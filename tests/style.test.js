// The Plexar look is a rule, not a suggestion: every task runs this with the rest of the tests.
// Colours come only from plexar-tokens.css (var(--px-*), or color-mix of them); the page loads
// the tokens and the brand font; nothing outside vendor/ hard-codes a colour.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SKIP = new Set(["node_modules", "vendor", ".git", "notes", "qa", "tests", ".plexar"]);
const TOKENS = "plexar-tokens.css";

function files(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files(p, out);
    else if (/\.(css|html|js)$/.test(e.name) && e.name !== TOKENS) out.push(p);
  }
  return out;
}

test("no hard-coded colours outside the tokens file", () => {
  const bad = [];
  const colour = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
  for (const f of files(ROOT)) {
    fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
      if (colour.test(line.replace(/url\([^)]*\)/g, "").replace(/href="#[^"]*"/g, ""))) bad.push(`${path.relative(ROOT, f)}:${i + 1}: ${line.trim().slice(0, 80)}`);
    });
  }
  assert.deepStrictEqual(bad, [], "use var(--px-*) from plexar-tokens.css instead:\n" + bad.join("\n"));
});

test("every page loads the Plexar tokens and uses the brand font for headings", () => {
  const pages = files(ROOT).filter(f => f.endsWith(".html"));
  assert.ok(pages.length > 0, "no page found");
  for (const p of pages) {
    const html = fs.readFileSync(p, "utf8");
    assert.ok(html.includes(TOKENS), `${path.relative(ROOT, p)} does not load ${TOKENS}`);
  }
  const css = files(ROOT).filter(f => /\.(css|html)$/.test(f)).map(f => fs.readFileSync(f, "utf8")).join("\n");
  assert.ok(css.includes("var(--px-font-display)"), "headings must use var(--px-font-display) (Montserrat)");
});
