// Route handling for the Plexar Notes server: static app files, the shared lib/ modules for
// the browser, and the JSON API over the open folder. Node standard library only.
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
  if (req.method !== "GET" && req.method !== "HEAD") throw httpError(405, "method not allowed");

  // Work on the raw request path, never a normalised one, so '..' still reaches safeJoin.
  const q = req.url.indexOf("?");
  const rawPath = q === -1 ? req.url : req.url.slice(0, q);
  const query = new URLSearchParams(q === -1 ? "" : req.url.slice(q + 1));

  if (rawPath === "/" || rawPath === "/index.html") return sendFile(res, PUBLIC, "index.html");

  if (rawPath === "/api/tree") return apiTree(rootFolder, query, res);

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
      sendJson(res, status, { error: (err && err.message) || "internal error" });
    });
  };
}

module.exports = { handler, route, walk, CONTENT_TYPES, contentType };
