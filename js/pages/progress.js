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

  s.body.appendChild(mkTabs([['🏋 Academia', gym], ['🏃 Cardio', card], ['⚽ Futsal', fut], ['🧘 Mobilidade', mob]]).el);
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
      pts.push([shortD(d), best]);
      rows.push({ cells: [fmtD(d), sets.length, g(best, 2), repsBest, vol.toFixed(0), rm.toFixed(1)] });
    }
    q(gym, '[data-x="chart"]').innerHTML = lineChart(pts, { color: '#8C1C3C', fmt: v => `${v.toFixed(1)} kg`, height: 230 });
    gtable.set(rows.reverse());
    q(gym, '[data-x="sum"]').textContent = pts.length >= 2 ? `Progressão: ${g(pts[0][1], 2)} → ${g(pts.at(-1)[1], 2)} kg (${pts.at(-1)[1] - pts[0][1] >= 0 ? '+' : ''}${g(pts.at(-1)[1] - pts[0][1], 2)} kg)` : '';
  }
  async function drawCardio() {
    const mod = val(card, 'mod'), W = await wmap();
    const rows = (await DB.where('cardio', 'modality', mod)).map(c => ({ ...c, w: W.get(c.workout_id) })).filter(r => r.w)
      .sort((a, b) => a.w.date.localeCompare(b.w.date) || a.workout_id - b.workout_id);
    const pts = rows.filter(r => r.pace && r.mode !== 'HIIT').map(r => [shortD(r.w.date), r.pace]);
    q(card, '[data-x="chart"]').innerHTML = lineChart(pts, { color: '#F2F2F2', fmt: v => fmtPace(v) + '/km', height: 230 });
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

  async function refresh() {
    const exs = [...new Set((await DB.all('gym_sets')).map(x => x.exercise))].sort((a, b) => a.localeCompare(b, 'pt'));
    const cur = val(gym, 'ex');
    F(gym, 'ex').innerHTML = exs.map(e => `<option>${esc(e)}</option>`).join('');
    setv(gym, 'ex', exs.includes(cur) ? cur : (exs[0] || ''));
    await Promise.all([drawGym(), drawCardio(), drawFootball(), drawMobility()]);
  }
  return { el: s.el, refresh };
};
