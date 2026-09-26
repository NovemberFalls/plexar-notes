// Search for Plexar Notes: rank notes in a folder by a free-text query and pick the content
// lines that hit. Pure logic, no DOM. The browser imports this module too, so it must not
// pull in ./paths.js (which needs node:path); the one helper it wants is repeated here.

const SNIPPET_MAX = 140;
const MATCHES_MAX = 3;
const ELLIPSIS = "…";

// Score tiers. A note gets the highest tier it qualifies for, plus a content bonus below 100 so
// content hits only order notes inside the same tier.
const TIER_TITLE_EXACT = 1000;
const TIER_TITLE_PREFIX = 800;
const TIER_TITLE_WORD = 600;
const TIER_PATH_WORD = 400;
const TIER_CONTENT = 200;
const CONTENT_HITS_CAP = 100;

// Last path segment without its .md, the same as displayName in ./paths.js.
function displayName(rel) {
  const segments = String(rel).replace(/\\/g, "/").split("/");
  const last = segments[segments.length - 1] || "";
  return last.replace(/\.md$/i, "");
}

// Lower-cased query words, in order, without duplicates.
function words(query) {
  const trimmed = typeof query === "string" ? query.trim() : "";
  if (!trimmed) return [];
  const out = [];
  for (const w of trimmed.toLowerCase().split(/\s+/)) if (w && !out.includes(w)) out.push(w);
  return out;
}

// Number of (possibly overlapping) occurrences of word in lower.
function countHits(lower, word) {
  let n = 0;
  let at = lower.indexOf(word);
  while (at !== -1) {
    n += 1;
    at = lower.indexOf(word, at + 1);
  }
  return n;
}

// Index of the earliest occurrence of any word in lower, or -1.
function firstHit(lower, qwords) {
  let best = -1;
  for (const w of qwords) {
    const at = lower.indexOf(w);
    if (at !== -1 && (best === -1 || at < best)) best = at;
  }
  return best;
}

// A trimmed line cut to SNIPPET_MAX characters around its first hit, with ELLIPSIS where cut.
function snippet(rawLine, qwords) {
  const line = rawLine.trim();
  if (line.length <= SNIPPET_MAX) return line;
  const hit = Math.max(0, firstHit(line.toLowerCase(), qwords));
  let start = Math.max(0, hit - Math.floor(SNIPPET_MAX / 4));
  let end = start + SNIPPET_MAX;
  if (end > line.length) {
    end = line.length;
    start = end - SNIPPET_MAX;
  }
  const prefix = start > 0 ? ELLIPSIS : "";
  const suffix = end < line.length ? ELLIPSIS : "";
  return prefix + line.slice(start + prefix.length, end - suffix.length) + suffix;
}

// Up to MATCHES_MAX content lines containing a query word, as {line (1-based), text}.
function contentMatches(content, qwords) {
  const out = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length && out.length < MATCHES_MAX; i += 1) {
    const lower = lines[i].toLowerCase();
    if (qwords.some((w) => lower.includes(w))) out.push({ line: i + 1, text: snippet(lines[i], qwords) });
  }
  return out;
}

function scoreNote(titleLower, pathLower, contentLower, queryLower, qwords) {
  let tier = 0;
  if (titleLower === queryLower) tier = TIER_TITLE_EXACT;
  else if (titleLower.startsWith(queryLower)) tier = TIER_TITLE_PREFIX;
  else if (qwords.some((w) => titleLower.includes(w))) tier = TIER_TITLE_WORD;
  else if (qwords.some((w) => pathLower.includes(w))) tier = TIER_PATH_WORD;

  let bonus = 0;
  const first = firstHit(contentLower, qwords);
  if (first !== -1) {
    if (tier === 0) tier = TIER_CONTENT;
    let hits = 0;
    for (const w of qwords) hits += countHits(contentLower, w);
    // More hits: up to 50. Earlier first hit: up to 50 more, fading with distance.
    bonus = (Math.min(hits, CONTENT_HITS_CAP) / CONTENT_HITS_CAP) * 50 + 50 / (1 + first / 200);
  }
  return tier + bonus;
}

// query: free text; notes: [{path, content}] (POSIX paths ending .md); options: {limit = 20}.
// → [{path, title, score, matches: [{line, text}]}] sorted by score descending.
export function search(query, notes, options = {}) {
  const qwords = words(query);
  if (qwords.length === 0) return [];
  const queryLower = String(query).trim().toLowerCase();
  const limit = Number.isFinite(options.limit) && options.limit >= 0 ? options.limit : 20;
  const list = Array.isArray(notes) ? notes.filter((n) => n && typeof n.path === "string") : [];

  const results = [];
  for (const { path, content } of list) {
    const text = typeof content === "string" ? content : "";
    const title = displayName(path);
    const titleLower = title.toLowerCase();
    const pathLower = path.toLowerCase();
    const contentLower = text.toLowerCase();
    const all = qwords.every(
      (w) => titleLower.includes(w) || pathLower.includes(w) || contentLower.includes(w),
    );
    if (!all) continue;
    results.push({
      path,
      title,
      score: scoreNote(titleLower, pathLower, contentLower, queryLower, qwords),
      matches: contentMatches(text, qwords),
    });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const at = a.title.toLowerCase();
    const bt = b.title.toLowerCase();
    return at < bt ? -1 : at > bt ? 1 : 0;
  });
  return results.slice(0, limit);
}

// Split text into [{text, hit}] segments so a renderer can bold hits without building HTML
// from strings. Matching is case-insensitive; at each position the longest matching word wins.
export function highlight(text, query) {
  const str = typeof text === "string" ? text : "";
  const qwords = words(query);
  if (str.length === 0) return [];
  if (qwords.length === 0) return [{ text: str, hit: false }];

  const lower = str.toLowerCase();
  const segments = [];
  let plainStart = 0;
  let i = 0;
  while (i < lower.length) {
    let len = 0;
    for (const w of qwords) if (w.length > len && lower.startsWith(w, i)) len = w.length;
    if (len === 0) {
      i += 1;
      continue;
    }
    if (i > plainStart) segments.push({ text: str.slice(plainStart, i), hit: false });
    segments.push({ text: str.slice(i, i + len), hit: true });
    i += len;
    plainStart = i;
  }
  if (plainStart < str.length) segments.push({ text: str.slice(plainStart), hit: false });
  return segments;
}
