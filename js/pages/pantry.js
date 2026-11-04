'use strict';
/* Página: Meus alimentos e refeições modelo */
window.Pages = window.Pages || {};
Pages.pantry = app => {
  const s = pageShell('Meus alimentos e refeições', 'Cadastre seus alimentos (valores por 100 g) e monte refeições modelo para lançar com um clique.');
  const K = ['kcal', 'prot', 'carb', 'fat'];

  /* ---- aba alimentos ---- */
  const a = h(`<div>
    <div class="row">${fld('Nome do alimento', inp('f_name', '', 'class="w20"'))}
      ${[['f_kcal', 'kcal /100 g'], ['f_prot', 'Prot (g)'], ['f_carb', 'Carb (g)'], ['f_fat', 'Gord (g)']].map(([k, t]) => fld(t, inp(k, '', 'class="w8" inputmode="decimal"'))).join('')}
      <div class="btns">${btn('Salvar', 'saveFood')}${btn('Novo', 'newFood', 'ghost')}${btn('Excluir', 'delFood', 'danger')}</div></div>
    <div class="row">${fld('Buscar', inp('f_search', '', 'class="w20"'))}
      <span class="muted sm" style="padding-bottom:12px">Se deixar kcal em branco, calculamos pelos macros. Clique num alimento para editar.</span></div>
    <div data-x="ftable" style="margin-top:8px"></div></div>`);
  const ftable = mkTable([['Alimento'], ['kcal', 'r'], ['Prot (g)', 'r'], ['Carb (g)', 'r'], ['Gord (g)', 'r']], {
    onSelect: id => pickFood(Number(id)), empty: 'Nenhum alimento.' });
  q(a, '[data-x="ftable"]').appendChild(ftable.el);

  /* ---- aba modelos ---- */
  const t = h(`<div class="two" style="margin-top:0">
    <div><h3>Modelos</h3>
      <div class="row">${fld('Nome (ex: Café padrão)', inp('t_name', '', 'class="w14"'))}${fld('Refeição', sel('t_meal', MEALS, MEALS[0]))}</div>
      <div class="btns">${btn('Criar modelo', 'newTpl')}${btn('Excluir modelo', 'delTpl', 'danger')}</div>
      <div data-x="ttable" style="margin-top:6px"></div></div>
    <div><h3 data-x="ttitle">Selecione ou crie um modelo</h3>
      <div class="row">${fld('Alimento', '<select name="i_food"></select>', 'grow')}${fld('Qtd (g)', inp('i_qty', '100', 'class="w6" inputmode="decimal"'))}
        <div class="btns">${btn('+ Adicionar item', 'addItem', 'ghost')}</div></div>
      <div data-x="itable"></div>
      <div class="between" style="margin-top:8px;align-items:center">${btn('Remover item', 'delItem', 'danger')}<b data-x="tot" style="color:var(--accent2)"></b></div></div></div>`);
  const ttable = mkTable([['Modelo'], ['Refeição'], ['kcal', 'r']], { onSelect: id => { curTid = Number(id); refreshItems(); }, empty: 'Nenhum modelo.' });
  const itable = mkTable([['Alimento'], ['Qtd (g)', 'r'], ['kcal', 'r'], ['P', 'r'], ['C', 'r'], ['G', 'r']], { empty: 'Sem itens.' });
  q(t, '[data-x="ttable"]').appendChild(ttable.el); q(t, '[data-x="itable"]').appendChild(itable.el);

  const tabs = mkTabs([['🥫 Alimentos', a], ['🍱 Refeições modelo', t]]);
  s.body.appendChild(tabs.el);
  let selFood = null, curTid = null, foods = new Map();

  async function pickFood(id) {
    const r = await DB.get('foods', id); if (!r) return;
    selFood = r.id; setv(a, 'f_name', r.name); K.forEach(k => setv(a, 'f_' + k, r[k].toFixed(1)));
  }
  const clearFood = () => { selFood = null; ['name', ...K].forEach(k => setv(a, 'f_' + k, '')); };

  F(a, 'f_search').addEventListener('input', () => refreshFoods());
  async function refreshFoods() {
    foods = new Map((await DB.all('foods')).sort((x, y) => x.name.localeCompare(y.name, 'pt')).map(f => [f.name, f]));
    F(t, 'i_food').innerHTML = [...foods.keys()].map(n => `<option>${esc(n)}</option>`).join('');
    const term = val(a, 'f_search').trim().toLowerCase();
    ftable.set([...foods.values()].filter(r => r.name.toLowerCase().includes(term)).map(r => ({
      id: r.id, cells: [esc(r.name), r.kcal.toFixed(0), r.prot.toFixed(1), r.carb.toFixed(1), r.fat.toFixed(1)] })));
  }
  async function refreshTemplates() {
    const tpls = (await DB.all('meal_templates')).sort((x, y) => x.name.localeCompare(y.name, 'pt'));
    const items = await DB.all('template_items');
    ttable.set(tpls.map(r => ({ id: r.id, cells: [esc(r.name), esc(r.meal || '-'),
      items.filter(i => i.template_id === r.id).reduce((s2, i) => s2 + i.kcal, 0).toFixed(0)] })));
    if (!tpls.some(r => r.id === curTid)) { curTid = null; q(t, '[data-x="ttitle"]').textContent = 'Selecione ou crie um modelo'; }
    else ttable.select(curTid);
    await refreshItems();
  }
  async function refreshItems() {
    const tot = q(t, '[data-x="tot"]');
    if (!curTid) { itable.set([]); tot.textContent = ''; return; }
    const tp = await DB.get('meal_templates', curTid); if (!tp) return;
    q(t, '[data-x="ttitle"]').textContent = `${tp.name}  (${tp.meal || '-'})`;
    const items = (await DB.where('template_items', 'template_id', curTid)).sort((x, y) => x.id - y.id);
    itable.set(items.map(r => ({ id: r.id, cells: [esc(r.food), r.qty.toFixed(0), r.kcal.toFixed(0), r.prot.toFixed(1), r.carb.toFixed(1), r.fat.toFixed(1)] })));
    const sum = k => items.reduce((x, i) => x + i[k], 0);
    tot.textContent = `Total: ${sum('kcal').toFixed(0)} kcal • P ${sum('prot').toFixed(0)} • C ${sum('carb').toFixed(0)} • G ${sum('fat').toFixed(0)}`;
  }

  bindActions(s.body, {
    async saveFood() {
      const name = val(a, 'f_name').trim(); let kc, pr, cb, ft;
      try { [kc, pr, cb, ft] = K.map(k => num(val(a, 'f_' + k))); } catch { return info('Use apenas números nos valores nutricionais.'); }
      if (!name) return info('Informe o nome do alimento.');
      if (kc <= 0) kc = pr * 4 + cb * 4 + ft * 9;
      const dup = foods.get(name);
      if (selFood) {
        if (dup && dup.id !== selFood) return info('Já existe um alimento com esse nome.');
        await DB.put('foods', { id: selFood, name, kcal: kc, prot: pr, carb: cb, fat: ft });
      } else await DB.upsertFood({ name, kcal: kc, prot: pr, carb: cb, fat: ft });
      clearFood(); await refreshFoods();
    },
    newFood: () => clearFood(),
    async delFood() {
      if (!selFood) return info('Clique em um alimento da lista para excluir.');
      if (confirm('Excluir este alimento da sua lista?\n(Registros já lançados não mudam.)')) { await DB.del('foods', selFood); clearFood(); await refreshFoods(); }
    },
    async newTpl() {
      const name = val(t, 't_name').trim(); if (!name) return info('Dê um nome ao modelo.');
      if ((await DB.all('meal_templates')).some(x => x.name === name)) return info('Já existe um modelo com esse nome.');
      curTid = await DB.createTemplate(name, val(t, 't_meal'), []);
      setv(t, 't_name', ''); await refreshTemplates();
    },
    async delTpl() {
      if (curTid && confirm('Excluir este modelo e seus itens?')) { await DB.deleteTemplate(curTid); curTid = null; await refreshTemplates(); }
    },
    async addItem() {
      if (!curTid) return info('Crie ou selecione um modelo primeiro.');
      const f = foods.get(val(t, 'i_food')); let qty = 0;
      try { qty = num(val(t, 'i_qty')); } catch {}
      if (!f || qty <= 0) return info('Escolha um alimento cadastrado e informe a quantidade em gramas.');
      const k = qty / 100;
      await DB.add('template_items', { template_id: curTid, food: f.name, qty, kcal: f.kcal * k, prot: f.prot * k, carb: f.carb * k, fat: f.fat * k });
      await refreshTemplates();
    },
    async delItem() { const id = itable.selected(); if (id != null) { await DB.del('template_items', id); await refreshTemplates(); } },
  });

  return { el: s.el, async refresh() { await refreshFoods(); await refreshTemplates(); } };
};
