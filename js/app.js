'use strict';
/* app.js — núcleo: helpers compartilhados, navegação, exportar/importar. */
window.Pages = window.Pages || {};

const App = {
  pages: {}, current: null,

  /* ---- helpers compartilhados entre páginas ---- */
  async weight() { const p = await DB.getProfile(); return p ? p.weight : 75; },

  /** Cria as tarefas fixas para hoje/dias futuros, uma única vez por data. */
  async ensureDailyTodos(iso) {
    if (iso < todayISO() || await DB.get('todo_generated', iso)) return;
    const daily = await DB.all('todo_daily');
    const existing = (await DB.where('todos', 'date', iso)).map(t => t.text);
    for (const r of daily) {
      if (!existing.includes(r.text)) await DB.add('todos', { date: iso, text: r.text, category: r.category, done: 0 });
    }
    await DB.put('todo_generated', { date: iso });
  },
  async planned(iso) {
    const rows = await DB.where('routine', 'weekday', weekdayIdx(iso));
    const key = r => r.time || '99:99';
    return rows.sort((a, b) => key(a).localeCompare(key(b)) || a.id - b.id);
  },
  async planText(iso) {
    const rows = await this.planned(iso);
    if (!rows.length) return 'Nada planejado para este dia.';
    return rows.map(r => `• ${r.time ? r.time + ' ' : ''}${r.kind}${r.title && r.title !== r.kind ? ': ' + r.title : ''}`).join('\n');
  },
  async eatKcal(iso) {
    return (await DB.where('workouts', 'date', iso)).filter(w => w.kind !== 'Mobilidade').reduce((s, w) => s + (w.kcal || 0), 0);
  },
  async dayTotals(iso) {
    const t = { kcal: 0, prot: 0, carb: 0, fat: 0 };
    for (const m of await DB.where('meals', 'date', iso)) for (const k in t) t[k] += m[k] || 0;
    return t;
  },

  /* ---- navegação ---- */
  async show(key) {
    this.current = key;
    for (const [k, p] of Object.entries(this.pages)) {
      p.el.classList.toggle('hidden', k !== key);
      this.navEls[k].classList.toggle('active', k === key);
    }
    document.getElementById('content').scrollTop = 0;
    window.scrollTo(0, 0);
    document.body.classList.remove('menu-open');
    await this.pages[key].refresh();
  },
  refreshCurrent() { return this.pages[this.current].refresh(); },

  /* ---- backup ---- */
  async exportJSON() {
    const data = await DB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `atleta-eternus-backup-${todayISO()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Backup exportado.');
  },
  async importJSON(file) {
    let obj, summary;
    try {
      obj = JSON.parse(await file.text());
      summary = DB.inspectBackup(obj);
    } catch (e) {
      return info(e instanceof SyntaxError ? 'Arquivo inválido: não é um JSON.' : e.message);
    }
    const when = obj.exportedAt ? new Date(obj.exportedAt).toLocaleString('pt-BR') : 'data desconhecida';
    const resumo = `${summary.meals} refeições, ${summary.workouts} treinos, ${summary.foods} alimentos, ` +
      `${summary.todos} tarefas, ${summary.weight_log} pesos`;
    if (!confirm(`Importar backup de ${when}?\n\n${resumo}\n\nATENÇÃO: isso substitui TODOS os dados atuais deste navegador.`)) return;
    await DB.importAll(obj);
    toast('Dados importados com sucesso.');
    await this.show(await DB.getProfile() ? this.current || 'dash' : 'prof');
  },

  async init() {
    try {
      await DB.open();
      await DB.seed();
    } catch (e) {
      document.getElementById('content').innerHTML =
        `<div class="pad"><h2>Não foi possível abrir o banco de dados</h2><p class="muted">${esc(e.message)}</p>
         <p class="muted">Abra o app em uma janela normal (não anônima) e com armazenamento permitido.</p></div>`;
      return;
    }
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

    const items = [['dash', '📊  Painel'], ['todo', '✅  Tarefas do dia'], ['food', '🍽  Alimentação'],
      ['train', '🏋  Treinos'], ['routine', '📅  Rotina semanal'], ['pantry', '🥗  Meus alimentos'],
      ['prog', '📈  Evolução'], ['prof', '👤  Perfil']];
    const nav = document.getElementById('nav'), content = document.getElementById('content');
    this.navEls = {};
    for (const [key, label] of items) {
      this.pages[key] = Pages[key](this);
      content.appendChild(this.pages[key].el);
      const n = h(`<div class="nav-item">${label}</div>`);
      n.onclick = () => this.show(key);
      nav.appendChild(n);
      this.navEls[key] = n;
    }
    const toggleMenu = () => document.body.classList.toggle('menu-open');
    document.getElementById('btnMenu').onclick = toggleMenu;
    document.getElementById('scrim').onclick = toggleMenu;
    document.getElementById('btnExport').onclick = () => this.exportJSON();
    const file = document.getElementById('fileImport');
    document.getElementById('btnImport').onclick = () => file.click();
    file.onchange = async () => { if (file.files[0]) await this.importJSON(file.files[0]); file.value = ''; };
    await this.show(await DB.getProfile() ? 'dash' : 'prof');
  },
};

window.addEventListener('DOMContentLoaded', () => App.init());
