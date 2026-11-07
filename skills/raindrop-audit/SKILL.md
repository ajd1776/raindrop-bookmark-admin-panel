---
name: raindrop-audit
description: Audit your WHOLE Raindrop library (not just Recently Saved) - check every bookmark's title follows the "Name - What - Source" format and its tags follow the 7-layer tag network, then fix the ones that don't. Use when the user says "audit my bookmarks", "check all my bookmarks are named and tagged", "/raindrop-audit", or presses Audit on the Bookmark Admin Panel.
---

# Raindrop library audit

Check every bookmark in your Raindrop.io library and fix titles and tags that break the house rules. Use the Raindrop.io connector tools (`find_bookmarks`, `find_tags`, `find_collections`, `fetch_bookmark_content`, `update_bookmarks`).

The naming rules, the tag network and the folder map are defined in the **raindrop-inbox** skill at `~/.claude/skills/raindrop-inbox/SKILL.md`. Read that file first and apply exactly the same rules here.

## Modes
- `/raindrop-audit` or `/raindrop-audit dry run` (default): report only, change nothing.
- `/raindrop-audit fix`: report, then apply the fixes.
- `/raindrop-audit fix folder "NAME"`: only that folder (and its subfolders).
If the mode is unclear, do a dry run.

## 1. Load
- `find_tags` once (the allowed tag list). `find_collections` once (folder ids and names).
- Page through `find_bookmarks` with `limit: 150` (`page: 1, 2, …`) until all are read. Skip Trash and Recently Saved (the inbox has its own command).

## 2. Check each bookmark (no web fetches unless a title is unreadable)
Flag a bookmark when ANY of these is true:
- **Title**: not 2–4 parts joined by " - "; contains SEO filler ("|", "Buy", "Official Site", "Free Shipping", "Home -"), a raw URL, emoji, or is ALL CAPS shouting; or is just a domain.
- **Tags**: fewer than 3 or more than 5; not exactly one `type/`; not exactly one `use/`; no `topic/`; more than two `topic/`; any tag that isn't in the existing tag list; layer order violations (for/ vibe/ place/ via/ used while a required layer is missing).
- **Rules**: Wikipedia links missing `type/wiki` + `via/wikipedia`; IMDb links missing `via/imdb`.
- **Folder**: the bookmark sits at a hub's top level (hubs hold only subfolders). Report it and suggest a subfolder; only move it in `fix` mode.

Do not flag a title just because you would word it differently. Only flag clear rule breaks.

## 3. Report
Print a summary first: bookmarks checked, flagged by reason, clean percentage.
Then a table of flagged bookmarks: id · current title → proposed title · current tags → proposed tags · reason. Group by hub. If more than 60 are flagged, show the first 60 and the count of the rest.

## 4. Fix (only in fix mode)
- Append one line per change to `~/.claude/skills/raindrop-audit/log.tsv` (header `date	bookmark_id	old_title	new_title	old_tags	new_tags` if new) before writing, so it can be undone.
- `update_bookmarks` in batches: group bookmarks that get identical tags; otherwise one call each. Only change title, tags and (for top-level strays) collection_id.
- Never delete anything. Never create tags or folders; suggest them in the report instead.
- Finish with: changed N, skipped N (and why), and remind the user to press [R] on the Bookmark Admin Panel to see the new numbers.
