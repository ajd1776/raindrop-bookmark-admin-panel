// The "librarian": asks Claude to propose clean titles, tags and folders for bookmarks.
// Uses the user's own Anthropic API key. Proposals are only applied when the user presses APPLY.
import Anthropic from '@anthropic-ai/sdk';
import * as config from './config.js';

export const RULES = `
TITLES — 2 to 4 parts joined by " - ": Name - What it is - Source.
  Drop the source when it adds nothing (a brand's own site). Minimal and readable:
  no SEO filler ("| Site", "Official Site", "Buy now", prices), no emoji, no raw URLs, no dates unless they matter.
  Examples: "List of Shapes - Lists - Wikipedia", "Night Owl - Series", "Northwind Studio - Furniture Brand",
  "Grid Garden - CSS Game", "Gore-Tex Alternatives - Thread - Reddit".

TAGS — the 7-layer network, 3 to 5 tags, never more than 5:
  exactly 1 type/  (what the link IS: brand, shop, listing, supplier, tool, app, account, article, guide, video,
                    course, docs, wiki, reference, forum, news, dataset, assets, template, portfolio, game, search, map)
  exactly 1 use/   (WHY it was saved: buy, learn, research, reference, inspiration, manage, build, watch, read, hire, plan, fun)
  1-2 topic/       (what it is ABOUT)
  then fill up to 5 with, in priority order: for/ (which project it serves) > vibe/ (aesthetic) > place/ (where) > via/ (platform, e.g. via/wikipedia, via/reddit, via/youtube).
  Prefer tags that already exist in the library. Only use a tag that is not in the existing list when nothing fits.

FOLDERS — file into the most specific existing subfolder. Never into a top-level folder that has subfolders. Never invent folders.
`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'tags', 'folder_id', 'changed', 'reason'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          folder_id: { type: 'integer' },
          changed: { type: 'boolean' },
          reason: { type: 'string' },
        },
      },
    },
  },
};

export async function checkKey(apiKey, model) {
  const client = new Anthropic({ apiKey });
  await client.models.retrieve(model);
}

function folderPaths(collections) {
  const byId = new Map(collections.map((c) => [c.collection_id, c]));
  const kids = new Set(collections.map((c) => c.parent_id).filter((x) => x != null));
  return collections.filter((c) => c.collection_id > 0 && !c.inbox).map((c) => {
    const parts = []; let x = c;
    while (x) { parts.unshift(x.title); x = x.parent_id != null ? byId.get(x.parent_id) : null; }
    return { id: c.collection_id, path: parts.join(' › '), hasChildren: kids.has(c.collection_id) };
  });
}

// mode: 'inbox' (title + tags + folder) or 'audit' (title + tags; folder only for top-level strays)
export async function propose({ mode, bookmarks, collections, tags, onProgress }) {
  const cfg = config.load();
  if (!cfg.claude.apiKey) throw new Error('Claude is not connected. Add your Anthropic API key on the CONNECT tab.');
  const client = new Anthropic({ apiKey: cfg.claude.apiKey });
  const folders = folderPaths(collections);
  const folderIds = new Set(folders.map((f) => f.id));
  const known = new Set(tags.map((t) => t.tag));
  const pathOf = new Map(folders.map((f) => [f.id, f.path]));

  const system = `You tidy a personal Raindrop.io bookmark library. Follow these house rules exactly.\n${RULES}\n` +
    `EXISTING TAGS (use these): ${[...known].sort().join(', ')}\n\n` +
    `FOLDERS (id: path — * means it has subfolders, so never file directly into it):\n` +
    folders.map((f) => `${f.id}: ${f.path}${f.hasChildren ? ' *' : ''}`).join('\n');

  const task = mode === 'inbox'
    ? 'These bookmarks are in the inbox. For each one give a clean title, 3-5 tags and the best folder_id. changed is always true.'
    : 'Audit these bookmarks. Only fix clear rule breaks: a messy or badly formatted title, wrong tag count, missing type/ or use/ or topic/, more than two topic/ tags, or a bookmark sitting directly in a folder marked *. ' +
      'Keep folder_id the same unless it is in a * folder. If a bookmark already follows the rules, return it unchanged with changed=false. Do not reword titles that are already fine.';

  const out = [];
  const BATCH = 40;
  for (let i = 0; i < bookmarks.length; i += BATCH) {
    const batch = bookmarks.slice(i, i + BATCH);
    const lines = batch.map((b) => JSON.stringify({ id: String(b.bookmark_id), title: b.title, link: b.link, tags: b.tags, folder_id: b.collection_id, folder: pathOf.get(b.collection_id) || 'inbox' }));
    let response;
    try {
      response = await client.beta.messages.create({
        model: cfg.claude.model || 'claude-opus-5-5',
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
        system,
        messages: [{ role: 'user', content: `${task}\n\nBookmarks (one JSON object per line):\n${lines.join('\n')}` }],
      });
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) throw new Error('Claude rejected the API key. Check it on the CONNECT tab.');
      if (error instanceof Anthropic.RateLimitError) throw new Error('Claude is rate-limiting requests. Wait a minute and try again.');
      if (error instanceof Anthropic.APIError) throw new Error(`Claude API error ${error.status}: ${error.message}`);
      throw error;
    }
    if (response.stop_reason === 'refusal') throw new Error('Claude declined this batch. Try a smaller folder.');
    const text = response.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error('Claude returned an unreadable answer. Try again.'); }
    const byId = new Map(batch.map((b) => [String(b.bookmark_id), b]));
    for (const p of parsed.items || []) {
      const b = byId.get(String(p.id));
      if (!b) continue;
      const cleanTags = [...new Set(p.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 5);
      const folder = folderIds.has(p.folder_id) ? p.folder_id : b.collection_id;
      const changed = mode === 'inbox' || p.title !== b.title || folder !== b.collection_id ||
        cleanTags.join('|') !== [...b.tags].map((t) => t.toLowerCase()).join('|');
      out.push({
        id: b.bookmark_id, oldTitle: b.title, title: p.title.trim() || b.title, oldTags: b.tags, tags: cleanTags,
        newTags: cleanTags.filter((t) => !known.has(t)), oldFolder: b.collection_id, folder,
        folderPath: pathOf.get(folder) || '', changed: changed && p.changed !== false, reason: p.reason, link: b.link,
      });
    }
    onProgress?.(Math.min(bookmarks.length, i + BATCH), bookmarks.length);
  }
  return out;
}
