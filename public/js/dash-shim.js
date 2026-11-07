// A small stand-in for the claude.ai Dashboard runtime, so the same chart code runs locally.
// Sources come from the local server (live) or from demo-data.js (made-up sample library).
window.dash = (() => {
  const sources = {}, loaders = {}, calcs = {}, state = {}, draws = {}, onDataFns = [];
  const memo = {};
  let params = {}, defaults = {}, version = 0, scheduled = false;

  const rowsOf = (data) => (data && Array.isArray(data.rows) ? data.rows : data);
  const schedule = () => { if (scheduled) return; scheduled = true; requestAnimationFrame(() => { scheduled = false; render(); }); };

  async function load(id) {
    const fetcher = sources[id];
    if (!fetcher) return;
    state[id] = { status: 'loading', data: state[id]?.data || [], refreshing: Boolean(state[id]?.data?.length) };
    schedule();
    try {
      const answer = await fetcher();
      const fn = loaders[id]?.fn;
      const out = fn ? await fn({ answer, args: { limit: 1e9 }, call: async () => { throw new Error('paging is done by the server'); } }) : answer;
      state[id] = { status: 'ok', data: rowsOf(out) || [], message: '' };
    } catch (e) {
      state[id] = { status: e.status === 401 ? 'connect' : 'error', data: [], message: e.message || String(e) };
    }
    version++;
    schedule();
  }

  function calcData(id) {
    const c = calcs[id];
    const inputs = c.inputs.map((i) => data(i));
    const bad = inputs.find((d) => d.status !== 'ok');
    if (bad) return { status: bad.status === 'error' || bad.status === 'connect' ? 'error' : 'loading', data: [], message: bad.message };
    const key = c.inputs.map((i) => (state[i]?.v ?? memo[i]?.v ?? 0)).join(':') + ':' + version;
    if (memo[id]?.key !== key) {
      try { memo[id] = { key, v: version, status: 'ok', data: rowsOf(c.fn(...inputs.map((d) => d.data))) || [] }; }
      catch (e) { memo[id] = { key, v: version, status: 'error', data: [], message: e.message }; }
    }
    return memo[id];
  }

  function data(id) {
    if (calcs[id]) return calcData(id);
    if (!state[id]) { if (sources[id]) load(id); else return { status: 'missing', data: [] }; }
    return { ...state[id], data: state[id].data || [] };
  }

  const visible = (el) => !el.closest('[hidden]');
  const mounted = new WeakMap();
  const ro = new ResizeObserver((entries) => { if (entries.some((e) => e.contentRect.width > 0)) schedule(); });
  const observed = new WeakSet();

  function render() {
    for (const fn of onDataFns) { try { fn(); } catch (e) { console.error(e); } }
    for (const [name, spec] of Object.entries(draws)) {
      document.querySelectorAll(`[data-draw="${name}"]`).forEach((el) => {
        if (!visible(el)) return;
        if (!observed.has(el)) { observed.add(el); ro.observe(el); }
        try {
          if (typeof spec === 'function') spec(el);
          else {
            if (!mounted.has(el)) mounted.set(el, spec.mount(el));
            spec.update(el, mounted.get(el));
          }
        } catch (e) { console.error(`draw ${name}`, e); }
      });
    }
  }

  return {
    source(id, fetcher) { sources[id] = fetcher; },
    loader(id, spec) { loaders[id] = spec; },
    calc(id, spec) { calcs[id] = spec; },
    data,
    draw(name, spec) { if (spec === undefined) { schedule(); return; } draws[name] = spec; schedule(); },
    onData(fn) { onDataFns.push(fn); schedule(); },
    params: () => ({ ...params }),
    setParams(p) { for (const [k, v] of Object.entries(p)) { if (v === null) delete params[k]; else params[k] = v; } version++; schedule(); },
    resetParams() { params = { ...defaults }; version++; schedule(); },
    defaults(p) { defaults = { ...p }; params = { ...p, ...params }; },
    refresh(id) { if (sources[id]) load(id); },
    refreshAll() { for (const id of Object.keys(sources)) load(id); },
    setLink(id) { try { history.replaceState(null, '', '#' + id); } catch { /* file:// */ } },
    rerender: schedule,
  };
})();
