// Route handling for the Plexar Notes server: static app files, the shared lib/ modules for
// the browser, and the JSON API over the open folder (tree, file and folder operations, search).
// Every path that reaches the folder goes through safeJoin and a realpath check. The one
// exception is the open-folder family (/api/folder, /api/open-folder, /api/folders), which
// takes absolute paths because it chooses the folder rather than a file inside it.
// Node standard library only.
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.join(__dirname, "..");
const PUBLIC = path.join(REPO, "public");
const BRAND = path.join(REPO, "brand");
const LIB = path.join(REPO, "lib");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
};
const JSON_TYPE = "application/json; charset=utf-8";
const MAX_BODY = 20 * 1024 * 1024; // JSON request bodies over 20 MB are refused with 413

// lib/ is written as ES modules (the browser imports it too), so load it once, lazily.
let libPromise = null;
function lib() {
  if (!libPromise) {
    libPromise = Promise.all([
      import("../lib/paths.js"),
      import("../lib/tree.js"),
      import("../lib/search.js"),
      import("../lib/backlinks.js"),
    ]).then(([paths, tree, search, backlinks]) => ({ ...paths, ...tree, ...search, ...backlinks }));
  }
  return libPromise;
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function contentType(file) {
  return CONTENT_TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
}

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": JSON_TYPE });
  res.end(JSON.stringify(body));
}

// Decode one URL path component set; a malformed escape is a bad request, not a crash.
function decodePath(raw) {
  try {
    return decodeURIComponent(raw);
  } catch {
    throw httpError(400, "malformed path");
  }
}

// One value from the raw query string, still URL-encoded: requirePath does the single decode.
// undefined when the name is absent.
function queryValue(rawQuery, name) {
  for (const part of rawQuery.split("&")) {
    const eq = part.indexOf("=");
    const key = eq === -1 ? part : part.slice(0, eq);
    if (key !== name) continue;
    return eq === -1 ? "" : part.slice(eq + 1);
  }
  return undefined;
}

// A path taken from a query or a JSON body: must be a string, decoded exactly once here and
// nowhere else. safeJoin does the actual guarding later; this only shapes the value.
function requirePath(value, label) {
  if (typeof value !== "string") throw httpError(400, `${label} required`);
  return decodePath(value);
}

// Collect the whole request body. Over MAX_BODY (by header or by count) is a 413.
// An oversize body is still drained to its end before the 413 is raised: answering while the
// client is mid-upload would make it see a reset connection instead of the status.
function readBody(req) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers["content-length"]);
    let tooLarge = Number.isFinite(declared) && declared > MAX_BODY;
    let chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      if (tooLarge) return; // drain and discard
      size += chunk.length;
      if (size > MAX_BODY) {
        tooLarge = true;
        chunks = [];
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (tooLarge) reject(httpError(413, "body too large"));
      else resolve(Buffer.concat(chunks));
    });
    req.on("error", (err) => reject(err));
  });
}

// The request body as a JSON object; anything else is a 400.
async function readJson(req) {
  const raw = await readBody(req);
  if (raw.length === 0) throw httpError(400, "JSON body required");
  let body;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    throw httpError(400, "malformed JSON body");
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) throw httpError(400, "JSON object required");
  return body;
}

// The real path of full, or of its nearest existing ancestor with the missing tail appended,
// so a path that does not exist yet can still be checked against the real root.
// A dangling symlink is not "missing": realpath fails on it, but a write would follow it to
// wherever it points, so it is refused outright rather than walked past.
async function nearestRealpath(full) {
  let probe = full;
  const tail = [];
  for (;;) {
    try {
      const real = await fs.promises.realpath(probe);
      return tail.length ? path.join(real, ...tail) : real;
    } catch (err) {
      if (err.code !== "ENOENT" && err.code !== "ENOTDIR") throw err;
      if (await isSymlink(probe)) throw httpError(400, "path escapes folder");
      const parent = path.dirname(probe);
      if (parent === probe) throw err;
      tail.unshift(path.basename(probe));
      probe = parent;
    }
  }
}

