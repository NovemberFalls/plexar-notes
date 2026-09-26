# Plexar Notes user guide

Plexar Notes is a note taker for a folder of Markdown files on your own disk. Your notes are
plain `.md` files: open the same folder in any other editor and nothing is lost. There is no
account, no cloud and no database.

- [Install and start](#install-and-start)
- [A tour of the window](#a-tour-of-the-window)
- [Working with notes and folders](#working-with-notes-and-folders)
- [Writing](#writing)
- [Links between notes](#links-between-notes)
- [Finding things](#finding-things)
- [Tabs](#tabs)
- [Starred notes and settings](#starred-notes-and-settings)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Where your notes live, and safety](#where-your-notes-live-and-safety)
- [Troubleshooting](#troubleshooting)

## Install and start

You need [Node.js](https://nodejs.org) 20 or newer. Nothing else: there is no `npm install`
and no build step.

```sh
git clone https://github.com/NovemberFalls/plexar-notes
cd plexar-notes
node server/server.js
```

Open **http://localhost:3000**. The first time, you see `sample-notes/`, a demo folder with
nested subfolders and linked notes that show every feature. Start with **Welcome**.

To use your own folder, name it when you start (it is created if it does not exist):

```sh
node server/server.js ~/Documents/notes          # macOS / Linux
node server/server.js "C:\Users\you\Documents\notes"   # Windows
```

You can also switch folders while the app is running: click the folder icon at the bottom
of the explorer, beside the folder's name.

Other settings:

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `3000` | The port the app listens on. |
| `HOST` | `127.0.0.1` | Where it listens. Only this computer can reach it by default. Set `HOST=0.0.0.0` only if you mean to let other machines in; anyone who can reach it can read and change your notes. |

## A tour of the window

The layout follows Obsidian, left to right:

- **Ribbon** (far left): the Plexar mark, then icons for the file explorer, search and
  starred notes. Settings sit at the bottom.
- **Explorer**: icon buttons along the top (new note, new folder, sort, collapse all), then the
  folder tree. Folders open and close with the chevron; notes are shown without `.md`. The
  open note is highlighted. The folder's name and the open-folder button are at the bottom.
- **Tab bar and search**: open notes as tabs, with back and forward arrows. The search box
  is at the top centre.
- **The note**: a centred column. The icon at the top right switches between reading and
  editing.
- **Status bar** (bottom right): backlinks, word and character counts, and whether the note
  is saved.

## Working with notes and folders

- **New note**: the pencil icon at the top of the explorer, or right-click a folder and pick
  *New note here*.
- **New folder**: the folder-plus icon.
- **Rename, move, delete**: right-click a note or folder. Delete always asks first. Moving a
  note keeps it a note; moving a folder takes everything inside it.
- **Sort**: the sort icon cycles through name and modified-time orders.
- **Collapse all**: closes every folder in the tree.

Everything you do in the explorer happens to the real files on disk, immediately.

## Writing

Open a note and press **Ctrl+E** (or the icon at its top right) to edit. It saves on its own a
moment after you stop typing, and the status bar shows *Saved*. **Ctrl+S** saves at once.

The reading view renders:

| You write | You get |
|---|---|
| `# Heading` to `###### Heading` | Headings |
| `- item`, `1. item`, indented for nesting | Lists |
| `- [ ] to do` / `- [x] done` | Task list with checkboxes |
| `| a | b |` rows with a `|---|---|` line | A table |
| `> quoted text` | A block quote |
| `> [!note]`, `> [!tip]`, `> [!warning]` on the first line of a quote | A callout box |
| ```` ```js ```` … ```` ``` ```` | A code block with syntax highlighting and a copy button |
| `![alt](assets/picture.png)` | An image from your folder |
| `---` | A horizontal rule |
| Plain HTML such as `<kbd>Ctrl</kbd>` | Rendered as HTML |

Code highlighting covers JavaScript, Python, HTML, CSS, JSON, shell and SQL, among others.
The **Markdown cheatsheet** and **Code samples** notes in `sample-notes/` show all of it.

## Links between notes

Write `[[Note name]]` to link to another note by its name, wherever it sits in the folder.
`[[Note name|shown text]]` shows different text. Click the link to open the note. If it does
not exist yet, clicking it creates it and opens it for you to write.

The status bar shows how many notes link to the one you are reading. Click it to see them,
each with the line that mentions this note.

If two notes share a name, a link goes to the first one found; keep names unique.

## Finding things

The search box at the top centre searches **file names** as you type. Switch it to **full
text** to search inside every note; results show the matching line. Pick a result with the
arrow keys and Enter.

- **Ctrl+P** jumps to the search box in file name mode.
- **Ctrl+Shift+F** jumps to it in full text mode.

## Tabs

Clicking a note opens it in the current tab; **Ctrl-click** opens it in a background tab.
The **+** opens a new tab, the × closes one (or **Ctrl+W**). The arrows at the top left go back
and forward through the notes you have visited in that tab.

## Starred notes and settings

Star a note with the star icon at its top right; starred notes are listed under the star in
the ribbon. The settings (the cog) include the autosave delay and whether file extensions
are shown in the tree. Stars and settings are kept in this browser.

## Keyboard shortcuts

Ctrl works as Cmd on macOS.

| Shortcut | What it does |
|---|---|
| Ctrl+E | Switch between reading and editing |
| Ctrl+S | Save now |
| Ctrl+P | Search file names |
| Ctrl+Shift+F | Search full text |
| Ctrl+W | Close the tab |
| Ctrl+Tab / Ctrl+Shift+Tab | Next / previous tab |
| Esc | Close a menu, a dialog or the search results |

Some browsers keep Ctrl+Tab and Ctrl+W for themselves.

## Where your notes live, and safety

- Your notes are the `.md` files in the folder you opened. Plexar Notes keeps no copy of them
  anywhere else.
- The server refuses any request for a path outside the open folder: absolute paths and any
  path containing a `..` segment are rejected before the disk is touched.
- It listens on `127.0.0.1`, so only this computer can reach it, unless you set `HOST`.
- Deleting a note or folder deletes the files. Keep the folder in Git or a backup if you want
  a history.

## Troubleshooting

| What you see | What to do |
|---|---|
| `EADDRINUSE` when starting | Port 3000 is taken. Start with `PORT=3001 node server/server.js`. |
| The page loads but the tree is empty | The folder has no `.md` files yet. Create a note with the pencil icon. |
| A link opens the wrong note | Two notes share that name. Rename one. |
| Another computer cannot reach it | That is the default. Set `HOST=0.0.0.0` if you really want it on your network. |

For developers: [docs/API.md](API.md) describes the server's JSON API, and the
[README](../README.md) covers the repo layout and tests.
