const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "sample-notes");

// Walk the folder and return every file as { rel, abs, depth } where rel uses
// forward slashes and depth is the number of folders between ROOT and the file.
const walk = (dir, rel = "") => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs, childRel));
    else out.push({ rel: childRel, abs, depth: childRel.split("/").length - 1 });
  }
  return out;
};

const files = walk(ROOT);
const notes = files.filter((f) => /\.md$/i.test(f.rel)).map((f) => ({ ...f, text: fs.readFileSync(f.abs, "utf8") }));

const someNote = (re) => notes.some((n) => re.test(n.text));
const fence = (lang) => new RegExp("^```" + lang + "\\s*$[\\s\\S]*?^```\\s*$", "m");

test("sample-notes has at least 12 Markdown notes", () => {
  assert.ok(notes.length >= 12, `found ${notes.length} notes`);
});

test("a folder nested two levels deep holds at least one note", () => {
  assert.ok(notes.some((n) => n.depth >= 2), notes.map((n) => n.rel).join(", "));
});

test("a .png lives under assets/", () => {
  assert.ok(files.some((f) => /^assets\/.+\.png$/i.test(f.rel)));
});

test("some note has a table row", () => {
  assert.ok(someNote(/^\|.*\|\s*$/m));
});

test("some note has a fenced block for each language", () => {
  for (const lang of ["js", "python", "html", "css", "json", "sql"]) {
    assert.ok(someNote(fence(lang)), `no \`\`\`${lang} block`);
  }
  assert.ok(someNote(fence("bash")) || someNote(fence("sh")), "no ```bash or ```sh block");
});

test("some note has both checked and unchecked task items", () => {
  assert.ok(someNote(/^\s*- \[x\] /m), "no '- [x]'");
  assert.ok(someNote(/^\s*- \[ \] /m), "no '- [ ]'");
});

test("some note has a callout", () => {
  assert.ok(someNote(/^> \[!/m));
});

test("some note has an image", () => {
  assert.ok(someNote(/!\[[^\]]*\]\([^)]+\)/));
});

test("some note has a [[link]] and some note uses the [[Note|alias]] form", () => {
  assert.ok(someNote(/\[\[[^\]\n]+\]\]/), "no [[link]]");
  assert.ok(someNote(/\[\[[^\]|\n]+\|[^\]\n]+\]\]/), "no [[Note|alias]] link");
});

test("no note contains the word 'vault'", () => {
  const offenders = notes.filter((n) => /vault/i.test(n.text)).map((n) => n.rel);
  assert.deepStrictEqual(offenders, []);
});

test("every note starts with '# ' followed by its file name", () => {
  for (const n of notes) {
    const firstLine = n.text.split(/\r?\n/, 1)[0];
    const name = path.basename(n.rel).replace(/\.md$/i, "");
    assert.strictEqual(firstLine, `# ${name}`, n.rel);
  }
});
