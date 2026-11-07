#!/usr/bin/env node
// Raindrop Bookmark Admin Panel — local server.
// Serves the panel on http://127.0.0.1:4517 and talks to Raindrop and Claude on the user's behalf.
// Secrets never leave this machine except to api.raindrop.io and api.anthropic.com.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as config from './lib/config.js';
import * as rd from './lib/raindrop.js';
import * as assistant from './lib/assistant.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 4517;
const HOST = '127.0.0.1';
const ORIGIN = `http://${HOST}:${PORT}`;
const SESSION = crypto.randomBytes(24).toString('hex'); // the page must echo this on every API call
const plans = new Map();
let oauthState = '';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const fail = (res, status, message) => send(res, status, { error: message });
const readBody = (req) => new Promise((resolve, reject) => {
  let s = '';
  req.on('data', (c) => { s += c; if (s.length > 1e6) { reject(new Error('Request too large')); req.destroy(); } });
  req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new Error('Bad JSON')); } });
});

// ── Claude Code (optional): find the `claude` command, including the copy bundled with the Claude desktop app ──
function claudeCode() {
  const home = os.homedir();
  const which = spawnSync('/bin/zsh', ['-lc', 'command -v claude'], { encoding: 'utf8' }).stdout?.trim();
  const candidates = [which, `${home}/.local/bin/claude`, '/opt/homebrew/bin/claude', '/usr/local/bin/claude'];
  for (const p of candidates) if (p && fs.existsSync(p)) return p;
  const base = `${home}/Library/Application Support/Claude/claude-code`;
  try {
    const versions = fs.readdirSync(base).filter((v) => /^\d/.test(v)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const v of versions) for (const h of fs.readdirSync(path.join(base, v))) {
      const p = path.join(base, v, h, 'claude.app/Contents/MacOS/claude');
      if (fs.existsSync(p)) return p;
    }
  } catch { /* not installed */ }
  return '';
}

