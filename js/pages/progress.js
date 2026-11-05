'use strict';
/* Página: Evolução (carga, pace, jogos, mobilidade) */
window.Pages = window.Pages || {};
Pages.prog = app => {
  const s = pageShell('Evolução', 'Acompanhe sua progressão de carga, pace e desempenho em jogos.');

  const gym = h(`<div><div class="row">${fld('Exercício', '<select name="ex"></select>', '')}<b data-x="sum" style="color:var(--accent2);padding-bottom:12px"></b></div>
    <div data-x="chart"></div><div data-x="table" style="margin-top:8px"></div></div>`);
  const gtable = mkTable([['Data', 'c'], ['Séries', 'r'], ['Maior carga (kg)', 'r'], ['Reps nela', 'r'], ['Volume (kg)', 'r'], ['1RM est. (kg)', 'r']], { empty: 'Sem registros' });
  q(gym, '[data-x="table"]').appendChild(gtable.el);

  const card = h(`<div><div class="row">${fld('Modalidade', sel('mod', CARDIO_MODES, 'Corrida'))}<b data-x="sum" style="color:var(--accent2);padding-bottom:12px"></b></div>
    <div data-x="chart"></div><div data-x="table" style="margin-top:8px"></div></div>`);
  const ctable = mkTable([['Data', 'c'], ['Tipo'], ['Dist. (km)', 'r'], ['Duração (min)', 'r'], ['Pace', 'r'], ['RPE', 'r']]);
  q(card, '[data-x="table"]').appendChild(ctable.el);

  const fut = h(`<div><b data-x="sum" style="color:var(--accent2);display:block;margin:4px 0"></b><p class="muted" data-x="cnt"></p><div data-x="table" style="margin-top:8px"></div></div>`);
  const ftable = mkTable([['Data', 'c'], ['Adversário'], ['Placar', 'c'], ['Minutos', 'r'], ['Gols', 'r'], ['Assist.', 'r'], ['RPE', 'r']], { empty: 'Nenhum jogo registrado.' });
  q(fut, '[data-x="table"]').appendChild(ftable.el);

  const mob = h(`<div><b data-x="sum" style="color:var(--accent2);display:block;margin:4px 0"></b><p class="muted" data-x="cnt"></p><div data-x="table" style="margin-top:8px"></div></div>`);
  const mtable = mkTable([['Data', 'c'], ['Método'], ['Regiões'], ['Min', 'r']], { empty: 'Nenhuma sessão registrada.' });
  q(mob, '[data-x="table"]').appendChild(mtable.el);

  const load = h(`<div><b data-x="sum" style="color:var(--accent2);display:block;margin:4px 0"></b>
    <p class="muted sm" data-x="note"></p><div data-x="chart"></div><div data-x="table" style="margin-top:8px"></div></div>`);
  const ltable = mkTable([['Semana (início)', 'c'], ['Treinos', 'r'], ['Minutos', 'r'], ['Carga (UA)', 'r'], ['vs. anterior', 'r']], { empty: 'Sem registros' });
  q(load, '[data-x="table"]').appendChild(ltable.el);
  const lchart = mkChart({ name: 'Carga semanal', color: '#E04F74', periods: [90, 180, 0], period: 0,
    fmt: v => v.toFixed(0) + ' UA', axisFmt: v => v.toFixed(0), fmtDelta: d => (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(0) + ' UA' });
  q(load, '[data-x="chart"]').appendChild(lchart.el);

  const gchart = mkChart({ name: 'Maior carga', color: '#E04F74', fmt: v => g(v, 2) + ' kg', axisFmt: v => v.toFixed(1),
    fmtDelta: d => (d >= 0 ? '+' : '−') + g(Math.abs(d), 2) + ' kg' });
  const cchart = mkChart({ name: 'Pace', color: '#F2F2F2', fmt: v => fmtPace(v) + '/km', axisFmt: v => fmtPace(v),
    fmtDelta: d => (d >= 0 ? '+' : '−') + fmtPace(Math.abs(d)) + '/km' });
  q(gym, '[data-x="chart"]').appendChild(gchart.el);
  q(card, '[data-x="chart"]').appendChild(cchart.el);

    s.body.appendChild(mkTabs([['🏋 Academia', gym], ['🏃 Cardio', card], ['⚽ Futsal', fut], ['🧘 Mobilidade', mob], ['📊 Carga semanal', load]]).el);
  F(gym, 'ex').addEventListener('change', () => drawGym());
  F(card, 'mod').addEventListener('change', () => drawCardio());
  const wmap = async () => new Map((await DB.all('workouts')).map(w => [w.id, w]));

  async function drawGym() {
    const ex = val(gym, 'ex'), W = await wmap();
    const by = new Map();
    (await DB.where('gym_sets', 'exercise', ex)).forEach(r => { const w = W.get(r.workout_id); if (!w) return; if (!by.has(w.date)) by.set(w.date, []); by.get(w.date).push(r); });
    const days = [...by.keys()].sort(), pts = [], rows = [];
    for (const d of days) {
      const sets = by.get(d), best = Math.max(...sets.map(x => x.load));
      const repsBest = Math.max(...sets.filter(x => x.load === best).map(x => x.reps));
      const vol = sets.reduce((a, x) => a + x.reps * x.load, 0), rm = Math.max(...sets.map(x => x.load * (1 + x.reps / 30)));
      pts.push([d, best, `${repsBest} reps • ${sets.length} ${sets.length === 1 ? 'série' : 'séries'} • 1RM est. ${rm.toFixed(1)} kg`]);
      rows.push({ cells: [fmtD(d), sets.length, g(best, 2), repsBest, vol.toFixed(0), rm.toFixed(1)] });
    }
    gchart.set(pts);
    gtable.set(rows.reverse());
    q(gym, '[data-x="sum"]').textContent = pts.length >= 2 ? `Progressão: ${g(pts[0][1], 2)} → ${g(pts.at(-1)[1], 2)} kg (${pts.at(-1)[1] - pts[0][1] >= 0 ? '+' : ''}${g(pts.at(-1)[1] - pts[0][1], 2)} kg)` : '';
  }
  async function drawCardio() {
    const mod = val(card, 'mod'), W = await wmap();
    const rows = (await DB.where('cardio', 'modality', mod)).map(c => ({ ...c, w: W.get(c.workout_id) })).filter(r => r.w)
      .sort((a, b) => a.w.date.localeCompare(b.w.date) || a.workout_id - b.workout_id);
    const pts = rows.filter(r => r.pace && r.mode !== 'HIIT').map(r => [r.w.date, r.pace, `${g(r.distance, 2)} km • ${r.w.duration.toFixed(0)} min`]);
    cchart.set(pts);
    ctable.set([...rows].reverse().map(r => ({ cells: [fmtD(r.w.date), r.mode === 'HIIT' ? `HIIT ${r.rounds}×${r.work_s}/${r.rest_s}s` : 'Contínuo',
      r.distance ? g(r.distance, 2) : '-', r.w.duration.toFixed(0), r.pace ? fmtPace(r.pace) : '-', r.w.rpe] })));
    q(card, '[data-x="sum"]').textContent = pts.length >= 2 ? `Pace: ${fmtPace(pts[0][1])} → ${fmtPace(pts.at(-1)[1])} /km` : '';
  }
  async function drawFootball() {
    const W = await wmap(), all = (await DB.all('football')).map(f => ({ ...f, w: W.get(f.workout_id) })).filter(r => r.w);
    const games = all.filter(f => f.focus === 'Jogo').sort((a, b) => b.w.date.localeCompare(a.w.date) || b.workout_id - a.workout_id);
    const sum = k => games.reduce((a, r) => a + (r[k] || 0), 0);
    q(fut, '[data-x="sum"]').textContent = `${games.length} jogo(s) • ${sum('goals')} gol(s) • ${sum('assists')} assistência(s) • ${sum('minutes')} minutos jogados`;
    const since = addDays(todayISO(), -90), cnt = {};
    all.filter(f => f.w.date >= since).forEach(f => cnt[f.focus] = (cnt[f.focus] || 0) + 1);
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
    q(fut, '[data-x="cnt"]').textContent = 'Últimos 90 dias: ' + (top.map(([k, n]) => `${k} ${n}`).join(' • ') || 'sem registros');
    ftable.set(games.map(r => ({ cells: [fmtD(r.w.date), esc(r.opponent || '-'), esc(r.result || '-'), r.minutes || 0, r.goals || 0, r.assists || 0, r.w.rpe] })));
  }
  async function drawMobility() {
    const W = await wmap();
    const rows = (await DB.all('mobility')).map(m => ({ ...m, w: W.get(m.workout_id) })).filter(r => r.w)
      .sort((a, b) => b.w.date.localeCompare(a.w.date) || b.workout_id - a.workout_id);
    const since = addDays(todayISO(), -30), recent = rows.filter(r => r.w.date >= since);
    q(mob, '[data-x="sum"]').textContent = `${recent.length} sessão(ões) nos últimos 30 dias • ${recent.reduce((a, r) => a + r.w.duration, 0).toFixed(0)} min`;
    const cnt = {};
    recent.forEach(r => (r.areas || '').split(', ').filter(Boolean).forEach(a => cnt[a] = (cnt[a] || 0) + 1));
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
    q(mob, '[data-x="cnt"]').textContent = 'Regiões mais trabalhadas: ' + (top.map(([a, n]) => `${a} ${n}`).join(' • ') || 'sem registros');
    mtable.set(rows.map(r => ({ cells: [fmtD(r.w.date), esc(r.method || '-'), esc(r.areas || '-'), r.w.duration.toFixed(0)] })));
  }

  async function drawLoad() {
    const rows = await app.weekLoads();
    lchart.set(rows.map(r => [r.week, r.load, `${r.sessions} treino(s) • ${r.min.toFixed(0)} min`]));
    ltable.set([...rows].reverse().map((r, i, arr) => {
      const p = arr[i + 1] ? pctChange(r.load, arr[i + 1].load) : null;
      return { cells: [fmtD(r.week), r.sessions, r.min.toFixed(0), r.load.toFixed(0), (p != null && p > 30 ? '⚠ ' : '') + fmtPct(p)] };
    }));
    const cur = rows.at(-1), before = rows.slice(-5, -1);
    const avg = before.length ? before.reduce((a, r) => a + r.load, 0) / before.length : null;
    q(load, '[data-x="sum"]').textContent = cur
      ? `Esta semana: ${cur.load.toFixed(0)} UA` + (avg != null ? ` • média das ${before.length} semanas anteriores: ${avg.toFixed(0)} UA` : '') : '';
    q(load, '[data-x="note"]').textContent = 'Carga = RPE × minutos de cada treino. ⚠ marca aumento acima de 30% sobre a semana anterior. Treinos sem RPE (como mobilidade) não somam.';
  }

  async function refresh() {
    const exs = [...new Set((await DB.all('gym_sets')).map(x => x.exercise))].sort((a, b) => a.localeCompare(b, 'pt'));
    const cur = val(gym, 'ex');
    F(gym, 'ex').innerHTML = exs.map(e => `<option>${esc(e)}</option>`).join('');
    setv(gym, 'ex', exs.includes(cur) ? cur : (exs[0] || ''));
    await Promise.all([drawGym(), drawCardio(), drawFootball(), drawMobility(), drawLoad()]);
  }
  return { el: s.el, refresh };
};
