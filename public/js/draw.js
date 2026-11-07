
const SIZE = () => { const s = dash.params().size; return s === 's' || s === 'l' ? s : 'm'; };

/* ── small values ── */
dash.draw('kpi', (el) => {
  const d = dash.data(el.dataset.source);
  if (!TX.ready(el, d, true)) return;
  const f = el.dataset.field;
  el.textContent = TX.fmt(f, d.data[0][f]);
});
dash.draw('fact', (el) => {
  const d = dash.data('facts');
  if (!TX.ready(el, d, true)) return;
  const f = el.dataset.field;
  el.textContent = TX.fmt(f, d.data[0][f]);
});
// a count that is a problem (red) or needs action (orange) only when above zero
dash.draw('kpi-flag', (el) => {
  const d = dash.data(el.dataset.source);
  el.classList.remove('k-bad', 'k-act', 'k-dim');
  if (!TX.ready(el, d, true)) return;
  const v = d.data[0][el.dataset.field] || 0;
  el.textContent = TX.num(v);
  el.classList.add(v > 0 ? (el.dataset.flag === 'bad' ? 'k-bad' : 'k-act') : 'k-dim');
});
dash.draw('inbox-pill', (el) => {
  const d = dash.data('kpis');
  el.classList.remove('k-act', 'k-dim');
  if (d.status !== 'ok' || !d.data.length) { el.textContent = '—'; return; }
  const n = d.data[0].inbox || 0;
  el.textContent = n ? TX.num(n) + ' waiting' : 'clear';
  el.classList.add(n ? 'k-act' : 'k-dim');
});
dash.draw('range', (el) => {
  const d = dash.data('per_year');
  if (!TX.ready(el, d, true)) return;
  const ys = d.data.filter((r) => r.n > 0).map((r) => r.year);
  el.textContent = ys.length ? d3.min(ys) + '–' + d3.max(ys) : '—';
});
dash.draw('last-save', (el) => {
  const d = dash.data('recent');
  if (!TX.ready(el, d, true)) return;
  el.textContent = TX.day(d.data[0].created) + ' · ' + d.data[0].title;
});

/* ── tables ── */
const fillRows = (tb, rows, colsSpec) => {
  tb.replaceChildren();
  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.dataset.key = String(r.id);
    for (const [field, cls, fmt] of colsSpec) {
      const td = document.createElement('td');
      if (cls) td.className = cls;
      const val = fmt ? fmt(r[field], r) : String(r[field] ?? '');
      if (val instanceof Node) td.appendChild(val); else td.textContent = val;
      tr.appendChild(td);
    }
    tb.appendChild(tr);
  }
};
const linked = (title, r) => {
  if (!r.link) return title;
  const a = document.createElement('a');
  a.href = r.link; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = title;
  return a;
};
dash.draw('inbox', (tb) => {
  const d = dash.data('inbox');
  if (d.status !== 'ok') { tb.replaceChildren(); return; }
  fillRows(tb, d.data, [['title', 'k-act', linked], ['domain', 'tx-tags k-dim'], ['created', 'tx-date', TX.day]]);
});
dash.draw('recent', (tb) => {
  const d = dash.data('recent');
  if (d.status !== 'ok') { tb.replaceChildren(); return; }
  fillRows(tb, d.data, [['title', '', linked], ['folder', 'k-dim'], ['created', 'tx-date', TX.day]]);
});
dash.draw('thin', (tb) => {
  const d = dash.data('thin');
  if (d.status !== 'ok') { tb.replaceChildren(); return; }
  fillRows(tb, d.data, [['folder', ''], ['hub', 'k-dim'], ['total', 'tx-n k-total', (v) => TX.num(v)], ['status', '', (v) => TX.span(v === 'EMPTY' ? 'k-bad' : 'k-act', v)]]);
});

