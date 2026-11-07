
dash.loader('tags', {
  description: 'Each Raindrop tag as a row, split into its layer (before the /) and name.',
  fn: ({ answer }) => {
    let j = answer;
    if (typeof j === 'string') j = JSON.parse(j);
    if (j && Array.isArray(j.content) && j.content[0] && typeof j.content[0].text === 'string') j = JSON.parse(j.content[0].text);
    if (!j || !Array.isArray(j.tags)) throw new Error('Raindrop returned no tag list');
    return j.tags.map((t) => {
      const i = t.tag.indexOf('/');
      return { tag: t.tag, layer: i > 0 ? t.tag.slice(0, i) : 'other', name: i > 0 ? t.tag.slice(i + 1) : t.tag, n: Number(t.bookmarks_count) };
    });
  },
});
dash.loader('collections', {
  description: 'Each Raindrop folder as a row: id, name, parent, bookmarks directly inside, and total including subfolders.',
  fn: ({ answer }) => {
    let j = answer;
    if (typeof j === 'string') j = JSON.parse(j);
    if (j && Array.isArray(j.content) && j.content[0] && typeof j.content[0].text === 'string') j = JSON.parse(j.content[0].text);
    if (!j || !Array.isArray(j.collections)) throw new Error('Raindrop returned no folder list');
    return j.collections.map((c) => ({ id: c.collection_id, title: c.title, parent: c.parent_id ?? null, direct: Number(c.bookmarks_count) || 0, total: Number(c.total_bookmarks_count) || 0, inbox: Boolean(c.inbox) }));
  },
});

dash.loader('all_bm', {
  description: 'Every bookmark as a row (all pages of Raindrop’s answer): id, title, folder id, when saved, tags and site.',
  fn: async ({ answer, args, call }) => {
    const parse = (a) => {
      let j = a;
      if (typeof j === 'string') j = JSON.parse(j);
      if (j && Array.isArray(j.content) && j.content[0] && typeof j.content[0].text === 'string') j = JSON.parse(j.content[0].text);
      return j;
    };
    const first = parse(answer);
    if (!first || !Array.isArray(first.bookmarks)) throw new Error('Raindrop returned no bookmark list');
    const total = Number(first.total) || 0;
    const per = Number(args.limit) || 150;
    const pages = Math.min(12, Math.ceil(total / per));
    const seen = new Map();
    for (const b of first.bookmarks) seen.set(b.bookmark_id, b);
    for (let p = 2; p <= pages; p++) {
      const next = parse(await call('find_bookmarks', { ...args, page: p }, { poll: false }));
      if (!next || !Array.isArray(next.bookmarks) || !next.bookmarks.length) break;
      for (const b of next.bookmarks) seen.set(b.bookmark_id, b);
    }
    const rows = [...seen.values()].map((b) => {
      const d = new Date(b.created);
      let domain = '';
      try { domain = new URL(b.link).hostname.replace(/^www\./, ''); } catch (e) { domain = ''; }
      const link = typeof b.link === 'string' && /^https?:\/\//i.test(b.link) ? b.link : '';
      return { id: String(b.bookmark_id), title: b.title || '', link, folderId: b.collection_id, created: Number.isNaN(d.getTime()) ? '' : d.toISOString(), year: Number.isNaN(d.getTime()) ? null : d.getUTCFullYear(), tags: (b.tags || []).join(' '), domain };
    });
    return { columns: ['id', 'title', 'link', 'folderId', 'created', 'year', 'tags', 'domain'], rows, cut: rows.length < total };
  },
});

dash.calc('bm', {
  title: 'Bookmarks with their hub',
  description: 'Each bookmark with its folder name and the hub that folder sits in.',
  inputs: ['all_bm', 'collections'],
  fn: (all_bm, collections) => {
    const byId = new Map(collections.map((c) => [c.id, c]));
    const hubOf = (id) => { let x = byId.get(id); while (x && x.parent !== null && byId.get(x.parent)) x = byId.get(x.parent); return x ? x.title : 'Unsorted'; };
    return all_bm.map((b) => ({ ...b, folder: (byId.get(b.folderId) || {}).title || 'Unsorted', hub: hubOf(b.folderId), inbox: Boolean((byId.get(b.folderId) || {}).inbox) }));
  },
});

