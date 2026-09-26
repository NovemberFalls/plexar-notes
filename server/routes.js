// Route handling for the Plexar Notes server: static app files, the shared lib/ modules for
// the browser, and the JSON API over the open folder (tree, file and folder operations).
// Every path that reaches the folder goes through safeJoin and a realpath check.
// Node standard library only.
"use strict";

const fs = require("node:fs");
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
    libPromise = Promise.all([import("../lib/paths.js"), import("../lib/tree.js")]).then(
      ([paths, tree]) => ({ ...paths, ...tree }),
    );
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

// One value from the raw query string, URL-decoded exactly once ('+' stays a literal plus).
// undefined when the name is absent.
function queryValue(rawQuery, name) {
  for (const part of rawQuery.split("&")) {
    const eq = part.indexOf("=");
    const key = eq === -1 ? part : part.slice(0, eq);
    if (key !== name) continue;
    return decodePath(eq === -1 ? "" : part.slice(eq + 1));
  }
  return undefined;
}

// A path taken from a query or a JSON body: must be a string, decoded once. safeJoin does
// the actual guarding later; this only shapes the value.
function requirePath(value, label) {
  if (typeof value !== "string") throw httpError(400, `${label} required`);
  return decodePath(value);
}

// Collect the whole request body. Over MAX_BODY (by header or by count) is a 413.
function readBody(req) {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn, value) => {
      if (done) return;
      done = true;
      fn(value);
    };
    const declared = Number(req.headers["content-length"]);
    if (Number.isFinite(declared) && declared > MAX_BODY) {
      req.resume();
      finish(reject, httpError(413, "body too large"));
      return;
    }
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      if (done) return;
      size += chunk.length;
      if (size > MAX_BODY) {
        finish(reject, httpError(413, "body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => finish(resolve, Buffer.concat(chunks)));
    req.on("error", (err) => finish(reject, err));
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
async function nearestRealpath(full) {
  let probe = full;
  const tail = [];
  for (;;) {
    try {
      const real = await fs.promises.realpath(probe);
      return tail.length ? path.join(real, ...tail) : real;
    } catch (err) {
      if (err.code !== "ENOENT" && err.code !== "ENOTDIR") throw err;
      const parent = path.dirname(probe);
      if (parent === probe) throw err;
      tail.unshift(path.basename(probe));
      probe = parent;
    }
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
  sendJson(res, 200, { ok: true, path: toPosix(to) });
}

// DELETE /api/file?path= -> {ok}; 404 for a missing path or a folder.
async function apiDeleteFile(rootFolder, rawQuery, res) {
  const rel = requirePath(queryValue(rawQuery, "path"), "path");
  const full = await guardedPath(rootFolder, rel);
  const stat = await statOrNull(full);
  if (!stat || !stat.isFile()) throw httpError(404, "file not found");
  await fs.promises.unlink(full);
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
  sendJson(res, 200, { ok: true });
}

// The JSON API. Known paths with the wrong method are a 405, unknown paths a 404.
const API_METHODS = {
  "/api/tree": ["GET", "HEAD"],
  "/api/file": ["GET", "PUT", "POST", "DELETE"],
  "/api/folder": ["POST", "DELETE"],
  "/api/rename": ["POST"],
};

async function apiRoute(rootFolder, req, res, rawPath, rawQuery) {
  const allowed = API_METHODS[rawPath];
  if (!allowed) throw httpError(404, "not found");
  if (!allowed.includes(req.method)) throw httpError(405, "method not allowed");
  switch (`${req.method} ${rawPath}`) {
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

// Static prefixes whose files live under public/ keep the prefix in the relative path.
const PUBLIC_PREFIXES = ["/css/", "/js/", "/vendor/"];

async function route(rootFolder, req, res) {
  // Work on the raw request path, never a normalised one, so '..' still reaches safeJoin.
  const q = req.url.indexOf("?");
  const rawPath = q === -1 ? req.url : req.url.slice(0, q);
  const rawQuery = q === -1 ? "" : req.url.slice(q + 1);

  if (rawPath.startsWith("/api/")) return apiRoute(rootFolder, req, res, rawPath, rawQuery);

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
function handler(rootFolder) {
  return (req, res) => {
    route(rootFolder, req, res).catch((err) => {
      const status = Number.isInteger(err && err.status) ? err.status : 500;
      if (res.headersSent) {
        res.destroy();
        return;
      }
      // A refused body may still be streaming in; do not reuse the connection for it.
      if (status === 413) res.setHeader("connection", "close");
      sendJson(res, status, { error: (err && err.message) || "internal error" });
    });
  };
}

module.exports = { handler, route, walk, CONTENT_TYPES, contentType };
