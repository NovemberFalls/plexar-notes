// Edit mode, the status bar and the new-note prompt: the shell has the textarea and the
// prompt, editor.js is wired for Tab and auto-grow, app.js runs the autosave and word count
// through the shared lib modules, and the styles keep the editor bare and in the tokens.
// Node only, no browser: the modules import browser-absolute paths, so they are read as text.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

test("index.html has the editor textarea, the mode toggle, the new-note prompt and the saved indicator", () => {
  const html = read("public/index.html");
  assert.ok(html.includes('id="note-editor"'), "must have the #note-editor textarea");
  assert.ok(/<textarea[^>]*id="note-editor"/.test(html), "#note-editor must be a textarea");
  assert.ok(html.includes('id="mode-toggle"'), "must keep the #mode-toggle button");
  assert.ok(html.includes('id="new-note-form"') && html.includes('id="new-note-name"'), "must have the new-note prompt");
  assert.ok(html.includes('id="status-words"') && html.includes('id="status-saved"'), "must keep the status bar spans");
  assert.ok(html.includes('class="saved-dot"'), "the saved indicator keeps its dot");
});

test("editor.js inserts two spaces on Tab, grows with its content and marks the mode on the toggle", () => {
  const src = read("public/js/editor.js");
  assert.ok(/export\s+function\s+createEditor\s*\(/.test(src), "must export createEditor()");
  assert.ok(src.includes('"Tab"'), "must handle the Tab key");
  assert.ok(src.includes('"  "'), "Tab must insert two spaces");
  assert.ok(src.includes("scrollHeight"), "must size the textarea to its content");
  assert.ok(src.includes("icons.pencil") && src.includes("icons.bookOpen"), "the toggle shows a pencil or a book");
  assert.ok(src.includes('"Edit"') && src.includes('"Read"'), "the toggle tooltip reads Edit or Read");
});

test("app.js saves through lib/autosave.js, counts through lib/words.js and answers Ctrl+E and Ctrl+S", () => {
  const src = read("public/js/app.js");
  assert.ok(src.includes("/lib/autosave.js"), "must import from /lib/autosave.js");
  assert.ok(src.includes("/lib/words.js"), "must import from /lib/words.js");
  assert.ok(src.includes("./editor.js"), "must import editor.js");
  assert.ok(src.includes("createAutosave("), "must create an autosave");
  assert.ok(src.includes("autosave.change("), "typing must reach autosave.change");
  assert.ok(src.includes("autosave.flush("), "must flush the autosave");
  assert.ok(/api\(\s*"PUT",\s*"\/api\/file"/.test(src), "saving must PUT /api/file");
  assert.ok(/api\(\s*"POST",\s*"\/api\/file"/.test(src), "creating must POST /api/file");
  assert.ok(src.includes("stats("), "must call stats()");
  assert.ok(src.includes("Words: ${words} · Characters: ${chars}"), "the status text is 'Words: N · Characters: N'");
  for (const text of ['"Saved"', '"Unsaved changes"', '"Saving…"', '"Save failed"']) {
    assert.ok(src.includes(text), `the saved indicator must be able to read ${text}`);
  }
  assert.ok(/key === "e"/.test(src), "Ctrl+E must toggle the mode");
  assert.ok(/key === "s"/.test(src), "Ctrl+S must save");
});

test("state.js keeps a per-tab mode that survives a reload", () => {
  const src = read("public/js/state.js");
  assert.ok(/mode:\s*t\.mode === "edit" \? "edit" : "read"/.test(src), "sanitise must keep a tab's mode");
  assert.ok(/export\s+function\s+setTabMode\s*\(/.test(src), "must export setTabMode()");
  assert.ok(/export\s+function\s+tabMode\s*\(/.test(src), "must export tabMode()");
});

test("the editor is a bare textarea in the tokens: no border, transparent, accent caret, 15px/1.6", () => {
  const css = read("public/css/note.css");
  const block = /\.note-editor\s*\{([^}]*)\}/.exec(css);
  assert.ok(block, "note.css must style .note-editor");
  const rules = block[1];
  assert.ok(/border:\s*0/.test(rules), "no border");
  assert.ok(/background:\s*transparent/.test(rules), "transparent background");
  assert.ok(rules.includes("caret-color: var(--px-accent)"), "caret in the accent");
  assert.ok(/font-family:\s*var\(--px-font-(mono|ui)\)/.test(rules), "the mono or ui font");
  assert.ok(/font-size:\s*15px/.test(rules) && /line-height:\s*1\.6/.test(rules), "15px over 1.6");
  assert.ok(/resize:\s*none/.test(rules), "no resize handle");
  for (const token of ["var(--px-ok)", "var(--px-warn)", "var(--px-error)"]) {
    assert.ok(css.includes(token), `the saved indicator must use ${token}`);
  }
  assert.ok(css.includes(".new-note-input"), "the new-note prompt is styled");
});
