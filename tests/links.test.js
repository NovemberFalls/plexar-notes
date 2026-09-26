const test = require("node:test");
const assert = require("node:assert");

const loadLinks = () => import("../lib/links.js");
const loadBacklinks = () => import("../lib/backlinks.js");

test("parseLinks finds a plain link with raw text and index", async () => {
  const { parseLinks } = await loadLinks();
  const md = "See [[Plan]] for details.";
  assert.deepStrictEqual(parseLinks(md), [
    { target: "Plan", alias: null, heading: null, raw: "[[Plan]]", index: 4 },
  ]);
});

test("parseLinks splits an alias and trims the target", async () => {
  const { parseLinks } = await loadLinks();
  const [link] = parseLinks("go [[ Plan | the plan ]] now");
  assert.strictEqual(link.target, "Plan");
  assert.strictEqual(link.alias, "the plan");
  assert.strictEqual(link.raw, "[[ Plan | the plan ]]");
});

test("parseLinks strips a heading suffix into heading", async () => {
  const { parseLinks } = await loadLinks();
  const [a, b] = parseLinks("[[Plan#Goals]] and [[Plan#Goals|goals]]");
  assert.strictEqual(a.target, "Plan");
  assert.strictEqual(a.heading, "Goals");
  assert.strictEqual(a.alias, null);
  assert.strictEqual(b.target, "Plan");
  assert.strictEqual(b.heading, "Goals");
  assert.strictEqual(b.alias, "goals");
});

test("parseLinks ignores links inside fenced and inline code", async () => {
  const { parseLinks } = await loadLinks();
  const md = [
    "before [[One]]",
    "```",
    "[[Hidden]]",
    "```",
    "inline `[[AlsoHidden]]` then [[Two]]",
    "```js",
    "const x = '[[Nope]]';",
    "```",
  ].join("\n");
  const targets = parseLinks(md).map((l) => l.target);
  assert.deepStrictEqual(targets, ["One", "Two"]);
});

test("parseLinks returns every link on a line, in order, and skips empty ones", async () => {
  const { parseLinks } = await loadLinks();
  const md = "[[A]] [[ ]] [[B|bee]] [[C#top]] [[]]";
  const links = parseLinks(md);
  assert.deepStrictEqual(links.map((l) => l.target), ["A", "B", "C"]);
  assert.ok(links[0].index < links[1].index && links[1].index < links[2].index);
  for (const l of links) assert.strictEqual(md.slice(l.index, l.index + l.raw.length), l.raw);
  assert.deepStrictEqual(parseLinks(""), []);
  assert.deepStrictEqual(parseLinks(null), []);
});

test("resolveLink matches file names case-insensitively", async () => {
  const { resolveLink } = await loadLinks();
  const paths = ["Projects/Plan.md", "Todo.md"];
  assert.strictEqual(resolveLink("plan", paths), "Projects/Plan.md");
  assert.strictEqual(resolveLink("TODO", paths), "Todo.md");
  assert.strictEqual(resolveLink("Missing", paths), null);
  assert.strictEqual(resolveLink("", paths), null);
});

test("resolveLink prefers the shortest path among duplicate names", async () => {
  const { resolveLink } = await loadLinks();
  const paths = ["Archive/2024/Plan.md", "Plan.md", "Projects/Plan.md"];
  assert.strictEqual(resolveLink("Plan", paths), "Plan.md");
  assert.strictEqual(resolveLink("Plan", ["Archive/2024/Plan.md", "Projects/Plan.md"]), "Projects/Plan.md");
});

test("resolveLink matches the full path when the target has a folder", async () => {
  const { resolveLink } = await loadLinks();
  const paths = ["Archive/Plan.md", "Plan.md", "Projects/Plan.md"];
  assert.strictEqual(resolveLink("Projects/Plan", paths), "Projects/Plan.md");
  assert.strictEqual(resolveLink("archive/plan", paths), "Archive/Plan.md");
  assert.strictEqual(resolveLink("Other/Plan", paths), null);
});

const NOTES = [
  { path: "A.md", content: "# A\nA points to [[B]] here.\n" },
  { path: "B.md", content: "# B\nB points to [[C|see C]].\nand back to [[a]] too.\n" },
  { path: "C.md", content: "# C\n\n   C returns to [[A#top]] and mentions [[Nowhere]] and [[Nowhere]] again.\n`[[B]]` is code.\n" },
];

test("buildIndex records forward links per note", async () => {
  const { buildIndex } = await loadBacklinks();
  const index = buildIndex(NOTES);
  assert.deepStrictEqual(index.links.get("A.md"), ["B.md"]);
  assert.deepStrictEqual(index.links.get("B.md"), ["C.md", "A.md"]);
  assert.deepStrictEqual(index.links.get("C.md"), ["A.md"]);
});

test("backlinksFor B is [A] with the linking line as context", async () => {
  const { buildIndex, backlinksFor } = await loadBacklinks();
  const index = buildIndex(NOTES);
  assert.deepStrictEqual(backlinksFor(index, "B.md"), [
    { from: "A.md", title: "A", context: "A points to [[B]] here." },
  ]);
});

test("backlinksFor A is [B, C] sorted by from, with contexts", async () => {
  const { buildIndex, backlinksFor } = await loadBacklinks();
  const index = buildIndex(NOTES);
  assert.deepStrictEqual(backlinksFor(index, "A.md"), [
    { from: "B.md", title: "B", context: "and back to [[a]] too." },
    { from: "C.md", title: "C", context: "C returns to [[A#top]] and mentions [[Nowhere]] and [[Nowhere]] again." },
  ]);
  assert.deepStrictEqual(backlinksFor(index, "C.md"), [
    { from: "B.md", title: "B", context: "B points to [[C|see C]]." },
  ]);
  assert.deepStrictEqual(backlinksFor(index, "Zed.md"), []);
});

test("buildIndex records unresolved targets with the notes that use them", async () => {
  const { buildIndex } = await loadBacklinks();
  const index = buildIndex(NOTES);
  assert.deepStrictEqual([...index.unresolved.entries()], [["Nowhere", ["C.md"]]]);
  assert.deepStrictEqual(index.links.get("C.md"), ["A.md"]);
});

test("buildIndex caps context at 160 characters", async () => {
  const { buildIndex, backlinksFor } = await loadBacklinks();
  const long = "x".repeat(200) + " [[T]]";
  const index = buildIndex([{ path: "T.md", content: "" }, { path: "S.md", content: long }]);
  const [entry] = backlinksFor(index, "T.md");
  assert.strictEqual(entry.context.length, 160);
  assert.strictEqual(entry.title, "S");
});