/* ── selects ── */
dash.draw('hub-sel', (sel) => {
  const g = dash.data('hubs');
  sel.replaceChildren(new Option('all hubs', ''), ...(g.status === 'ok' ? g.data : []).map((h) => new Option(h.hub + ' (' + TX.num(h.total) + ')', h.hub)));
  sel.value = dash.params().hub ?? '';
  sel.onchange = () => dash.setParams({ hub: sel.value || null });
});
dash.draw('year-sel', (sel) => {
  const g = dash.data('per_year');
  const p = sel.dataset.param;
  const years = g.status === 'ok' ? g.data.filter((r) => r.n > 0).map((r) => r.year) : [];
  sel.replaceChildren(...years.map((y) => new Option(String(y), String(y))));
  const cur = dash.params()[p];
  sel.value = cur != null ? String(cur) : '';
  sel.onchange = () => dash.setParams({ [p]: Number(sel.value) });
});
dash.draw('project-sel', (sel) => {
  const g = dash.data('tags');
  const names = g.status === 'ok' ? g.data.filter((t) => t.layer === 'for').sort((a, b) => b.n - a.n).map((t) => t.name) : [];
  sel.replaceChildren(...names.map((n) => new Option('for/' + n, n)));
  sel.value = dash.params().project || names[0] || '';
  sel.onchange = () => dash.setParams({ project: sel.value });
});

/* ── hub share strip (df) ── */
dash.draw('hubs', (el) => {
  const d = dash.data('hubs');
  if (!TX.ready(el, d)) return;
  el.replaceChildren();
  const rows = d.data, total = d3.sum(rows, (r) => r.total) || 1;
  const c = TX.cols(el, 30);
  const W = Math.max(20, c - 2);
  const glyphs = ['█', '▓', '▒', '░'];
  // largest-remainder widths so the strip is exactly W wide
  const raw = rows.map((r) => (r.total / total) * W);
  const w = raw.map(Math.floor);
  let left = W - d3.sum(w);
  raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { w[i]++; left--; } });
  const strip = [TX.span('k-dim', '[')];
  rows.forEach((r, i) => strip.push(TX.span(i % 2 ? 'k-minor' : 'k-topic', glyphs[i % 4].repeat(w[i]))));
  strip.push(TX.span('k-dim', ']'));
  el.appendChild(TX.row(...strip));
  el.appendChild(TX.row(TX.span('k-dim', ' ')));
  const lW = Math.min(d3.max(rows, (r) => r.hub.length), 22);
  const perCol = Math.max(1, Math.floor(c / (lW + 20)));
  const per = Math.ceil(rows.length / perCol);
  for (let i = 0; i < per; i++) {
    const parts = [];
    for (let j = 0; j < perCol; j++) {
      const k = j * per + i, r = rows[k];
      if (!r) continue;
      parts.push(TX.span(k % 2 ? 'k-minor' : 'k-topic', glyphs[k % 4].repeat(2) + ' '), TX.span('', TX.fit(r.hub, lW) + ' '), TX.span('k-total', TX.num(r.total).padStart(4, ' ')), TX.span('k-dim', ' ' + d3.format('5.1%')(r.share) + '   '));
    }
    el.appendChild(TX.row(...parts));
  }
  el.appendChild(TX.row(TX.span('k-dim', ' '.repeat(lW + 3) + '────')));
  el.appendChild(TX.row(TX.span('k-dim', TX.fit('total', lW + 3)), TX.span('k-total', TX.num(total).padStart(4, ' '))));
});

