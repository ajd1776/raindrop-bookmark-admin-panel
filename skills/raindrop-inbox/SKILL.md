---
name: raindrop-inbox
description: Sort your Raindrop "Recently Saved" inbox - rename each new bookmark (Name - What - Source), tag it with the 7-layer tag network and move it into the right hub folder. Use when the user says "sort my Recently Saved", "process my Raindrop inbox", "/raindrop-inbox", or presses RUN on the Bookmark Admin Panel.
---

# Raindrop inbox

Process every bookmark in your Raindrop.io **Recently Saved** folder (a top-level folder; find its id with `find_collections`). Use the Raindrop.io connector tools: `find_bookmarks`, `find_tags`, `find_collections`, `fetch_bookmark_content`, `update_bookmarks`. Work quietly and finish with a short report.

If the request says "dry run" or "preview", do steps 1–3 and show the plan without writing anything.

## 1. Read the inbox
- `find_bookmarks` with `collection_ids: [<Recently Saved id>]`, `limit: 150`. Page further if `total` > 150.
- Empty: say "Recently Saved is empty, nothing to do." and stop.
- `find_tags` (no arguments) once. Use ONLY tags that already exist. Never invent a tag; if a new one seems needed, suggest it in the report instead.

## 2. For each bookmark decide three things
Look at the title, link and domain. If that doesn't make clear what the page is, call `fetch_bookmark_content`.

### A. Title: 2 to 4 parts joined by " - "
- Pattern: **Name - What it is - Source**. Drop the source when it adds nothing (the brand's own site).
- Minimalist and easy to read. No SEO filler, no "| Site name", no prices, no "Buy now", no emoji, no dates unless they matter.
- Examples: `List of Shapes - Lists - Wikipedia`, `Night Owl - Series`, `Northwind Studio - Furniture Brand`, `Grid Garden - CSS Game`, `Gore-Tex Alternatives - Thread - Reddit`, `Incoterms - Shipping Guide`.

### B. Tags: the 7-layer network, 3 to 5 tags, never more than 5
Exactly 1 `type/` + exactly 1 `use/` + 1–2 `topic/`, then fill up to 5 with `for/` > `vibe/` > `place/` > `via/` in that priority.

- **type/** (what the link IS): brand, shop, listing (one product page), supplier, tool, app, account (logins/dashboards), article, guide, video, course, docs, wiki, reference, forum, news, dataset, assets, template, portfolio, game, search, map
- **use/** (WHY it was saved): buy, learn, research, reference, inspiration, manage, build, watch, read, hire, plan, fun
- **topic/** (what it's ABOUT): an existing topic/ tag, e.g. web-dev, python, fonts, icons, travel, fitness, film, music, history, finance, home.
- **for/** (which project it SERVES): the user's own project tags, e.g. for/side-hustle, for/portfolio. Only use ones that already exist.
- **vibe/** (aesthetic): e.g. minimal, retro-tech, sci-fi, brutalist, gorpcore, luxury. Only use ones that already exist.
- **place/** (where it's based or about): e.g. uk, usa, europe, japan, london.
- **via/** (platform): e.g. reddit, youtube, wikipedia, github, imdb, medium, amazon.

Rules:
- Brands and shops: `type/brand` or `type/shop` + `use/buy`; only add a for/ project tag when the page is clearly about that project.
- Wikipedia pages: `type/wiki` + `via/wikipedia`. Films: `via/imdb` + `use/watch`.

### C. Folder: move it into the best existing subfolder
Call `find_collections` once and build the folder tree. Never file into a top-level folder that has subfolders, and never create folders. Pick the most specific folder whose name and contents match the bookmark (look at a few bookmarks already in a candidate folder if unsure).

## 3. Safety checks
- Duplicates: `find_bookmarks` with `url_pattern` for the bookmark's domain + path. If the same URL already exists outside Recently Saved, rename and tag the new one but leave it in Recently Saved and list it as a duplicate. Don't delete it.
- Can't tell what it is (dead link, login wall, no content): leave it untouched in Recently Saved and list it.
- Never delete anything.

## 4. Write
- Before writing, append one line per bookmark to `~/.claude/skills/raindrop-inbox/log.tsv` (create it with the header `date	bookmark_id	original_title	new_title	folder_id	tags` if missing) so any change can be undone.
- `update_bookmarks`: set `title`, `tags` (replaces the list) and `collection_id`. Group bookmarks that share folder + tags; otherwise one update per bookmark.

## 5. Report
A short table: new title · folder · tags. Then anything left in Recently Saved and why. Remind the user that the Bookmark Admin Panel picks up the changes the next time it opens or when they press Refresh.
