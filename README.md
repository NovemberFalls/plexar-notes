# Plexar Notes

A desktop-style Markdown note taker for one folder of `.md` files. It is laid out like
Obsidian with fewer features and styled as a Plexar product: an explorer tree on the left,
tabs across the top, a reading view or editor in the middle, and a status bar at the bottom.

It was built end to end by agents under the
[Plexar Framework](https://github.com/NovemberFalls/plexar-framework): a long-form goal
went in, a planner sliced it into tasks with checks, a named human approved the plan once,
agents did each task on its own branch, a deterministic gate and a review chain judged the
work, and a human gave the final verdict. The `qa/` folder holds the QA notes and screenshots
each task left behind.

## Running it

    node server/server.js [folder]

Then open http://localhost:3000. The folder defaults to `sample-notes/` in the repo and is
created if missing. Set `PORT` to listen somewhere else:

    PORT=4000 node server/server.js ~/notes

There is no build step and no npm install. The server uses the Node standard library only,
and everything the browser needs is checked in under `public/`.

## Features

- Explorer tree with new note, new folder, rename, move and delete from a right-click menu.
- Open folder: the folder button at the top of the explorer picks another folder on this
  machine and the server switches to it while running. The folder's name is shown at the
  bottom of the explorer.
- Tabs with back and forward history. Ctrl-click or Cmd-click a note to open it in a
  background tab.
- Search box: file names by default, full text on demand.
- Reading view with syntax-highlighted code blocks and copy buttons, callouts, tables and
  task lists.
- `[[links]]` between notes; clicking a link to a note that does not exist creates it.
- Edit mode with autosave, and a save state shown in the status bar.
- Status bar with backlinks, word and character counts.
- Starred notes and a settings panel (autosave delay, showing file extensions, and so on).

## Keyboard shortcuts

Ctrl works as Cmd on macOS.

| Shortcut | What it does |
|---|---|
| Ctrl+E | Toggle between reading and edit mode for the open note |
| Ctrl+P | Focus the search box in file name mode |
| Ctrl+Shift+F | Focus the search box in full text mode |
| Ctrl+S | Save now (autosave would get there anyway) |
| Ctrl+W | Close the active tab |
| Ctrl+Tab | Next tab (Ctrl+Shift+Tab for the previous one) |

The handlers live in `public/js/app.js` under "keyboard shortcuts". Some browsers keep
Ctrl+Tab and Ctrl+W for themselves; the other shortcuts work everywhere.

## Repo layout

| Path | Contents |
|---|---|
| `server/` | `server.js` starts the HTTP server; `routes.js` serves the app and the JSON API over the open folder |
| `lib/` | Pure logic shared by server and browser: paths guard, tree, links, backlinks, search, words, markdown, autosave |
| `public/` | `index.html`, `css/`, `js/` ES modules, and `vendor/` |
| `public/vendor/` | marked and highlight.js as plain ES module files, with their licences |
| `brand/` | The Plexar mark, fonts and `plexar-tokens.css` |
| `sample-notes/` | The folder served by default |
| `tests/` | Tests for `node --test` |
| `qa/` | QA notes and screenshot evidence from each task |

## Tests

    node --test

Tests cover the pure modules in `lib/`, the server routes, the sample notes and the browser
UI. One of them, `tests/style.test.js`, enforces the Plexar look: no literal colours (hex,
`rgb()`, `hsl()`) anywhere outside `brand/plexar-tokens.css` and `public/vendor/`, every
page must load the tokens file, and headings must use the brand display font. Use
`var(--px-*)` from the tokens file instead of writing a colour.

## Vendored libraries and licences

`public/vendor/` holds the only third-party code in the repo. `public/vendor/README.md`
records the pinned versions, where they came from and how to update them.

| Library | Licence |
|---|---|
| marked | MIT, see `public/vendor/marked/LICENSE.md` |
| highlight.js | BSD-3-Clause, see `public/vendor/highlight/LICENSE` |

No highlight.js theme is vendored; code is styled with Plexar tokens.

## Not goals

- Export to other formats.
- Plugins.
- Graph view.
- Sync between machines.
