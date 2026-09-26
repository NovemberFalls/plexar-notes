# September

The month page. One line per day, more if something happened. Weekly pages like [[Week 39]] carry the detail.

## Goals for the month

- [x] Ship the file tree and path guard
- [x] Get the renderer through the whole [[Markdown cheatsheet]] without a glitch
- [x] Write the demo folder
- [ ] Start the quick switcher, see [[Roadmap]]

## Days

- **1 Sep** Set up the repo. No build step, ever. Wrote that down in [[Plexar Notes]] so nobody forgets.
- **3 Sep** Tree builder first pass. Folders before files was easy; natural sort took longer than it should have.
- **5 Sep** Path guard. Every read and write now goes through one function. Sleep better.
- **8 Sep** Started the renderer. marked for Markdown, highlight.js for code. Both vendored, no network.
- **10 Sep** Callouts. Turns out `> [!note]` is easier to detect after rendering than before.
- **12 Sep** Link syntax. `[[Name]]` and `[[Name|shown]]` both work. Create-on-click for missing targets landed the same day.
- **15 Sep** Design tokens. Moved every literal colour into one file and wrote a test that fails if one comes back.
- **17 Sep** Rest day. Read half of a book from the [[Reading list]].
- **19 Sep** Rename on disk. The tree re-reads rather than patching itself. Simpler and it has not been wrong yet.
- **22 Sep** Started the demo folder. Writing notes as if they were real turned up three renderer bugs in an hour.
- **24 Sep** Fixed those bugs. Nested lists three deep now indent properly.
- **26 Sep** Finished the demo folder and its test. Wrote this page.

## Looking back

Two things worth keeping. First, writing real content is a better test than any fixture. Second, saying no early to sync, plugins and a database kept the month short. Both go in [[Ideas]] as lessons, not features.

Next month: the quick switcher, then search. Details with [[Len]].
