'use strict';
/* Página: Treinos (Academia, Cardio, Futsal, Mobilidade) */
window.Pages = window.Pages || {};
Pages.train = app => {
  const s = pageShell('Treinos', 'Academia, cardio e futsal em um só lugar.');
  const nav = dayNav(() => refresh()); s.head.appendChild(nav.el);
  const kcalFld = n => fld('Calorias gastas (kcal)', inp(n, '', 'class="w8" inputmode="decimal"')) + '<span class="muted sm" style="padding-bottom:12px">(vazio = estimativa)</span>';

  /* ---------- abas ---------- */
  const gym = h(`<div>
    <div class="row">${fld('Treino (ex: Peito/Tríceps)', inp('g_title', '', 'class="w20"'))}${fld('Duração (min)', inp('g_dur', '', 'class="w8" inputmode="decimal"'))}
      ${fld('RPE (1–10)', sel('g_rpe', RPE, '7'))}${kcalFld('g_kcal')}</div>
    <hr style="border:0;border-top:1px solid var(--line);margin:8px 0">
    <div class="row">${fld('Exercício', '<input name="g_ex" list="exlist" autocomplete="off"><datalist id="exlist"></datalist>', 'grow')}
      ${fld('Séries', inp('g_series', '3', 'class="w6" inputmode="numeric"'))}${fld('Reps', inp('g_reps', '', 'class="w6" inputmode="numeric"'))}
      ${fld('Carga (kg)', inp('g_load', '', 'class="w8" inputmode="decimal"'))}<div class="btns">${btn('+ Adicionar', 'gymAdd', 'ghost')}</div></div>
    <div data-x="gtable" style="margin:8px 0"></div>
    <div class="btns">${btn('Salvar treino', 'gymSave')}${btn('Remover série', 'gymRemove', 'ghost')}${btn('Limpar', 'gymClear', 'ghost')}</div></div>`);
  const gtable = mkTable([['Exercício'], ['Série', 'c'], ['Reps', 'r'], ['Carga (kg)', 'r']], { empty: 'Nenhuma série adicionada.' });
  q(gym, '[data-x="gtable"]').appendChild(gtable.el);

  const cardio = h(`<div>
    <div class="row">${fld('Modalidade', sel('c_mod', CARDIO_MODES, 'Corrida'))}${fld('Tipo', sel('c_mode', ['Contínuo', 'HIIT'], 'Contínuo'))}
      ${fld('RPE (1–10)', sel('c_rpe', RPE, '7'))}${kcalFld('c_kcal')}</div>
    <div class="row" data-x="cbox">${fld('Distância (km)', inp('c_dist', '', 'class="w8" inputmode="decimal"'))}${fld('Duração (min)', inp('c_dur', '', 'class="w8" inputmode="decimal"'))}
      <b data-x="pace" style="color:var(--accent2);padding-bottom:12px">Pace: -</b></div>
    <div class="hidden" data-x="hiit"><div class="muted" style="margin-top:8px">Intervalado (HIIT)</div>
      <div class="row">${fld('Rounds', inp('c_rounds', '8', 'class="w6"'))}${fld('Esforço (seg)', inp('c_work', '30', 'class="w8"'))}${fld('Descanso (seg)', inp('c_rest', '30', 'class="w8"'))}</div></div>
    <div class="row">${fld('Observações (velocidade do tiro, FC, etc.)', inp('c_notes'), 'grow')}</div>
    <div class="btns" style="margin-top:8px">${btn('Salvar cardio', 'cardioSave')}</div></div>`);

  const fut = h(`<div>
    <div class="row">${fld('Tipo de treino', sel('f_focus', FOOTBALL_FOCUS, 'Técnico'))}${fld('Duração (min)', inp('f_dur', '60', 'class="w8" inputmode="decimal"'))}
      ${fld('RPE (1–10)', sel('f_rpe', RPE, '7'))}${kcalFld('f_kcal')}</div>
    <div class="hidden" data-x="game"><div class="muted" style="margin-top:8px">Dia de jogo</div>
      <div class="row">${fld('Adversário', inp('f_opp', '', 'class="w14"'))}${fld('Placar (ex: 2x1)', inp('f_res', '', 'class="w8"'))}
        ${fld('Min. jogados', inp('f_min', '', 'class="w8"'))}${fld('Gols', inp('f_goals', '', 'class="w6"'))}${fld('Assist.', inp('f_assists', '', 'class="w6"'))}</div></div>
    <div class="row">${fld('Observações (o que trabalhou, pontos a melhorar...)', inp('f_notes'), 'grow')}</div>
    <div class="btns" style="margin-top:8px">${btn('Salvar treino de futsal', 'futSave')}</div></div>`);

  const mob = h(`<div>
    <div class="row">${fld('Método', sel('m_method', MOBILITY_METHODS, MOBILITY_METHODS[0]))}${fld('Duração (min)', inp('m_dur', '20', 'class="w8" inputmode="decimal"'))}</div>
    <div class="muted sm" style="margin:8px 0 2px">Regiões trabalhadas</div>
    <div class="checks">${MOBILITY_AREAS.map(x => `<label class="check"><input type="checkbox" data-area="${esc(x)}"> ${esc(x)}</label>`).join('')}</div>
    <div class="row" style="margin-top:8px">${fld('Exercícios / observações (ex: 90/90, agachamento profundo...)', inp('m_notes'), 'grow')}</div>
    <p class="muted sm">Mobilidade não entra no cálculo de gasto calórico.</p>
    <div class="btns">${btn('Salvar mobilidade', 'mobSave')}</div></div>`);

  const tabs = mkTabs([['🏋 Academia', gym], ['🏃 Cardio', cardio], ['⚽ Futsal', fut], ['🧘 Mobilidade', mob]]);

  /* ---------- painel lateral ---------- */
  const side = h(`<div class="card pad">
    <h3>Planejado para o dia</h3><p class="muted sm pre" data-x="plan"></p>
    <div class="btns">${btn('Preencher registro com o planejado', 'fillPlan', 'ghost')}</div>
    <h3>Treinos do dia</h3><div data-x="dtable"></div>
    <b data-x="total" style="color:var(--accent2);display:block;margin-top:6px;white-space:pre-line"></b>
    <p class="muted sm pre" data-x="info" style="margin-top:6px"></p>
    <div class="between" style="margin-top:6px"><span class="btns">${btn('Alterar kcal', 'editKcal', 'ghost')}</span>${btn('Remover selecionado', 'del', 'danger')}</div></div>`);
  const dtable = mkTable([['Tipo'], ['Descrição'], ['Min', 'r'], ['kcal', 'r']], { onSelect: id => showDetail(Number(id)), empty: 'Nenhum treino neste dia.' });
  q(side, '[data-x="dtable"]').appendChild(dtable.el);

  const layout = h('<div class="split wide"><div data-x="left"></div><div data-x="right"></div></div>');
  q(layout, '[data-x="left"]').appendChild(tabs.el); q(layout, '[data-x="right"]').appendChild(side);
  s.body.appendChild(layout);
  const X = n => q(side, `[data-x="${n}"]`);

  /* ---------- helpers ---------- */
  let gymSets = [];
  const readKcal = n => { const t = val(s.body, n).trim(); if (!t) return null; const v = num(t); if (v < 0) throw new Error('neg'); return v; };
  const BADKCAL = 'Calorias gastas inválidas. Use um número (ou deixe em branco para estimar).';

  function gymRedraw() {
    const cnt = {};
    gtable.set(gymSets.map((x, i) => { cnt[x.ex] = (cnt[x.ex] || 0) + 1; return { id: i, cells: [esc(x.ex), cnt[x.ex], x.reps, g(x.load, 2)] }; }));
  }
  function updatePace() {
    let t = 'Pace: -';
    try { const d = num(val(cardio, 'c_dist')), m = num(val(cardio, 'c_dur')); if (d > 0 && m > 0) t = `Pace: ${fmtPace(m * 60 / d)} /km`; } catch {}
    q(cardio, '[data-x="pace"]').textContent = t;
  }
  const toggleHiit = () => q(cardio, '[data-x="hiit"]').classList.toggle('hidden', val(cardio, 'c_mode') !== 'HIIT');
  function toggleGame() {
    const game = val(fut, 'f_focus') === 'Jogo';
    if (game && ['60', '90'].includes(val(fut, 'f_dur'))) setv(fut, 'f_dur', '40'); // 2 tempos de 20 min
    q(fut, '[data-x="game"]').classList.toggle('hidden', !game);
  }
  F(cardio, 'c_dist').addEventListener('input', updatePace); F(cardio, 'c_dur').addEventListener('input', updatePace);
  F(cardio, 'c_mode').addEventListener('change', toggleHiit); F(fut, 'f_focus').addEventListener('change', toggleGame);

  /* ---------- ações ---------- */
  const actions = {
    gymAdd() {
      const ex = val(gym, 'g_ex').trim(); let n, reps, load;
      try { n = Math.trunc(num(val(gym, 'g_series'), 1)); reps = Math.trunc(num(val(gym, 'g_reps'))); load = num(val(gym, 'g_load')); } catch { n = 0; }
      if (!ex || !(n >= 1) || !(reps >= 1) || !(load >= 0)) return info('Informe exercício, séries, repetições e carga.');
      for (let i = 0; i < n; i++) gymSets.push({ ex, reps, load });
      gymRedraw();
    },
    gymRemove() { const i = gtable.selected(); if (i != null) { gymSets.splice(i, 1); gymRedraw(); } },
    gymClear() { gymSets = []; gymRedraw(); },
    async gymSave() {
      if (!gymSets.length) return info('Adicione ao menos uma série.');
      let dur, manual;
      try { dur = num(val(gym, 'g_dur'), 60); } catch { return info('Duração inválida.'); }
      try { manual = readKcal('g_kcal'); } catch { return info(BADKCAL); }
      const kcal = manual ?? kcalFromMet(5.0, await app.weight(), dur), cnt = {};
      await DB.saveWorkout({ date: nav.iso(), kind: 'Academia', title: val(gym, 'g_title').trim() || 'Treino de força', duration: dur,
        rpe: Number(val(gym, 'g_rpe')) || 0, kcal, notes: '' },
        gymSets.map(x => { cnt[x.ex] = (cnt[x.ex] || 0) + 1; return ['gym_sets', { exercise: x.ex, set_no: cnt[x.ex], reps: x.reps, load: x.load }]; }));
      gymSets = []; gymRedraw(); setv(gym, 'g_title', ''); setv(gym, 'g_kcal', ''); await refresh();
    },
    async cardioSave() {
      const mode = val(cardio, 'c_mode'), mod = val(cardio, 'c_mod'); let dist, dur, rounds, work, rest;
      try { dist = num(val(cardio, 'c_dist')); dur = num(val(cardio, 'c_dur')); rounds = Math.trunc(num(val(cardio, 'c_rounds'))); work = Math.trunc(num(val(cardio, 'c_work'))); rest = Math.trunc(num(val(cardio, 'c_rest'))); }
      catch { return info('Use apenas números nos campos numéricos.'); }
      if (mode === 'HIIT' && dur <= 0) dur = rounds * (work + rest) / 60;
      if (dur <= 0) return info('Informe a duração.');
      const pace = dist > 0 ? dur * 60 / dist : null; let met, title;
      if (mode === 'HIIT') { met = 10; title = `HIIT ${mod} ${rounds}x${work}s/${rest}s`; }
      else {
        const speed = dist > 0 ? dist / (dur / 60) : 0;
        met = { Corrida: Math.max(6, speed), Esteira: Math.max(6, speed), Bike: 7.5, 'Natação': 7, Caminhada: 3.8, 'Elíptico': 5 }[mod] ?? 6;
        title = dist > 0 ? `${mod} ${g(dist, 2)} km` : mod;
      }
      let manual; try { manual = readKcal('c_kcal'); } catch { return info(BADKCAL); }
      const kcal = manual ?? kcalFromMet(met, await app.weight(), dur), hi = mode === 'HIIT';
      await DB.saveWorkout({ date: nav.iso(), kind: 'Cardio', title, duration: dur, rpe: Number(val(cardio, 'c_rpe')) || 0, kcal, notes: val(cardio, 'c_notes').trim() },
        [['cardio', { modality: mod, mode, distance: dist, pace, rounds: hi ? rounds : null, work_s: hi ? work : null, rest_s: hi ? rest : null }]]);
      ['c_dist', 'c_dur', 'c_notes', 'c_kcal'].forEach(n => setv(cardio, n, '')); updatePace(); await refresh();
    },
    async futSave() {
      const focus = val(fut, 'f_focus'), game = focus === 'Jogo'; let dur, mins = null, goals = null, assists = null;
      try {
        dur = num(val(fut, 'f_dur'), 0); if (dur <= 0) throw 0;
        if (game) { mins = Math.trunc(num(val(fut, 'f_min'), dur)); goals = Math.trunc(num(val(fut, 'f_goals'), 0)); assists = Math.trunc(num(val(fut, 'f_assists'), 0)); }
      } catch { return info('Verifique os números informados (duração, minutos, gols, assistências).'); }
      const opp = game ? val(fut, 'f_opp').trim() : null, res = game ? val(fut, 'f_res').trim() : null;
      const title = game ? (opp ? `Jogo vs ${opp}` : 'Jogo') : `Treino ${focus.toLowerCase()}`;
      let manual; try { manual = readKcal('f_kcal'); } catch { return info(BADKCAL); }
      const kcal = manual ?? kcalFromMet(FOOTBALL_MET[focus], await app.weight(), game && mins ? mins : dur);
      await DB.saveWorkout({ date: nav.iso(), kind: 'Futsal', title, duration: dur, rpe: Number(val(fut, 'f_rpe')) || 0, kcal, notes: val(fut, 'f_notes').trim() },
        [['football', { focus, opponent: opp, result: res, minutes: mins, goals, assists }]]);
      ['f_opp', 'f_res', 'f_min', 'f_goals', 'f_assists', 'f_notes', 'f_kcal'].forEach(n => setv(fut, n, '')); await refresh();
    },
    async mobSave() {
      let dur; try { dur = num(val(mob, 'm_dur')); if (dur <= 0) throw 0; } catch { return info('Informe a duração em minutos.'); }
      const areas = qa(mob, '[data-area]').filter(c => c.checked).map(c => c.dataset.area);
      await DB.saveWorkout({ date: nav.iso(), kind: 'Mobilidade', title: 'Mobilidade' + (areas.length ? ': ' + areas.join(', ') : ''), duration: dur, rpe: 0, kcal: 0, notes: val(mob, 'm_notes').trim() },
        [['mobility', { method: val(mob, 'm_method'), areas: areas.join(', ') }]]);
      qa(mob, '[data-area]').forEach(c => c.checked = false); setv(mob, 'm_notes', ''); await refresh();
    },
    async editKcal() {
      const id = dtable.selected(); if (id == null) return info('Clique em um treino da lista para alterar as calorias.');
      const w = await DB.get('workouts', id);
      if (w.kind === 'Mobilidade') return info('Mobilidade não entra no cálculo de gasto calórico.');
      const txt = prompt('Calorias gastas neste treino (kcal):', w.kcal.toFixed(0)); if (txt === null) return;
      let v; try { v = num(txt); if (v < 0) throw 0; } catch { return info('Valor inválido.'); }
      await DB.put('workouts', { ...w, kcal: v }); await refresh();
    },
    async del() {
      const id = dtable.selected();
      if (id != null && confirm('Remover este treino?')) { await DB.deleteWorkout(id); await refresh(); }
    },
    async fillPlan() {
      const rows = (await app.planned(nav.iso())).filter(r => r.kind !== 'Descanso');
      if (!rows.length) return info('Não há treino planejado para este dia.');
      const r = rows[0], title = r.title || '';
      if (r.kind === 'Academia') { tabs.select(0); setv(gym, 'g_title', title); }
      else if (r.kind === 'Cardio') { tabs.select(1); setv(cardio, 'c_notes', title); if (/hiit/i.test(title)) { setv(cardio, 'c_mode', 'HIIT'); toggleHiit(); } }
      else if (r.kind === 'Mobilidade') { tabs.select(3); setv(mob, 'm_notes', title); }
      else { tabs.select(2); if (FOOTBALL_FOCUS.includes(title)) { setv(fut, 'f_focus', title); toggleGame(); } else setv(fut, 'f_notes', title); }
    },
  };
  bindActions(s.body, actions);

  async function showDetail(id) {
    const w = await DB.get('workouts', id); if (!w) return;
    const lines = w.rpe ? [`RPE ${w.rpe}`] : [];
    if (w.kind === 'Academia') {
      const agg = {};
      (await DB.where('gym_sets', 'workout_id', id)).sort((a, b) => a.id - b.id).forEach(x => (agg[x.exercise] = agg[x.exercise] || []).push(`${x.reps}×${g(x.load, 2)}kg`));
      lines.push(...Object.entries(agg).map(([ex, v]) => `${ex}: ${v.join(', ')}`));
    } else if (w.kind === 'Cardio') {
      const c = await DB.get('cardio', id);
      if (c && c.pace) lines.push(`Pace ${fmtPace(c.pace)}/km`);
      if (c && c.mode === 'HIIT') lines.push(`HIIT ${c.rounds}×(${c.work_s}s/${c.rest_s}s)`);
    } else if (w.kind === 'Mobilidade') {
      const m = await DB.get('mobility', id);
      if (m) lines.push(m.method + (m.areas ? ` • ${m.areas}` : '')); lines.push('Sem gasto calórico.');
    } else {
      const f = await DB.get('football', id);
      if (f && f.focus === 'Jogo') lines.push(`Placar ${f.result || '-'} • ${f.minutes} min • ${f.goals} gol(s) • ${f.assists} assist.`);
    }
    if (w.notes) lines.push(`Obs: ${w.notes}`);
    X('info').textContent = lines.join('\n');
  }

  async function refresh() {
    const iso = nav.iso();
    const ex = [...new Set([...DEFAULT_EXERCISES, ...(await DB.all('gym_sets')).map(x => x.exercise)])].sort((a, b) => a.localeCompare(b, 'pt'));
    q(gym, '#exlist').innerHTML = ex.map(e => `<option value="${esc(e)}">`).join('');
    const ws = (await DB.where('workouts', 'date', iso)).sort((a, b) => a.id - b.id);
    dtable.set(ws.map(w => ({ id: w.id, cells: [esc(w.kind), esc(w.title || ''), w.duration.toFixed(0), w.kind === 'Mobilidade' ? '-' : w.kcal.toFixed(0)] })));
    X('info').textContent = '';
    X('plan').textContent = await app.planText(iso);
    const tot = await app.eatKcal(iso);
    X('total').textContent = tot ? `Gasto nos treinos: ${tot.toFixed(0)} kcal\n(somado ao gasto calórico do dia)` : '';
  }
  toggleHiit(); toggleGame();
  return { el: s.el, refresh };
};
