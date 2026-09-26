// The reading view: render.js is built on the vendored marked and highlight.js plus the shared
// lib/markdown.js helpers, the stylesheets cover every block type, nothing under public/
// (outside vendor/) reaches for a CDN, and the fence language map covers the short names.
// Node only, no browser: the module imports browser-absolute paths, so it is read as text.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

function filesUnder(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "vendor") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) filesUnder(p, out);
    else out.push(p);
  }
  return out;
}

test("render.js imports marked, highlight.js and the shared Markdown helpers", () => {
  const src = read("public/js/render.js");
  assert.ok(src.includes("/vendor/marked/marked.esm.js"), "must import from /vendor/marked/marked.esm.js");
  assert.ok(src.includes("/vendor/highlight/highlight.min.js"), "must import from /vendor/highlight/highlight.min.js");
  assert.ok(src.includes("/lib/markdown.js"), "must import from /lib/markdown.js");
  assert.ok(/export\s+(async\s+)?function\s+render\s*\(/.test(src), "must export render()");
});

test("render.js pipeline uses every shared helper and strips scripts and on* handlers", () => {
  const src = read("public/js/render.js");
  for (const fn of ["wikiLinksToHtml", "calloutsToHtml", "taskListsToHtml", "addCopyButtons"]) {
    assert.ok(src.includes(`${fn}(`), `must call ${fn}`);
  }
  assert.ok(/script/i.test(src), "must handle <script> tags");
  assert.ok(/startsWith\("on"\)|\bon\[a-zA-Z\]|\/\^on\//.test(src), "must drop on* attributes");
});

test("the language map covers js, sh and html", () => {
  const src = read("public/js/render.js");
  const m = /LANG_MAP\s*=\s*\{([\s\S]*?)\};/.exec(src);
  assert.ok(m, "render.js must define LANG_MAP");
  const map = {};
  for (const entry of m[1].matchAll(/([\w-]+)\s*:\s*"([^"]+)"/g)) map[entry[1]] = entry[2];
  assert.strictEqual(map.js, "javascript");
  assert.strictEqual(map.sh, "bash");
  assert.strictEqual(map.shell, "bash");
  assert.strictEqual(map.html, "xml");
});

test("markdown.css styles tables, callouts, code blocks, tasks and block quotes", () => {
  const css = read("public/css/markdown.css");
  for (const needle of ["table", "callout", ".codeblock", "task", "blockquote"]) {
    assert.ok(css.includes(needle), `markdown.css must contain a ${needle} rule`);
  }
  for (const needle of ["var(--px-font-display)", "var(--px-accent-soft)", "var(--px-radius)", "color-mix("]) {
    assert.ok(css.includes(needle), `markdown.css must use ${needle}`);
  }
});

test("code.css maps highlight.js tokens to Plexar colours", () => {
  const css = read("public/css/code.css");
  for (const cls of [".hljs-keyword", ".hljs-string", ".hljs-comment", ".hljs-number", ".hljs-title", ".hljs-attr", ".hljs-built_in", ".hljs-tag", ".hljs-name", ".hljs-selector-", ".hljs-literal", ".hljs-type", ".hljs-meta"]) {
    assert.ok(css.includes(cls), `code.css must style ${cls}`);
  }
});

test("app.css loads markdown.css and code.css, and the shell has the confirm bar", () => {
  const app = read("public/css/app.css");
  assert.ok(app.includes("markdown.css"), "app.css must import markdown.css");
  assert.ok(app.includes("code.css"), "app.css must import code.css");
  const html = read("public/index.html");
  assert.ok(html.includes('id="confirm-bar"'), "index.html must have the confirm bar");
  assert.ok(html.includes('id="note-body"'), "index.html must keep #note-body");
});

test("nothing under public/ (outside vendor/) loads from a CDN", () => {
  const cdn = /https?:\/\/[^\s"'`)]*(cdn\.|unpkg|jsdelivr)/i;
  const offenders = filesUnder(PUBLIC).filter((f) => cdn.test(fs.readFileSync(f, "utf8")));
  assert.deepStrictEqual(offenders.map((f) => path.relative(ROOT, f)), [], "vendor libraries only, no CDN URLs");
});
