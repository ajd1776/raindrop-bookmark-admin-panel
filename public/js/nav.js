// pages + top tab bar
const PAGES = ['admin', 'stats', 'files', 'connect'];
const showPage = (id, link) => {
  if (!PAGES.includes(id)) return;
  document.querySelectorAll('.tx-page').forEach((p) => { p.hidden = p.id !== id; });
  document.querySelectorAll('.tx-tab').forEach((b) => { if (b.dataset.page === id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  if (link !== false) dash.setLink(id);
  dash.rerender();
};
document.querySelectorAll('.tx-tab').forEach((b) => b.addEventListener('click', () => {
  showPage(b.dataset.page);
  window.scrollTo(0, 0);
}));
showPage(PAGES.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'admin', false);
requestAnimationFrame(() => window.scrollTo(0, 0)); // a #page link should open the page at the top, not jump to its anchor

// re-read every Raindrop source
const refreshAll = () => dash.refreshAll();
document.querySelectorAll('.tx-refresh').forEach((b) => b.addEventListener('click', refreshAll));

// keys: 1 2 3 pages · R re-read · / search the tree
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t && (t.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName))) return;
  if (['1', '2', '3', '4'].includes(e.key)) { showPage(PAGES[Number(e.key) - 1]); return; }
  if (e.key === 'r' || e.key === 'R') { refreshAll(); return; }
  if (e.key === '/') {
    const q = document.getElementById('ftree-q');
    if (q) { e.preventDefault(); showPage('files'); setTimeout(() => q.focus(), 0); }
  }
});

// copy buttons
document.querySelectorAll('.tx-copy').forEach((btn) => btn.addEventListener('click', () => {
  const text = btn.dataset.copy;
  const flip = (copied) => {
    btn.querySelectorAll('.tx-c1').forEach((s) => { s.hidden = copied; });
    btn.querySelectorAll('.tx-c2').forEach((s) => { s.hidden = !copied; });
  };
  const done = () => { flip(true); setTimeout(() => flip(false), 1600); };
  const fallback = () => {
    const code = btn.parentElement && btn.parentElement.querySelector('code');
    if (!code) return;
    const r = document.createRange(); r.selectNodeContents(code);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
  };
  try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
}));

// inbox queue: table only when something is waiting
dash.onData(() => {
  const k = dash.data('kpis');
  const n = k.status === 'ok' && k.data.length ? (k.data[0].inbox || 0) : 0;
  document.querySelectorAll('.tx-inbox-box').forEach((b) => { b.hidden = n === 0; });
  document.querySelectorAll('.tx-inbox-empty').forEach((p) => { p.hidden = n !== 0 || k.status !== 'ok'; });
});

// chart size switch on the stats page (S / M / L)
document.querySelectorAll('.tx-sz').forEach((b) => b.addEventListener('click', () => dash.setParams({ size: b.dataset.size })));
dash.onData(() => {
  const s = dash.params().size === 's' || dash.params().size === 'l' ? dash.params().size : 'm';
  document.querySelectorAll('.tx-sz').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.size === s)));
  document.querySelectorAll('#stats-grid').forEach((g) => { g.classList.remove('tx-sz-s', 'tx-sz-m', 'tx-sz-l'); g.classList.add('tx-sz-' + s); });
});
