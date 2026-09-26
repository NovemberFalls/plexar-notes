const test = require("node:test");
const assert = require("node:assert");

const load = () => import("../lib/words.js");

test("empty input gives zero words, chars and minutes", async () => {
  const { countWords, countChars, stats } = await load();
  assert.strictEqual(countWords(""), 0);
  assert.strictEqual(countChars(""), 0);
  assert.deepStrictEqual(stats(""), { words: 0, chars: 0, readingMinutes: 0 });
  assert.deepStrictEqual(stats(null), { words: 0, chars: 0, readingMinutes: 0 });
});

test("'Hello, world!' is 2 words and 13 chars", async () => {
  const { countWords, countChars, stats } = await load();
  assert.strictEqual(countWords("Hello, world!"), 2);
  assert.strictEqual(countChars("Hello, world!"), 13);
  assert.deepStrictEqual(stats("Hello, world!"), { words: 2, chars: 13, readingMinutes: 1 });
});

test("countChars excludes line breaks", async () => {
  const { countChars } = await load();
  assert.strictEqual(countChars("ab\ncd\r\nef\r"), 6);
});

test("heading and list markers are not words", async () => {
  const { countWords } = await load();
  const md = ["# Title", "", "- one", "- two", "* three", "> quoted", "1. four", "---", "| a | b |"].join("\n");
  assert.strictEqual(countWords(md), 9);
  assert.strictEqual(countWords("## \n---\n***"), 0);
});

test("emphasis markers are stripped but the words stay", async () => {
  const { countWords } = await load();
  assert.strictEqual(countWords("**bold** and _italic_ and `code`"), 5);
});

test("apostrophes and hyphens join a word", async () => {
  const { countWords } = await load();
  assert.strictEqual(countWords("don't stop-me"), 2);
  assert.strictEqual(countWords("rock ’n’ roll"), 3);
});

test("unicode letters count and a run of CJK is one word", async () => {
  const { countWords } = await load();
  assert.strictEqual(countWords("café"), 1);
  assert.strictEqual(countWords("日本語"), 1);
  assert.strictEqual(countWords("café au lait, 日本語 です"), 5);
});

test("fenced code loses its fences but keeps its content", async () => {
  const { countWords } = await load();
  const md = ["before", "```js", "const x = 1", "```", "after"].join("\n");
  assert.strictEqual(countWords(md), 5);
  assert.strictEqual(countWords("~~~\nfoo bar\n~~~"), 2);
});

test("a wiki link with an alias counts only the alias words", async () => {
  const { countWords } = await load();
  assert.strictEqual(countWords("see [[Some Long Target|the plan]] now"), 4);
  assert.strictEqual(countWords("[[Plan]]"), 1);
});

test("a Markdown link counts its text but not its URL", async () => {
  const { countWords } = await load();
  assert.strictEqual(countWords("[text](http://x)"), 1);
  assert.strictEqual(countWords("read [the docs here](https://example.com/a-b/c?d=1) today"), 5);
  assert.strictEqual(countWords("![alt words](img.png)"), 2);
});

test("reading minutes round up at 200 words per minute, minimum 1", async () => {
  const { stats } = await load();
  const words = (n) => Array.from({ length: n }, (_, i) => "w" + i).join(" ");
  assert.strictEqual(stats("one").readingMinutes, 1);
  assert.strictEqual(stats(words(200)).readingMinutes, 1);
  assert.strictEqual(stats(words(201)).readingMinutes, 2);
  assert.strictEqual(stats(words(1000)).readingMinutes, 5);
  assert.strictEqual(stats("---").readingMinutes, 0);
});
