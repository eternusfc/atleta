'use strict';
/* Página: Perfil */
window.Pages = window.Pages || {};
Pages.prof = app => {
  const s = pageShell('Perfil', 'Seus dados alimentam o cálculo de gasto calórico diário.');
  s.body.innerHTML = `<div class="two" style="margin-top:0">
    <div class="card pad">
      <div class="row">${fld('Nome', inp('name', '', 'class="w20"'))}${fld('Posição', sel('position', POSITIONS, POSITIONS[0]))}</div>
      <div class="row">${fld('Sexo', sel('sex', ['Masculino', 'Feminino'], 'Masculino'))}${fld('Nascimento', '<input type="date" name="birth">')}</div>
      <div class="row">${fld('Altura (cm)', inp('height', '', 'class="w8" inputmode="decimal"'))}${fld('Peso (kg)', inp('weight', '', 'class="w8" inputmode="decimal"'))}${fld('% gordura (opcional)', inp('bodyfat', '', 'class="w10" inputmode="decimal"'))}</div>
      <div class="row">${fld('Nível de atividade fora do treino (NEAT)', sel('neat', Object.keys(NEAT_LEVELS), Object.keys(NEAT_LEVELS)[1]), 'grow')}</div>
      <div class="row">${fld('Objetivo', sel('goal', Object.keys(GOALS), Object.keys(GOALS)[0]))}</div>
      <div class="btns" style="margin-top:10px">${btn('Salvar perfil', 'save')}</div>
      <p class="muted sm" style="margin-top:10px">Dica: informar o % de gordura usa a fórmula Katch-McArdle, mais precisa para atletas. Sem ele usamos Mifflin-St Jeor.</p>
    </div>
    <div class="card pad">
      <h3>Seu gasto energético</h3>
      <div data-x="res"></div>
      <div class="row" style="margin-top:16px;align-items:center">
        <span class="muted">Registrar peso de hoje (kg):</span>
        <input name="wlog" class="w6" inputmode="decimal">${btn('Registrar', 'logw', 'ghost')}
      </div>
      <h3>Dados e backup</h3>
      <p class="muted sm">Os dados ficam salvos neste navegador (IndexedDB). Use os botões de exportar/importar na lateral para backup em JSON.</p>
      <div class="btns">${btn('Apagar todos os dados', 'wipe', 'danger')}</div>
    </div></div>`;
  const root = s.body;

  bindActions(root, {
    async save() {
      let birth = val(root, 'birth'), height, weight, bf;
      try {
        height = num(val(root, 'height')); weight = num(val(root, 'weight'));
        bf = num(val(root, 'bodyfat'), 0) || null;
        if (!birth || height < 100 || height > 230 || weight < 30 || weight > 200) throw new Error();
        if (bf !== null && !(bf >= 3 && bf <= 60)) throw new Error();
      } catch { return info('Verifique os campos: nascimento, altura em cm, peso em kg e % de gordura (3–60).'); }
      await DB.saveProfile({ name: val(root, 'name').trim(), position: val(root, 'position'), sex: val(root, 'sex'),
        birth, height, weight, bodyfat: bf, neat: val(root, 'neat'), goal: val(root, 'goal') });
      await refresh(); info('Perfil salvo!');
    },
    async logw() {
      let w;
      try { w = num(val(root, 'wlog')); if (!(w >= 30 && w <= 200)) throw 0; } catch { return info('Peso inválido.'); }
      if (!await DB.getProfile()) return info('Salve o perfil primeiro.');
      await DB.logWeight(todayISO(), w);
      setv(root, 'wlog', ''); await refresh();
    },
    async wipe() {
      if (!confirm('Apagar TODOS os dados deste navegador? Isso não pode ser desfeito.\n\nExporte um backup antes se quiser guardá-los.')) return;
      await DB.resetAll(); await DB.seed(); toast('Dados apagados.'); await refresh();
    },
  });

  async function refresh() {
    const p = await DB.getProfile(), res = q(root, '[data-x="res"]');
    if (p) {
      setv(root, 'name', p.name || ''); setv(root, 'position', p.position || POSITIONS[0]); setv(root, 'sex', p.sex);
      setv(root, 'birth', p.birth); setv(root, 'height', g(p.height, 2)); setv(root, 'weight', g(p.weight, 2));
      setv(root, 'bodyfat', p.bodyfat ? g(p.bodyfat, 2) : ''); setv(root, 'neat', p.neat); setv(root, 'goal', p.goal);
    }
    if (!p) { res.innerHTML = '<p class="muted">Preencha e salve seu perfil para ver os cálculos.</p>'; return; }
    const e = energy(p, 0), et = energy(p, await app.eatKcal(todayISO()));
    const lines = [
      [`TMB (${e.formula}, ${e.age} anos)`, e.tmb, ''], ['+ NEAT (atividade fora do treino)', e.neat, ''],
      ['+ TEF (efeito térmico ≈10%)', e.tef, ''], ['= Gasto em dia sem treino', e.tdee, 'warn'],
      ['Treino de hoje (EAT)', et.eat, ''], ['= Gasto total de hoje', et.tdee, 'warn'],
      [`Meta calórica de hoje (${esc(p.goal)})`, et.target, 'accent2'],
    ];
    res.innerHTML = lines.map(([t, v, c]) => {
      const bold = t.startsWith('=') || t.startsWith('Meta');
      return `<div class="between" style="padding:2px 0"><span class="${bold ? '' : 'muted'}" style="${bold ? 'font-weight:700' : ''}">${t}</span><b style="color:${c ? `var(--${c})` : 'inherit'}">${v.toFixed(0)} kcal</b></div>`;
    }).join('') + `<hr style="border:0;border-top:1px solid var(--line);margin:10px 0">
      <div class="muted">Macros sugeridos (hoje)</div>
      <b>Proteína ${et.prot.toFixed(0)} g • Carboidrato ${et.carb.toFixed(0)} g • Gordura ${et.fat.toFixed(0)} g</b>
      <div class="muted sm">(2 g/kg proteína, 0,9 g/kg gordura, o restante em carboidrato)</div>`;
  }
  return { el: s.el, refresh };
};