// True when the path itself is a symbolic link (followed or not); false when it is absent.
async function isSymlink(full) {
  try {
    return (await fs.promises.lstat(full)).isSymbolicLink();
  } catch (err) {
    if (err.code === "ENOENT" || err.code === "ENOTDIR") return false;
    throw err;
  }
}

// safeJoin plus the symlink check: the resolved real path must still sit inside the real
// root, otherwise 400. Returns the joined absolute path for the file system calls.
async function guardedPath(rootFolder, rel) {
  const { safeJoin } = await lib();
  const full = safeJoin(rootFolder, rel);
  let realRoot;
  try {
    realRoot = await fs.promises.realpath(rootFolder);
  } catch {
    throw httpError(404, "open folder not found");
  }
  const real = await nearestRealpath(full);
  const back = path.relative(realRoot, real);
  if (back === "" || back.startsWith("..") || path.isAbsolute(back)) throw httpError(400, "path escapes folder");
  return full;
}

// stat that yields null for a missing path instead of throwing.
async function statOrNull(full) {
  try {
    return await fs.promises.stat(full);
  } catch (err) {
    if (err.code === "ENOENT" || err.code === "ENOTDIR") return null;
    throw err;
  }
}

// ---- the search cache ----
// Note contents by absolute path, each with the mtime it was read at, so repeated searches
// only re-read files that changed. A stat still happens per file on every search (walk does
// it); the cache only saves the reads. Every route that writes forgets what it touched.
const SEARCH_CACHE_MAX = 5000;
const searchCache = new Map(); // full path -> {mtime, content}

// Drop the cached content of full and of anything under it (when full is a folder).
function forgetSearch(full) {
  searchCache.delete(full);
  const prefix = full + path.sep;
  for (const key of searchCache.keys()) if (key.startsWith(prefix)) searchCache.delete(key);
}

// The content of full as of mtime, from the cache when it is current, else from disk.
// null when the file cannot be read (it may have vanished since the listing).
async function cachedContent(full, mtime) {
  const hit = searchCache.get(full);
  if (hit && hit.mtime === mtime) return hit.content;
  let content;
  try {
    content = await fs.promises.readFile(full, "utf8");
  } catch {
    searchCache.delete(full);
    return null;
  }
  if (searchCache.size >= SEARCH_CACHE_MAX) searchCache.clear();
  searchCache.set(full, { mtime, content });
  return content;
}

// Every .md note under the open folder as [{path, content}] (POSIX paths relative to root),
// contents from the cache where current. Search and backlinks both read from this.
async function cachedNotes(rootFolder) {
  const { isMarkdown } = await lib();
  const root = path.resolve(rootFolder);
  const entries = await walk(root, isMarkdown);
  const notes = [];
  for (const entry of entries) {
    if (entry.type !== "file") continue;
    const content = await cachedContent(path.join(root, entry.path), entry.mtime);
    if (content !== null) notes.push({ path: entry.path, content });
  }
  return notes;
}

// GET /api/search?q=<query>&limit=<n> -> {query, results}; results as lib/search.js gives
// them, over every .md file under the open folder. An empty query is {query: '', results: []}.
async function apiSearch(rootFolder, rawQuery, res) {
  const { search } = await lib();
  const params = new URLSearchParams(rawQuery);
  const query = (params.get("q") || "").trim();
  if (!query) return sendJson(res, 200, { query: "", results: [] });
  // limit: a non-negative integer, else lib/search.js's default (Number(null) would be 0).
  const rawLimit = params.has("limit") ? Number(params.get("limit")) : NaN;
  const limit = Number.isInteger(rawLimit) && rawLimit >= 0 ? rawLimit : undefined;
  const notes = await cachedNotes(rootFolder);
  sendJson(res, 200, { query, results: search(query, notes, { limit }) });
}

// ---- the backlinks index ----
// Built from the same note list as search and kept only as long as that list is the same:
// the index remembers the notes it was built from and is rebuilt as soon as the fresh list
// differs in any path or content. An edit, a new file, a rename or a delete all change that
// list (they forget the cache entry, or change the walk), so the index is never stale.
let linkIndex = null; // {root, notes, index}