/* ── year chart (svg): green bars, white running-total line ── */
const yearChart = (el, rows) => {
  el.replaceChildren();
  const W = Math.max(280, el.clientWidth || 600), H = { s: 170, m: 230, l: 340 }[SIZE()];
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Bookmarks saved per year with running total');
  const maxN = d3.max(rows, (r) => r.n) || 1, maxC = d3.max(rows, (r) => r.cum) || 1;
  const yL = d3.scaleLinear([0, maxN], [0, 1]).nice(), yR = d3.scaleLinear([0, maxC], [0, 1]).nice();
  const probe = svg.append('text').attr('font-size', 11);
  const tw = (s) => { probe.text(s); return probe.node().getComputedTextLength(); };
  const lt = yL.ticks(4), rt = yR.ticks(4);
  const m = { t: 18, b: 24, l: Math.ceil(d3.max(lt, (t) => tw(TX.num(t)))) + 10, r: Math.ceil(d3.max(rt, (t) => tw(TX.num(t)))) + 10 };
  probe.remove();
  yL.range([H - m.b, m.t]); yR.range([H - m.b, m.t]);
  const x = d3.scaleBand(rows.map((r) => r.year), [m.l, W - m.r]).padding(0.3);
  const g = svg.append('g');
  g.selectAll('line.g').data(lt).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', (t) => yL(t)).attr('y2', (t) => yL(t)).style('stroke', 'var(--faint)').attr('stroke-dasharray', '1 3');
  g.selectAll('text.yl').data(lt).join('text').attr('x', m.l - 6).attr('y', (t) => yL(t) + 4).attr('text-anchor', 'end').attr('font-size', 11).style('fill', 'var(--dim)').text((t) => TX.num(t));
  g.selectAll('text.yr').data(rt).join('text').attr('x', W - m.r + 6).attr('y', (t) => yR(t) + 4).attr('font-size', 11).style('fill', 'var(--k-total)').attr('opacity', 0.6).text((t) => TX.num(t));
  const bw = Math.min(30, x.bandwidth()), bx = (r) => x(r.year) + (x.bandwidth() - bw) / 2;
  g.selectAll('rect.b').data(rows).join('rect').attr('x', bx).attr('width', bw).attr('y', (r) => yL(r.n)).attr('height', (r) => Math.max(0, yL(0) - yL(r.n))).style('fill', 'var(--fg2)');
  g.selectAll('rect.cap').data(rows).join('rect').attr('x', bx).attr('width', bw).attr('y', (r) => yL(r.n)).attr('height', (r) => r.n > 0 ? 2 : 0).style('fill', 'var(--fg)');
  g.selectAll('text.v').data(rows).join('text').attr('x', (r) => bx(r) + bw / 2).attr('y', (r) => yL(r.n) - 5).attr('text-anchor', 'middle').attr('font-size', 11).style('fill', 'var(--fg)').text((r) => TX.num(r.n));
  const step = x.bandwidth() < 26 ? 2 : 1;
  g.selectAll('text.x').data(rows).join('text').attr('x', (r) => x(r.year) + x.bandwidth() / 2).attr('y', H - 7).attr('text-anchor', 'middle').attr('font-size', 11).style('fill', 'var(--dim)').text((r, i) => (i % step === 0 || i === rows.length - 1) ? (step > 1 ? "'" + String(r.year).slice(2) : r.year) : '');
  g.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', yL(0)).attr('y2', yL(0)).style('stroke', 'var(--fg2)');
  const line = d3.line().x((r) => x(r.year) + x.bandwidth() / 2).y((r) => yR(r.cum));
  g.append('path').datum(rows).attr('d', line).style('fill', 'none').style('stroke', 'var(--k-total)').attr('stroke-width', 1.5).attr('stroke-dasharray', '4 3');
  g.selectAll('rect.pt').data(rows).join('rect').attr('x', (r) => x(r.year) + x.bandwidth() / 2 - 3).attr('y', (r) => yR(r.cum) - 3).attr('width', 6).attr('height', 6).style('fill', 'var(--k-total)');
  const t = TX.tip(el);
  g.selectAll('rect.hit').data(rows).join('rect').attr('x', (r) => x(r.year)).attr('width', x.bandwidth()).attr('y', m.t).attr('height', H - m.t - m.b).style('fill', 'transparent')
    .on('mousemove', (ev, r) => { TX.tipText(t, String(r.year), TX.num(r.n) + ' saved · ' + TX.num(r.cum) + ' total'); TX.placeTip(t, el, ev); })
    .on('mouseleave', () => { t.hidden = true; });
};
dash.draw('years', (el) => {
  const d = dash.data('per_year');
  if (!TX.ready(el, d)) return;
  yearChart(el, d.data);
});

