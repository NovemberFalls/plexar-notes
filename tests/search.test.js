const test = require("node:test");
const assert = require("node:assert");

const load = () => import("../lib/search.js");

const NOTES = [
  { path: "Plan.md", content: "# Plan\nThe plan for the quarter.\n" },
  { path: "Planning notes.md", content: "Ideas only.\n" },
  { path: "Journal/Today.md", content: "No plan yet, but a plan is coming.\nAnother plan line.\n" },
  { path: "Projects/plans/Roadmap.md", content: "Milestones.\n" },
  { path: "Other.md", content: "Nothing relevant here.\n" },
];

test("empty or blank query returns []", async () => {
  const { search } = await load();
  assert.deepStrictEqual(search("", NOTES), []);
  assert.deepStrictEqual(search("   ", NOTES), []);
  assert.deepStrictEqual(search(null, NOTES), []);
});

test("exact title beats title prefix beats path beats content", async () => {
  const { search } = await load();
  const paths = search("plan", NOTES).map((r) => r.path);
  assert.deepStrictEqual(paths, ["Plan.md", "Planning notes.md", "Projects/plans/Roadmap.md", "Journal/Today.md"]);
  const [first] = search("plan", NOTES);
  assert.strictEqual(first.title, "Plan");
  assert.ok(typeof first.score === "number");
});

test("title containing a word ranks above a path hit and a content hit", async () => {
  const { search } = await load();
  const notes = [
    { path: "A.md", content: "budget budget budget" },
    { path: "budget/B.md", content: "" },
    { path: "Yearly budget review.md", content: "" },
  ];
  const paths = search("budget", notes).map((r) => r.path);
  assert.deepStrictEqual(paths, ["Yearly budget review.md", "budget/B.md", "A.md"]);
});

test("content ranking: more hits and earlier hits score higher, ties by title", async () => {
  const { search } = await load();
  const notes = [
    { path: "Late.md", content: "x".repeat(500) + " cat" },
    { path: "Many.md", content: "cat cat cat" },
    { path: "One.md", content: "cat" },
    { path: "Zed.md", content: "cat" },
    { path: "Amy.md", content: "cat" },
  ];
  const paths = search("cat", notes).map((r) => r.path);
  assert.deepStrictEqual(paths, ["Many.md", "Amy.md", "One.md", "Zed.md", "Late.md"]);
});

test("multi-word query requires every word", async () => {
  const { search } = await load();
  const notes = [
    { path: "Both.md", content: "alpha here\nbeta there" },
    { path: "OnlyAlpha.md", content: "alpha" },
    { path: "Beta.md", content: "alpha in the body" },
  ];
  const paths = search("alpha beta", notes).map((r) => r.path);
  assert.deepStrictEqual(paths.sort(), ["Beta.md", "Both.md"]);
  assert.deepStrictEqual(search("alpha gamma", notes), []);
});

test("matching is case-insensitive in title, path and content", async () => {
  const { search } = await load();
  const notes = [
    { path: "Groceries.md", content: "" },
    { path: "shopping/List.md", content: "" },
    { path: "Misc.md", content: "Buy MILK today" },
  ];
  assert.strictEqual(search("GROCERIES", notes)[0].path, "Groceries.md");
  assert.strictEqual(search("Shopping", notes)[0].path, "shopping/List.md");
  assert.strictEqual(search("milk", notes)[0].path, "Misc.md");
});

test("matches carry 1-based line numbers, cap at 3, and trim long lines with …", async () => {
  const { search } = await load();
  const long = "a".repeat(200) + " needle " + "b".repeat(200);
  const content = ["intro", "  needle on line two  ", "nothing", long, "needle 5", "needle 6"].join("\n");
  const [result] = search("needle", [{ path: "N.md", content }]);
  assert.strictEqual(result.matches.length, 3);
  assert.deepStrictEqual(result.matches[0], { line: 2, text: "needle on line two" });
  assert.strictEqual(result.matches[1].line, 4);
  const text = result.matches[1].text;
  assert.ok(text.length <= 140, `snippet length ${text.length}`);
  assert.ok(text.startsWith("…") && text.endsWith("…"));
  assert.ok(text.includes("needle"));
  assert.strictEqual(result.matches[2].line, 5);
});

test("a hit at the start of a long line is cut only at the end", async () => {
  const { search } = await load();
  const content = "needle " + "z".repeat(300);
  const [result] = search("needle", [{ path: "N.md", content }]);
  const text = result.matches[0].text;
  assert.strictEqual(text.length, 140);
  assert.ok(text.startsWith("needle"));
  assert.ok(text.endsWith("…"));
});

test("limit caps results and defaults to 20", async () => {
  const { search } = await load();
  const notes = [];
  for (let i = 0; i < 30; i += 1) notes.push({ path: `n${i}.md`, content: "hit" });
  assert.strictEqual(search("hit", notes).length, 20);
  assert.strictEqual(search("hit", notes, { limit: 5 }).length, 5);
  assert.strictEqual(search("hit", notes, { limit: 100 }).length, 30);
});

test("highlight splits 'a foo b Foo c' on 'foo' case-insensitively", async () => {
  const { highlight } = await load();
  assert.deepStrictEqual(highlight("a foo b Foo c", "foo"), [
    { text: "a ", hit: false },
    { text: "foo", hit: true },
    { text: " b ", hit: false },
    { text: "Foo", hit: true },
    { text: " c", hit: false },
  ]);
});

test("highlight handles no hits, empty input, and multiple words", async () => {
  const { highlight } = await load();
  assert.deepStrictEqual(highlight("plain", "zzz"), [{ text: "plain", hit: false }]);
  assert.deepStrictEqual(highlight("plain", ""), [{ text: "plain", hit: false }]);
  assert.deepStrictEqual(highlight("", "foo"), []);
  assert.deepStrictEqual(highlight("<b>foo</b>", "foo <b>"), [
    { text: "<b>", hit: true },
    { text: "foo", hit: true },
    { text: "</b>", hit: false },
  ]);
});
