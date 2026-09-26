# Plexar Notes server API

`node server/server.js [folder]` serves the app and a small JSON API over **one open folder**
of Markdown files. The browser app uses nothing else, so anything it does can be scripted.
All routes are in [`server/routes.js`](../server/routes.js); it uses the Node standard
library only.

- Base URL: `http://localhost:3000` (`PORT` and `HOST` change it; the default host is
  `127.0.0.1`, so only this machine can call it).
- Bodies are JSON (`Content-Type: application/json`); responses are JSON.
- **Paths** in `path`, `from` and `to` are relative to the open folder, with forward slashes,
  e.g. `Projects/Roadmap.md`. An absolute path, or any path containing a `..` segment, is
  rejected with `400` before the disk is touched (see [`lib/paths.js`](../lib/paths.js)).
- **Errors** are `{"error": "<message>"}` with the status below. A known path with the wrong
  method is `405`; an unknown path is `404`.

## The open folder

### `GET /api/folder`
The folder being served.
```json
{"folder": "sample-notes", "root": "/home/you/plexar-notes/sample-notes"}
```

### `POST /api/open-folder`
Switch to another folder while the server runs. This is the one place an absolute path is
accepted, because it chooses the folder rather than reaching inside it.
```json
{"folder": "/home/you/Documents/notes"}
```
Returns the same shape as `GET /api/folder`. `400` if the path is not absolute or is not an
existing folder.

### `GET /api/folders?path=<absolute path>`
The subfolders of a path, for the folder picker (the home folder when `path` is empty).
Hidden folders and ones that cannot be read are left out.
```json
{"path": "/home/you", "parent": "/home", "folders": [{"name": "Documents", "path": "/home/you/Documents"}]}
```
`parent` is `null` at the top of a drive or file system.

## Browsing

### `GET /api/tree`
The whole folder as a tree: folders first, then files, each `{name, path, type}`, with
`children` on folders.
```json
{"folder": "sample-notes", "root": "…", "tree": [
  {"name": "Projects", "path": "Projects", "type": "folder", "children": [
    {"name": "Roadmap.md", "path": "Projects/Roadmap.md", "type": "file"}]}]}
```

### `GET /files/<path>`
The raw file, for images and other attachments a note embeds (`![](assets/picture.png)`).

## Notes

| Route | Body / query | Returns | Errors |
|---|---|---|---|
| `GET /api/file?path=a/b.md` | | `{path, content, mtime}` | `400` not Markdown or unsafe · `404` not found |
| `PUT /api/file` | `{path, content}` | `{ok, mtime}` | `400` no content · `404` its folder is missing · `409` a folder is there |
| `POST /api/file` | `{path, content?}` | `{ok, path}` | `409` already exists |
| `DELETE /api/file?path=a/b.md` | | `{ok}` | `404` not found, or it is a folder |

`PUT` overwrites an existing note (this is what autosave calls). `POST` creates a new one:
it adds `.md` if missing and creates any missing parent folders.

## Folders and moves

| Route | Body / query | Returns | Errors |
|---|---|---|---|
| `POST /api/folder` | `{path}` | `{ok, path}` | `409` a file is there |
| `DELETE /api/folder?path=Projects/Old` | | `{ok}` | `400` the open folder itself · `404` not found |
| `POST /api/rename` | `{from, to}` | `{ok, path}` | `400` a folder into itself · `404` not found · `409` the destination exists |

`POST /api/folder` works like `mkdir -p`. `DELETE /api/folder` removes everything inside.
`POST /api/rename` renames or moves a note or a folder, creating the destination's parent.

## Search and links

### `GET /api/search?q=<text>&limit=<n>`
Searches every note's name and text. An empty `q` returns no results.
```json
{"query": "roadmap", "results": [{"path": "Projects/Roadmap.md", "title": "Roadmap", "score": 12, "matches": [{"line": 3, "text": "…"}]}]}
```

### `GET /api/backlinks?path=a/b.md`
The notes that link to this one with `[[Name]]`, each with the line that mentions it.
```json
{"path": "Projects/Roadmap.md", "count": 2, "backlinks": [{"from": "Welcome.md", "title": "Welcome", "context": "…"}]}
```
`400` if the path is not a Markdown file, `404` if the note is not there.

## Example: script it with curl

```sh
curl -s localhost:3000/api/tree
curl -s -X POST localhost:3000/api/file -H 'Content-Type: application/json' \
     -d '{"path": "Inbox/Idea.md", "content": "# Idea\n\nLinks to [[Welcome]]."}'
curl -s "localhost:3000/api/backlinks?path=Welcome.md"
curl -s "localhost:3000/api/search?q=idea"
```