/* ── ascii heatmap: hubs × years ── */
dash.draw('heat', (el) => {
  const yh = dash.data('year_hub'), h = dash.data('hubs'), py = dash.data('per_year');
  if (!TX.ready(el, yh) || !TX.ready(el, h) || !TX.ready(el, py)) return;
  el.replaceChildren();
  const years = py.data.filter((r) => r.n > 0).map((r) => r.year);
  const hubs = h.data.map((x) => x.hub);
  const get = (hub, y) => { const r = yh.data.find((x) => x.hub === hub && x.year === y); return r ? r.n : 0; };
  const max = d3.max(hubs, (hb) => d3.max(years, (y) => get(hb, y))) || 1;
  const c = TX.cols(el, 30);
  const lW = Math.min(d3.max(hubs, (s) => s.length), Math.max(8, Math.floor(c * 0.3)));
  const cw = Math.max(3, Math.min(6, Math.floor((c - lW - 1) / years.length)));
  const shade = (n) => n === 0 ? '·' : n / max >= 0.75 ? '█' : n / max >= 0.45 ? '▓' : n / max >= 0.2 ? '▒' : '░';
  const t = TX.tip(el);
  el.appendChild(TX.row(TX.span('k-dim', ' '.repeat(lW + 1)), ...years.map((y) => TX.span('k-dim', ("'" + String(y).slice(2)).padEnd(cw, ' ')))));
  for (const hb of hubs) {
    const parts = [TX.span('', TX.fit(hb, lW) + ' ')];
    for (const y of years) {
      const n = get(hb, y);
      const cell = TX.span(n === 0 ? 'k-line' : n === max ? 'k-total' : 'k-topic', shade(n).repeat(cw - 1) + ' ');
      cell.addEventListener('mousemove', (ev) => { TX.tipText(t, hb + ' ' + y, TX.num(n) + ' saved'); TX.placeTip(t, el, ev); });
      cell.addEventListener('mouseleave', () => { t.hidden = true; });
      parts.push(cell);
    }
    el.appendChild(TX.row(...parts));
  }
  el.appendChild(TX.row(TX.span('k-dim', ' ')));
  el.appendChild(TX.row(TX.span('k-dim', 'scale: · 0  ░ <20%  ▒ <45%  ▓ <75%  █ 75%+  '), TX.span('k-total', '█ busiest = ' + TX.num(max))));
});

/* ── treemap (svg), all green: folders are structure ── */
dash.draw('tree', (el) => {
  const d = dash.data('collections');
  if (!TX.ready(el, d)) return;
  el.replaceChildren();
  const cols = d.data.filter((c) => c.id > 0);
  const kids = d3.group(cols, (c) => c.parent);
  const node = (c) => ({ name: c.title, value: c.direct, children: (kids.get(c.id) || []).map(node) });
  const rootData = { name: 'library', value: 0, children: cols.filter((c) => c.parent === null && !c.inbox).map(node) };
  const W = Math.max(280, el.clientWidth || 800);
  const H = Math.round(Math.max(260, Math.min(760, W * { s: 0.36, m: 0.45, l: 0.55 }[SIZE()])));
  const root = d3.hierarchy(rootData).sum((n) => n.value).sort((a, b) => b.value - a.value);
  d3.treemap().size([W, H]).paddingOuter(2).paddingTop((n) => n.depth === 1 ? 17 : n.depth === 0 ? 0 : 2).paddingInner(2).round(true)(root);
  const hubs = root.children || [];
  const maxLeaf = d3.max(root.leaves(), (n) => n.value) || 1;
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Treemap of folders by bookmark count');
  const t = TX.tip(el);
  const path = (n) => n.ancestors().reverse().slice(1).map((a) => a.data.name).join(' › ');
  svg.selectAll('rect.hub').data(hubs).join('rect').attr('x', (n) => n.x0).attr('y', (n) => n.y0).attr('width', (n) => n.x1 - n.x0).attr('height', (n) => n.y1 - n.y0).style('fill', 'var(--bg)').style('stroke', 'var(--fg2)');
  const leaves = root.leaves().filter((n) => n.depth >= 1 && n.value > 0 && n.x1 > n.x0);
  const cells = svg.selectAll('g.leaf').data(leaves).join('g').attr('transform', (n) => `translate(${n.x0},${n.y0})`);
  cells.append('rect').attr('width', (n) => n.x1 - n.x0).attr('height', (n) => n.y1 - n.y0)
    .style('fill', 'var(--fg)').attr('fill-opacity', (n) => 0.06 + 0.3 * (n.value / maxLeaf)).style('stroke', 'var(--line)')
    .on('mousemove', (ev, n) => { d3.select(ev.currentTarget).style('stroke', 'var(--blue-line)'); TX.tipText(t, path(n), '· ' + TX.num(n.value)); TX.placeTip(t, el, ev); })
    .on('mouseleave', (ev) => { d3.select(ev.currentTarget).style('stroke', 'var(--line)'); t.hidden = true; });
  const cw = 6.7;
  cells.each(function (n) {
    const w = n.x1 - n.x0, h = n.y1 - n.y0;
    if (w < 34 || h < 16) return;
    const max = Math.floor((w - 8) / cw);
    const name = n.data.name.length > max ? n.data.name.slice(0, Math.max(1, max - 1)) + '…' : n.data.name;
    const gg = d3.select(this);
    gg.append('text').attr('x', 4).attr('y', 12).attr('font-size', 11).style('fill', 'var(--fg)').attr('pointer-events', 'none').text(name);
    if (h >= 30) gg.append('text').attr('x', 4).attr('y', 25).attr('font-size', 11).style('fill', 'var(--k-total)').attr('pointer-events', 'none').text(TX.num(n.value));
  });
  svg.selectAll('text.hub').data(hubs).join('text').attr('x', (n) => n.x0 + 4).attr('y', (n) => n.y0 + 12).attr('font-size', 11).attr('font-weight', 700).style('fill', 'var(--k-total)').attr('pointer-events', 'none')
    .text((n) => { const w = n.x1 - n.x0; const full = n.data.name.toUpperCase() + ' ' + TX.num(n.value); const max = Math.floor((w - 8) / cw); return full.length <= max ? full : max > 3 ? full.slice(0, max - 1) + '…' : ''; });
});

