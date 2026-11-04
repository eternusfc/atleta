'use strict';
/* ============================================================================
   chart.js — gráfico de linha interativo (SVG puro, sem dependências).

   Recursos
     • Tooltip ao passar o mouse / tocar (data, valor, variação e detalhe extra)
     • Filtro de período: 7 / 30 / 90 dias / Tudo
     • Zoom: roda do mouse, botões − / + / Reset, pinça no celular
     • Arrastar para mover, duplo clique para resetar

   Uso
     const ch = mkChart({ name: 'Peso', color: '#E04F74', fmt: v => v.toFixed(1) + ' kg', period: 30 });
     container.appendChild(ch.el);
     ch.set([['2026-11-01', 75.2], ['2026-11-02', 75.0, 'detalhe opcional no tooltip']]);
   ========================================================================== */
let CHART_SEQ = 0;

function mkChart(opt = {}) {
  const o = { color: '#8C1C3C', fmt: v => v.toFixed(1), name: 'Valor', height: 230, period: 0, periods: [7, 30, 90, 0], ...opt };
  o.axisFmt = o.axisFmt || o.fmt;
  o.fmtDelta = o.fmtDelta || (d => (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(1));

  const uid = 'chart' + (++CHART_SEQ);
  const W = 640, H = o.height, L = 62, R = 24, T = 22, B = 32, PW = W - L - R, PH = H - T - B, DAY = 864e5;

  const el = h(`<div class="chart-box">
    <div class="chart-bar">
      <div class="chips">${o.periods.map(p => `<button type="button" class="chip" data-p="${p}">${p ? p + ' dias' : 'Tudo'}</button>`).join('')}</div>
      <div class="chips">
        <button type="button" class="chip" data-z="out" title="Diminuir zoom" aria-label="Diminuir zoom">−</button>
        <button type="button" class="chip" data-z="in" title="Aumentar zoom" aria-label="Aumentar zoom">+</button>
        <button type="button" class="chip" data-z="reset" title="Resetar zoom">Reset</button>
      </div>
    </div>
    <div class="chart-wrap">
      <svg class="chart" viewBox="0 0 ${W} ${H}" font-family="Segoe UI,system-ui,sans-serif"></svg>
      <div class="chart-tip hidden"></div>
    </div>
    <div class="muted sm chart-hint">Passe o mouse ou toque para ver os valores • role para dar zoom • arraste para mover • duplo clique reseta</div>
  </div>`);
  const svg = q(el, 'svg'), wrap = q(el, '.chart-wrap'), tip = q(el, '.chart-tip');

  let all = [];          // todos os pontos {t, iso, v, extra}
  let view = [];         // pontos dentro do período escolhido
  let full = [0, 1];     // intervalo de tempo completo do período
  let win = [0, 1];      // janela visível (zoom/pan)
  let period = o.period;
  let geo = null;        // funções X/Y do último desenho

  /* ---------------- período e janela ---------------- */
  function applyPeriod() {
    const cutoff = period ? parseISO(addDays(todayISO(), -period)).getTime() : -Infinity;
    view = all.filter(p => p.t >= cutoff);
    if (view.length) {
      let a = view[0].t, b = view[view.length - 1].t;
      if (b - a < 2 * DAY) { const c = (a + b) / 2; a = c - 3 * DAY; b = c + 3 * DAY; }
      const pad = (b - a) * 0.03;
      full = [a - pad, b + pad];
    } else full = [0, 1];
    win = [...full];
    qa(el, '[data-p]').forEach(b => b.classList.toggle('active', Number(b.dataset.p) === period));
  }
  const minSpan = () => { const fs = full[1] - full[0]; return Math.min(fs, Math.max(2 * DAY, fs / 40)); };
  function clampWin(a, b) {
    const fs = full[1] - full[0], s = b - a;
    if (s >= fs) return [...full];
    if (a < full[0]) { a = full[0]; b = a + s; }
    if (b > full[1]) { b = full[1]; a = b - s; }
    return [a, b];
  }
  function zoomedWin(w, factor, centerT) {
    const fs = full[1] - full[0], span = w[1] - w[0];
    const ns = Math.max(minSpan(), Math.min(fs, span * factor));
    const frac = (centerT - w[0]) / span, a = centerT - frac * ns;
    return clampWin(a, a + ns);
  }
  function setWin(w) { win = w; draw(); hideHover(); }

  /* ---------------- desenho ---------------- */
  function draw() {
    const [a, b] = win, span = b - a;
    if (!view.length) {
      svg.innerHTML = `<text x="${W / 2}" y="${H / 2}" fill="#8C8C8C" font-size="14" text-anchor="middle">${all.length ? 'Sem registros neste período' : 'Sem dados ainda'}</text>`;
      geo = null; return;
    }
    const vis = view.filter(p => p.t >= a && p.t <= b);
    let base = vis;
    if (!base.length) { // janela entre dois pontos: usa os vizinhos para a escala
      const before = [...view].reverse().find(p => p.t < a), after = view.find(p => p.t > b);
      base = [before, after].filter(Boolean);
    }
    const ys = base.map(p => p.v);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    if (lo === hi) { lo -= 1; hi += 1; }
    const pd = (hi - lo) * 0.12; lo -= pd; hi += pd;
    const X = t => L + PW * (t - a) / span, Y = v => T + PH * (1 - (v - lo) / (hi - lo));
    geo = { X, Y };

    let s = `<defs><clipPath id="${uid}"><rect x="${L}" y="${T - 8}" width="${PW}" height="${PH + 16}"/></clipPath></defs>`;
    for (let k = 0; k < 5; k++) {
      const v = lo + (hi - lo) * k / 4, y = Y(v);
      s += `<line x1="${L}" y1="${y}" x2="${W - R}" y2="${y}" stroke="#2A2A2A"/><text x="${L - 8}" y="${y + 4}" fill="#8C8C8C" font-size="11" text-anchor="end">${esc(o.axisFmt(v))}</text>`;
    }
    const long = span > 200 * DAY;
    for (let k = 0; k < 5; k++) {
      const t = a + span * k / 4, iso = toISO(new Date(t));
      const label = long ? `${shortD(iso)}/${iso.slice(2, 4)}` : shortD(iso);
      s += `<text x="${L + PW * k / 4}" y="${H - 12}" fill="#8C8C8C" font-size="11" text-anchor="${k === 0 ? 'start' : k === 4 ? 'end' : 'middle'}">${label}</text>`;
    }
    s += `<g clip-path="url(#${uid})">`;
    if (view.length > 1) s += `<polyline fill="none" stroke="${o.color}" stroke-width="2.5" stroke-linejoin="round" points="${view.map(p => X(p.t).toFixed(1) + ',' + Y(p.v).toFixed(1)).join(' ')}"/>`;
    if (vis.length <= 60) vis.forEach(p => { s += `<circle cx="${X(p.t)}" cy="${Y(p.v)}" r="4" fill="${o.color}" stroke="#141414" stroke-width="2"/>`; });
    s += '</g>';
    const last = view[view.length - 1];
    if (last.t >= a && last.t <= b) s += `<text x="${Math.min(X(last.t), W - R - 20)}" y="${Y(last.v) - 12}" fill="#fff" font-size="12" font-weight="700" text-anchor="middle">${esc(o.axisFmt(last.v))}</text>`;
    s += '<g class="hv"></g>';
    svg.innerHTML = s;
  }

  /* ---------------- tooltip ---------------- */
  const svgX = e => { const r = svg.getBoundingClientRect(); return (e.clientX - r.left) * W / r.width; };
  function hideHover() { tip.classList.add('hidden'); const g = q(svg, '.hv'); if (g) g.innerHTML = ''; }
  function showHover(e) {
    if (!geo || !view.length) return;
    const x = svgX(e);
    if (x < L - 10 || x > W - R + 10) return hideHover();
    let best = null, bd = Infinity;
    for (const p of view) {
      if (p.t < win[0] || p.t > win[1]) continue;
      const d = Math.abs(geo.X(p.t) - x);
      if (d < bd) { bd = d; best = p; }
    }
    if (!best) return hideHover();
    const px = geo.X(best.t), py = geo.Y(best.v);
    q(svg, '.hv').innerHTML = `<line x1="${px}" y1="${T}" x2="${px}" y2="${T + PH}" stroke="#666" stroke-dasharray="3 3"/>
      <circle cx="${px}" cy="${py}" r="6" fill="${o.color}" stroke="#fff" stroke-width="2"/>`;
    const idx = view.indexOf(best), prev = idx > 0 ? view[idx - 1] : null;
    tip.innerHTML = `<b>${fmtD(best.iso)}</b>
      <div><i style="background:${o.color}"></i>${esc(o.name)}: <b>${esc(o.fmt(best.v))}</b></div>
      ${prev ? `<div class="muted">vs. ${shortD(prev.iso)}: ${esc(o.fmtDelta(best.v - prev.v))}</div>` : ''}
      ${best.extra ? `<div class="muted">${esc(best.extra)}</div>` : ''}`;
    tip.classList.remove('hidden');
    const ww = wrap.clientWidth, tw = tip.offsetWidth, th = tip.offsetHeight, topPx = py / H * svg.clientHeight;
    const below = topPx - th - 16 < 0;
    tip.classList.toggle('below', below);
    tip.style.left = Math.max(tw / 2 + 4, Math.min(ww - tw / 2 - 4, px / W * ww)) + 'px';
    tip.style.top = (below ? topPx + 14 : topPx - 14) + 'px';
  }

  /* ---------------- interação ---------------- */
  const ptrs = new Map();
  let pinch = null, moved = 0;
  svg.addEventListener('pointerdown', e => {
    svg.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: svgX(e) });
    if (ptrs.size === 1) moved = 0;
    if (ptrs.size === 2) { const [p1, p2] = [...ptrs.values()]; pinch = { d: Math.abs(p1.x - p2.x), win: [...win] }; hideHover(); }
    else if (e.pointerType !== 'mouse') showHover(e); // toque: mostra o tooltip
  });
  svg.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) { if (e.pointerType === 'mouse') showHover(e); return; }
    const prev = ptrs.get(e.pointerId), x = svgX(e);
    ptrs.set(e.pointerId, { x });
    if (ptrs.size === 2 && pinch) {
      const [p1, p2] = [...ptrs.values()], d = Math.abs(p1.x - p2.x);
      if (d > 10 && pinch.d > 10) {
        const mid = (p1.x + p2.x) / 2, pw = pinch.win[1] - pinch.win[0];
        setWin(zoomedWin(pinch.win, pinch.d / d, pinch.win[0] + Math.max(0, Math.min(1, (mid - L) / PW)) * pw));
      }
      return;
    }
    moved += Math.abs(x - prev.x);
    if (moved > 5) { svg.classList.add('drag'); setWin(clampWin(win[0] - (x - prev.x) / PW * (win[1] - win[0]), win[1] - (x - prev.x) / PW * (win[1] - win[0]))); }
    else showHover(e);
  });
  const end = e => {
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (!ptrs.size) { svg.classList.remove('drag'); if (e.pointerType === 'mouse') showHover(e); }
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !ptrs.size) hideHover(); });
  svg.addEventListener('dblclick', () => setWin([...full]));
  svg.addEventListener('wheel', e => {
    if (!view.length) return;
    e.preventDefault();
    const frac = Math.max(0, Math.min(1, (svgX(e) - L) / PW));
    setWin(zoomedWin(win, e.deltaY < 0 ? 1 / 1.25 : 1.25, win[0] + frac * (win[1] - win[0])));
  }, { passive: false });

  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.p !== undefined) { period = Number(b.dataset.p); applyPeriod(); draw(); hideHover(); return; }
    const c = (win[0] + win[1]) / 2;
    if (b.dataset.z === 'in') setWin(zoomedWin(win, 1 / 1.5, c));
    else if (b.dataset.z === 'out') setWin(zoomedWin(win, 1.5, c));
    else if (b.dataset.z === 'reset') setWin([...full]);
  });

  return {
    el,
    /** pts: [[dataISO, valor, detalheOpcional]] */
    set(pts) {
      all = pts.map(([iso, v, extra]) => ({ t: parseISO(iso).getTime(), iso, v, extra })).sort((x, y) => x.t - y.t);
      applyPeriod(); draw();
    },
  };
}