function sameNotes(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].path !== b[i].path || a[i].content !== b[i].content) return false;
  }
  return true;
}

async function currentIndex(rootFolder) {
  const { buildIndex } = await lib();
  const root = path.resolve(rootFolder);
  const notes = await cachedNotes(root);
  if (!linkIndex || linkIndex.root !== root || !sameNotes(linkIndex.notes, notes)) {
    linkIndex = { root, notes, index: buildIndex(notes) };
  }
  return linkIndex.index;
}

// GET /api/backlinks?path=a/b.md -> {path, count, backlinks: [{from, title, context}]}
// 400 for a path that is unsafe or not Markdown, 404 when the note is not there.
async function apiBacklinks(rootFolder, rawQuery, res) {
  const { isMarkdown, toPosix, backlinksFor } = await lib();
  const rel = requirePath(queryValue(rawQuery, "path"), "path");
  if (!isMarkdown(rel)) throw httpError(400, "not a Markdown file");
  const full = await guardedPath(rootFolder, rel);
  const stat = await statOrNull(full);
  if (!stat || !stat.isFile()) throw httpError(404, "file not found");
  const index = await currentIndex(rootFolder);
  const posix = toPosix(rel);
  const backlinks = backlinksFor(index, posix);
  sendJson(res, 200, { path: posix, count: backlinks.length, backlinks });
}

// GET /api/file?path=a/b.md -> {path, content, mtime}
async function apiReadFile(rootFolder, rawQuery, res) {
  const { isMarkdown, toPosix } = await lib();
  const rel = requirePath(queryValue(rawQuery, "path"), "path");
  if (!isMarkdown(rel)) throw httpError(400, "not a Markdown file");
  const full = await guardedPath(rootFolder, rel);
  const stat = await statOrNull(full);
  if (!stat || !stat.isFile()) throw httpError(404, "file not found");
  const content = await fs.promises.readFile(full, "utf8");
  sendJson(res, 200, { path: toPosix(rel), content, mtime: stat.mtimeMs });
}

// PUT /api/file {path, content} -> {ok, mtime}; the parent folder must already exist.
async function apiWriteFile(rootFolder, req, res) {
  const { isMarkdown } = await lib();
  const body = await readJson(req);
  const rel = requirePath(body.path, "path");
  if (typeof body.content !== "string") throw httpError(400, "content required");
  if (!isMarkdown(rel)) throw httpError(400, "not a Markdown file");
  const full = await guardedPath(rootFolder, rel);
  const parent = await statOrNull(path.dirname(full));
  if (!parent || !parent.isDirectory()) throw httpError(404, "folder not found");
  const existing = await statOrNull(full);
  if (existing && !existing.isFile()) throw httpError(409, "a folder is there");
  await fs.promises.writeFile(full, body.content, "utf8");
  forgetSearch(full);
  const stat = await fs.promises.stat(full);
  sendJson(res, 200, { ok: true, mtime: stat.mtimeMs });
}

// POST /api/file {path, content?} -> {ok, path}; adds .md, creates parent folders, 409 if there.
async function apiCreateFile(rootFolder, req, res) {
  const { isMarkdown, toPosix } = await lib();
  const body = await readJson(req);
  let rel = requirePath(body.path, "path");
  if (body.content !== undefined && typeof body.content !== "string") throw httpError(400, "content must be a string");
  if (!isMarkdown(rel)) rel = `${rel}.md`;
  const full = await guardedPath(rootFolder, rel);
  if (await statOrNull(full)) throw httpError(409, "already exists");
  try {
    await fs.promises.mkdir(path.dirname(full), { recursive: true });
    await fs.promises.writeFile(full, body.content || "", { encoding: "utf8", flag: "wx" });
  } catch (err) {
    if (err.code === "EEXIST" || err.code === "ENOTDIR") throw httpError(409, "already exists");
    throw err;
  }
  forgetSearch(full);
  sendJson(res, 200, { ok: true, path: toPosix(rel) });
}

