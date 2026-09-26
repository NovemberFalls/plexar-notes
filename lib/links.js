// Wiki links for Plexar Notes: find [[Target]] / [[Target|alias]] in Markdown and resolve a
// target to a file in the notes folder. Pure logic, no DOM.

const FENCE = /```[\s\S]*?(```|$)/g;
const INLINE = /`[^`\n]*`/g;
const LINK = /\[\[([^\[\]]*)\]\]/g;

// Replace code with spaces of the same length so link indexes still point into the original.
function blankCode(markdown) {
  const blank = (m) => " ".repeat(m.length);
  return markdown.replace(FENCE, blank).replace(INLINE, blank);
}

// Every link occurrence in reading order. alias and heading are null when absent.
export function parseLinks(markdown) {
  if (typeof markdown !== "string" || markdown.length === 0) return [];
  const out = [];
  const text = blankCode(markdown);
  for (const m of text.matchAll(LINK)) {
    const raw = m[0];
    const bar = m[1].indexOf("|");
    let target = (bar === -1 ? m[1] : m[1].slice(0, bar)).trim();
    const alias = bar === -1 ? null : m[1].slice(bar + 1).trim() || null;
    let heading = null;
    const hash = target.indexOf("#");
    if (hash !== -1) {
      heading = target.slice(hash + 1).trim() || null;
      target = target.slice(0, hash).trim();
    }
    if (target.length === 0) continue;
    out.push({ target, alias, heading, raw, index: m.index });
  }
  return out;
}

function stripMd(p) {
  return p.replace(/\.md$/i, "");
}

// The note path a target names, or null. A target with '/' must match the whole path; a bare
// name matches any file with that name, the shortest path winning when several do.
export function resolveLink(target, notePaths) {
  if (typeof target !== "string" || !Array.isArray(notePaths)) return null;
  const want = target.trim().replace(/^\.?\//, "").toLowerCase();
  if (want.length === 0) return null;
  const qualified = want.includes("/");
  let best = null;
  for (const p of notePaths) {
    if (typeof p !== "string") continue;
    const bare = stripMd(p).toLowerCase();
    const key = qualified ? bare : bare.slice(bare.lastIndexOf("/") + 1);
    if (key !== want) continue;
    if (best === null || p.length < best.length) best = p;
  }
  return best;
}
