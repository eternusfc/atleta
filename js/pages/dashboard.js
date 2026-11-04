'use strict';
/* Página: Painel do dia */
window.Pages = window.Pages || {};
Pages.dash = app => {
  const s = pageShell('Painel do dia');
  const stats = [['target', 'Meta do dia', 'var(--accent2)'], ['eaten', 'Consumido', 'var(--blue)'],
    ['left', 'Restante', 'var(--ok)'], ['burn', 'Gasto estimado', 'var(--warn)']];
  const macros = [['kcal', 'Calorias', 'var(--accent)'], ['prot', 'Proteína', 'var(--blue)'],
    ['carb', 'Carboidrato', 'var(--warn)'], ['fat', 'Gordura', 'var(--violet)']];
  s.body.innerHTML = `
    <div class="stats">${stats.map(([k, t, c]) => `<div class="card stat" style="--c:${c}"><small>${t}</small><b data-s="${k}">—</b><em>kcal</em></div>`).join('')}</div>
    <div class="two">
      <div class="card pad">
        <h3>Macronutrientes de hoje</h3>
        ${macros.map(([k, t, c]) => `<div class="mrow"><div class="between"><span>${t}</span><span class="muted sm" data-m="${k}"></span></div><div class="bar"><i data-b="${k}" data-c="${c}"></i></div></div>`).join('')}
        <h3>Planejado para hoje</h3><p class="muted pre" data-x="plan"></p>
        <h3>Treinos de hoje</h3><p class="muted pre" data-x="train"></p>
      </div>
      <div class="card pad">
        <h3>Evolução do peso (kg)</h3>
        <p class="muted sm" data-x="week"></p><p class="muted sm" data-x="todo"></p>
        <div data-x="chart"></div>
      </div>
    </div>`;
  const X = n => q(s.body, `[data-x="${n}"]`);

  async function refresh() {
    const p = await DB.getProfile(), iso = todayISO(), hr = new Date().getHours();
    const greet = hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite';
    s.titleEl.textContent = `${greet}, ${(p && p.name ? p.name.trim().split(/\s+/)[0] : 'craque')}! ⚽`;
    if (!p) {
      qa(s.body, '[data-s]').forEach(e => e.textContent = '—');
      X('train').textContent = 'Preencha seu Perfil para calcular suas metas.';
      return;
    }
    const e = energy(p, await app.eatKcal(iso)), tot = await app.dayTotals(iso);
    const S = k => q(s.body, `[data-s="${k}"]`);
    S('target').textContent = e.target.toFixed(0);
    S('eaten').textContent = tot.kcal.toFixed(0);
    const left = e.target - tot.kcal;
    S('left').textContent = left.toFixed(0);
    S('left').style.color = left >= 0 ? 'var(--ok)' : 'var(--accent2)';
    S('burn').textContent = e.tdee.toFixed(0);
    for (const [k, tgt] of [['kcal', e.target], ['prot', e.prot], ['carb', e.carb], ['fat', e.fat]]) {
      q(s.body, `[data-m="${k}"]`).textContent = `${tot[k].toFixed(0)} / ${tgt.toFixed(0)} ${k === 'kcal' ? 'kcal' : 'g'}`;
      setBar(q(s.body, `[data-b="${k}"]`), tot[k], tgt, tot[k] > tgt * 1.05);
    }
    const ws = (await DB.where('workouts', 'date', iso)).sort((a, b) => a.id - b.id);
    X('train').textContent = ws.length
      ? ws.map(w => `• ${w.kind}: ${w.title || '-'} (${w.duration.toFixed(0)} min${w.kind === 'Mobilidade' ? '' : `, ~${w.kcal.toFixed(0)} kcal`})`).join('\n') +
        `\nTotal gasto nos treinos: ${ws.reduce((a, w) => a + w.kcal, 0).toFixed(0)} kcal`
      : 'Nenhum treino registrado hoje.';
    X('plan').textContent = await app.planText(iso);
    const wk = (await DB.between('workouts', 'date', weekStartISO(), '9999-12-31'));
    X('week').textContent = `Semana: ${wk.length} treino(s) • ${wk.reduce((a, w) => a + w.duration, 0).toFixed(0)} min`;
    await app.ensureDailyTodos(iso);
    const td = await DB.where('todos', 'date', iso);
    X('todo').textContent = td.length ? `Tarefas de hoje: ${td.filter(t => t.done).length}/${td.length} concluídas` : 'Tarefas de hoje: nenhuma cadastrada';
    const wl = (await DB.all('weight_log')).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
    X('chart').innerHTML = lineChart(wl.map(r => [shortD(r.date), r.weight]), { color: '#E04F74', height: 260 });
  }
  return { el: s.el, refresh };
};