// POST /api/folder {path} -> {ok, path}; mkdir -p, 409 when a file is in the way.
async function apiCreateFolder(rootFolder, req, res) {
  const { toPosix } = await lib();
  const body = await readJson(req);
  const rel = requirePath(body.path, "path");
  const full = await guardedPath(rootFolder, rel);
  const existing = await statOrNull(full);
  if (existing && !existing.isDirectory()) throw httpError(409, "a file is there");
  try {
    await fs.promises.mkdir(full, { recursive: true });
  } catch (err) {
    if (err.code === "EEXIST" || err.code === "ENOTDIR") throw httpError(409, "a file is there");
    throw err;
  }
  sendJson(res, 200, { ok: true, path: toPosix(rel) });
}

// POST /api/rename {from, to} -> {ok, path}; moves a file or folder, making the destination parent.
async function apiRename(rootFolder, req, res) {
  const { toPosix } = await lib();
  const body = await readJson(req);
  const from = requirePath(body.from, "from");
  const to = requirePath(body.to, "to");
  const fromFull = await guardedPath(rootFolder, from);
  const toFull = await guardedPath(rootFolder, to);
  const source = await statOrNull(fromFull);
  if (!source) throw httpError(404, "file not found");
  if (fromFull === toFull) throw httpError(409, "already exists");
  if (source.isDirectory() && toFull.startsWith(fromFull + path.sep)) {
    throw httpError(400, "cannot move a folder into itself");
  }
  if (await statOrNull(toFull)) throw httpError(409, "already exists");
  try {
    await fs.promises.mkdir(path.dirname(toFull), { recursive: true });
    await fs.promises.rename(fromFull, toFull);
  } catch (err) {
    if (err.code === "EEXIST" || err.code === "ENOTDIR") throw httpError(409, "already exists");
    if (err.code === "ENOENT") throw httpError(404, "file not found");
    throw err;
  }
  forgetSearch(fromFull);
  forgetSearch(toFull);
  sendJson(res, 200, { ok: true, path: toPosix(to) });
}

// DELETE /api/file?path= -> {ok}; 404 for a missing path or a folder.
async function apiDeleteFile(rootFolder, rawQuery, res) {
  const rel = requirePath(queryValue(rawQuery, "path"), "path");
  const full = await guardedPath(rootFolder, rel);
  const stat = await statOrNull(full);
  if (!stat || !stat.isFile()) throw httpError(404, "file not found");
  await fs.promises.unlink(full);
  forgetSearch(full);
  sendJson(res, 200, { ok: true });
}

// DELETE /api/folder?path= -> {ok}; recursive, never the open folder itself.
async function apiDeleteFolder(rootFolder, rawQuery, res) {
  const { toPosix } = await lib();
  const rel = requirePath(queryValue(rawQuery, "path"), "path");
  const posix = toPosix(rel);
  if (posix === "" || posix === ".") throw httpError(400, "cannot delete the open folder");
  const full = await guardedPath(rootFolder, rel);
  const stat = await statOrNull(full);
  if (!stat || !stat.isDirectory()) throw httpError(404, "folder not found");
  await fs.promises.rm(full, { recursive: true, force: true });
  forgetSearch(full);
  sendJson(res, 200, { ok: true });
}

// The JSON API. Known paths with the wrong method are a 405, unknown paths a 404.
const API_METHODS = {
  "/api/tree": ["GET", "HEAD"],
  "/api/file": ["GET", "PUT", "POST", "DELETE"],
  "/api/folder": ["GET", "POST", "DELETE"],
  "/api/open-folder": ["POST"],
  "/api/folders": ["GET"],
  "/api/rename": ["POST"],
  "/api/search": ["GET"],
  "/api/backlinks": ["GET"],
};

