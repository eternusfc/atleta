'use strict';
/* ============================================================================
   db.js — camada de dados (IndexedDB).
   Todo acesso ao banco passa por aqui: as páginas nunca tocam em indexedDB.

   Stores
     profile          {id:1, name, position, sex, birth, height, weight, bodyfat, neat, goal}
     weight_log       {date, weight}
     foods            {id, name(único), kcal, prot, carb, fat}      -- por 100 g
     meals            {id, date, meal, food, qty, kcal, prot, carb, fat}
     workouts         {id, date, kind, title, duration, rpe, kcal, notes}
     gym_sets         {id, workout_id, exercise, set_no, reps, load}
     cardio           {workout_id, modality, mode, distance, pace, rounds, work_s, rest_s}
     football         {workout_id, focus, opponent, result, minutes, goals, assists}
     mobility         {workout_id, method, areas}
     routine          {id, weekday, time, kind, title, detail}
     meal_templates   {id, name(único), meal}
     template_items   {id, template_id, food, qty, kcal, prot, carb, fat}
     todos            {id, date, text, category, done}
     todo_daily       {id, text, category}
     todo_generated   {date}
     meta             {key, value}                                   -- não exportada
   ========================================================================== */
const DB = (() => {
  const NAME = 'atleta-eternus-fc';
  const VERSION = 2;
  const BACKUP_FORMAT = 'atleta-eternus-fc-backup';

  // keyPath padrão 'id'; auto = autoIncrement
  const SCHEMA = {
    profile:        { keyPath: 'id' },
    weight_log:     { keyPath: 'date' },
    foods:          { auto: true, indexes: [['name', 'name', { unique: true }]] },
    meals:          { auto: true, indexes: [['date', 'date']] },
    workouts:       { auto: true, indexes: [['date', 'date']] },
    gym_sets:       { auto: true, indexes: [['workout_id', 'workout_id'], ['exercise', 'exercise']] },
    cardio:         { keyPath: 'workout_id', indexes: [['modality', 'modality']] },
    football:       { keyPath: 'workout_id' },
    mobility:       { keyPath: 'workout_id' },
    routine:        { auto: true, indexes: [['weekday', 'weekday']] },
    meal_templates: { auto: true, indexes: [['name', 'name', { unique: true }]] },
    template_items: { auto: true, indexes: [['template_id', 'template_id']] },
    todos:          { auto: true, indexes: [['date', 'date']] },
    todo_daily:     { auto: true },
    todo_generated: { keyPath: 'date' },
    water_log:      { keyPath: 'date', },
    meta:           { keyPath: 'key' },
  };
  const DATA_STORES = Object.keys(SCHEMA).filter(s => s !== 'meta');

  let db = null;

  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const done = t => new Promise((res, rej) => {
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('Transação abortada'));
  });
  const store = (n, mode = 'readonly') => db.transaction(n, mode).objectStore(n);

  function open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(NAME, VERSION);
      r.onupgradeneeded = () => {
        const d = r.result;
        for (const [name, s] of Object.entries(SCHEMA)) {
          if (d.objectStoreNames.contains(name)) continue;
          const st = d.createObjectStore(name, { keyPath: s.keyPath || 'id', autoIncrement: !!s.auto });
          (s.indexes || []).forEach(([n, kp, o]) => st.createIndex(n, kp, o || {}));
        }
      };
      r.onsuccess = () => { db = r.result; res(db); };
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error('Banco bloqueado por outra aba aberta.'));
    });
  }

  /* ----- operações genéricas ----- */
  const all = n => req(store(n).getAll());
  const get = (n, k) => req(store(n).get(k));
  const put = (n, o) => req(store(n, 'readwrite').put(o));   // retorna a chave
  const add = (n, o) => req(store(n, 'readwrite').add(o));
  const del = (n, k) => req(store(n, 'readwrite').delete(k));
  const where = (n, idx, v) => req(store(n).index(idx).getAll(v));
  const between = (n, idx, lo, hi) => req(store(n).index(idx).getAll(IDBKeyRange.bound(lo, hi)));
  const count = n => req(store(n).count());

  /* ----- perfil / peso ----- */
  const getProfile = () => get('profile', 1);
  async function saveProfile(p) {
    const t = db.transaction(['profile', 'weight_log'], 'readwrite');
    t.objectStore('profile').put({ ...p, id: 1 });
    t.objectStore('weight_log').put({ date: todayISO(), weight: p.weight });
    return done(t);
  }
  async function logWeight(iso, w) {
    const t = db.transaction(['profile', 'weight_log'], 'readwrite');
    t.objectStore('weight_log').put({ date: iso, weight: w });
    const ps = t.objectStore('profile'), r = ps.get(1);
    r.onsuccess = () => { if (r.result) ps.put({ ...r.result, weight: w }); };
    return done(t);
  }

  /* ----- alimentos (nome único => "upsert" por nome) ----- */
  async function upsertFood(f) {
    const old = await req(store('foods').index('name').get(f.name));
    return put('foods', old ? { ...f, id: old.id } : f);
  }

  /* ----- treinos: registro principal + detalhes numa única transação ----- */
  function saveWorkout(w, extras = []) {
    return new Promise((res, rej) => {
      const t = db.transaction(['workouts', 'gym_sets', 'cardio', 'football', 'mobility'], 'readwrite');
      let id;
      const r = t.objectStore('workouts').add(w);
      r.onsuccess = () => { id = r.result; extras.forEach(([n, o]) => t.objectStore(n).add({ ...o, workout_id: id })); };
      t.oncomplete = () => res(id);
      t.onerror = t.onabort = () => rej(t.error);
    });
  }
  async function deleteWorkout(id) {
    const sets = await where('gym_sets', 'workout_id', id);
    const t = db.transaction(['workouts', 'gym_sets', 'cardio', 'football', 'mobility'], 'readwrite');
    t.objectStore('workouts').delete(id);
    sets.forEach(s => t.objectStore('gym_sets').delete(s.id));
    ['cardio', 'football', 'mobility'].forEach(n => t.objectStore(n).delete(id));
    return done(t);
  }

  /* ----- modelos de refeição ----- */
  async function deleteTemplate(id) {
    const items = await where('template_items', 'template_id', id);
    const t = db.transaction(['meal_templates', 'template_items'], 'readwrite');
    t.objectStore('meal_templates').delete(id);
    items.forEach(i => t.objectStore('template_items').delete(i.id));
    return done(t);
  }
  async function createTemplate(name, meal, items) {
    return new Promise((res, rej) => {
      const t = db.transaction(['meal_templates', 'template_items'], 'readwrite');
      let id;
      const r = t.objectStore('meal_templates').add({ name, meal });
      r.onsuccess = () => { id = r.result; items.forEach(i => t.objectStore('template_items').add({ ...i, template_id: id })); };
      t.oncomplete = () => res(id);
      t.onerror = t.onabort = () => rej(t.error);
    });
  }

  /* ----- seed inicial ----- */
  async function seed() {
    const flag = await get('meta', 'seeded');
    if (flag || (await count('foods')) > 0) return;
    const t = db.transaction(['foods', 'meta'], 'readwrite');
    SEED_FOODS.forEach(([name, kcal, prot, carb, fat]) => t.objectStore('foods').add({ name, kcal, prot, carb, fat }));
    t.objectStore('meta').put({ key: 'seeded', value: true });
    await done(t);
  }

  /* ----- exportar / importar (JSON) ----- */
  async function exportAll() {
    const stores = {};
    for (const n of DATA_STORES) stores[n] = await all(n);
    return { format: BACKUP_FORMAT, version: 1, app: APP_NAME, exportedAt: new Date().toISOString(), stores };
  }

  /** Valida o arquivo e devolve um resumo (sem gravar nada). */
  function inspectBackup(obj) {
    if (!obj || typeof obj !== 'object' || obj.format !== BACKUP_FORMAT || typeof obj.stores !== 'object' || !obj.stores) {
      throw new Error('Arquivo inválido: não é um backup do Atleta Eternus FC.');
    }
    if (obj.version > 1) throw new Error('Backup de uma versão mais nova do app.');
    const summary = {};
    for (const n of DATA_STORES) {
      const rows = obj.stores[n];
      if (rows !== undefined && !Array.isArray(rows)) throw new Error(`Dados corrompidos em "${n}".`);
      summary[n] = (rows || []).length;
    }
    return summary;
  }

  /** Substitui TODOS os dados pelos do backup, em uma única transação (tudo ou nada). */
  async function importAll(obj) {
    inspectBackup(obj);
    const t = db.transaction([...DATA_STORES, 'meta'], 'readwrite');
    for (const n of DATA_STORES) {
      const st = t.objectStore(n);
      st.clear();
      (obj.stores[n] || []).forEach(row => st.put(row));
    }
    t.objectStore('meta').put({ key: 'seeded', value: true });
    await done(t);
  }

  async function resetAll() {
    const t = db.transaction([...DATA_STORES, 'meta'], 'readwrite');
    [...DATA_STORES, 'meta'].forEach(n => t.objectStore(n).clear());
    await done(t);
  }

    /* ----- água ----- */
  const getWater = async iso => (await get('water_log', iso))?.ml || 0;
  function addWater(iso, delta) {
    const t = db.transaction('water_log', 'readwrite'), st = t.objectStore('water_log');
    const r = st.get(iso);
    r.onsuccess = () => st.put({ date: iso, ml: Math.max(0, (r.result?.ml || 0) + delta) });
    return done(t);
  }

  return {
    open, seed, all, get, put, add, del, where, between, count,
    getProfile, saveProfile, logWeight, upsertFood,
    saveWorkout, deleteWorkout, createTemplate, deleteTemplate,
    exportAll, inspectBackup, importAll, resetAll, getWater, addWater
  };
})();


