// lib/markdown.js: fixtures below are hand-written in the shape marked produces; marked itself
// is never imported here.
const test = require("node:test");
const assert = require("node:assert");

const load = () => import("../lib/markdown.js");

test("escapeHtml escapes the five HTML-sensitive characters", async () => {
  const { escapeHtml } = await load();
  assert.strictEqual(escapeHtml(`<a href="x">Tom & Jerry's</a>`), "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;");
  assert.strictEqual(escapeHtml(null), "");
  assert.strictEqual(escapeHtml(42), "42");
});

test("wikiLinksToHtml renders a resolved link with the target as text", async () => {
  const { wikiLinksToHtml } = await load();
  const html = wikiLinksToHtml("See [[Plan]] now.", ["Plan.md", "Other.md"]);
  assert.strictEqual(html, 'See <a class="wikilink" data-target="Plan" data-path="Plan.md" href="#">Plan</a> now.');
});

test("wikiLinksToHtml marks a missing link and uses the alias as text", async () => {
  const { wikiLinksToHtml } = await load();
  const html = wikiLinksToHtml("[[Nowhere|go there]]", ["Plan.md"]);
  assert.strictEqual(html, '<a class="wikilink wikilink-missing" data-target="Nowhere" data-path="" href="#">go there</a>');
});

test("wikiLinksToHtml escapes quotes and angle brackets in attributes and text", async () => {
  const { wikiLinksToHtml } = await load();
  const html = wikiLinksToHtml(`[[Say "hi"|<b>"x"</b>]]`, []);
  assert.strictEqual(
    html,
    '<a class="wikilink wikilink-missing" data-target="Say &quot;hi&quot;" data-path="" href="#">&lt;b&gt;&quot;x&quot;&lt;/b&gt;</a>',
  );
});

test("wikiLinksToHtml leaves links inside code alone", async () => {
  const { wikiLinksToHtml } = await load();
  const md = "a `[[Code]]` b [[Real]]\n```\n[[Fenced]]\n```";
  const html = wikiLinksToHtml(md, ["Real.md"]);
  assert.ok(html.includes("`[[Code]]`"));
  assert.ok(html.includes("[[Fenced]]"));
  assert.ok(html.includes('data-path="Real.md"'));
  assert.strictEqual((html.match(/<a /g) || []).length, 1);
});

test("calloutsToHtml turns a titled callout into a callout box", async () => {
  const { calloutsToHtml } = await load();
  const html = "<blockquote>\n<p>[!WARNING] Mind the gap\nStep back.</p>\n</blockquote>\n";
  assert.strictEqual(
    calloutsToHtml(html),
    '<div class="callout callout-warning" data-type="warning"><div class="callout-title">Mind the gap</div><div class="callout-body"><p>Step back.</p></div></div>\n',
  );
});

test("calloutsToHtml defaults the title to the type in sentence case and keeps nested content", async () => {
  const { calloutsToHtml } = await load();
  const html = "<blockquote>\n<p>[!tip]</p>\n<p>First.</p>\n<ul>\n<li>one</li>\n</ul>\n</blockquote>\n";
  assert.strictEqual(
    calloutsToHtml(html),
    '<div class="callout callout-tip" data-type="tip"><div class="callout-title">Tip</div><div class="callout-body"><p>First.</p>\n<ul>\n<li>one</li>\n</ul></div></div>\n',
  );
});

test("calloutsToHtml keeps an unknown type name", async () => {
  const { calloutsToHtml } = await load();
  const html = "<blockquote>\n<p>[!Recipe] Dinner</p>\n</blockquote>";
  assert.strictEqual(
    calloutsToHtml(html),
    '<div class="callout callout-recipe" data-type="recipe"><div class="callout-title">Dinner</div><div class="callout-body"></div></div>',
  );
  const bare = calloutsToHtml("<blockquote>\n<p>[!recipe]</p>\n</blockquote>");
  assert.ok(bare.includes('<div class="callout-title">Recipe</div>'));
});

test("calloutsToHtml leaves a plain blockquote untouched", async () => {
  const { calloutsToHtml } = await load();
  const html = "<p>Intro</p>\n<blockquote>\n<p>Just a quote [not a callout]</p>\n<blockquote>\n<p>Inner</p>\n</blockquote>\n</blockquote>\n";
  assert.strictEqual(calloutsToHtml(html), html);
});

test("taskListsToHtml classes task items and drops disabled", async () => {
  const { taskListsToHtml } = await load();
  const html = '<ul>\n<li><input checked="" disabled="" type="checkbox"> Milk</li>\n<li><input disabled="" type="checkbox"> Eggs</li>\n<li>Plain</li>\n</ul>\n';
  assert.strictEqual(
    taskListsToHtml(html),
    '<ul>\n<li class="task task-done"><input checked="" type="checkbox"> Milk</li>\n<li class="task"><input type="checkbox"> Eggs</li>\n<li>Plain</li>\n</ul>\n',
  );
});

test("addCopyButtons wraps a block with a language", async () => {
  const { addCopyButtons } = await load();
  const html = '<p>Run:</p>\n<pre><code class="language-js">const a = 1;\n</code></pre>\n';
  assert.strictEqual(
    addCopyButtons(html),
    '<p>Run:</p>\n<div class="codeblock" data-lang="js"><button class="copy" type="button" aria-label="Copy code">Copy</button><pre><code class="language-js">const a = 1;\n</code></pre></div>\n',
  );
});

test("addCopyButtons wraps a block without a language with an empty data-lang", async () => {
  const { addCopyButtons } = await load();
  const html = "<pre><code>plain &lt;text&gt;\n</code></pre>\n";
  assert.strictEqual(
    addCopyButtons(html),
    '<div class="codeblock" data-lang=""><button class="copy" type="button" aria-label="Copy code">Copy</button><pre><code>plain &lt;text&gt;\n</code></pre></div>\n',
  );
});

test("titleFrom prefers the first level-1 heading", async () => {
  const { titleFrom } = await load();
  assert.strictEqual(titleFrom("intro\n\n## Sub\n# Real Title  \ntext", "notes/x.md"), "Real Title");
  assert.strictEqual(titleFrom("# Closed #\n", "x.md"), "Closed");
});

test("titleFrom falls back to the file name without .md", async () => {
  const { titleFrom } = await load();
  assert.strictEqual(titleFrom("no heading here\n## only h2", "folder/Weekly Plan.md"), "Weekly Plan");
  assert.strictEqual(titleFrom("", "C:\\notes\\Todo.MD"), "Todo");
});

test("toggleTask switches only the second task marker", async () => {
  const { toggleTask } = await load();
  const md = "- [ ] first\n* [ ] second\n1. [x] third\n- [ ] not [ ] a marker here";
  assert.strictEqual(toggleTask(md, 1, true), "- [ ] first\n* [x] second\n1. [x] third\n- [ ] not [ ] a marker here");
  assert.strictEqual(toggleTask(md, 2, false), "- [ ] first\n* [ ] second\n1. [ ] third\n- [ ] not [ ] a marker here");
  assert.strictEqual(toggleTask(md, 9, true), md);
});

test("toggleTask does not count markers inside code fences", async () => {
  const { toggleTask } = await load();
  const md = "```\n- [ ] fake\n```\n- [ ] real";
  assert.strictEqual(toggleTask(md, 0, true), "```\n- [ ] fake\n```\n- [x] real");
});