async function apiRoute(ctx, req, res, rawPath, rawQuery) {
  const allowed = API_METHODS[rawPath];
  if (!allowed) throw httpError(404, "not found");
  if (!allowed.includes(req.method)) throw httpError(405, "method not allowed");
  const rootFolder = ctx.root;
  switch (`${req.method} ${rawPath}`) {
    case "GET /api/folder":
      return apiCurrentFolder(ctx, res);
    case "POST /api/open-folder":
      return apiOpenFolder(ctx, req, res);
    case "GET /api/folders":
      return apiListFolders(rawQuery, res);
    case "GET /api/tree":
    case "HEAD /api/tree":
      return apiTree(rootFolder, new URLSearchParams(rawQuery), res);
    case "GET /api/file":
      return apiReadFile(rootFolder, rawQuery, res);
    case "PUT /api/file":
      return apiWriteFile(rootFolder, req, res);
    case "POST /api/file":
      return apiCreateFile(rootFolder, req, res);
    case "DELETE /api/file":
      return apiDeleteFile(rootFolder, rawQuery, res);
    case "POST /api/folder":
      return apiCreateFolder(rootFolder, req, res);
    case "DELETE /api/folder":
      return apiDeleteFolder(rootFolder, rawQuery, res);
    case "POST /api/rename":
      return apiRename(rootFolder, req, res);
    case "GET /api/search":
      return apiSearch(rootFolder, rawQuery, res);
    case "GET /api/backlinks":
      return apiBacklinks(rootFolder, rawQuery, res);
    default:
      throw httpError(404, "not found");
  }
}

// Stream a file from base/rel. rel goes through safeJoin so it can never leave base.
async function sendFile(res, base, rel) {
  const { safeJoin } = await lib();
  const full = safeJoin(base, rel);
  let stat;
  try {
    stat = await fs.promises.stat(full);
  } catch {
    throw httpError(404, "file not found");
  }
  if (!stat.isFile()) throw httpError(404, "file not found");
  res.writeHead(200, { "content-type": contentType(full), "content-length": stat.size });
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(full);
    stream.on("error", reject);
    res.on("close", resolve);
    stream.pipe(res).on("finish", resolve);
  });
}

// Recursive listing of the open folder: folders and .md files with their mtime, skipping
// dot-names and node_modules. Paths are POSIX-style and relative to root.
async function walk(root, isMarkdown, rel = "", out = []) {
  const dir = rel ? path.join(root, rel) : root;
  let dirents;
  try {
    dirents = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (rel === "") throw httpError(404, "open folder not found");
    return out;
  }
  for (const d of dirents) {
    if (d.name.startsWith(".") || d.name === "node_modules") continue;
    const childRel = rel ? `${rel}/${d.name}` : d.name;
    if (d.isDirectory()) {
      let mtime = 0;
      try {
        mtime = (await fs.promises.stat(path.join(root, childRel))).mtimeMs;
      } catch {}
      out.push({ path: childRel, type: "folder", mtime });
      await walk(root, isMarkdown, childRel, out);
    } else if (d.isFile() && isMarkdown(d.name)) {
      let mtime = 0;
      try {
        mtime = (await fs.promises.stat(path.join(root, childRel))).mtimeMs;
      } catch {}
      out.push({ path: childRel, type: "file", mtime });
    }
  }
  return out;
}

async function apiTree(rootFolder, query, res) {
  const { buildTree, isMarkdown } = await lib();
  const root = path.resolve(rootFolder);
  const entries = await walk(root, isMarkdown);
  const sort = query.get("sort") || undefined;
  sendJson(res, 200, { folder: path.basename(root), root, tree: buildTree(entries, { sort }) });
}

// ---- the open folder itself ----
// These are the one place an absolute path is accepted: they pick which folder is served,
// they never reach inside it.

// GET /api/folder -> {folder, root}: the folder currently open.
function apiCurrentFolder(ctx, res) {
  const root = path.resolve(ctx.root);
  sendJson(res, 200, { folder: path.basename(root), root });
}

// POST /api/open-folder {folder} -> {folder, root}; folder must be an absolute path to an
// existing directory (400 otherwise). Every later request is served from it, and the search
// cache starts over since nothing in it belongs to the new folder.
async function apiOpenFolder(ctx, req, res) {
  const body = await readJson(req);
  const folder = body.folder;
  if (typeof folder !== "string" || folder.trim() === "") throw httpError(400, "folder required");
  if (folder.includes("\0") || !path.isAbsolute(folder)) throw httpError(400, "folder must be an absolute path");
  const root = path.resolve(folder);
  const stat = await statOrNull(root);
  if (!stat || !stat.isDirectory()) throw httpError(400, "folder not found");
  ctx.root = root;
  searchCache.clear();
  linkIndex = null;
  sendJson(res, 200, { folder: path.basename(root), root });
}

