# Plexar Notes

The project note. Everything else in the `Projects/` folder hangs off this one. Start at [[Welcome]] if you have not read it yet.

## What it is

Plexar Notes is a Markdown note taker that works on a folder of `.md` files and nothing else. You point it at a folder, it shows a file tree on the left and a rendered note on the right, and edits go straight back to disk. The app has no build step: open `index.html` and it runs.

It was built end to end by agents under the Plexar Framework. Each task ran on its own branch, a deterministic gate ran the tests, and a review chain judged the work before a human gave the final verdict. The `showcase/` folder in the repo holds the record.

## Parts

| Part | File | Job | Tests | Status |
|------|------|-----|-------|--------|
| Tree builder | `lib/tree.js` | Turns a flat list of paths into a sorted tree | `tests/tree.test.js` | done |
| Path guard | `lib/paths.js` | Keeps every read and write inside the open folder | `tests/paths.test.js` | done |
| Note store | `lib/notes.js` | Reads, writes and renames notes | `tests/notes.test.js` | done |
| Renderer | `public/` | Markdown to HTML with marked and highlight.js | manual, see [[Markdown cheatsheet]] | done |
| Design tokens | `plexar-tokens.css` | Colours, spacing and type, no literals elsewhere | `tests/style.test.js` | done |
| Demo folder | `sample-notes/` | The notes you are reading | `tests/sample-notes.test.js` | in progress |

Borders on the table are drawn by the renderer, not by the Markdown. The pipes only mark the columns.

## How a note gets on screen

1. The app lists the folder and hands the paths to the tree builder.
2. The tree builder drops anything that is not `.md`, implies folders from paths, and sorts folders before files.
3. You click a file. The path goes through the path guard so nothing outside the folder can be read.
4. The note store reads the file and hands the text to the renderer.
5. The renderer turns `[[links]]` into anchors, then hands the rest to marked.
6. Fenced code blocks are passed to highlight.js by language.
7. Callouts like `> [!note]` are picked out after rendering and given a class.

## Principles

- The folder is the source of truth
  - Nothing is stored anywhere except in the files you can see
    - No index file, no sidecar, no hidden metadata
    - If the app is deleted the notes are untouched
  - Renames and moves happen on disk, and the tree just re-reads
- Markdown as written, not as we wish it were
  - CommonMark first, GitHub extensions second
    - Tables, task lists and strikethrough are in
    - Footnotes and maths are out for now, see [[Roadmap]]
  - Anything the renderer does not understand is shown as plain text, never dropped
- Keyboard first
  - Every action has a shortcut
    - Shortcuts are listed in [[Markdown cheatsheet|the cheatsheet]] under the keys section
    - No shortcut uses more than two modifiers
  - The mouse is a fallback, not the plan

## Open questions

Kept in [[Ideas]] so they do not clutter this page. Bigger items with a date go in [[Roadmap]]. The week-by-week story is in [[Week 39]].
