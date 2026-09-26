# The goal, as typed

Plexar Notes becomes a polished desktop-style note taker for a folder of Markdown files on disk, laid out like Obsidian with fewer features, and it must look like a Plexar product. Today the repo is a one-page toy (index.html, notes.js, tests run with `node --test`; tests/style.test.js already enforces the Plexar look and must stay green). Build it in this repository layout:

  server/        server.js (Node standard library only) and its routes
  lib/           pure logic modules, no DOM (path guard, tree builder, [[link]] parser, backlinks index, search, word count)
  public/        index.html, css/ (app.css split by area if it grows), js/ (ES modules: tree.js, tabs.js, editor.js, search.js, ...)
  public/vendor/ marked and highlight.js as plain files with their licence files (no npm install, no build step, no CDN at runtime)
  brand/         the Plexar mark (already there) and plexar-tokens.css (move it here; pages link it)
  sample-notes/  a demo folder with nested subfolders and a dozen linked notes that show off headings, tables, task lists, code in several languages, images and [[links]]
  tests/         node --test for every lib/ module and for the server API

`node server/server.js [folder]` serves the app on http://localhost:3000 over the chosen folder (default: sample-notes/). The API lists the tree, reads, writes, creates, renames, moves and deletes files and folders; every path is guarded so it can never leave the folder (reject any `..` segment and absolute paths; test it). Use the words "folder", "file", "open folder" everywhere; never "vault".

The window, left to right, like Obsidian:
1. A thin icon ribbon on the far left (vertical icons: files, search, starred, settings).
2. A file explorer panel: a header row of ICON buttons with tooltips (new note, new folder, sort, collapse all), then the folder tree (chevrons for folders, file names without .md, the open file highlighted, right-click menu: rename, move, delete with a confirm, new note here). At the bottom: the open folder's name with an icon to open a different folder, and a settings icon.
3. The main area: a tab bar across the top (open files as tabs with close buttons and a + for a new tab; back/forward arrows), and a SEARCH BOX TOP CENTRE in the title bar (typing searches file names and full text, results in a dropdown; Ctrl+P and Ctrl+Shift+F focus it). The note is shown in a centred readable column (about 750px), title at the top.
4. A status bar along the bottom right: backlinks count (click to show the notes linking here), word count and character count, and a saved indicator.

Reading view renders Markdown excellently: headings, nested lists, task checkboxes, tables with borders like Obsidian's, block quotes, callouts (> [!note]), links, images, horizontal rules, inline HTML, and code blocks with syntax highlighting (JS, Python, HTML, CSS, JSON, shell, SQL) and a copy button. Edit mode is a clean full-height editor in the same column; toggle with an icon at the top right of the note and Ctrl+E; autosave shortly after typing stops. [[Note name]] links open the note (or offer to create it).

The look is Plexar, not generic: dark only, every colour from brand/plexar-tokens.css (var(--px-*) or color-mix of them; tests/style.test.js fails otherwise), Montserrat (var(--px-font-display)) for headings and the app name, the Plexar mark in the ribbon, the warm radial glow behind the panels at low opacity, sentence-case labels, soft rounded corners (var(--px-radius*)), hover states on every icon, the accent colour (var(--px-accent)) for the active tab, the selected file and focus rings. Icons are inline SVG, one consistent stroke style.

It is a note taker: no PDF or other export, no plugins, no graph view, no sync. Every task keeps `node --test` green (including tests/style.test.js) and adds tests for what it adds. Screenshots in QA must show the whole window, and each must show a different state (e.g. tree expanded, a tab open with a table and code block, search dropdown with results, edit mode, backlinks shown).