// Case-insensitive natural order for folder names in the picker.
const nameOrder = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

// GET /api/folders?path=<absolute or empty> -> {path, parent, folders: [{name, path}]}
// The subfolders of that path (the home folder when empty) for the folder picker. Only
// directories; hidden ones and anything that cannot be read are left out. parent is null at
// the top of a drive or file system.
async function apiListFolders(rawQuery, res) {
  const raw = queryValue(rawQuery, "path");
  const wanted = raw === undefined ? "" : decodePath(raw).trim();
  if (wanted.includes("\0")) throw httpError(400, "malformed path");
  if (wanted !== "" && !path.isAbsolute(wanted)) throw httpError(400, "path must be absolute");
  const dir = path.resolve(wanted === "" ? os.homedir() : wanted);
  const stat = await statOrNull(dir);
  if (!stat || !stat.isDirectory()) throw httpError(400, "folder not found");
  let dirents;
  try {
    dirents = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    throw httpError(400, "folder cannot be read");
  }
  const folders = [];
  for (const d of dirents) {
    if (d.name.startsWith(".")) continue;
    let isDir = d.isDirectory();
    if (!isDir && d.isSymbolicLink()) {
      // A link (or a Windows junction) counts when it leads to a folder; one that cannot be
      // followed is simply left out.
      try {
        isDir = (await fs.promises.stat(path.join(dir, d.name))).isDirectory();
      } catch {
        isDir = false;
      }
    }
    if (isDir) folders.push({ name: d.name, path: path.join(dir, d.name) });
  }
  folders.sort((a, b) => nameOrder.compare(a.name, b.name));
  const up = path.dirname(dir);
  sendJson(res, 200, { path: dir, parent: up === dir ? null : up, folders });
}

// Static prefixes whose files live under public/ keep the prefix in the relative path.
const PUBLIC_PREFIXES = ["/css/", "/js/", "/vendor/"];

// ctx is {root}: the open folder, which POST /api/open-folder may change. A plain string is
// accepted too and treated as a folder that never changes.
async function route(ctx, req, res) {
  if (typeof ctx === "string") ctx = { root: ctx };
  const rootFolder = ctx.root;
  // Work on the raw request path, never a normalised one, so '..' still reaches safeJoin.
  const q = req.url.indexOf("?");
  const rawPath = q === -1 ? req.url : req.url.slice(0, q);
  const rawQuery = q === -1 ? "" : req.url.slice(q + 1);

  if (rawPath.startsWith("/api/")) return apiRoute(ctx, req, res, rawPath, rawQuery);

  if (req.method !== "GET" && req.method !== "HEAD") throw httpError(405, "method not allowed");

  if (rawPath === "/" || rawPath === "/index.html") return sendFile(res, PUBLIC, "index.html");

  for (const prefix of PUBLIC_PREFIXES) {
    if (rawPath.startsWith(prefix)) return sendFile(res, PUBLIC, decodePath(rawPath.slice(1)));
  }
  if (rawPath.startsWith("/brand/")) return sendFile(res, BRAND, decodePath(rawPath.slice("/brand/".length)));
  if (rawPath.startsWith("/lib/")) return sendFile(res, LIB, decodePath(rawPath.slice("/lib/".length)));
  if (rawPath.startsWith("/files/")) return sendFile(res, rootFolder, decodePath(rawPath.slice("/files/".length)));

  throw httpError(404, "not found");
}

// The request listener for http.createServer. Every failure becomes a JSON {error} reply.
// The open folder lives in one context shared by every request, so open-folder can switch it.
function handler(rootFolder) {
  const ctx = { root: path.resolve(rootFolder) };
  return (req, res) => {
    route(ctx, req, res).catch((err) => {
      const status = Number.isInteger(err && err.status) ? err.status : 500;
      if (res.headersSent) {
        res.destroy();
        return;
      }
      sendJson(res, status, { error: (err && err.message) || "internal error" });
    });
  };
}

module.exports = { handler, route, walk, CONTENT_TYPES, contentType };