/* ── butterfly: year A ◄ hub ► year B ── */
dash.draw('compare', (el) => {
  const yh = dash.data('year_hub'), h = dash.data('hubs');
  if (!TX.ready(el, yh) || !TX.ready(el, h)) return;
  el.replaceChildren();
  const ya = Number(dash.params().ya), yb = Number(dash.params().yb);
  const count = (hub, y) => { const r = yh.data.find((x) => x.hub === hub && x.year === y); return r ? r.n : 0; };
  const rows = h.data.map((x) => ({ hub: x.hub, a: count(x.hub, ya), b: count(x.hub, yb) }));
  const c = TX.cols(el, 34);
  const max = d3.max(rows, (r) => Math.max(r.a, r.b)) || 1;
  const nW = Math.max(3, d3.max(rows, (r) => Math.max(String(r.a).length, String(r.b).length)));
  const lW = Math.min(d3.max(rows, (r) => r.hub.length), Math.max(8, Math.floor(c * 0.26)));
  const bW = Math.max(4, Math.floor((c - lW - 2 * nW - 10) / 2));
  const center = (s, n) => { s = s.length > n ? s.slice(0, n - 1) + '…' : s; const l = Math.floor((n - s.length) / 2); return ' '.repeat(l) + s + ' '.repeat(n - s.length - l); };
  el.appendChild(TX.row(TX.span('k-dim', ' '.repeat(nW + 1) + String(ya).padStart(bW, ' ') + ' ◄' + center('hub', lW) + '► ' + String(yb).padEnd(bW, ' '))));
  for (const r of rows) {
    const fa = Math.max(r.a > 0 ? 1 : 0, Math.round((r.a / max) * bW));
    const fb = Math.max(r.b > 0 ? 1 : 0, Math.round((r.b / max) * bW));
    const dlt = r.b - r.a;
    el.appendChild(TX.row(
      TX.span('k-total', String(r.a).padStart(nW, ' ') + ' '),
      TX.span('k-line', '·'.repeat(bW - fa)), TX.span('k-minor', '█'.repeat(fa)),
      TX.span('k-dim', ' │'), TX.span('', center(r.hub, lW)), TX.span('k-dim', '│ '),
      TX.span('k-topic', '█'.repeat(fb)), TX.span('k-line', '·'.repeat(bW - fb)),
      TX.span('k-total', ' ' + String(r.b).padEnd(nW, ' ')),
      TX.span(dlt > 0 ? 'k-topic' : 'k-dim', ' ' + (dlt > 0 ? '▲' + dlt : dlt < 0 ? '▼' + -dlt : '=')),
    ));
  }
});

/* ── project tracker: vertical block columns in the for/ colour ── */
dash.draw('project', (el) => {
  const d = dash.data('project_year'), py = dash.data('per_year');
  if (!TX.ready(el, d) || !TX.ready(el, py)) return;
  const totals = d3.rollups(d.data, (v) => d3.sum(v, (r) => r.n), (r) => r.project).sort((x, y) => y[1] - x[1]);
  const project = dash.params().project || (totals[0] ? totals[0][0] : '');
  const years = py.data.filter((r) => r.n > 0).map((r) => r.year);
  const rows = years.map((y) => { const hit = d.data.find((r) => r.project === project && r.year === y); return { year: y, n: hit ? hit.n : 0 }; });
  TX.columns(el, rows, { cls: 'k-for', height: { s: 5, m: 7, l: 11 }[SIZE()] });
  el.appendChild(TX.row(TX.span('k-dim', 'total '), TX.span('k-for', 'for/' + project), TX.span('k-dim', ' = '), TX.span('k-total', TX.num(d3.sum(rows, (r) => r.n)))));
});

