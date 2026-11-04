'use strict';
/* Página: Alimentação */
window.Pages = window.Pages || {};
Pages.food = app => {
  const s = pageShell('Alimentação', 'Registre o que você comeu e acompanhe calorias e macros.');
  const nav = dayNav(() => refresh()); s.head.appendChild(nav.el);
  const macros = [['kcal', 'Calorias', 'var(--accent)'], ['prot', 'Proteína', 'var(--blue)'],
    ['carb', 'Carboidrato', 'var(--warn)'], ['fat', 'Gordura', 'var(--violet)']];
  s.body.innerHTML = `<div class="split">
    <div class="col">
      <div class="card pad">
        <div class="row">
          ${fld('Refeição', sel('meal', MEALS, MEALS[0]))}
          ${fld('Alimento (escolha ou digite)', '<input name="food" list="foodlist" autocomplete="off"><datalist id="foodlist"></datalist>', 'grow')}
          ${fld('Qtd (g)', inp('qty', '100', 'class="w6" inputmode="decimal"'))}
        </div>
        <div class="row">
          ${[['kcal', 'Calorias'], ['prot', 'Prot (g)'], ['carb', 'Carb (g)'], ['fat', 'Gord (g)']].map(([k, t]) => fld(t, inp(k, '', 'class="w8" inputmode="decimal"'))).join('')}
          <div class="btns">${btn('Adicionar', 'add')}${btn('Salvar como alimento', 'saveFood', 'ghost')}</div>
        </div>
        <div class="row">
          ${fld('Refeição modelo', '<select name="tpl"></select>', 'grow')}
          <div class="btns">${btn('Adicionar modelo ao dia', 'addTpl', 'ghost')}${btn('Salvar refeição do dia como modelo', 'saveTpl', 'ghost')}</div>
        </div>
      </div>
      <div data-x="table"></div>
      <div class="btns" style="justify-content:flex-end">${btn('Remover selecionado', 'del', 'danger')}</div>
    </div>
    <div class="card pad">
      <h3>Resumo do dia</h3>
      ${macros.map(([k, t, c]) => `<div class="mrow"><div class="between"><span>${t}</span><span class="muted sm" data-m="${k}"></span></div><div class="bar"><i data-b="${k}" data-c="${c}"></i></div></div>`).join('')}
      <p class="muted pre" data-x="bal" style="margin-top:14px"></p>
    </div></div>`;
  const root = s.body, X = n => q(root, `[data-x="${n}"]`);
  const table = mkTable([['Refeição'], ['Alimento'], ['Qtd (g)', 'r'], ['kcal', 'r'], ['P', 'r'], ['C', 'r'], ['G', 'r']], { empty: 'Nada lançado neste dia.' });
  X('table').appendChild(table.el);
  let foods = new Map(), templates = new Map();
  const MK = ['kcal', 'prot', 'carb', 'fat'];

  async function loadLists() {
    foods = new Map((await DB.all('foods')).sort((a, b) => a.name.localeCompare(b.name, 'pt')).map(f => [f.name, f]));
    q(root, '#foodlist').innerHTML = [...foods.keys()].map(n => `<option value="${esc(n)}">`).join('');
    templates = new Map((await DB.all('meal_templates')).sort((a, b) => a.name.localeCompare(b.name, 'pt')).map(t => [t.name, t]));
    const cur = val(root, 'tpl');
    F(root, 'tpl').innerHTML = '<option value=""></option>' + [...templates.keys()].map(n => `<option${n === cur ? ' selected' : ''}>${esc(n)}</option>`).join('');
  }
  function autofill() {
    const f = foods.get(val(root, 'food')); if (!f) return;
    let qty; try { qty = num(val(root, 'qty')); } catch { return; }
    MK.forEach(k => setv(root, k, (f[k] * qty / 100).toFixed(1)));
  }
  ['food', 'qty'].forEach(n => { F(root, n).addEventListener('input', autofill); F(root, n).addEventListener('change', autofill); });
  F(root, 'tpl').addEventListener('change', () => { const t = templates.get(val(root, 'tpl')); if (t && t.meal) setv(root, 'meal', t.meal); });

  const actions = {
    async add() {
      const name = val(root, 'food').trim();
      let qty, kc, pr, cb, ft;
      try { qty = num(val(root, 'qty')); [kc, pr, cb, ft] = MK.map(k => num(val(root, k))); }
      catch { return info('Use apenas números nos campos de quantidade e macros.'); }
      if (!name || (kc <= 0 && pr <= 0 && cb <= 0 && ft <= 0)) return info('Informe o alimento e seus valores nutricionais.');
      if (kc <= 0) kc = pr * 4 + cb * 4 + ft * 9;
      await DB.add('meals', { date: nav.iso(), meal: val(root, 'meal'), food: name, qty, kcal: kc, prot: pr, carb: cb, fat: ft });
      setv(root, 'food', ''); MK.forEach(k => setv(root, k, '')); await refresh();
    },
    async saveFood() {
      const name = val(root, 'food').trim(); let qty, vals;
      try { qty = num(val(root, 'qty')); vals = MK.map(k => num(val(root, k))); } catch { return; }
      if (!name || qty <= 0) return info('Informe nome, quantidade e valores para salvar o alimento.');
      const [kcal, prot, carb, fat] = vals.map(v => v * 100 / qty);
      await DB.upsertFood({ name, kcal, prot, carb, fat });
      await loadLists(); info(`'${name}' salvo na sua lista (valores por 100 g).`);
    },
    async addTpl() {
      const t = templates.get(val(root, 'tpl'));
      if (!t) return info("Escolha uma refeição modelo. Você pode criá-las em 'Meus alimentos'.");
      const items = (await DB.where('template_items', 'template_id', t.id)).sort((a, b) => a.id - b.id);
      if (!items.length) return info('Esse modelo ainda não tem itens.');
      for (const it of items) await DB.add('meals', { date: nav.iso(), meal: val(root, 'meal'), food: it.food, qty: it.qty, kcal: it.kcal, prot: it.prot, carb: it.carb, fat: it.fat });
      await refresh();
    },
    async saveTpl() {
      const iso = nav.iso(), meal = val(root, 'meal');
      const rows = (await DB.where('meals', 'date', iso)).filter(m => m.meal === meal).sort((a, b) => a.id - b.id);
      if (!rows.length) return info(`Não há itens lançados em '${meal}' neste dia para salvar.`);
      const name = (prompt(`Nome do modelo para '${meal}':`) || '').trim();
      if (!name) return;
      const old = (await DB.all('meal_templates')).find(t => t.name === name);
      if (old) { if (!confirm('Já existe um modelo com esse nome. Substituir?')) return; await DB.deleteTemplate(old.id); }
      await DB.createTemplate(name, meal, rows.map(r => ({ food: r.food, qty: r.qty, kcal: r.kcal, prot: r.prot, carb: r.carb, fat: r.fat })));
      await loadLists(); setv(root, 'tpl', name); info(`Modelo '${name}' salvo!`);
    },
    async del() { const id = table.selected(); if (id != null) { await DB.del('meals', id); await refresh(); } },
  };
  bindActions(root, actions);

  async function refresh() {
    await loadLists();
    const iso = nav.iso();
    const rows = (await DB.where('meals', 'date', iso)).sort((a, b) => a.id - b.id);
    table.set(rows.map(r => ({ id: r.id, cells: [esc(r.meal), esc(r.food), r.qty.toFixed(0), r.kcal.toFixed(0), r.prot.toFixed(1), r.carb.toFixed(1), r.fat.toFixed(1)] })));
    const tot = await app.dayTotals(iso), p = await DB.getProfile();
    const e = p ? energy(p, await app.eatKcal(iso)) : null;
    const tg = e ? { kcal: e.target, prot: e.prot, carb: e.carb, fat: e.fat } : { kcal: 1, prot: 1, carb: 1, fat: 1 };
    for (const k of MK) {
      const unit = k === 'kcal' ? 'kcal' : 'g';
      q(root, `[data-m="${k}"]`).textContent = e ? `${tot[k].toFixed(0)} / ${tg[k].toFixed(0)} ${unit}` : `${tot[k].toFixed(0)} ${unit}`;
      setBar(q(root, `[data-b="${k}"]`), tot[k], tg[k], !!e && tot[k] > tg[k] * 1.05);
    }
    if (e) {
      const diff = e.target - tot.kcal;
      X('bal').textContent = (diff >= 0 ? `Restam ${diff.toFixed(0)} kcal para a meta.` : `Passou ${(-diff).toFixed(0)} kcal da meta.`) +
        `\nGasto estimado do dia: ${e.tdee.toFixed(0)} kcal.\n(inclui +${e.eat.toFixed(0)} kcal de treinos)\nBalanço: ${(tot.kcal - e.tdee >= 0 ? '+' : '') + (tot.kcal - e.tdee).toFixed(0)} kcal.`;
    } else X('bal').textContent = 'Preencha o Perfil para ver sua meta.';
  }
  return { el: s.el, refresh };
};
