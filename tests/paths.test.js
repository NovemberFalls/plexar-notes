const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

const load = () => import("../lib/paths.js");

const REJECTED = [
  "..",
  "a/../..",
  "..\\b",
  "a/..\\..\\c",
  "/etc/passwd",
  "\\Windows",
  "C:\\Windows",
  "c:/Users",
  "\\\\server\\share",
  "",
  "a\u0000b",
  "%2e%2e/x",
  "a/%2E%2E/b",
  "./a.md",
  "a/./b.md",
  "a/   /b.md",
  "   ",
];

const ACCEPTED = ["notes/todo.md", "Deep/Nested/Path/file.md", "todo.md", "a.b/c..d.md", "notes\\todo.md"];

test("toPosix normalises separators and trims edges", async () => {
  const { toPosix } = await load();
  assert.strictEqual(toPosix("a\\b\\c.md"), "a/b/c.md");
  assert.strictEqual(toPosix("./a/b.md"), "a/b.md");
  assert.strictEqual(toPosix("/a/b/"), "a/b");
  assert.strictEqual(toPosix("\\a\\b\\"), "a/b");
  assert.strictEqual(toPosix("a/b"), "a/b");
  assert.strictEqual(toPosix(42), "");
});

test("isSafeRelative rejects escapes, absolutes, dot segments, null bytes and blanks", async () => {
  const { isSafeRelative } = await load();
  for (const rel of REJECTED) assert.strictEqual(isSafeRelative(rel), false, JSON.stringify(rel));
  assert.strictEqual(isSafeRelative(null), false);
  assert.strictEqual(isSafeRelative(undefined), false);
  assert.strictEqual(isSafeRelative(7), false);
  assert.strictEqual(isSafeRelative(["a"]), false);
});

test("isSafeRelative accepts ordinary nested files", async () => {
  const { isSafeRelative } = await load();
  for (const rel of ACCEPTED) assert.strictEqual(isSafeRelative(rel), true, JSON.stringify(rel));
});

test("safeJoin throws a 400 'path escapes folder' error for unsafe paths", async () => {
  const { safeJoin } = await load();
  const root = path.join(__dirname, "fixture-folder");
  for (const rel of REJECTED) {
    assert.throws(() => safeJoin(root, rel), (err) => {
      assert.strictEqual(err.message, "path escapes folder", JSON.stringify(rel));
      assert.strictEqual(err.status, 400, JSON.stringify(rel));
      return true;
    }, JSON.stringify(rel));
  }
  assert.throws(() => safeJoin(root, undefined), { status: 400 });
});

test("safeJoin returns an absolute path under root for safe paths", async () => {
  const { safeJoin } = await load();
  const root = path.join(__dirname, "fixture-folder");
  const a = safeJoin(root, "notes/todo.md");
  assert.strictEqual(a, path.resolve(root, "notes", "todo.md"));
  assert.ok(path.isAbsolute(a));
  const b = safeJoin(root, "Deep/Nested/Path/file.md");
  assert.strictEqual(b, path.resolve(root, "Deep", "Nested", "Path", "file.md"));
  assert.ok(b.startsWith(root + path.sep));
  const c = safeJoin(root, "notes\\todo.md");
  assert.strictEqual(c, a);
});

test("safeJoin resolves a relative root against the working directory", async () => {
  const { safeJoin } = await load();
  const out = safeJoin("sample-notes", "todo.md");
  assert.strictEqual(out, path.resolve(process.cwd(), "sample-notes", "todo.md"));
  assert.throws(() => safeJoin("sample-notes", "../todo.md"), { status: 400 });
});

test("isMarkdown is case-insensitive on the .md extension", async () => {
  const { isMarkdown } = await load();
  assert.strictEqual(isMarkdown("a.md"), true);
  assert.strictEqual(isMarkdown("Dir/B.MD"), true);
  assert.strictEqual(isMarkdown("a.markdown"), false);
  assert.strictEqual(isMarkdown("a.txt"), false);
  assert.strictEqual(isMarkdown("md"), false);
  assert.strictEqual(isMarkdown(null), false);
});

test("displayName is the last segment without .md", async () => {
  const { displayName } = await load();
  assert.strictEqual(displayName("Projects/Plan.md"), "Plan");
  assert.strictEqual(displayName("Projects\\Plan.MD"), "Plan");
  assert.strictEqual(displayName("Plan.md"), "Plan");
  assert.strictEqual(displayName("Plan"), "Plan");
  assert.strictEqual(displayName("a/b.txt"), "b.txt");
});
