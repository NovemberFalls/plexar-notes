// Path guard for Plexar Notes. Every server route that touches the notes folder goes through
// safeJoin so a request can never read or write a file outside that folder.
// Pure logic, no DOM. Only safeJoin needs the Node path module.
import path from "node:path";

const SEP = /[\\/]+/;

// Normalise separators to '/', drop a leading './' and any leading/trailing slashes.
export function toPosix(rel) {
  if (typeof rel !== "string") return "";
  let out = rel.replace(/\\/g, "/");
  while (out.startsWith("./")) out = out.slice(2);
  return out.replace(/^\/+/, "").replace(/\/+$/, "");
}

// A relative path is safe when it stays inside the folder it is joined to.
// Percent-encoded forms are not decoded here (the server decodes the URL first), but a
// literal '%2e%2e' is still rejected so an undecoded '..' can never slip through.
export function isSafeRelative(rel) {
  if (typeof rel !== "string" || rel.length === 0) return false;
  if (rel.includes("\0")) return false;
  if (/%2e%2e/i.test(rel)) return false;
  // Absolute forms: leading '/' or '\', a drive letter such as 'C:', or a UNC share '\\server'.
  if (rel.startsWith("/") || rel.startsWith("\\")) return false;
  if (/^[a-zA-Z]:/.test(rel)) return false;
  const segments = rel.split(SEP);
  for (const seg of segments) {
    if (seg === ".." || seg === ".") return false;
    if (/^(\.|%2e)+$/i.test(seg) && seg.length > 1) return false;
    if (seg.trim().length === 0) return false;
  }
  return true;
}

function escapeError() {
  const err = new Error("path escapes folder");
  err.status = 400;
  return err;
}

// Resolve rel under root, or throw a 400 error when the result would leave root.
// root may itself be relative; it is resolved against the current working directory.
export function safeJoin(root, rel) {
  if (!isSafeRelative(rel)) throw escapeError();
  const absRoot = path.resolve(String(root));
  const full = path.resolve(absRoot, toPosix(rel));
  const back = path.relative(absRoot, full);
  if (back === "" || back.startsWith("..") || path.isAbsolute(back)) throw escapeError();
  return full;
}

export function isMarkdown(rel) {
  return typeof rel === "string" && /\.md$/i.test(rel);
}

// Last segment without its trailing .md, for showing a note in the sidebar.
export function displayName(rel) {
  const segments = toPosix(rel).split("/");
  const last = segments[segments.length - 1] || "";
  return last.replace(/\.md$/i, "");
}
