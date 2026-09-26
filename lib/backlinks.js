// Link index for Plexar Notes: which notes a file links to, which files link to it, and which
// targets do not resolve to any file. Pure logic, no DOM.
import { parseLinks, resolveLink } from "./links.js";
import { displayName } from "./paths.js";

const CONTEXT_MAX = 160;

// The line of content around index, trimmed and capped.
function lineAt(content, index) {
  const start = content.lastIndexOf("\n", index - 1) + 1;
  let end = content.indexOf("\n", index);
  if (end === -1) end = content.length;
  return content.slice(start, end).trim().slice(0, CONTEXT_MAX);
}

function push(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

// notes: [{path, content}] → { links, backlinks, unresolved } (all Maps; see the task docs).
export function buildIndex(notes) {
  const links = new Map();
  const backlinks = new Map();
  const unresolved = new Map();
  const list = Array.isArray(notes) ? notes.filter((n) => n && typeof n.path === "string") : [];
  const paths = list.map((n) => n.path);
  for (const p of paths) {
    links.set(p, []);
    backlinks.set(p, []);
  }
  for (const { path, content } of list) {
    const text = typeof content === "string" ? content : "";
    const targets = links.get(path);
    for (const link of parseLinks(text)) {
      const to = resolveLink(link.target, paths);
      if (to === null) {
        const froms = unresolved.get(link.target) || [];
        if (!froms.includes(path)) push(unresolved, link.target, path);
        continue;
      }
      if (!targets.includes(to)) targets.push(to);
      push(backlinks, to, { from: path, context: lineAt(text, link.index) });
    }
  }
  return { links, backlinks, unresolved };
}

// Notes linking to path, sorted by their own path.
export function backlinksFor(index, path) {
  const entries = index && index.backlinks ? index.backlinks.get(path) || [] : [];
  return entries
    .map((e) => ({ from: e.from, title: displayName(e.from), context: e.context }))
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}
