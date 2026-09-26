// Folder tree for the Plexar Notes sidebar. Turns the flat listing the server produces into
// nested folder and file nodes, sorted for display. Pure logic, no DOM.
import { toPosix, isMarkdown, displayName } from "./paths.js";

const SORTS = new Set(["name-asc", "name-desc", "modified-desc", "modified-asc"]);

// Case-insensitive natural order, so 'Note 2' comes before 'Note 10'.
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function byName(a, b) {
  return collator.compare(a.name, b.name) || collator.compare(a.path, b.path);
}

function fileComparator(sort) {
  switch (sort) {
    case "name-desc":
      return (a, b) => byName(b, a);
    case "modified-desc":
      return (a, b) => (b.mtime - a.mtime) || byName(a, b);
    case "modified-asc":
      return (a, b) => (a.mtime - b.mtime) || byName(a, b);
    default:
      return byName;
  }
}

function lastSegment(rel) {
  const segments = rel.split("/");
  return segments[segments.length - 1] || "";
}

// entries: [{path, type, mtime}] with POSIX-style relative paths, type 'file' or 'folder'.
// options.sort: 'name-asc' (default), 'name-desc', 'modified-desc', 'modified-asc'.
// options.allFiles: include every file, not only .md notes.
// Returns nested nodes: folders {name, path, type, children}, files {name, path, type}.
export function buildTree(entries, options = {}) {
  const sort = SORTS.has(options.sort) ? options.sort : "name-asc";
  const allFiles = options.allFiles === true;

  // Working nodes keep mtime so files can be ordered; it is dropped from the output.
  const folders = new Map(); // path -> working folder node ('' is the root)
  const root = { path: "", type: "folder", children: [] };
  folders.set("", root);

  function ensureFolder(rel) {
    if (folders.has(rel)) return folders.get(rel);
    const idx = rel.lastIndexOf("/");
    const parent = ensureFolder(idx === -1 ? "" : rel.slice(0, idx));
    const node = { name: lastSegment(rel), path: rel, type: "folder", children: [] };
    folders.set(rel, node);
    parent.children.push(node);
    return node;
  }

  const seenFiles = new Set();
  for (const entry of entries || []) {
    if (!entry) continue;
    const rel = toPosix(entry.path);
    if (rel === "") continue;
    if (entry.type === "folder") {
      ensureFolder(rel);
      continue;
    }
    if (entry.type !== "file") continue;
    if (!allFiles && !isMarkdown(rel)) continue;
    if (seenFiles.has(rel)) continue;
    seenFiles.add(rel);
    const idx = rel.lastIndexOf("/");
    const parent = ensureFolder(idx === -1 ? "" : rel.slice(0, idx));
    const mtime = typeof entry.mtime === "number" && Number.isFinite(entry.mtime) ? entry.mtime : 0;
    parent.children.push({ name: displayName(rel), path: rel, type: "file", mtime });
  }

  const compareFiles = fileComparator(sort);

  function finish(children) {
    const dirs = children.filter((n) => n.type === "folder").sort(byName);
    const files = children.filter((n) => n.type === "file").sort(compareFiles);
    return [
      ...dirs.map((d) => ({ name: d.name, path: d.path, type: "folder", children: finish(d.children) })),
      ...files.map((f) => ({ name: f.name, path: f.path, type: "file" })),
    ];
  }

  return finish(root.children);
}

// Depth-first walk in display order; each node is copied with a depth field (0 at top level).
export function flatten(tree, depth = 0, out = []) {
  for (const node of tree || []) {
    out.push({ ...node, depth });
    if (node.type === "folder") flatten(node.children, depth + 1, out);
  }
  return out;
}

// The node whose path matches, or null when nothing in the tree has that path.
export function findNode(tree, rel) {
  const target = toPosix(rel);
  if (target === "") return null;
  for (const node of tree || []) {
    if (node.path === target) return node;
    if (node.type === "folder" && target.startsWith(node.path + "/")) {
      const hit = findNode(node.children, target);
      if (hit) return hit;
    }
  }
  return null;
}
