// Boot: decide LIVE (local server + connected Raindrop) or DEMO (made-up data), then wire up
// the CONNECT page and the Claude actions (preview → review → apply).
(() => {
  const TOKEN = document.querySelector('meta[name="panel-token"]')?.content || '';
  const HAS_SERVER = TOKEN && !TOKEN.startsWith('__');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const text = (sel, v) => $$(sel).forEach((el) => { el.textContent = v; });
  let STATUS = { live: false, raindrop: {}, claude: {}, claudeCode: false };

  async function api(path, body) {
    const res = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: { 'X-Panel-Token': TOKEN, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(json.error || `Request failed (${res.status})`); e.status = res.status; throw e; }
    return json;
  }

  function wireSources() {
    if (STATUS.live) {
      dash.source('tags', () => api('/api/data/tags'));
      dash.source('collections', () => api('/api/data/collections'));
      dash.source('all_bm', () => api('/api/data/bookmarks'));
    } else {
      dash.source('tags', DEMO.tags);
      dash.source('collections', DEMO.collections);
      dash.source('all_bm', DEMO.bookmarks);
    }
  }

  function paintStatus() {
    const live = STATUS.live;
    document.documentElement.classList.toggle('is-demo', !live);
    text('.js-mode', live ? 'LIVE' : 'DEMO');
    text('.js-user', live ? (STATUS.raindrop.user || 'you') : 'demo');
    text('.js-rd-status', STATUS.raindrop.connected ? `connected as ${STATUS.raindrop.user || 'you'}` : 'not connected');
    text('.js-cl-status', STATUS.claude.connected ? `connected · ${STATUS.claude.model}` : 'not connected');
    text('.js-cc-status', STATUS.claudeCode ? 'found on this Mac' : 'not found');
    text('.js-redirect', STATUS.redirectUri || 'http://127.0.0.1:4517/auth/raindrop/callback');
    $$('.js-rd-flag').forEach((el) => { el.className = 'js-rd-flag ' + (STATUS.raindrop.connected ? 'k-topic' : 'k-act'); el.textContent = STATUS.raindrop.connected ? '[ OK ]' : '[ -- ]'; });
    $$('.js-cl-flag').forEach((el) => { el.className = 'js-cl-flag ' + (STATUS.claude.connected ? 'k-topic' : 'k-act'); el.textContent = STATUS.claude.connected ? '[ OK ]' : '[ -- ]'; });
    $$('.js-cc-flag').forEach((el) => { el.className = 'js-cc-flag ' + (STATUS.claudeCode ? 'k-topic' : 'k-dim'); el.textContent = STATUS.claudeCode ? '[ OK ]' : '[ -- ]'; });
    $$('.js-needs-server').forEach((el) => { el.hidden = !HAS_SERVER; });
    $$('.js-no-server').forEach((el) => { el.hidden = HAS_SERVER; });
    $$('.js-terminal').forEach((el) => { el.hidden = !(HAS_SERVER && STATUS.claudeCode && STATUS.platform === 'darwin'); });
    if ($('#inbox-name') && STATUS.inboxName) $('#inbox-name').value = STATUS.inboxName;
    if ($('#cl-model') && STATUS.claude.model) $('#cl-model').value = STATUS.claude.model;
  }

  async function refreshStatus() {
    if (HAS_SERVER) { try { STATUS = await api('/api/status'); } catch { /* keep demo */ } }
    paintStatus();
  }

  const say = (sel, msg, cls) => $$(sel).forEach((el) => { el.textContent = msg; el.className = sel.slice(1) + ' tx-msg ' + (cls || 'k-dim'); });

  // ── CONNECT page ──
  function wireConnect() {
    const on = (id, fn) => $(id)?.addEventListener('click', fn);
    on('#rd-save', async () => {
      say('.js-rd-msg', 'checking token…');
      try { const r = await api('/api/connect/raindrop', { token: $('#rd-token').value }); $('#rd-token').value = ''; say('.js-rd-msg', `connected as ${r.user}`, 'k-topic'); await reload(); }
      catch (e) { say('.js-rd-msg', e.message, 'k-bad'); }
    });
    on('#rd-oauth', async () => {
      try { const r = await api('/api/connect/raindrop-app', { clientId: $('#rd-client-id').value, clientSecret: $('#rd-client-secret').value }); location.href = r.signIn; }
      catch (e) { say('.js-rd-msg', e.message, 'k-bad'); }
    });
    on('#cl-save', async () => {
      say('.js-cl-msg', 'checking key…');
      try { const r = await api('/api/connect/claude', { apiKey: $('#cl-key').value, model: $('#cl-model').value }); $('#cl-key').value = ''; say('.js-cl-msg', `connected · ${r.model}`, 'k-topic'); await refreshStatus(); }
      catch (e) { say('.js-cl-msg', e.message, 'k-bad'); }
    });
    on('#inbox-save', async () => {
      try { await api('/api/settings', { inboxName: $('#inbox-name').value }); say('.js-inbox-msg', 'saved', 'k-topic'); await reload(); }
      catch (e) { say('.js-inbox-msg', e.message, 'k-bad'); }
    });
    $$('[data-disconnect]').forEach((b) => b.addEventListener('click', async () => {
      try { await api('/api/disconnect', { what: b.dataset.disconnect }); await reload(); } catch (e) { alert(e.message); }
    }));
  }

  async function reload() {
    await refreshStatus();
    wireSources();
    dash.refreshAll();
  }

  // ── Claude actions: preview → review → apply ──
  let PLAN = null;
  function renderPlan() {
    const box = $('#review-body');
    if (!box) return;
    $('#review').hidden = !PLAN;
    if (!PLAN) return;
    text('.js-plan-title', PLAN.mode === 'inbox' ? 'sort Recently Saved' : 'audit');
    text('.js-plan-count', `${PLAN.items.length} change${PLAN.items.length === 1 ? '' : 's'} proposed · ${PLAN.checked} checked`);
    box.replaceChildren(...PLAN.items.map((it) => {
      const tr = document.createElement('tr');
      const td = (cls, ...kids) => { const c = document.createElement('td'); if (cls) c.className = cls; c.append(...kids); tr.appendChild(c); return c; };
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = true; cb.value = String(it.id); cb.className = 'tx-pick'; cb.setAttribute('aria-label', 'Apply this change');
      td('', cb);
      const old = document.createElement('div'); old.className = 'k-dim tx-strike'; old.textContent = it.oldTitle;
      const neu = document.createElement('div'); neu.textContent = it.title;
      td('', old, neu);
      const tags = document.createElement('div');
      it.tags.forEach((t) => { const s = document.createElement('span'); const layer = t.split('/')[0]; s.className = ({ type: 'k-type', use: 'k-use', for: 'k-for', topic: 'k-topic' })[layer] || 'k-minor'; s.textContent = t + ' '; tags.appendChild(s); });
      if (it.newTags?.length) { const n = document.createElement('div'); n.className = 'k-act'; n.textContent = 'new: ' + it.newTags.join(' '); tags.appendChild(n); }
      td('tx-tags', tags);
      td('k-dim', (it.folder !== it.oldFolder ? '→ ' : '') + (it.folderPath || ''));
      td('k-dim tx-tags', it.reason || '');
      return tr;
    }));
  }

  async function runPlan(mode, folderId) {
    say('.js-plan-msg', mode === 'inbox' ? 'asking Claude to sort the inbox…' : 'asking Claude to audit… large libraries take a few minutes', 'k-dim');
    $$('[data-plan]').forEach((b) => { b.disabled = true; });
    try {
      PLAN = STATUS.live ? await api('/api/plan', { mode, folderId }) : DEMO.plan(mode);
      say('.js-plan-msg', PLAN.items.length ? (STATUS.live ? 'review the changes, then apply' : 'DEMO: a sample preview. Connect Raindrop and Claude to run it for real.') : 'nothing to change', 'k-topic');
    } catch (e) { PLAN = null; say('.js-plan-msg', e.message, 'k-bad'); }
    $$('[data-plan]').forEach((b) => { b.disabled = false; });
    renderPlan();
    if (PLAN) $('#review')?.scrollIntoView({ block: 'start' });
  }

  async function applyPlan(all) {
    if (!PLAN) return;
    const ids = $$('.tx-pick').filter((c) => all || c.checked).map((c) => c.value);
    if (!ids.length) { say('.js-plan-msg', 'nothing selected', 'k-act'); return; }
    if (!STATUS.live || PLAN.planId === 'demo') { say('.js-plan-msg', `DEMO: would apply ${ids.length} change(s). Nothing was changed.`, 'k-act'); return; }
    say('.js-plan-msg', `applying ${ids.length} change(s)…`, 'k-dim');
    try {
      const r = await api('/api/apply', { planId: PLAN.planId, ids });
      say('.js-plan-msg', `applied ${r.applied}` + (r.failed.length ? ` · ${r.failed.length} failed` : ''), r.failed.length ? 'k-act' : 'k-topic');
      PLAN = null; renderPlan(); dash.refreshAll();
    } catch (e) { say('.js-plan-msg', e.message, 'k-bad'); }
  }

  function wireActions() {
    $$('[data-plan]').forEach((b) => b.addEventListener('click', () => runPlan(b.dataset.plan === 'inbox' ? 'inbox' : 'audit', b.dataset.plan === 'audit-folder' ? Number($('#audit-folder').value) || 0 : 0)));
    $('#apply-picked')?.addEventListener('click', () => applyPlan(false));
    $('#apply-all')?.addEventListener('click', () => applyPlan(true));
    $('#discard')?.addEventListener('click', () => { PLAN = null; renderPlan(); say('.js-plan-msg', 'preview discarded', 'k-dim'); });
    $$('[data-run]').forEach((b) => b.addEventListener('click', async () => {
      try { await api('/api/run', { command: b.dataset.run }); say('.js-plan-msg', 'opened in Terminal', 'k-topic'); }
      catch (e) { say('.js-plan-msg', e.message, 'k-bad'); }
    }));
  }

  // folder picker for "audit one folder", filled from the live or demo folder list
  dash.draw('folder-sel', (sel) => {
    const d = dash.data('collections');
    if (d.status !== 'ok') return;
    const keep = sel.value;
    const byId = new Map(d.data.map((c) => [c.id, c]));
    const label = (c) => (c.parent != null && byId.get(c.parent) ? byId.get(c.parent).title + ' › ' : '') + c.title;
    sel.replaceChildren(new Option('everything', '0'), ...d.data.filter((c) => c.id > 0 && !c.inbox).sort((a, b) => label(a).localeCompare(label(b))).map((c) => new Option(label(c), String(c.id))));
    sel.value = keep || '0';
  });

  // start
  dash.defaults({ hub: '', ya: 2024, yb: 2025, size: 'm' });
  wireConnect();
  wireActions();
  refreshStatus().then(() => { wireSources(); dash.rerender(); });
})();
