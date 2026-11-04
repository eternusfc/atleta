'use strict';
/* ============================================================================
   util.js — constantes de domínio, helpers de data/número, cálculo de energia
   e pequenos componentes de UI (sem dependências).
   ========================================================================== */
const APP_NAME = 'Atleta Eternus FC';

const NEAT_LEVELS = {
  'Baixo (maior parte do dia sentado)': 0.10,
  'Leve (alguma caminhada/deslocamento)': 0.20,
  'Moderado (bastante em pé e em movimento)': 0.30,
  'Alto (muito ativo fora dos treinos)': 0.40,
};
const GOALS = {
  'Manter peso': 0.0, 'Cutting leve (-10%)': -0.10, 'Cutting (-20%)': -0.20,
  'Bulking leve (+10%)': 0.10, 'Bulking (+15%)': 0.15,
};
const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const ROUTINE_KINDS = ['Academia', 'Cardio', 'Futsal', 'Mobilidade', 'Descanso'];
const MOBILITY_METHODS = ['Mobilidade ativa', 'Alongamento estático', 'Liberação miofascial (rolo)',
  'Aquecimento dinâmico', 'Yoga / Pilates', 'Outro'];
const MOBILITY_AREAS = ['Tornozelo', 'Panturrilha', 'Quadril', 'Isquiotibiais', 'Adutores', 'Glúteos',
  'Coluna lombar', 'Coluna torácica', 'Ombros', 'Pescoço', 'Punhos', 'Corpo todo'];
const TODO_CATS = ['Treino', 'Alimentação', 'Mobilidade', 'Recuperação', 'Estudo', 'Pessoal', 'Outro'];
const POSITIONS = ['Goleiro', 'Fixo', 'Ala', 'Pivô'];
const MEALS = ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde',
  'Pré-treino', 'Pós-treino', 'Jantar', 'Ceia'];
const FOOTBALL_FOCUS = ['Técnico', 'Fundamentos', 'Coletivo', 'Tático', 'Bola parada', 'Físico', 'Jogo', 'Outro'];
const FOOTBALL_MET = { 'Técnico': 5.0, 'Fundamentos': 6.0, 'Coletivo': 8.5, 'Tático': 6.0,
  'Bola parada': 5.0, 'Físico': 8.5, 'Jogo': 10.0, 'Outro': 5.0 };
const CARDIO_MODES = ['Corrida', 'Esteira', 'Bike', 'Natação', 'Caminhada', 'Elíptico'];
const DEFAULT_EXERCISES = [
  'Supino reto', 'Supino inclinado', 'Agachamento livre', 'Leg press', 'Levantamento terra',
  'Stiff', 'Desenvolvimento', 'Remada curvada', 'Puxada frontal', 'Barra fixa',
  'Rosca direta', 'Tríceps pulley', 'Cadeira extensora', 'Mesa flexora',
  'Afundo / passada', 'Panturrilha em pé', 'Elevação pélvica', 'Abdominal',
];
const SEED_FOODS = [ // nome, kcal, prot, carb, gord (por 100 g, valores aproximados)
  ['Arroz branco cozido', 128, 2.5, 28.1, 0.2], ['Feijão carioca cozido', 76, 4.8, 13.6, 0.5],
  ['Frango grelhado (peito)', 165, 31.0, 0.0, 3.6], ['Ovo cozido', 155, 13.0, 1.1, 10.6],
  ['Banana prata', 89, 1.1, 22.8, 0.3], ['Aveia em flocos', 394, 13.9, 66.6, 8.5],
  ['Batata-doce cozida', 86, 1.6, 20.0, 0.1], ['Carne bovina (patinho)', 219, 35.9, 0.0, 7.3],
  ['Pão francês', 300, 8.0, 58.6, 3.1], ['Leite integral', 61, 3.2, 4.7, 3.3],
  ['Whey protein (pó)', 400, 80.0, 8.0, 6.0], ['Maçã', 52, 0.3, 13.8, 0.2],
  ['Macarrão cozido', 158, 5.8, 30.9, 0.9], ['Pasta de amendoim', 588, 25.0, 20.0, 50.0],
  ['Iogurte natural', 61, 3.5, 4.7, 3.3], ['Azeite de oliva', 884, 0.0, 0.0, 100.0],
  ['Tilápia grelhada', 128, 26.0, 0.0, 2.7], ['Mandioca cozida', 160, 1.4, 38.1, 0.3],
  ['Tapioca (goma hidratada)', 240, 0.0, 60.0, 0.0], ['Queijo minas frescal', 264, 17.4, 3.2, 20.2],
];