// Fixed list: the page can only ask for one of these, never send its own text.
const COMMANDS = {
  'inbox': '/raindrop-inbox',
  'inbox-dry': '/raindrop-inbox dry run',
  'audit-dry': '/raindrop-audit dry run',
  'audit-fix': '/raindrop-audit fix',
  'checkup': '/raindrop:library-checkup',
};
const shq = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
function runInTerminal(key) {
  const prompt = COMMANDS[key];
  if (!prompt) throw new Error('Unknown command.');
  if (process.platform !== 'darwin') throw new Error('Running in Terminal is only available on macOS. Use the copy button instead.');
  const bin = claudeCode();
  if (!bin) throw new Error('Claude Code was not found. Install it (https://claude.com/claude-code) or open the Claude desktop app once.');
  const shell = `cd ~ && ${shq(bin)} ${shq(prompt)}`;
  const script = `tell application "Terminal"\nactivate\ndo script ${JSON.stringify(shell)}\nend tell`;
  const r = spawnSync('osascript', ['-e', script], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('Could not open Terminal. Allow automation for Terminal in System Settings › Privacy & Security.');
}

async function handleApi(req, res, url) {
  // Only this page may call the API: same host, and it must echo the per-launch session token.
  if (req.headers['x-panel-token'] !== SESSION) return fail(res, 403, 'Forbidden');
  const cfg = config.load();
  const route = `${req.method} ${url.pathname}`;
  const body = req.method === 'POST' ? await readBody(req) : {};

  switch (route) {
    case 'GET /api/status':
      return send(res, 200, { ...config.publicStatus(cfg), live: Boolean(cfg.raindrop.token), claudeCode: Boolean(claudeCode()), platform: process.platform, redirectUri: `${ORIGIN}/auth/raindrop/callback` });

    case 'GET /api/data/tags': return send(res, 200, await rd.tags());
    case 'GET /api/data/collections': return send(res, 200, await rd.collections(cfg.inboxName));
    case 'GET /api/data/bookmarks': return send(res, 200, await rd.bookmarks(0));

    case 'POST /api/connect/raindrop': {
      const token = String(body.token || '').trim();
      if (!token) return fail(res, 400, 'Paste a Raindrop token first.');
      const user = await rd.whoAmI(token);
      config.update((c) => { c.raindrop = { ...c.raindrop, token, refreshToken: '', expiresAt: 0, user }; });
      return send(res, 200, { ok: true, user });
    }
    case 'POST /api/connect/raindrop-app': {
      const clientId = String(body.clientId || '').trim(), clientSecret = String(body.clientSecret || '').trim();
      if (!clientId || !clientSecret) return fail(res, 400, 'Enter both the client ID and the client secret.');
      config.update((c) => { c.raindrop.clientId = clientId; c.raindrop.clientSecret = clientSecret; });
      return send(res, 200, { ok: true, signIn: '/auth/raindrop' });
    }
    case 'POST /api/connect/claude': {
      const apiKey = String(body.apiKey || '').trim();
      const model = String(body.model || cfg.claude.model || 'claude-opus-5-5').trim();
      if (!apiKey) return fail(res, 400, 'Paste an Anthropic API key first.');
      try { await assistant.checkKey(apiKey, model); } catch { return fail(res, 400, 'That key or model was not accepted by the Claude API.'); }
      config.update((c) => { c.claude = { apiKey, model }; });
      return send(res, 200, { ok: true, model });
    }
    case 'POST /api/disconnect': {
      config.update((c) => {
        if (body.what === 'raindrop') c.raindrop = { ...c.raindrop, token: '', refreshToken: '', expiresAt: 0, user: '' };
        if (body.what === 'claude') c.claude.apiKey = '';
      });
      return send(res, 200, { ok: true });
    }
    case 'POST /api/settings': {
      const inboxName = String(body.inboxName || '').trim().slice(0, 80);
      if (inboxName) config.update((c) => { c.inboxName = inboxName; });
      return send(res, 200, { ok: true });
    }

    case 'POST /api/plan': {
      const mode = body.mode === 'audit' ? 'audit' : 'inbox';
      const [cols, tg] = await Promise.all([rd.collections(cfg.inboxName), rd.tags()]);
      let target;
      if (mode === 'inbox') {
        const inbox = cols.collections.find((c) => c.inbox);
        if (!inbox) return fail(res, 400, `There is no top-level folder called "${cfg.inboxName}". Create it in Raindrop, or change the inbox name on the CONNECT tab.`);
        target = (await rd.bookmarks(inbox.collection_id)).bookmarks;
      } else {
        const folderId = Number(body.folderId) || 0;
        const all = (await rd.bookmarks(0)).bookmarks;
        const inboxIds = new Set(cols.collections.filter((c) => c.inbox).map((c) => c.collection_id));
        if (folderId) {
          const under = new Set([folderId]);
          let grew = true;
          while (grew) { grew = false; for (const c of cols.collections) if (under.has(c.parent_id) && !under.has(c.collection_id)) { under.add(c.collection_id); grew = true; } }
          target = all.filter((b) => under.has(b.collection_id));
        } else target = all.filter((b) => !inboxIds.has(b.collection_id));
        target = target.slice(0, Math.min(Number(body.limit) || 2000, 2000));
      }
      if (!target.length) return send(res, 200, { planId: '', items: [] });
      const items = await assistant.propose({ mode, bookmarks: target, collections: cols.collections, tags: tg.tags });
      const planId = crypto.randomUUID();
      plans.set(planId, { mode, items, at: Date.now() });
      return send(res, 200, { planId, mode, checked: target.length, items: items.filter((i) => i.changed) });
    }
    case 'POST /api/apply': {
      const plan = plans.get(String(body.planId || ''));
      if (!plan) return fail(res, 400, 'That preview has expired. Run it again.');
      const pick = new Set((body.ids || []).map(String));
      const results = [];
      for (const it of plan.items.filter((i) => i.changed && pick.has(String(i.id)))) {
        try {
          config.logChange({ id: it.id, oldTitle: it.oldTitle, title: it.title, oldTags: it.oldTags, tags: it.tags, oldFolder: it.oldFolder, folder: it.folder });
          await rd.updateBookmark(it.id, { title: it.title, tags: it.tags, collectionId: it.folder !== it.oldFolder ? it.folder : null });
          results.push({ id: it.id, ok: true });
        } catch (e) { results.push({ id: it.id, ok: false, error: e.message }); }
      }
      return send(res, 200, { applied: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok) });
    }
    case 'POST /api/run': {
      runInTerminal(String(body.command || ''));
      return send(res, 200, { ok: true });
    }
    default:
      return fail(res, 404, 'Not found');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    // Refuse requests addressed to any other host name (blocks DNS-rebinding tricks).
    const host = req.headers.host || '';
    if (host !== `${HOST}:${PORT}` && host !== `localhost:${PORT}`) return fail(res, 421, 'Wrong host');
    const url = new URL(req.url, ORIGIN);

    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);

    if (url.pathname === '/auth/raindrop') {
      const r = config.load().raindrop;
      if (!r.clientId) return fail(res, 400, 'Add your Raindrop app on the CONNECT tab first.');
      oauthState = crypto.randomBytes(16).toString('hex');
      res.writeHead(302, { Location: rd.authorizeUrl(r.clientId, `${ORIGIN}/auth/raindrop/callback`, oauthState) });
      return res.end();
    }
    if (url.pathname === '/auth/raindrop/callback') {
      if (!oauthState || url.searchParams.get('state') !== oauthState) return fail(res, 400, 'Sign-in state did not match. Start again from the CONNECT tab.');
      oauthState = '';
      const t = await rd.exchangeCode(url.searchParams.get('code') || '', `${ORIGIN}/auth/raindrop/callback`);
      const user = await rd.whoAmI(t.access_token);
      config.update((c) => {
        c.raindrop = { ...c.raindrop, token: t.access_token, refreshToken: t.refresh_token || '', expiresAt: Date.now() + (Number(t.expires_in) || 0) * 1000, user };
      });
      res.writeHead(302, { Location: '/#connect' });
      return res.end();
    }

    // Static files from public/ only.
    const rel = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const file = path.normalize(path.join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return fail(res, 404, 'Not found');
    let data = fs.readFileSync(file);
    if (file.endsWith('index.html')) data = data.toString().replace('__PANEL_TOKEN__', SESSION);
    return send(res, 200, data, TYPES[path.extname(file)] || 'application/octet-stream');
  } catch (e) {
    const status = e instanceof rd.RaindropError ? (e.status === 401 ? 401 : 502) : 500;
    return fail(res, status, e.message || 'Something went wrong');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  ▌ Raindrop Bookmark Admin Panel\n  ▌ open ${ORIGIN}\n  ▌ settings: ${config.CONFIG_DIR}\n`);
});
