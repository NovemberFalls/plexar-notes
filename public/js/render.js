// The reading view for Plexar Notes: Markdown in, HTML out. marked does the parsing, the
// shared helpers in lib/markdown.js add wiki links, callouts, task lists and copy buttons,
// highlight.js colours fenced code, and a last pass keeps the user's own inline HTML while
// dropping <script> tags, on* handlers and javascript: URLs and pointing relative images at
// the note's folder under /files/. Pure string work: no DOM, so it can run anywhere.
import { Marked } from "/vendor/marked/marked.esm.js";
import hljs from "/vendor/highlight/highlight.min.js";
import { wikiLinksToHtml, calloutsToHtml, taskListsToHtml, addCopyButtons, escapeHtml } from "/lib/markdown.js";
import { icons } from "./icons.js";

// Fence names people actually type, mapped to the highlight.js language names.
export const LANG_MAP = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  javascript: "javascript",
  ts: "typescript",
  typescript: "typescript",
  py: "python",
  python: "python",
  sh: "bash",
  shell: "bash",
  bash: "bash",
  zsh: "bash",
  console: "bash",
  html: "xml",
  htm: "xml",
  xml: "xml",
  svg: "xml",
  css: "css",
  json: "json",
  jsonc: "json",
  sql: "sql",
  mysql: "sql",
  postgres: "sql",
  postgresql: "sql",
  sqlite: "sql",
  yml: "yaml",
  yaml: "yaml",
  md: "markdown",
  markdown: "markdown",
};

// The fence language as written ("js title=x" gives "js"), or "" when there is none.
function fenceName(lang) {
  return String(lang || "").trim().split(/\s+/)[0].toLowerCase();
}

// The highlight.js language a fence name maps to, or null when the bundle lacks it.
export function languageFor(lang) {
  const name = fenceName(lang);
  if (!name) return null;
  const mapped = LANG_MAP[name] || name;
  return hljs.getLanguage(mapped) ? mapped : null;
}

// Highlighted HTML for a code block; plain escaped text when the language is unknown.
export function highlight(code, lang) {
  const language = languageFor(lang);
  if (language) {
    try {
      return hljs.highlight(code, { language, ignoreIllegals: true }).value;
    } catch {
      // fall through to plain text
    }
  }
  return escapeHtml(code);
}

// ---- heading ids ----

let usedIds = new Set();

export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;|&#x?[0-9a-f]+;/gi, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-");
}

function uniqueId(base) {
  const root = base || "section";
  let id = root;
  let n = 1;
  while (usedIds.has(id)) id = `${root}-${++n}`;
  usedIds.add(id);
  return id;
}

// ---- marked ----

const renderer = {
  code({ text, lang }) {
    const name = fenceName(lang);
    const cls = name ? ` class="language-${escapeHtml(name)}"` : "";
    const code = String(text || "").replace(/\n$/, "");
    return `<pre><code${cls}>${highlight(code, name)}</code></pre>\n`;
  },
  heading({ tokens, depth }) {
    const html = this.parser.parseInline(tokens);
    const plain = this.parser.parseInline(tokens, this.parser.textRenderer);
    const id = uniqueId(slugify(plain));
    return `<h${depth} id="${escapeHtml(id)}">${html}</h${depth}>\n`;
  },
};

const md = new Marked({ gfm: true, breaks: false, async: false, renderer });

// ---- callout icons and copy buttons ----

const CALLOUT_ICONS = {
  note: "pencil",
  abstract: "list",
  summary: "list",
  tldr: "list",
  info: "info",
  todo: "check",
  tip: "bulb",
  hint: "bulb",
  success: "check",
  check: "check",
  done: "check",
  question: "info",
  help: "info",
  faq: "info",
  warning: "alertTriangle",
  caution: "alertTriangle",
  attention: "alertTriangle",
  failure: "close",
  fail: "close",
  missing: "close",
  danger: "alertOctagon",
  error: "alertOctagon",
  important: "alertOctagon",
  bug: "alertOctagon",
  example: "list",
  quote: "quote",
  cite: "quote",
};

const CALLOUT_TITLE = /(<div class="callout callout-([^"]*)" data-type="[^"]*"><div class="callout-title">)/g;
const COPY_BUTTON = '<button class="copy" type="button" aria-label="Copy code">Copy</button>';

