# Welcome

Hello, and welcome to Plexar Notes.

Plexar Notes is a small desktop-style note taker for a folder of Markdown files. There is no database and no account. You open a folder, the app lists every `.md` file in it, and you read and write those files in place. Close the app and the folder is still just a folder. Open it in any other editor and nothing is lost.

This folder is the demo set that ships with the app. Everything in it was written by the team while we built the thing, so it doubles as a tour and as a test bed for the renderer.

## Where to start

- [[Plexar Notes|The project note]] explains what the app is and how it is put together.
- [[Roadmap]] lists what is done and what is next.
- [[Ideas]] is the scratch pad where half-formed thoughts go.
- [[Markdown cheatsheet]] shows every bit of syntax the renderer supports.
- [[Code samples]] has fenced blocks in a handful of languages so you can check highlighting.
- [[Tables]] has two tables, one with alignment colons.
- [[September]] and [[Week 39]] are journal pages, nested two folders deep.
- [[Team]] and [[Len]] introduce the people behind the app.
- [[Reading list]] is what we have been reading while building.

Links use double square brackets. Click one and the note opens. If the note does not exist yet, like [[Someday]], clicking the link creates the file for you and drops you straight into it.

> [!note]
> Links resolve by note name, not by path. `[[Roadmap]]` finds `Projects/Roadmap.md` even though the link does not mention the folder. If two notes share a name the first one wins, so keep names unique.

> [!tip]
> Press <kbd>Ctrl</kbd>+<kbd>P</kbd> to open the quick switcher and jump to any note by typing part of its name.

## Things to try

- [x] Open this folder in Plexar Notes
- [x] Click a link to another note
- [x] Click the [[Someday]] link and watch the file appear
- [ ] Edit a note and check that the file on disk changed
- [ ] Make a new folder and drop a few notes into it
- [ ] Try the sort options in the file tree

## How the folder is laid out

```
sample-notes/
  Welcome.md
  Reading list.md
  Projects/
  Reference/
  Journal/2026/
  People/
  assets/
```

Folders in the tree always sort before files. Inside each group the order is by name, or by modified time if you change the sort.

If anything looks wrong, tell [[Len]]. That is usually how bugs get fixed around here.
