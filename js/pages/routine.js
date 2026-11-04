'use strict';
/* Página: Rotina semanal */
window.Pages = window.Pages || {};
Pages.routine = app => {
  const s = pageShell('Rotina semanal', 'Planeje seus treinos da semana. O planejado aparece no Painel e na tela de Treinos.');
  const KIND_COLOR = { Academia: 'var(--accent2)', Cardio: 'var(--blue)', Futsal: 'var(--ok)', Mobilidade: 'var(--violet)', Descanso: 'var(--muted)' };
  s.body.innerHTML = `<div class="card pad"><div class="row">
      ${fld('Dia', sel('day', WEEKDAYS, WEEKDAYS[0]))}${fld('Tipo', sel('kind', ROUTINE_KINDS, ROUTINE_KINDS[0]))}
      ${fld('Descrição (ex: Peito/Tríceps, Coletivo)', inp('title', '', 'class="w20"'))}
      ${fld('Horário', inp('time', '', 'class="w6" placeholder="07:30"'))}
      ${fld('Detalhes (opcional)', inp('detail', '', 'class="w20"'))}
      <div class="btns">${btn('+ Adicionar', 'add')}</div></div></div>
    <div class="week" data-x="week"></div>
    <p class="muted sm" style="margin-top:10px">Para remover um item, clique no ✕ dele.</p>`;
  const root = s.body, week = q(root, '[data-x="week"]');

  bindActions(root, {
    async add() {
      const kind = val(root, 'kind'); let title = val(root, 'title').trim(), tm = val(root, 'time').trim();
      if (tm) {
        const m = tm.replace('h', ':').match(/^(\d{1,2})(?::(\d{0,2}))?$/);
        const hh = m ? +m[1] : -1, mm = m ? +(m[2] || 0) : -1;
        if (!m || hh > 23 || mm > 59) return info('Horário inválido. Use o formato HH:MM (ex: 07:30).');
        tm = `${pad(hh)}:${pad(mm)}`;
      }
      if (kind !== 'Descanso' && !title) title = kind;
      await DB.add('routine', { weekday: WEEKDAYS.indexOf(val(root, 'day')), time: tm, kind, title, detail: val(root, 'detail').trim() });
      ['title', 'detail', 'time'].forEach(n => setv(root, n, '')); await refresh();
    },
    async rm(b) { await DB.del('routine', Number(b.dataset.id)); await refresh(); },
  });

  async function refresh() {
    const today = weekdayIdx(todayISO()), all = await DB.all('routine');
    week.innerHTML = WEEKDAYS.map((name, i) => {
      const rows = all.filter(r => r.weekday === i).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99') || a.id - b.id);
      return `<div class="day ${i === today ? 'today' : ''}"><h4>${name}${i === today ? '  • hoje' : ''}</h4>` +
        (rows.length ? rows.map(r => `<div class="ritem"><div class="t"><span style="color:${KIND_COLOR[r.kind] || 'inherit'}">${r.time ? r.time + ' · ' : ''}${esc(r.kind)}</span>
          <span class="x" data-act="rm" data-id="${r.id}">✕</span></div>
          ${r.title && r.title !== r.kind ? `<div>${esc(r.title)}</div>` : ''}${r.detail ? `<div class="muted sm">${esc(r.detail)}</div>` : ''}</div>`).join('')
          : '<div class="muted sm">Livre</div>') + '</div>';
    }).join('');
  }
  return { el: s.el, refresh };
};
