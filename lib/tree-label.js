// The name the explorer shows for a tree node. The tree API strips '.md' from a file node's
// name, so the label is taken from the node's path instead: its last segment, with '.md' kept
// only when the 'Show file extensions in the tree' setting is on. Pure logic, no DOM, and no
// Node-only imports so the browser can load it from /lib/tree-label.js.

function baseName(rel) {
  const segments = String(rel || "").replace(/\\/g, "/").split("/");
  return segments[segments.length - 1] || "";
}

// node: {name, path, type}. showExtensions: true keeps '.md' on files; anything else hides it.
export function treeLabel(node, showExtensions) {
  if (!node) return "";
  if (node.type !== "file") return node.name || baseName(node.path);
  const base = baseName(node.path) || node.name || "";
  return showExtensions === true ? base : base.replace(/\.md$/i, "");
}