function decorate(html) {
  const withIcons = html.replace(CALLOUT_TITLE, (m, open, type) => {
    const name = CALLOUT_ICONS[type] || "pencil";
    return `${open}<span class="callout-icon">${icons[name]}</span>`;
  });
  return withIcons.split(COPY_BUTTON).join(
    `<button class="copy" type="button" aria-label="Copy code">${icons.copy}<span class="copy-label">Copy</span></button>`,
  );
}

// ---- images ----

// The URL for an image src written in a note whose folder is base ("" for the top level).
// Absolute URLs, data: URLs and absolute paths are left alone; anything else is resolved
// against the note's folder and served from /files/.
export function imageSrc(src, base = "") {
  const s = String(src || "").trim();
  if (!s || /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(s)) return s;
  const parts = [];
  const raw = (base ? `${base}/` : "") + s;
  for (const seg of raw.split("/")) {
    let piece = seg;
    try {
      piece = decodeURIComponent(seg);
    } catch {
      // keep the segment as written
    }
    if (piece === "" || piece === ".") continue;
    if (piece === "..") {
      parts.pop();
      continue;
    }
    parts.push(piece);
  }
  return "/files/" + parts.map(encodeURIComponent).join("/");
}

// ---- sanitising ----

const SCRIPT = /<script\b[^>]*>[\s\S]*?<\/script\s*>|<\/?script\b[^>]*>/gi;
// A stray quote inside a tag still ends at the next '>' so a malformed tag cannot smuggle
// attributes past the attribute loop below.
const TAG = /<(\/?)([a-zA-Z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*'|["'])*?)(\/?)>/g;
const ATTR = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const URL_ATTRS = new Set(["href", "src", "xlink:href", "action", "formaction", "poster", "srcset", "data"]);
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeEntities(s) {
  return String(s).replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi, (m, hex, dec, name) => {
    if (hex || dec) {
      try {
        return String.fromCodePoint(hex ? parseInt(hex, 16) : Number(dec));
      } catch {
        return "";
      }
    }
    return name.toLowerCase() in ENTITIES ? ENTITIES[name.toLowerCase()] : m;
  });
}

function unsafeUrl(value) {
  // Browsers ignore control characters and whitespace inside a scheme, so drop them first.
  const v = decodeEntities(value).replace(/[\u0000- \u007f]/g, "").toLowerCase();
  if (/^(?:javascript|vbscript):/.test(v)) return true;
  return v.startsWith("data:") && !v.startsWith("data:image/");
}

function isExternal(href) {
  return /^[a-z][a-z0-9+.-]*:/i.test(decodeEntities(href).trim());
}

// Rebuild one tag from its safe attributes only.
function cleanTag(whole, close, name, attrs, selfClose, base) {
  const lname = name.toLowerCase();
  if (close) return `</${name}>`;
  let out = "";
  let hasTarget = false;
  let external = false;
  for (const a of attrs.matchAll(ATTR)) {
    const key = a[1];
    const lkey = key.toLowerCase();
    if (lkey.startsWith("on")) continue;
    let value = a[2] !== undefined ? a[2] : a[3] !== undefined ? a[3] : a[4];
    if (value === undefined) {
      out += ` ${key}`;
      continue;
    }
    if (a[2] === undefined) value = value.replace(/"/g, "&quot;");
    if (URL_ATTRS.has(lkey) && unsafeUrl(value)) continue;
    if (lname === "img" && lkey === "src") value = escapeHtml(imageSrc(decodeEntities(value), base));
    if (lname === "a" && lkey === "href") external = isExternal(value);
    if (lname === "a" && lkey === "target") hasTarget = true;
    out += ` ${key}="${value}"`;
  }
  if (lname === "a" && external && !hasTarget) out += ' target="_blank" rel="noopener"';
  return `<${name}${out}${selfClose ? " /" : ""}>`;
}

export function sanitize(html, base = "") {
  return String(html)
    .replace(SCRIPT, "")
    .replace(TAG, (whole, close, name, attrs, selfClose) => cleanTag(whole, close, name, attrs, selfClose, base));
}

// ---- the pipeline ----

// options.base: the note's folder ("" for the top level), used to resolve relative images.
export function render(markdown, notePaths = [], options = {}) {
  const base = typeof options.base === "string" ? options.base : "";
  usedIds = new Set();
  const source = typeof markdown === "string" ? markdown : "";
  let html = md.parse(wikiLinksToHtml(source, notePaths));
  html = calloutsToHtml(html);
  html = taskListsToHtml(html);
  html = addCopyButtons(html);
  html = decorate(html);
  return sanitize(html, base);
}