/* ── waffle: 100 cells of tag links, one glyph+colour per layer ── */
dash.draw('waffle', (el) => {
  const d = dash.data('layers');
  if (!TX.ready(el, d)) return;
  el.replaceChildren();
  const rows = d.data, total = d3.sum(rows, (r) => r.links) || 1;
  const raw = rows.map((r) => (r.links / total) * 100);
  const n = raw.map(Math.floor);
  let left = 100 - d3.sum(n);
  raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { n[i]++; left--; } });
  const cells = [];
  rows.forEach((r, i) => { for (let k = 0; k < n[i]; k++) cells.push(r.layer); });
  const legend = rows.map((r, i) => [TX.span(TX.layerClass(r.layer), TX.LAYER_GLYPH[r.layer] || '·'), TX.span('', ' ' + TX.fit(r.layer + '/', 7)), TX.span('k-total', TX.num(r.links).padStart(5, ' ')), TX.span('k-dim', ' ' + String(n[i]).padStart(2, ' ') + '% (' + r.tags + ' tags)')]);
  const side = TX.cols(el, 20) >= 52;
  for (let y = 0; y < 10; y++) {
    const parts = [];
    for (let x = 0; x < 10; x++) { const l = cells[y * 10 + x]; parts.push(TX.span(l ? TX.layerClass(l) : 'k-line', (l ? (TX.LAYER_GLYPH[l] || '·') : '·') + ' ')); }
    if (side && legend[y]) parts.push(TX.span('', '   '), ...legend[y]);
    el.appendChild(TX.row(...parts));
  }
  if (!side) { el.appendChild(TX.row(TX.span('', ' '))); legend.forEach((l) => el.appendChild(TX.row(...l))); }
});

/* ── tag layer charts (filtered by hub) ── */
const layerItems = (el) => {
  const d = dash.data('hub_tags');
  if (!TX.ready(el, d)) return null;
  const hub = dash.params().hub || '*';
  const limit = Number(el.dataset.limit) || Infinity;
  const items = d.data.filter((t) => t.hub === hub && t.layer === el.dataset.layer).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, limit).map((t) => ({ label: t.name, n: t.n }));
  if (!items.length) { el.replaceChildren(TX.span('k-dim', 'none in this hub')); return null; }
  return items;
};
dash.draw('bars', (el) => { const it = layerItems(el); if (it) TX.bars(el, it, { cls: TX.layerClass(el.dataset.layer), glyph: el.dataset.glyph || '█' }); });
dash.draw('lolli', (el) => { const it = layerItems(el); if (it) TX.lolli(el, it, { cls: TX.layerClass(el.dataset.layer) }); });
dash.draw('frac', (el) => { const it = layerItems(el); if (it) TX.frac(el, it, { cls: 'k-minor', sym: el.dataset.sym }); });

