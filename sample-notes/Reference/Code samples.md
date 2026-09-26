# Code samples

Short fenced blocks in the languages we hit most, so the highlighter can be checked in one place. The syntax for fences is in the [[Markdown cheatsheet]]. Nothing here is meant to run as a program, though most of it would.

## JavaScript

The shape of the tree builder in [[Plexar Notes]], reduced to the idea.

```js
const buildTree = (entries) => {
  const isNote = (e) => e.type === "file" && /\.md$/i.test(e.path);
  const nodes = entries.filter(isNote).map((e) => ({ name: e.path.replace(/\.md$/i, ""), path: e.path }));
  return nodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
};
```

## Python

A one-off script that counted links across the folder while we wrote [[Roadmap]].

```python
import re
from pathlib import Path

LINK = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]*)?\]\]")

for note in Path("sample-notes").rglob("*.md"):
    targets = LINK.findall(note.read_text(encoding="utf-8"))
    print(f"{note.name}: {len(targets)} links")
```

## HTML

The skeleton of the app shell.

```html
<main class="app">
  <nav class="tree" aria-label="Files"></nav>
  <article class="note">
    <h1>Welcome</h1>
    <p>Open a folder to begin.</p>
  </article>
</main>
```

## CSS

Every colour comes from the tokens file. Nothing else may use a literal.

```css
.note {
  max-width: var(--measure);
  padding: var(--space-4);
  color: var(--fg);
  background: var(--bg);
}
```

## JSON

The settings object the app keeps in memory. Nothing is written to disk.

```json
{
  "folder": "sample-notes",
  "sort": "name-asc",
  "lastOpen": "Welcome.md",
  "showHidden": false
}
```

## Shell

How the tests run, and how to find every note that links to a given name.

```bash
node --test
grep -rl "\[\[Week 39" sample-notes --include="*.md"
```

## SQL

We do not have a database, and we like it that way. But a reviewer asked what the tree would look like as a table, so here it is.

```sql
SELECT path, modified
FROM notes
WHERE path LIKE 'Journal/%'
ORDER BY modified DESC
LIMIT 10;
```

Ideas for turning any of these into a real feature go in [[Ideas]].
