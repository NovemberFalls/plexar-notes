// The search box wiring: the dropdown is in the shell, search.js builds it from highlight()
// segments without innerHTML, debounces, and app.js gives it the two modes and the jump.
// Node only, no browser: the modules import browser-absolute paths, so they are read as text.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

test("index.html has the results listbox under the search box", () => {
  const html = read("public/index.html");
  assert.ok(html.includes('id="search"'), "must keep #search");
  assert.ok(/<div id="search-results"[^>]*role="listbox"/.test(html), "must have #search-results with role=listbox");
});

test("search.js imports highlight() from /lib/search.js, debounces 150ms and never uses innerHTML", () => {
  const src = read("public/js/search.js");
  assert.ok(/import\s*\{[^}]*\bhighlight\b[^}]*\}\s*from\s*"\/lib\/search\.js"/.test(src), "must import highlight from /lib/search.js");
  assert.ok(src.includes("/api/search?q="), "must call /api/search");
  assert.ok(/DEBOUNCE_MS\s*=\s*150/.test(src), "must debounce by 150ms");
  assert.ok(!src.includes("innerHTML"), "must not use innerHTML");
  assert.ok(src.includes("textContent"), "must set text through textContent");
  assert.ok(src.includes('"Open file"') && src.includes('"Search in files"'), "must have both placeholders");
  assert.ok(src.includes("No results"), "must have a 'No results' state");
  for (const key of ["ArrowDown", "ArrowUp", "Enter", "Escape"]) assert.ok(src.includes(key), `must handle ${key}`);
});

test("lib/search.js loads without node:path so the browser can import it", () => {
  const src = read("lib/search.js");
  assert.ok(!/from\s+"\.\/paths\.js"/.test(src), "must not import ./paths.js (it needs node:path)");
  assert.ok(!/from\s+"node:/.test(src), "must not import a node: module");
});

test("app.js wires the modes, the ribbon Search button and the jump to the matching block", () => {
  const src = read("public/js/app.js");
  assert.ok(src.includes('from "./search.js"'), "must import search.js");
  assert.ok(/createSearch\(/.test(src), "must create the search box");
  assert.ok(src.includes('focus("file")'), "Ctrl+P must put the box in file mode");
  assert.ok(src.includes('focus("text")'), "Ctrl+Shift+F must put the box in text mode");
  assert.ok(/scrollIntoView/.test(src), "must scroll to the matching block");
});

test("the dropdown uses the elevated surface, a border, the token radius and a color-mix shadow", () => {
  const css = read("public/css/tabs.css");
  const block = css.slice(css.indexOf("#search-results {"));
  assert.ok(block.includes("var(--px-elev)"), "background must be var(--px-elev)");
  assert.ok(block.includes("border: 1px solid var(--px-border)"), "must have a border");
  assert.ok(block.includes("var(--px-radius)"), "must use the token radius");
  assert.ok(/box-shadow:[^;]*color-mix\(in srgb, var\(--px-bg\)/.test(block), "shadow must be a color-mix of var(--px-bg)");
  assert.ok(block.includes("var(--px-dim)"), "the folder path must be dim");
  assert.ok(/\.search-item\.selected\s*\{[^}]*var\(--px-accent\)/.test(block), "the selection must use the accent");
});