dash.calc('hub_tags', {
  title: 'Tag counts per hub',
  description: 'How many bookmarks in each hub carry each tag; hub "*" is the whole library.',
  inputs: ['bm'],
  fn: (bm) => {
    const m = new Map();
    const add = (hub, tag) => { const k = hub + '\u0000' + tag; m.set(k, (m.get(k) || 0) + 1); };
    for (const b of bm) for (const t of b.tags.split(' ').filter(Boolean)) { add('*', t); add(b.hub, t); }
    return [...m].map(([k, n]) => { const [hub, tag] = k.split('\u0000'); const i = tag.indexOf('/'); return { hub, tag, layer: i > 0 ? tag.slice(0, i) : 'other', name: i > 0 ? tag.slice(i + 1) : tag, n }; });
  },
});

dash.calc('year_hub', {
  title: 'Saves per hub per year',
  description: 'How many bookmarks were saved into each hub in each year.',
  inputs: ['bm'],
  fn: (bm) => {
    const m = new Map();
    for (const b of bm) { if (b.year == null) continue; const k = b.year + '\u0000' + b.hub; m.set(k, (m.get(k) || 0) + 1); }
    return [...m].map(([k, n]) => { const [year, hub] = k.split('\u0000'); return { year: Number(year), hub, n }; });
  },
});

dash.calc('project_year', {
  title: 'Project saves per year',
  description: 'For each for/ project tag, how many of its bookmarks were saved in each year.',
  inputs: ['bm'],
  fn: (bm) => {
    const m = new Map();
    for (const b of bm) {
      if (b.year == null) continue;
      for (const t of b.tags.split(' ')) if (t.startsWith('for/')) { const k = t.slice(4) + '\u0000' + b.year; m.set(k, (m.get(k) || 0) + 1); }
    }
    return [...m].map(([k, n]) => { const [project, year] = k.split('\u0000'); return { project, year: Number(year), n }; });
  },
});

dash.calc('inbox', {
  title: 'Waiting in Recently Saved',
  description: 'Bookmarks in the Recently Saved folder, newest first.',
  inputs: ['bm'],
  fn: (bm) => bm.filter((b) => b.inbox).sort((a, b) => b.created.localeCompare(a.created)).map((b) => ({ id: b.id, title: b.title, link: b.link, domain: b.domain, created: b.created })),
});

dash.calc('recent', {
  title: 'Latest saves',
  description: 'The 15 most recently saved bookmarks outside Recently Saved.',
  inputs: ['bm'],
  fn: (bm) => bm.filter((b) => !b.inbox).sort((a, b) => b.created.localeCompare(a.created)).slice(0, 15).map((b) => ({ id: b.id, title: b.title, link: b.link, folder: b.folder, hub: b.hub, tags: b.tags, created: b.created })),
});

dash.calc('per_year', {
  title: 'Saves per year',
  description: 'Bookmarks saved each year, with a running total.',
  inputs: ['bm'],
  fn: (bm) => {
    const m = new Map();
    for (const b of bm) if (b.year != null) m.set(b.year, (m.get(b.year) || 0) + 1);
    if (!m.size) return [];
    const lo = Math.min(...m.keys()), hi = Math.max(...m.keys());
    let cum = 0;
    const rows = [];
    for (let y = lo; y <= hi; y++) { const n = m.get(y) || 0; cum += n; rows.push({ year: y, n, cum }); }
    return rows;
  },
});

dash.calc('hubs', {
  title: 'Bookmarks per hub',
  description: 'Top-level folders with their total bookmarks and share of the library.',
  inputs: ['collections'],
  fn: (collections) => {
    const top = collections.filter((c) => c.parent === null && c.id > 0 && !c.inbox);
    const all = top.reduce((s, c) => s + c.total, 0);
    return top.map((c) => ({ hub: c.title, total: c.total, share: all ? c.total / all : 0, subfolders: collections.filter((k) => k.parent === c.id).length })).sort((a, b) => b.total - a.total);
  },
});

dash.calc('kpis', {
  title: 'Library totals',
  description: 'Bookmarks, items waiting in Recently Saved, hubs, folders, tags, tag links, tags per bookmark and items in Trash.',
  inputs: ['collections', 'tags'],
  fn: (collections, tags) => {
    const roots = collections.filter((c) => c.parent === null && c.id > 0);
    const top = roots.filter((c) => !c.inbox);
    const bookmarks = roots.reduce((s, c) => s + c.total, 0);
    const links = tags.reduce((s, t) => s + t.n, 0);
    const trash = collections.find((c) => c.id === -99);
    const inbox = collections.find((c) => c.inbox);
    return [{ bookmarks, inbox: inbox ? inbox.total : 0, hubs: top.length, folders: collections.filter((c) => c.id > 0).length, tags: tags.length, links, avg: bookmarks ? links / bookmarks : 0, trash: trash ? trash.total : 0 }];
  },
});

