'use strict';
/* Página: Tarefas do dia */
window.Pages = window.Pages || {};
Pages.todo = app => {
  const s = pageShell('Tarefas do dia', 'Sua lista diária: treino, alimentação, mobilidade, recuperação e o que mais precisar.');
  const nav = dayNav(() => refresh()); s.head.appendChild(nav.el);
  s.body.innerHTML = `<div class="split">
    <div class="col">
      <div class="card pad"><div class="row">
        ${fld('Nova tarefa', inp('text', '', 'class="w20" style="min-width:220px"'), 'grow')}${fld('Categoria', sel('cat', TODO_CATS, TODO_CATS[0]))}
        <label class="check"><input type="checkbox" name="fixed"> Repetir todo dia</label>
        <div class="btns"><span data-x="addbtn">${btn('+ Adicionar', 'add')}</span><span class="hidden" data-x="cancel">${btn('Cancelar edição', 'cancel', 'ghost')}</span></div>
      </div></div>
      <div><div class="muted" data-x="prog"></div><div class="bar"><i data-x="bar" data-c="var(--accent)"></i></div></div>
      <div data-x="table"></div>
      <div class="btns">${btn('Concluir / reabrir', 'toggle')}${btn('Editar', 'edit', 'ghost')}${btn('Trazer pendências de ontem', 'carry', 'ghost')}<span style="flex:1"></span>${btn('Apagar', 'del', 'danger')}</div>
    </div>
    <div class="card pad">
      <h3>Tarefas fixas (todo dia)</h3><p class="muted sm">Entram sozinhas em hoje e nos dias futuros.</p>
      <div data-x="dtable" style="margin-top:8px"></div>
      <div class="btns" style="margin-top:8px">${btn('Editar', 'editd', 'ghost')}<span style="flex:1"></span>${btn('Apagar das fixas', 'deld', 'danger')}</div>
    </div></div>`;
  const root = s.body, X = n => q(root, `[data-x="${n}"]`);
  const table = mkTable([['', 'c'], ['Tarefa'], ['Categoria']], { onDbl: () => actions.toggle(), empty: 'Nenhuma tarefa neste dia.' });
  const dtable = mkTable([['Tarefa'], ['Cat.']], { empty: 'Nenhuma tarefa fixa.' });
  X('table').appendChild(table.el); X('dtable').appendChild(dtable.el);
  let editing = null;

  async function upsertDaily(text, cat) {
    if (F(root, 'fixed').checked && !(await DB.all('todo_daily')).some(d => d.text === text)) await DB.add('todo_daily', { text, category: cat });
  }
  function resetForm() {
    editing = null; setv(root, 'text', ''); F(root, 'fixed').checked = false;
    X('addbtn').innerHTML = btn('+ Adicionar', 'add'); X('cancel').classList.add('hidden');
  }

  const actions = {
    async add() {
      const text = val(root, 'text').trim(), cat = val(root, 'cat');
      if (!text) return info('Escreva a tarefa.');
      if (editing) {
        const t = await DB.get('todos', editing);
        await DB.put('todos', { ...t, text, category: cat });
        await upsertDaily(text, cat); resetForm(); return refresh();
      }
      const iso = nav.iso();
      await app.ensureDailyTodos(iso);
      await DB.add('todos', { date: iso, text, category: cat, done: 0 });
      await upsertDaily(text, cat);
      setv(root, 'text', ''); F(root, 'fixed').checked = false; await refresh();
    },
    cancel: () => resetForm(),
    async toggle() {
      const id = table.selected(); if (id == null) return;
      const t = await DB.get('todos', id); await DB.put('todos', { ...t, done: t.done ? 0 : 1 }); await refresh();
    },
    async edit() {
      const id = table.selected(); if (id == null) return info('Clique em uma tarefa da lista para editar.');
      const t = await DB.get('todos', id); if (!t) return;
      editing = t.id; setv(root, 'text', t.text); setv(root, 'cat', t.category || TODO_CATS[0]); F(root, 'fixed').checked = false;
      X('addbtn').innerHTML = btn('Salvar alteração', 'add'); X('cancel').classList.remove('hidden');
      F(root, 'text').focus();
    },
    async del() {
      const id = table.selected(); if (id == null) return info('Clique em uma tarefa da lista para apagar.');
      if (!confirm('Apagar esta tarefa?')) return;
      if (editing === id) resetForm();
      await DB.del('todos', id); await refresh();
    },
    async carry() {
      const iso = nav.iso(), prev = addDays(iso, -1);
      await app.ensureDailyTodos(iso);
      const cur = (await DB.where('todos', 'date', iso)).map(t => t.text);
      let n = 0;
      for (const r of (await DB.where('todos', 'date', prev)).filter(t => !t.done)) {
        if (!cur.includes(r.text)) { await DB.add('todos', { date: iso, text: r.text, category: r.category, done: 0 }); n++; }
      }
      if (!n) info('Não há pendências de ontem para trazer.');
      await refresh();
    },
    async editd() {
      const id = dtable.selected(); if (id == null) return info('Clique em uma tarefa fixa para editar.');
      const r = await DB.get('todo_daily', id);
      const txt = prompt('Texto da tarefa fixa:', r.text);
      if (txt && txt.trim()) { await DB.put('todo_daily', { ...r, text: txt.trim() }); await refresh(); }
    },
    async deld() {
      const id = dtable.selected(); if (id == null) return;
      if (confirm('Apagar das tarefas fixas?\n(Dias já criados não mudam.)')) { await DB.del('todo_daily', id); await refresh(); }
    },
  };
  bindActions(root, actions);
  F(root, 'text').addEventListener('keydown', e => { if (e.key === 'Enter') actions.add(); });

  async function refresh() {
    const iso = nav.iso();
    await app.ensureDailyTodos(iso);
    const rows = (await DB.where('todos', 'date', iso)).sort((a, b) => a.done - b.done || a.id - b.id);
    table.set(rows.map(r => ({ id: r.id, cls: r.done ? 'dim' : '', cells: [r.done ? '☑' : '☐', esc(r.text), esc(r.category || '')] })));
    const done = rows.filter(r => r.done).length;
    X('prog').textContent = rows.length ? `${done}/${rows.length} concluídas` : 'Nenhuma tarefa neste dia.';
    setBar(X('bar'), done, rows.length || 1);
    X('bar').style.background = rows.length && done === rows.length ? 'var(--ok)' : 'var(--accent)';
    dtable.set((await DB.all('todo_daily')).sort((a, b) => a.id - b.id).map(r => ({ id: r.id, cells: [esc(r.text), esc(r.category || '')] })));
  }
  return { el: s.el, refresh };
};
