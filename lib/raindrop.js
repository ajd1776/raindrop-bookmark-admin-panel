// Minimal Raindrop.io REST client (https://developer.raindrop.io).
// Uses the token the user connected: either a personal "test token" or an OAuth access token.
import * as config from './config.js';

const API = 'https://api.raindrop.io/rest/v1';
const OAUTH = 'https://raindrop.io/oauth';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class RaindropError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function refreshIfNeeded() {
  const cfg = config.load();
  const r = cfg.raindrop;
  if (!r.refreshToken || !r.expiresAt || Date.now() < r.expiresAt - 60_000) return;
  const res = await fetch(`${OAUTH}/access_token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: r.refreshToken, client_id: r.clientId, client_secret: r.clientSecret }),
  });
  if (!res.ok) throw new RaindropError('Raindrop sign-in expired. Connect again on the CONNECT tab.', 401);
  const t = await res.json();
  config.update((c) => {
    c.raindrop.token = t.access_token;
    if (t.refresh_token) c.raindrop.refreshToken = t.refresh_token;
    c.raindrop.expiresAt = Date.now() + (Number(t.expires_in) || 0) * 1000;
  });
}

export async function api(method, path, body, token) {
  if (!token) await refreshIfNeeded();
  const tok = token || config.load().raindrop.token;
  if (!tok) throw new RaindropError('Raindrop is not connected.', 401);
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(API + path, {
      method,
      headers: { Authorization: `Bearer ${tok}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429) { await sleep((Number(res.headers.get('retry-after')) || 5) * 1000); continue; }
    if (res.status === 401) throw new RaindropError('Raindrop rejected the token. Connect again on the CONNECT tab.', 401);
    if (!res.ok) throw new RaindropError(`Raindrop ${method} ${path} failed (${res.status}).`, res.status);
    return res.json();
  }
  throw new RaindropError('Raindrop is rate-limiting requests. Try again in a minute.', 429);
}

// OAuth: build the sign-in URL and swap the returned code for tokens.
export function authorizeUrl(clientId, redirectUri, state) {
  const u = new URL(`${OAUTH}/authorize`);
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('state', state);
  return u.toString();
}
export async function exchangeCode(code, redirectUri) {
  const r = config.load().raindrop;
  const res = await fetch(`${OAUTH}/access_token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'authorization_code', code, client_id: r.clientId, client_secret: r.clientSecret, redirect_uri: redirectUri }),
  });
  if (!res.ok) throw new RaindropError('Raindrop did not accept the sign-in. Check the client ID, secret and redirect URI.', res.status);
  return res.json();
}

export async function whoAmI(token) {
  const { user } = await api('GET', '/user', null, token);
  return user?.fullName || user?.name || 'raindrop user';
}

// ── reads, shaped the way the panel expects ──
export async function tags() {
  const { items = [] } = await api('GET', '/tags/0');
  return { tags: items.map((t) => ({ tag: t._id, bookmarks_count: t.count })).sort((a, b) => b.bookmarks_count - a.bookmarks_count) };
}

export async function collections(inboxName) {
  const [root, kids, trash, unsorted] = await Promise.all([
    api('GET', '/collections'), api('GET', '/collections/childrens'),
    api('GET', '/raindrops/-99?perpage=1'), api('GET', '/raindrops/-1?perpage=1'),
  ]);
  const all = [...(root.items || []), ...(kids.items || [])].map((c) => ({
    collection_id: c._id, title: c.title, parent_id: c.parent?.$id ?? null, bookmarks_count: c.count || 0,
  }));
  const byParent = new Map();
  for (const c of all) { const k = c.parent_id ?? 'root'; byParent.set(k, [...(byParent.get(k) || []), c]); }
  const total = (c) => c.bookmarks_count + (byParent.get(c.collection_id) || []).reduce((s, k) => s + total(k), 0);
  const want = (inboxName || '').trim().toLowerCase();
  return {
    collections: [
      ...all.map((c) => ({ ...c, total_bookmarks_count: total(c), inbox: c.parent_id === null && c.title.trim().toLowerCase() === want })),
      { collection_id: -1, title: 'Unsorted', parent_id: null, bookmarks_count: unsorted.count || 0, total_bookmarks_count: unsorted.count || 0 },
      { collection_id: -99, title: 'Trash', parent_id: null, bookmarks_count: trash.count || 0, total_bookmarks_count: trash.count || 0 },
    ],
  };
}

const shapeBookmark = (b) => ({
  bookmark_id: b._id, title: b.title || '', link: b.link || '', collection_id: b.collection?.$id ?? -1,
  created: b.created, tags: b.tags || [],
});

// Every bookmark in a collection (0 = everything except Trash), 50 per page.
export async function bookmarks(collectionId = 0, max = 20000) {
  const out = [];
  for (let page = 0; out.length < max; page++) {
    const { items = [], count = 0 } = await api('GET', `/raindrops/${collectionId}?perpage=50&page=${page}&sort=-created`);
    out.push(...items.map(shapeBookmark));
    if (!items.length || out.length >= count) break;
  }
  return { bookmarks: out, total: out.length };
}

// One write per bookmark, paced under Raindrop's 120 requests/minute limit.
export async function updateBookmark(id, { title, tags, collectionId }) {
  const body = {};
  if (title != null) body.title = title;
  if (tags != null) body.tags = tags;
  if (collectionId != null) body.collection = { $id: collectionId };
  const res = await api('PUT', `/raindrop/${id}`, body);
  await sleep(550);
  return res;
}