/* ── file structure: collapsible tree with bookmarks ── */
dash.draw('ftree', {
  mount: (el) => {
    el.replaceChildren();
    const bar = document.createElement('div'); bar.className = 'tx-ftool';
    const q = document.createElement('input'); q.className = 'tx-in'; q.type = 'search'; q.id = 'ftree-q'; q.placeholder = '/ search titles, sites, tags'; q.setAttribute('aria-label', 'Search bookmarks');
    const ex = document.createElement('button'); ex.type = 'button'; ex.className = 'tx-btn'; ex.textContent = '[+] expand all';
    const co = document.createElement('button'); co.type = 'button'; co.className = 'tx-btn'; co.textContent = '[−] collapse all';
    const info = document.createElement('span'); info.className = 'k-dim';
    bar.append(q, ex, co, info);
    const box = document.createElement('div'); box.className = 'tx-ft';
    el.append(bar, box);
    const made = { q, box, info, open: new Set(), all: null, render: null };
    q.addEventListener('input', () => made.render && made.render());
    ex.addEventListener('click', () => { made.all = true; made.box.querySelectorAll('details').forEach((dt) => { dt.open = true; made.open.add(dt.dataset.id); }); });
    co.addEventListener('click', () => { made.all = false; made.open.clear(); made.box.querySelectorAll('details').forEach((dt) => { dt.open = false; }); });
    return made;
  },
  update: (el, made) => {
    const cd = dash.data('collections'), bd = dash.data('bm');
    if (cd.status !== 'ok' || bd.status !== 'ok') {
      made.box.replaceChildren(TX.span(cd.status === 'error' || bd.status === 'error' ? 'k-bad' : 'k-dim', cd.status === 'error' || bd.status === 'error' ? '✕ failed to load' : 'loading tree…'));
      return;
    }
    el.classList.remove('dash-skeleton');
    made.render = () => {
      const q = made.q.value.trim().toLowerCase();
      const cols = cd.data.filter((c) => c.id > 0);
      const kids = d3.group(cols, (c) => c.parent);
      const marks = d3.group(bd.data, (b) => b.folderId);
      const hit = (b) => !q || (b.title + ' ' + b.domain + ' ' + b.tags).toLowerCase().includes(q);
      const count = new Map();
      const countHits = (c) => { let n = (marks.get(c.id) || []).filter(hit).length; for (const k of kids.get(c.id) || []) n += countHits(k); count.set(c.id, n); return n; };
      const tops = cols.filter((c) => c.parent === null).sort((a, b) => (a.inbox ? -1 : b.inbox ? 1 : b.total - a.total));
      let shown = 0;
      tops.forEach(countHits);
      const frag = document.createDocumentFragment();
      const rootLine = document.createElement('div');
      rootLine.append(TX.span('k-topic', '~/raindrop '), TX.span('k-total', '(' + TX.num(d3.sum(tops, (c) => c.total)) + ')'));
      frag.appendChild(rootLine);
      const tagSpan = (tags, layer) => { const t = tags.split(' ').find((x) => x.startsWith(layer + '/')); return t ? TX.span(TX.layerClass(layer), ' ' + t) : null; };
      const folder = (c, prefix, last) => {
        if (q && !count.get(c.id)) return null;
        const det = document.createElement('details');
        det.dataset.id = String(c.id);
        det.open = q ? true : made.open.has(String(c.id));
        det.addEventListener('toggle', () => { if (q) return; if (det.open) made.open.add(det.dataset.id); else made.open.delete(det.dataset.id); });
        const sum = document.createElement('summary');
        const isInbox = c.inbox;
        const n = q ? count.get(c.id) : c.total;
        sum.append(TX.span('k-line', prefix + (last ? '└── ' : '├── ')), TX.span('tx-tw', ''), TX.span(isInbox && c.total > 0 ? 'k-act tx-fn' : 'tx-fn', c.title));
        if (c.total === 0 && !q) sum.append(TX.span('k-bad', ' (empty)'));
        else sum.append(TX.span(isInbox && c.total > 0 ? 'k-act' : 'k-total', ' (' + TX.num(n) + ')'));
        det.appendChild(sum);
        const sub = prefix + (last ? '    ' : '│   ');
        const children = (kids.get(c.id) || []).slice().sort((a, b) => b.total - a.total).filter((k) => !q || count.get(k.id));
        const items = (marks.get(c.id) || []).filter(hit).slice().sort((a, b) => a.title.localeCompare(b.title));
        children.forEach((k, i) => { const f = folder(k, sub, i === children.length - 1 && !items.length); if (f) det.appendChild(f); });
        items.forEach((b, i) => {
          const line = document.createElement('div'); line.className = 'tx-bk';
          line.append(TX.span('k-line', sub + (i === items.length - 1 ? '└── ' : '├── ')), TX.span('k-dim', '◦ '));
          if (b.link) { const a = document.createElement('a'); a.href = b.link; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.className = 'tx-bt'; a.textContent = b.title || b.domain; line.appendChild(a); }
          else line.appendChild(TX.span('tx-bt', b.title || b.domain));
          const ty = tagSpan(b.tags, 'type'), us = tagSpan(b.tags, 'use');
          if (ty) line.appendChild(ty);
          if (us) line.appendChild(us);
          det.appendChild(line);
          shown++;
        });
        return det;
      };
      tops.forEach((c, i) => { const f = folder(c, '', i === tops.length - 1); if (f) frag.appendChild(f); });
      made.box.replaceChildren(frag);
      made.info.textContent = q ? TX.num(d3.sum(tops, (c) => count.get(c.id) || 0)) + ' matches' : TX.num(cols.length) + ' folders · ' + TX.num(bd.data.length) + ' bookmarks';
    };
    made.render();
  },
});
