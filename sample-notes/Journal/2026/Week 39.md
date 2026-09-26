# Week 39

Monday 21 to Sunday 27 September 2026. The month view is in [[September]].

## Plan

- [x] Write the demo folder so the app has something to open by default
- [x] Cover it with a test that walks the folder and checks the syntax is all there
- [x] Fix whatever the demo turns up
- [ ] Sketch the quick switcher

## Monday

Agreed the shape of the demo folder with the [[Team]]. Two levels of nesting at least, a note for every kind of syntax, and links everywhere so the create-on-click flow gets exercised. No made-up product names; the notes should read like they were written by us, because they were.

## Tuesday

Wrote [[Welcome]] and the [[Markdown cheatsheet]]. First bug: an image with a relative path was resolved against the note's folder, not the open folder. Fixed to match what the cheatsheet says.

## Wednesday

[[Code samples]] and [[Tables]]. Second bug: alignment colons were ignored when the header cell had trailing spaces. Third bug: a `|` inside inline code broke the row. Both fixed, both now in the tables note as examples.

## Thursday

Journal pages, these ones. Nested lists three deep in [[Plexar Notes]] were rendering flat. That turned out to be a CSS problem, not a parser problem. Two lines in the tokens file.

## Friday

The test. It walks `sample-notes/`, counts the notes, looks for each piece of syntax in at least one file, and checks the first line of every note matches its file name. It also fails if the word we do not use appears anywhere. Green on the first full run after one fix to a heading.

## Weekend

Off. Something for [[Someday]]: a daily note shortcut so these pages write themselves.

## Carry over

- Quick switcher sketch, moved to [[Roadmap]] with a date
- Ask [[Len]] whether the demo folder should be read-only by default
