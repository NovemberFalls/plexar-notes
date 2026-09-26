# Roadmap

What is done, what is next, and what we have said no to. Dates are targets, not promises. The overall shape of the app is in [[Plexar Notes]].

## Done

- [x] File tree with folders first and natural sort
- [x] Path guard so nothing outside the open folder can be touched
- [x] Read, write and rename notes on disk
- [x] Render Markdown with marked, highlight fenced code with highlight.js
- [x] `[[Note name]]` links, including the alias form
- [x] Create a note on click when a link points nowhere
- [x] Design tokens in one CSS file, no literal colours elsewhere
- [x] This demo folder

## Next

- [ ] Quick switcher (2026-10)
- [ ] Search across the folder, plain text first, regex later (2026-10)
- [ ] Backlinks panel: which notes link here (2026-11)
- [ ] Drag a file between folders in the tree (2026-11)
- [ ] Remember the last open note per folder (2026-11)

## Later

- [ ] Footnotes
- [ ] Maths with KaTeX, if the size is acceptable
- [ ] A daily note shortcut that opens today's page in `Journal/`
- [ ] Light and dark themes chosen from the tokens file
- [ ] Export a note to HTML with the styles inlined

## Not doing

- Sync. Use whatever already syncs your folder.
- Plugins. The renderer is small on purpose.
- A database. See the first principle in [[Plexar Notes]].
- Anything that stores data outside the folder you opened.

## Why Markdown

Because the notes have to outlive the app. A folder of `.md` files opens in every editor made in the last twenty years and will open in the ones made in the next twenty. The argument is spelled out at greater length in a post on the [[Reading list]].

Rough ideas that have not earned a date live in [[Ideas]]. Anything with no home at all can go in [[Someday]].
