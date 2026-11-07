// Local settings store. Everything a user connects (Raindrop token, Claude API key)
// stays on their own machine in a file only they can read (chmod 600).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CONFIG_DIR = process.env.PANEL_CONFIG_DIR || path.join(os.homedir(), '.config', 'raindrop-admin-panel');
const FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULTS = {
  raindrop: { token: '', refreshToken: '', expiresAt: 0, clientId: '', clientSecret: '', user: '' },
  claude: { apiKey: '', model: 'claude-opus-5-5' },
  inboxName: 'Recently Saved',
};

export function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return {
      ...DEFAULTS, ...raw,
      raindrop: { ...DEFAULTS.raindrop, ...(raw.raindrop || {}) },
      claude: { ...DEFAULTS.claude, ...(raw.claude || {}) },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function save(cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
  fs.chmodSync(FILE, 0o600);
}

export function update(fn) {
  const cfg = load();
  fn(cfg);
  save(cfg);
  return cfg;
}

// Append-only record of every change the assistant applies, so it can be undone by hand.
export function logChange(entry) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  fs.appendFileSync(path.join(CONFIG_DIR, 'changes.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n', { mode: 0o600 });
}

// What the browser is allowed to see: whether things are connected, never the secrets.
export function publicStatus(cfg) {
  return {
    raindrop: { connected: Boolean(cfg.raindrop.token), user: cfg.raindrop.user || '', oauthReady: Boolean(cfg.raindrop.clientId && cfg.raindrop.clientSecret) },
    claude: { connected: Boolean(cfg.claude.apiKey), model: cfg.claude.model },
    inboxName: cfg.inboxName,
  };
}
