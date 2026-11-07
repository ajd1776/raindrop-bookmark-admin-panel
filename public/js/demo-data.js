// Made-up sample library for DEMO mode. Every folder, title, site and tag here is invented.
// Sites use the reserved .example domain so nothing points at a real page.
window.DEMO = (() => {
  let seed = 20260101;
  const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

  // hub › subfolder › { n, type, use, topics, extra tags, sample names }
  const TREE = {
    'Projects': {
      'Side Hustle': [14, 'supplier', 'research', ['ecommerce', 'manufacturing'], ['for/side-hustle', 'place/europe'], ['Loomworks', 'Bright Bolt', 'Cartwheel', 'Packet Mill', 'Hemline Co']],
      'Home Lab': [12, 'guide', 'build', ['hardware', 'networking'], ['for/home-lab', 'vibe/retro-tech'], ['Rack Notes', 'Pi Garden', 'Subnet Sheet', 'Cable Atlas']],
      'Portfolio Site': [10, 'docs', 'build', ['web-dev'], ['for/portfolio', 'via/github'], ['Grid Garden', 'Flexbox Field', 'Static Forge', 'Motion Kit']],
    },
    'Learning': {
      'Courses': [16, 'course', 'learn', ['data-science', 'python'], ['for/career'], ['Data Dojo', 'Py Path', 'Stats Studio', 'Query Camp']],
      'Coding Reference': [18, 'reference', 'reference', ['web-dev', 'python'], ['via/github'], ['Regex Atlas', 'CSS Almanac', 'Shell Notes', 'Git Pocket']],
      'Languages': [7, 'app', 'learn', ['languages'], ['place/japan'], ['Kana Quest', 'Verb Loop', 'Phrase Deck']],
    },
    'Design': {
      'Fonts': [15, 'assets', 'build', ['fonts'], ['vibe/minimal'], ['Type Orchard', 'Glyph Yard', 'Serif Shed', 'Mono Moon']],
      'Icons': [13, 'assets', 'build', ['icons'], ['for/portfolio'], ['Pixel Harbor', 'Stroke Set', 'Line Lab']],
      'Inspiration': [19, 'portfolio', 'inspiration', ['graphic-design', 'art'], ['vibe/sci-fi', 'vibe/brutalist'], ['Studio Nimbus', 'Ink & Orbit', 'Moss Gallery', 'Neon Index']],
      'Mockups': [8, 'assets', 'build', ['mockups'], ['for/side-hustle'], ['Frame Foundry', 'Mock Mill']],
    },
    'Reading': {
      'Articles': [20, 'article', 'read', ['productivity', 'internet-culture'], ['via/medium'], ['The Slow Web', 'Notes on Focus', 'Small Tools', 'Paper Cuts']],
      'Books': [9, 'wiki', 'read', ['books'], ['vibe/dystopian', 'via/wikipedia'], ['Glass Orchard', 'The Quiet Engine', 'Salt Road']],
      'Wiki Saves': [24, 'wiki', 'reference', ['history', 'space'], ['via/wikipedia'], ['Tidal Locking', 'Lighthouse', 'Pole of Cold', 'Signal Flags', 'Ice Road']],
    },
    'Shopping': {
      'Clothing': [26, 'brand', 'buy', ['streetwear', 'outdoor'], ['vibe/gorpcore', 'place/uk'], ['Northwind Studio', 'Field & Fold', 'Cinder Supply', 'Rain Theory', 'Tallow']],
      'Gadgets': [12, 'listing', 'buy', ['hardware'], ['via/amazon'], ['Desk Dial', 'Pocket Lamp', 'Key Deck']],
      'Home': [11, 'shop', 'buy', ['home'], ['vibe/minimal'], ['Oak & Ash', 'Linen Lane', 'Plant Room']],
    },
    'Travel & Events': {
      'Trips': [9, 'guide', 'plan', ['travel'], ['place/portugal', 'place/japan'], ['Coast Walks', 'Rail Pass Notes', 'Island Hops']],
      'Events': [5, 'listing', 'plan', ['events', 'music'], ['vibe/rave', 'place/london'], ['Night Market', 'Field Day', 'Echo Fest']],
      'Museums': [0],
    },
    'Health': {
      'Fitness': [10, 'guide', 'learn', ['fitness'], ['for/run-club'], ['Mobility Map', 'Lift Log', 'Core Club']],
      'Recipes': [12, 'article', 'reference', ['nutrition'], [], ['Green Bowl', 'Batch Cook', 'Oat Lab']],
      'Running': [3, 'app', 'manage', ['fitness'], ['for/run-club'], ['Pace Pal']],
    },
    'Media': {
      'Movies & TV': [17, 'wiki', 'watch', ['film', 'tv'], ['via/imdb', 'vibe/sci-fi'], ['Night Owl', 'Long Orbit', 'Cold Harbour', 'Quiet Planet']],
      'Music': [9, 'reference', 'fun', ['music'], ['vibe/rave'], ['Genre Atlas', 'Loop Shop', 'Synth Index']],
      'Podcasts': [2, 'video', 'watch', ['podcasts'], ['via/youtube'], ['Tool Talk']],
    },
    'Money': {
      'Budgeting': [8, 'tool', 'manage', ['finance'], [], ['Penny Plan', 'Bill Board']],
      'Investing': [11, 'tool', 'research', ['investing'], ['place/usa'], ['Ticker Tape', 'Index Notes', 'Yield Log']],
      'Banking': [0],
    },
    'Tools': {
      'Web Utilities': [16, 'tool', 'build', ['web-dev'], ['for/portfolio'], ['Squash PNG', 'Color Picker Pro', 'JSON Lint', 'Favicon Forge']],
      'Mac Apps': [12, 'app', 'manage', ['macos'], [], ['Window Tiler', 'Clip Stack', 'Menu Calendar']],
      'AI Tools': [9, 'tool', 'build', ['ai'], [], ['Draft Buddy', 'Summarizer X', 'Prompt Shelf']],
    },
  };
  const WHAT = { supplier: 'Supplier', guide: 'Guide', docs: 'Docs', course: 'Course', reference: 'Cheat Sheet', app: 'App', assets: 'Free Pack', portfolio: 'Studio', article: 'Essay', wiki: 'Wikipedia', brand: 'Clothing Brand', listing: 'Product', shop: 'Store', tool: 'Online Tool', video: 'Episode' };
  const YEARS = [2019, 2020, 2021, 2021, 2022, 2022, 2023, 2023, 2023, 2024, 2024, 2024, 2024, 2025, 2025, 2026];

  const INBOX = [
    ['Best Trail Running Shoes 2026 | Free Shipping | RunHub', 'runhub.example', 'Trail Shoes - Running Gear - RunHub', ['type/shop', 'use/buy', 'topic/fitness', 'for/run-club'], 'Running'],
    ['Home - Glyph Yard - The Best Free Fonts Online!!!', 'glyphyard.example', 'Glyph Yard - Free Fonts', ['type/assets', 'use/build', 'topic/fonts', 'vibe/minimal'], 'Fonts'],
    ['how to set up vlans at home (beginner) : r/homelab', 'forum.example', 'Home VLAN Setup - Thread - Reddit', ['type/forum', 'use/learn', 'topic/networking', 'for/home-lab', 'via/reddit'], 'Home Lab'],
    ['Cold Harbour (2024) - Rating, Cast, Trailer', 'moviedb.example', 'Cold Harbour - Film', ['type/wiki', 'use/watch', 'topic/film', 'via/imdb'], 'Movies & TV'],
    ['https://studionimbus.example/work/orbit-poster-series', 'studionimbus.example', 'Studio Nimbus - Poster Series', ['type/portfolio', 'use/inspiration', 'topic/graphic-design', 'vibe/sci-fi'], 'Inspiration'],
    ['Penny Plan — Budgeting App — Sign Up Today', 'pennyplan.example', 'Penny Plan - Budgeting App', ['type/app', 'use/manage', 'topic/finance'], 'Budgeting'],
  ];

  let id = 900000, fid = 5000;
  const inboxIds = [];
  const collections = [], bookmarks = [], tagCount = new Map();
  const addTags = (tags) => tags.forEach((t) => tagCount.set(t, (tagCount.get(t) || 0) + 1));
  const folderId = {};

  for (const [hub, subs] of Object.entries(TREE)) {
    const hid = ++fid; folderId[hub] = hid;
    const hubRow = { collection_id: hid, title: hub, parent_id: null, bookmarks_count: 0, total_bookmarks_count: 0 };
    collections.push(hubRow);
    for (const [sub, spec] of Object.entries(subs)) {
      const sid = ++fid; folderId[sub] = sid;
      const [n, type, use, topics = [], extra = [], names = []] = spec;
      collections.push({ collection_id: sid, title: sub, parent_id: hid, bookmarks_count: n, total_bookmarks_count: n });
      hubRow.total_bookmarks_count += n;
      for (let i = 0; i < n; i++) {
        const name = names.length ? names[i % names.length] + (i >= names.length ? ' ' + ['II', 'Notes', 'Lab', 'Pro', 'Club', 'Daily'][i % 6] : '') : sub;
        const tags = [`type/${type}`, `use/${use}`, `topic/${pick(topics)}`];
        if (topics.length > 1 && rnd() < 0.35) tags.push(`topic/${topics.find((t) => !tags.includes(`topic/${t}`)) || topics[0]}`);
        for (const e of extra) if (tags.length < 5 && rnd() < 0.7) tags.push(e);
        const uniq = [...new Set(tags)];
        addTags(uniq);
        const y = pick(YEARS), mo = 1 + Math.floor(rnd() * (y === 2026 ? 10 : 12)), dd = 1 + Math.floor(rnd() * 27);
        const site = slug(name) + '.example';
        bookmarks.push({ bookmark_id: ++id, title: `${name} - ${WHAT[type] || 'Site'}`, link: `https://${site}/`, collection_id: sid, created: new Date(Date.UTC(y, mo - 1, dd, 12)).toISOString(), tags: uniq });
      }
    }
  }
  const inboxId = ++fid;
  collections.unshift({ collection_id: inboxId, title: 'Recently Saved', parent_id: null, bookmarks_count: INBOX.length, total_bookmarks_count: INBOX.length, inbox: true });
  INBOX.forEach(([title, site], i) => bookmarks.push({ bookmark_id: (inboxIds.push(id + 1), ++id), title, link: `https://${site}/`, collection_id: inboxId, created: new Date(Date.UTC(2026, 10, 1 + i, 9)).toISOString(), tags: [] }));
  collections.push({ collection_id: -1, title: 'Unsorted', parent_id: null, bookmarks_count: 0, total_bookmarks_count: 0 });
  collections.push({ collection_id: -99, title: 'Trash', parent_id: null, bookmarks_count: 4, total_bookmarks_count: 4 });
  bookmarks.sort((a, b) => b.created.localeCompare(a.created));

  const wait = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 250));
  const pathOf = (fidv) => { const c = collections.find((x) => x.collection_id === fidv); const p = c && collections.find((x) => x.collection_id === c.parent_id); return [p?.title, c?.title].filter(Boolean).join(' › '); };

  return {
    user: 'demo',
    tags: () => wait({ tags: [...tagCount].map(([tag, bookmarks_count]) => ({ tag, bookmarks_count })).sort((a, b) => b.bookmarks_count - a.bookmarks_count) }),
    collections: () => wait({ collections }),
    bookmarks: () => wait({ bookmarks, total: bookmarks.length }),
    // A ready-made preview so the review screen can be tried without connecting anything.
    plan(mode) {
      if (mode !== 'inbox') {
        const sample = bookmarks.filter((b) => b.collection_id !== inboxId).slice(0, 3);
        return { planId: 'demo', mode, checked: bookmarks.length - INBOX.length, items: sample.map((b, i) => ({
          id: b.bookmark_id, oldTitle: b.title, title: b.title, oldTags: b.tags, tags: b.tags.slice(0, 3).concat(i === 0 ? ['via/github'] : []),
          newTags: [], oldFolder: b.collection_id, folder: b.collection_id, folderPath: pathOf(b.collection_id), changed: true,
          reason: ['adds the missing via/ platform tag', 'drops a duplicate topic/ tag', 'trims a sixth tag to keep 5 max'][i], link: b.link })) };
      }
      return { planId: 'demo', mode, checked: INBOX.length, items: INBOX.map(([oldTitle, site, title, tags, folder], i) => ({
        id: inboxIds[i], oldTitle, title, oldTags: [], tags, newTags: [], oldFolder: inboxId, folder: folderId[folder],
        folderPath: pathOf(folderId[folder]), changed: true, reason: 'inbox item: cleaned title, tagged and filed', link: `https://${site}/` })) };
    },
  };
})();
