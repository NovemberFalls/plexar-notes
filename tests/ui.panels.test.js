// The Starred panel, the settings dialog and the tooltips: the shell has both, every icon-only
// button carries an aria-label, tooltips come from [data-tip] in the CSS rather than the title
// attribute alone, and nothing under public/ says 'vault'. Node only, no browser: the files are
// read as text.
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

const html = read("public/index.html");
const jsFiles = filesUnder(path.join(PUBLIC, "js")).filter((f) => f.endsWith(".js"));
const js = jsFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n");
const css = filesUnder(path.join(PUBLIC, "css"))
  .filter((f) => f.endsWith(".css"))
  .map((f) => fs.readFileSync(f, "utf8"))
  .join("\n");

// Every <button ...>...</button> in a source text: [{attrs, inner, where}].
function buttonsIn(source, where) {
  const out = [];
  for (const m of source.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    out.push({ attrs: m[1], inner: m[2], where: `${where}: <button${m[1].trim().slice(0, 60)}>` });
  }
  return out;
}

// A button with no visible text: its inner markup is empty, or an <svg…> (and other tags)
// with no text between them.
function iconOnly(inner) {
  const withoutSvg = inner.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/\$\{[^}]*\}/g, "");
  return withoutSvg.replace(/<[^>]+>/g, "").trim() === "";
}

test("the shell has the settings dialog and the Starred panel", () => {
  assert.ok(html.includes('id="settings"') || js.includes('id="settings"'), 'index.html or public/js must contain id="settings"');
  assert.ok(html.includes(">Starred<") || js.includes('"Starred"'), "must have a 'Starred' label");
  assert.ok(/<dialog[^>]*id="settings"/.test(html), "#settings is a <dialog>");
  assert.ok(html.includes(">Settings<"), "the dialog is titled 'Settings'");
  for (const label of ["Editor font", "Text size", "Readable line width", "Autosave delay", "Show file extensions in the tree"]) {
    assert.ok(html.includes(label), `the dialog has a '${label}' setting`);
  }
  assert.ok(html.includes("Plexar Notes") && css.includes(".settings-brand"), "the About line says Plexar Notes");
  assert.ok(html.includes('id="star-toggle"'), "the note has a star button");
});

test("every icon-only <button> in index.html and the js templates has an aria-label", () => {
  const found = buttonsIn(html, "public/index.html");
  for (const f of jsFiles) found.push(...buttonsIn(fs.readFileSync(f, "utf8"), path.relative(ROOT, f)));
  assert.ok(found.length > 0, "no <button> found");
  const missing = found.filter((b) => iconOnly(b.inner) && !/\baria-label=/.test(b.attrs)).map((b) => b.where);
  assert.deepStrictEqual(missing, [], "icon-only buttons need an aria-label");
});

test("icon buttons in index.html carry a data-tip tooltip as well as their aria-label", () => {
  const icons = buttonsIn(html, "public/index.html").filter((b) => /\bdata-icon=/.test(b.attrs));
  assert.ok(icons.length >= 8, "index.html has the icon buttons");
  const bare = icons.filter((b) => !/\bdata-tip=/.test(b.attrs) || !/\baria-label=/.test(b.attrs)).map((b) => b.where);
  assert.deepStrictEqual(bare, [], "every icon button needs data-tip and aria-label");
});

test("tooltips are drawn by the CSS from [data-tip], not by the title attribute alone", () => {
  assert.ok(css.includes("[data-tip]"), "public/css must style [data-tip]");
  assert.ok(/\[data-tip\][^{]*::after\s*\{[^}]*content:\s*attr\(data-tip\)/.test(css), "[data-tip]::after must render the tip text");
  assert.ok(/\[data-tip\][^{]*::after\s*\{[^}]*var\(--px-elev\)/.test(css), "the tip sits on var(--px-elev)");
  assert.ok(/\[data-tip\][^{]*::after\s*\{[^}]*var\(--px-radius-sm\)/.test(css), "the tip has the small radius");
  assert.ok(/\[data-tip\]:focus-visible::after/.test(css), "the tip shows on keyboard focus too");
});

test("the settings apply through :root variables and persist through state.js", () => {
  const settings = read("public/js/settings.js");
  const state = read("public/js/state.js");
  for (const v of ["--text-scale", "--line-width", "--editor-font"]) {
    assert.ok(settings.includes(v), `settings.js must set ${v}`);
    assert.ok(css.includes(`var(${v}`), `public/css must read ${v}`);
  }
  assert.ok(css.includes("750px") && css.includes("900px") || settings.includes("900px"), "line widths of 750px and 900px");
  for (const key of ["font", "textSize", "lineWidth", "autosave", "showExtensions"]) {
    assert.ok(state.includes(`${key}:`), `state.js must hold the ${key} setting`);
  }
  assert.ok(/export\s+function\s+setStarred\s*\(/.test(state), "state.js must export setStarred()");
  assert.ok(read("lib/autosave.js").includes("setDelay("), "lib/autosave.js must expose setDelay()");
});

test("nothing under public/ (outside vendor/) says 'vault'", () => {
  const offenders = filesUnder(PUBLIC).filter((f) => /vault/i.test(fs.readFileSync(f, "utf8")));
  assert.deepStrictEqual(offenders.map((f) => path.relative(ROOT, f)), [], "say folder, not vault");
});