dash.calc('layers', {
  title: 'Tag layers',
  description: 'For each tag layer: how many unique tags it has and how many times they are used.',
  inputs: ['tags'],
  fn: (tags) => {
    const order = ['type', 'use', 'for', 'topic', 'vibe', 'place', 'via'];
    const m = new Map();
    for (const t of tags) {
      const r = m.get(t.layer) || { layer: t.layer, tags: 0, links: 0 };
      r.tags += 1; r.links += t.n; m.set(t.layer, r);
    }
    return [...m.values()].sort((a, b) => (order.indexOf(a.layer) + 99 * (order.indexOf(a.layer) < 0)) - (order.indexOf(b.layer) + 99 * (order.indexOf(b.layer) < 0)));
  },
});

dash.calc('thin', {
  title: 'Empty and thin folders',
  description: 'Subfolders holding 3 or fewer bookmarks, with the hub they sit in.',
  inputs: ['collections'],
  fn: (collections) => {
    const byId = new Map(collections.map((c) => [c.id, c]));
    const hubOf = (c) => { let x = c; while (x && x.parent !== null && byId.get(x.parent)) x = byId.get(x.parent); return x ? x.title : ''; };
    return collections
      .filter((c) => c.id > 0 && c.parent !== null && c.total <= 3)
      .map((c) => ({ id: c.id, folder: c.title, hub: hubOf(c), total: c.total, status: c.total === 0 ? 'EMPTY' : 'THIN' }))
      .sort((a, b) => a.total - b.total || a.hub.localeCompare(b.hub));
  },
});

dash.calc('facts', {
  title: 'Library insights',
  description: 'Top hub, tag, topic, place, source site and folder, the busiest year, and shares of the library.',
  inputs: ['tags', 'collections', 'per_year'],
  fn: (tags, collections, per_year) => {
    const roots = collections.filter((c) => c.parent === null && c.id > 0);
    const top = roots.filter((c) => !c.inbox).sort((a, b) => b.total - a.total);
    const bookmarks = roots.reduce((s, c) => s + c.total, 0);
    const byN = (a, b) => b.n - a.n;
    const layer = (l) => tags.filter((t) => t.layer === l).sort(byN);
    const all = [...tags].sort(byN);
    const via = layer('via'), place = layer('place'), topic = layer('topic');
    const placeSum = place.reduce((s, t) => s + t.n, 0);
    const project = layer('for')[0];
    const busiest = [...per_year].sort(byN)[0] || {};
    const yearsSum = per_year.reduce((s, r) => s + r.n, 0);
    const recent = per_year.filter((r) => r.year >= 2023).reduce((s, r) => s + r.n, 0);
    const leaf = collections.filter((c) => c.id > 0 && !c.inbox).sort((a, b) => b.direct - a.direct)[0] || {};
    return [{
      bookmarks,
      topHub: top[0] ? top[0].title : null, topHubN: top[0] ? top[0].total : null, topHubShare: top[0] && bookmarks ? top[0].total / bookmarks : null,
      topTag: all[0] ? all[0].tag : null, topTagN: all[0] ? all[0].n : null,
      topProject: project ? project.name : null, topProjectN: project ? project.n : 0, topProjectShare: project && bookmarks ? project.n / bookmarks : 0,
      busiestYear: busiest.year ?? null, busiestN: busiest.n ?? null,
      recentShare: yearsSum ? recent / yearsSum : null,
      topVia: via[0] ? via[0].name : null, topViaN: via[0] ? via[0].n : null,
      topPlace: place[0] ? place[0].name : null, topPlaceShare: place[0] && placeSum ? place[0].n / placeSum : null,
      topTopic: topic[0] ? topic[0].name : null, topTopicN: topic[0] ? topic[0].n : null, topicCount: topic.length,
      topFolder: leaf.title ?? null, topFolderN: leaf.direct ?? null,
      emptyCount: collections.filter((c) => c.id > 0 && c.total === 0).length,
    }];
  },
});