/* ---------------------------------------------------------------- datas --- */
const pad = n => String(n).padStart(2, '0');
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => toISO(new Date());
const parseISO = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
const fmtD = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const shortD = iso => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };
const weekdayIdx = iso => (parseISO(iso).getDay() + 6) % 7; // 0 = segunda
const weekStartISO = () => addDays(todayISO(), -weekdayIdx(todayISO()));
const calcAge = birthISO => {
  const b = parseISO(birthISO), t = new Date();
  return t.getFullYear() - b.getFullYear() - ((t.getMonth() < b.getMonth() ||
    (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) ? 1 : 0);
};

/* -------------------------------------------------------------- números --- */
/** Converte texto (aceita vírgula) em número. Vazio => default. Inválido => lança erro. */
function num(text, def = 0) {
  const s = String(text ?? '').trim().replace(',', '.');
  if (!s) return def;
  const v = Number(s);
  if (!Number.isFinite(v)) throw new Error('NaN');
  return v;
}
const fmtPace = s => (!s ? '-' : `${Math.floor(s / 60)}:${pad(Math.round(s % 60) % 60)}`);
const kcalFromMet = (met, kg, min) => met * kg * (min / 60);
const g = (v, d = 1) => (+v).toFixed(d).replace(/\.0+$/, ''); // número "limpo" (como :g)

/* ---------------------------------------------------- cálculo de energia --- */
/** TMB + NEAT + EAT + TEF. Katch-McArdle (com % gordura) ou Mifflin-St Jeor. */
function energy(p, eat = 0) {
  const w = p.weight, h = p.height, age = calcAge(p.birth), bf = p.bodyfat;
  let tmb, formula;
  if (bf) { tmb = 370 + 21.6 * (w * (1 - bf / 100)); formula = 'Katch-McArdle'; }
  else { tmb = 10 * w + 6.25 * h - 5 * age + (p.sex === 'Masculino' ? 5 : -161); formula = 'Mifflin-St Jeor'; }
  const neat = tmb * (NEAT_LEVELS[p.neat] ?? 0.2);
  const tef = 0.10 * (tmb + neat + eat);
  const tdee = tmb + neat + eat + tef;
  const target = tdee * (1 + (GOALS[p.goal] ?? 0));
  const prot = 2.0 * w, fat = 0.9 * w;
  const carb = Math.max(0, (target - prot * 4 - fat * 9) / 4);
  return { tmb, neat, eat, tef, tdee, target, prot, carb, fat, formula, age };
}

/* ------------------------------------------------------------------ DOM --- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = s => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; };
const q = (r, s) => r.querySelector(s);
const qa = (r, s) => [...r.querySelectorAll(s)];
const F = (root, n) => root.querySelector(`[name="${n}"]`);
const val = (root, n) => F(root, n).value;
const setv = (root, n, v) => { F(root, n).value = v; };

const fld = (label, inner, cls = '') => `<label class="fld ${cls}"><span>${label}</span>${inner}</label>`;
const inp = (name, v = '', attrs = '') => `<input name="${name}" value="${esc(v)}" autocomplete="off" ${attrs}>`;
const sel = (name, opts, v) => `<select name="${name}">${opts.map(o =>
  `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
const btn = (text, act, kind = 'primary') => `<button type="button" class="btn ${kind}" data-act="${act}">${text}</button>`;
const RPE = [...Array(10)].map((_, i) => String(i + 1));

/** Delegação de cliques: <button data-act="x"> chama actions.x() */
function bindActions(root, actions) {
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b && root.contains(b) && actions[b.dataset.act]) {
      Promise.resolve(actions[b.dataset.act](b)).catch(err => { console.error(err); toast('Erro: ' + err.message); });
    }
  });
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}
const info = msg => alert(msg);

