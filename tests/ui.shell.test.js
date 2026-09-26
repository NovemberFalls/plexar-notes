// The window shell: index.html has every region the app is built from, the brand assets
// are linked, the icons are one consistent stroke set, and nothing in public/ says 'vault'.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

function filesUnder(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "vendor") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) filesUnder(p, out);
    else out.push(p);
  }
  return out;
}

const html = fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8");

test("index.html has every region of the shell", () => {
  for (const id of ["ribbon", "explorer", "tree", "main", "tabbar", "search", "note", "statusbar"]) {
    assert.ok(html.includes(`id="${id}"`), `missing id="${id}"`);
  }
});

test("index.html links the tokens, shows the mark and loads an ES module", () => {
  assert.ok(html.includes("plexar-tokens.css"), "must link /brand/plexar-tokens.css");
  assert.ok(html.includes("/brand/mark.png"), "must reference /brand/mark.png");
  assert.ok(/<script[^>]*type="module"/.test(html), "must load a type=\"module\" script");
});

test("nothing under public/ (outside vendor/) says 'vault'", () => {
  const offenders = filesUnder(PUBLIC).filter((f) => /vault/i.test(fs.readFileSync(f, "utf8")));
  assert.deepStrictEqual(offenders.map((f) => path.relative(ROOT, f)), [], "say folder, not vault");
});

test("icons.js exists and every icon is a currentColor stroke with no hex fill", () => {
  const file = path.join(PUBLIC, "js", "icons.js");
  assert.ok(fs.existsSync(file), "public/js/icons.js must exist");
  const src = fs.readFileSync(file, "utf8");
  const svgs = src.split("<svg").slice(1);
  assert.ok(svgs.length > 0, "icons.js must define at least one <svg");
  svgs.forEach((chunk, i) => {
    const tag = chunk.slice(0, chunk.indexOf(">"));
    assert.ok(tag.includes("currentColor"), `<svg #${i + 1} must use currentColor`);
    assert.ok(!chunk.includes('fill="#'), `<svg #${i + 1} must not use a hex fill`);
  });
});

test("the CSS uses the accent, the display font, the glow and the token radii", () => {
  const css = filesUnder(path.join(PUBLIC, "css"))
    .filter((f) => f.endsWith(".css"))
    .map((f) => fs.readFileSync(f, "utf8"))
    .join("\n");
  for (const needle of ["var(--px-accent)", "var(--px-font-display)", "radial-gradient", "var(--px-radius"]) {
    assert.ok(css.includes(needle), `public/css must contain ${needle}`);
  }
});
