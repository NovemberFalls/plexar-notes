# Markdown cheatsheet

Every piece of syntax the renderer understands, in one file. If something on this page looks wrong in the app, that is a bug. Report it to [[Len]] or add it to [[Ideas]] if it is more of a wish.

## Headings

The line above this one is a level two heading. The first line of the file is level one.

### Level three

Used for sub-sections inside a topic.

#### Level four

The smallest heading we style. Anything deeper renders as bold text.

## Emphasis

Use **bold** for the thing you must not miss, *italic* for a term the first time it appears, and ~~strikethrough~~ for something that used to be true. You can also ***combine*** them if you must.

## Inline code

Wrap a file name or a key word in backticks: `Welcome.md`, `node --test`, `[[link]]`. Inline code never wraps, so keep it short.

## Block quote

> The folder is the source of truth. Nothing is stored anywhere except in the files you can see.
>
> From the principles in [[Plexar Notes]].

## Callouts

A block quote whose first line is a bracketed keyword becomes a callout.

> [!note]
> Plain information the reader should have.

> [!tip]
> Something that makes the app nicer to use.

> [!warning]
> Something that can lose work if you get it wrong.

## Lists

- A bullet
- Another bullet
  - Nested with two spaces
    - Nested again

1. First
2. Second
3. Third

- [x] A done task
- [ ] A task still to do

## Links

- A note link: [[Roadmap]]
- A note link with alias: [[Reading list|what we have been reading]]
- A link to a note that does not exist: [[Someday]] (click it to create the file)
- A normal web link: [CommonMark](https://commonmark.org)
- A bare URL: <https://commonmark.org>

## Images

Images are relative to the open folder.

![Plexar mark](assets/mark.png)

## Horizontal rule

Three dashes on their own line.

---

## Tables

| Syntax | Renders as |
|--------|------------|
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `` `code` `` | `code` |

Alignment and wider examples are in [[Tables]].

## Code blocks

Fence with three backticks and a language name.

```js
const greet = (name) => `Hello, ${name}`;
```

More languages in [[Code samples]].

## Keys and inline HTML

A little inline HTML is allowed. The renderer keeps <kbd>Ctrl</kbd>, <kbd>Shift</kbd>, <sup>sup</sup>, <sub>sub</sub> and <mark>mark</mark>. Script tags and event handlers are stripped.

| Keys | Action |
|------|--------|
| <kbd>Ctrl</kbd>+<kbd>P</kbd> | Quick switcher |
| <kbd>Ctrl</kbd>+<kbd>N</kbd> | New note in the current folder |
| <kbd>Ctrl</kbd>+<kbd>S</kbd> | Save (also happens on blur) |
| <kbd>Ctrl</kbd>+<kbd>E</kbd> | Toggle edit and preview |

## Escaping

Put a backslash in front of a character to show it as is: \*not italic\*, \[\[not a link\]\].
