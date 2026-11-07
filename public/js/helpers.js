
window.TX = (() => {
  // one colour per meaning (see the key in the CSS)
  const LAYER_CLASS = { type: 'k-type', use: 'k-use', for: 'k-for', topic: 'k-topic', vibe: 'k-minor', place: 'k-minor', via: 'k-minor' };
  const LAYER_GLYPH = { type: '■', use: '■', for: '■', topic: '■', vibe: '◆', place: '▲', via: '●' };
  const layerClass = (l) => LAYER_CLASS[l] || 'k-minor';
  const charW = (el) => {
    const s = document.createElement('span');
    s.textContent = '0'.repeat(40);
    s.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
    el.appendChild(s);
    const w = s.getBoundingClientRect().width / 40;
    s.remove();
    return w > 2 ? w : 7.8;
  };
  const cols = (el, min) => Math.max(min || 24, Math.floor((el.clientWidth || 360) / charW(el)) - 1);
  const span = (cls, text) => { const s = document.createElement('span'); if (cls) s.className = cls; s.textContent = text; return s; };
  const row = (...parts) => { const r = document.createElement('span'); r.className = 'tx-row'; r.append(...parts); return r; };
  const fail = () => { const d = document.createElement('div'); d.className = 'tx-fail'; d.textContent = 'failed to load'; return d; };
  const ready = (el, d, inline) => {
    if (d.status === 'ok' && Array.isArray(d.data) && d.data.length) { el.classList.remove('dash-skeleton'); return true; }
    if (d.status === 'error') { el.classList.remove('dash-skeleton'); el.replaceChildren(fail()); return false; }
    if (inline) { el.textContent = '—'; return false; }
    el.replaceChildren();
    el.classList.toggle('dash-skeleton', d.status === 'loading');
    return false;
  };
  const fit = (s, n) => s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s.padEnd(n, ' ');
  const num = (n) => d3.format(',')(n);
  // horizontal bars: label ████░░░░ n
  const bars = (el, items, o = {}) => {
    el.replaceChildren();
    const c = cols(el);
    const max = d3.max(items, (i) => i.n) || 1;
    const nW = d3.max(items, (i) => num(i.n).length);
    const lW = Math.min(d3.max(items, (i) => i.label.length), Math.max(8, Math.floor(c * 0.36)));
    const bW = Math.max(6, c - lW - nW - 2);
    for (const it of items) {
      const f = Math.max(it.n > 0 ? 1 : 0, Math.round((it.n / max) * bW));
      el.appendChild(row(span('', fit(it.label, lW) + ' '), span(o.cls, (o.glyph || '█').repeat(f)), span('k-line', '░'.repeat(bW - f)), span('k-total', ' ' + num(it.n).padStart(nW, ' '))));
    }
  };
  // lollipop: label ─────────● n
  const lolli = (el, items, o = {}) => {
    el.replaceChildren();
    const c = cols(el);
    const max = d3.max(items, (i) => i.n) || 1;
    const nW = d3.max(items, (i) => num(i.n).length);
    const lW = Math.min(d3.max(items, (i) => i.label.length), Math.max(8, Math.floor(c * 0.36)));
    const bW = Math.max(6, c - lW - nW - 3);
    for (const it of items) {
      const f = Math.max(0, Math.round((it.n / max) * (bW - 1)));
      el.appendChild(row(span('', fit(it.label, lW) + ' '), span('k-line', '─'.repeat(f)), span(o.cls, '●'), span('k-line', ' '.repeat(bW - 1 - f)), span('k-total', ' ' + num(it.n).padStart(nW, ' '))));
    }
  };
  // fractional-block bars: ◆ label ▉▉▍ n
  const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];
  const frac = (el, items, o = {}) => {
    el.replaceChildren();
    const c = cols(el, 20);
    const max = d3.max(items, (i) => i.n) || 1;
    const nW = d3.max(items, (i) => num(i.n).length);
    const lW = Math.min(d3.max(items, (i) => i.label.length), Math.max(6, Math.floor(c * 0.42)));
    const bW = Math.max(4, c - lW - nW - 4);
    for (const it of items) {
      const units = (it.n / max) * bW * 8;
      const whole = Math.floor(units / 8), part = Math.round(units % 8);
      const bar = '█'.repeat(whole) + (EIGHTHS[part] || '');
      el.appendChild(row(span(o.cls, (o.sym || '·') + ' '), span('', fit(it.label, lW) + ' '), span(o.cls, bar || '▏'), span('', ' '.repeat(Math.max(0, bW - Math.max(1, bar.length)))), span('k-total', ' ' + num(it.n).padStart(nW, ' '))));
    }
  };
  // vertical block columns, several text rows tall, years along the bottom
  const BLOCKS = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const columns = (el, rowsData, o = {}) => {
    el.replaceChildren();
    const H = o.height || 7;
    const max = d3.max(rowsData, (r) => r.n) || 1;
    const c = cols(el, 20);
    const cw = Math.max(3, Math.min(7, Math.floor((c - 6) / rowsData.length)));
    const pad = (s) => s.padStart(Math.ceil((cw + s.length) / 2), ' ').padEnd(cw, ' ');
    const yW = String(max).length;
    el.appendChild(row(span('k-dim', ' '.repeat(yW + 2)), ...rowsData.map((r) => span('k-total', pad(num(r.n))))));
    for (let lvl = H; lvl >= 1; lvl--) {
      const lab = lvl === H ? String(max).padStart(yW, ' ') + ' ┤' : lvl === 1 ? '0'.padStart(yW, ' ') + ' ┤' : ' '.repeat(yW) + ' │';
      const parts = [span('k-dim', lab)];
      for (const r of rowsData) {
        const h = (r.n / max) * H * 8;
        const full = Math.floor(h / 8), rem = Math.round(h % 8);
        let ch = ' ';
        if (lvl <= full) ch = '█'; else if (lvl === full + 1 && rem > 0) ch = BLOCKS[rem];
        if (r.n > 0 && lvl === 1 && ch === ' ') ch = '▁';
        const w = Math.max(1, cw - 2);
        parts.push(span(o.cls, ' ' + ch.repeat(w).padEnd(cw - 1, ' ')));
      }
      el.appendChild(row(...parts));
    }
    el.appendChild(row(span('k-dim', ' '.repeat(yW + 1) + '└' + '─'.repeat(cw * rowsData.length))));
    el.appendChild(row(span('k-dim', ' '.repeat(yW + 2)), ...rowsData.map((r) => span('k-dim', pad("'" + String(r.year).slice(2))))));
  };
  const tip = (box) => { const t = document.createElement('div'); t.className = 'tx-tip'; t.hidden = true; box.appendChild(t); return t; };
  const placeTip = (t, box, ev) => {
    const r = box.getBoundingClientRect();
    let x = ev.clientX - r.left + 12, y = ev.clientY - r.top + 12;
    t.hidden = false;
    const w = t.offsetWidth, h = t.offsetHeight;
    if (x + w > r.width) x = Math.max(0, ev.clientX - r.left - w - 12);
    if (y + h > r.height) y = Math.max(0, ev.clientY - r.top - h - 12);
    t.style.left = x + 'px'; t.style.top = y + 'px';
  };
  const tipText = (t, head, body) => { t.replaceChildren(span('tx-tk', head), document.createTextNode(' ' + body)); };
  const fmt = (field, v) => {
    if (v == null || Number.isNaN(v)) return '—';
    if (typeof v === 'string') return v;
    if (/Share$/.test(field)) return d3.format('.1%')(v);
    if (field === 'avg') return d3.format('.1f')(v);
    if (/Year$/.test(field)) return String(v);
    return d3.format(',')(v);
  };
  const day = (iso) => iso ? d3.utcFormat('%-d %b %Y')(new Date(iso)) : '';
  return { LAYER_GLYPH, layerClass, charW, cols, span, row, ready, fit, num, bars, lolli, frac, columns, tip, placeTip, tipText, fmt, day };
})();