function pageShell(title, subtitle = '') {
  const el = h(`<section class="page hidden"><div class="page-head"><h1></h1>
    ${subtitle ? `<div class="sub">${esc(subtitle)}</div>` : ''}<div class="rule"></div></div><div class="page-body"></div></section>`);
  const head = q(el, '.page-head'), body = q(el, '.page-body'), titleEl = q(el, 'h1');
  titleEl.textContent = title;
  return { el, head, body, titleEl };
}

/** Seletor de data: ◀ [data] ▶ Hoje */
function dayNav(onChange) {
  const el = h(`<div class="daynav">${btn('◀', 'prev', 'ghost')}<input type="date" value="${todayISO()}">
    ${btn('▶', 'next', 'ghost')}${btn('Hoje', 'today', 'ghost')}</div>`);
  const i = q(el, 'input');
  const iso = () => i.value || todayISO();
  const set = v => { i.value = v; onChange(); };
  i.addEventListener('change', () => { if (!i.value) i.value = todayISO(); onChange(); });
  bindActions(el, { prev: () => set(addDays(iso(), -1)), next: () => set(addDays(iso(), 1)), today: () => set(todayISO()) });
  return { el, iso };
}

/** Tabela com seleção de linha. cols: [titulo, classe('' | 'r' | 'c')] */
function mkTable(cols, { onSelect, onDbl, empty = 'Sem registros' } = {}) {
  const el = h(`<div class="tbl"><table><thead><tr>${cols.map(c => `<th class="${c[1] || ''}">${c[0]}</th>`).join('')}</tr></thead><tbody></tbody></table></div>`);
  const tb = q(el, 'tbody');
  let selId = null;
  tb.addEventListener('click', e => {
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    selId = tr.dataset.id;
    qa(tb, 'tr').forEach(r => r.classList.toggle('sel', r === tr));
    onSelect && onSelect(selId);
  });
  tb.addEventListener('dblclick', e => { const tr = e.target.closest('tr[data-id]'); if (tr && onDbl) onDbl(tr.dataset.id); });
  return {
    el, selected: () => (selId == null ? null : (isNaN(selId) ? selId : Number(selId))),
    select(id) { selId = String(id); },
    set(rows) {
      if (!rows.some(r => String(r.id) === selId)) selId = null;
      tb.innerHTML = rows.length ? rows.map(r => `<tr data-id="${r.id ?? ''}" class="${r.cls || ''} ${String(r.id) === selId ? 'sel' : ''}">` +
        r.cells.map((c, i) => `<td class="${cols[i][1] || ''}">${c}</td>`).join('') + '</tr>').join('')
        : `<tr><td class="empty" colspan="${cols.length}">${empty}</td></tr>`;
    },
  };
}

/** Abas simples. panes: [[rótulo, elemento]] */
function mkTabs(panes) {
  const el = h('<div><div class="tabs"></div></div>');
  const bar = q(el, '.tabs');
  const btns = panes.map(([label, pane], i) => {
    const b = h(`<button type="button" class="tab">${label}</button>`);
    b.onclick = () => select(i);
    bar.appendChild(b); pane.classList.add('tabpane'); el.appendChild(pane);
    return b;
  });
  function select(i) { btns.forEach((b, k) => { b.classList.toggle('active', k === i); panes[k][1].classList.toggle('hidden', k !== i); }); }
  select(0);
  return { el, select };
}

function setBar(i, value, max, over = false) {
  i.style.width = Math.max(0, Math.min(1, value / Math.max(max, 1e-9))) * 100 + '%';
  i.style.background = over ? 'var(--accent2)' : i.dataset.c;
}
