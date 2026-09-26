const test = require("node:test");
const assert = require("node:assert");

const load = () => import("../lib/tree.js");

const file = (path, mtime = 0) => ({ path, type: "file", mtime });
const folder = (path, mtime = 0) => ({ path, type: "folder", mtime });

const names = (nodes) => nodes.map((n) => n.name);

test("folders implied by a file path appear even without a folder entry", async () => {
  const { buildTree } = await load();
  const tree = buildTree([file("a/b/c.md")]);
  assert.deepStrictEqual(tree, [
    {
      name: "a",
      path: "a",
      type: "folder",
      children: [
        {
          name: "b",
          path: "a/b",
          type: "folder",
          children: [{ name: "c", path: "a/b/c.md", type: "file" }],
        },
      ],
    },
  ]);
});

test("an explicit folder entry and an implied one are the same folder", async () => {
  const { buildTree } = await load();
  const tree = buildTree([folder("Projects"), file("Projects/Plan.md"), folder("Empty")]);
  assert.deepStrictEqual(names(tree), ["Empty", "Projects"]);
  assert.deepStrictEqual(tree[0].children, []);
  assert.deepStrictEqual(names(tree[1].children), ["Plan"]);
});

test("only .md files are included unless options.allFiles is true", async () => {
  const { buildTree } = await load();
  const entries = [file("Plan.md"), file("photo.png"), file("Notes.MD"), file("readme.txt")];
  assert.deepStrictEqual(names(buildTree(entries)), ["Notes", "Plan"]);
  assert.deepStrictEqual(names(buildTree(entries, { allFiles: true })), ["Notes", "photo.png", "Plan", "readme.txt"]);
});

test("a folder that only contains non-md files still appears, empty", async () => {
  const { buildTree } = await load();
  const tree = buildTree([folder("Images"), file("Images/a.png")]);
  assert.deepStrictEqual(tree, [{ name: "Images", path: "Images", type: "folder", children: [] }]);
});

test("display names drop .md for files but keep the folder name whole", async () => {
  const { buildTree } = await load();
  const tree = buildTree([file("Projects/Plan.md"), folder("Archive.md")]);
  const projects = tree.find((n) => n.name === "Projects");
  assert.deepStrictEqual(projects.children[0], { name: "Plan", path: "Projects/Plan.md", type: "file" });
  assert.ok(tree.some((n) => n.name === "Archive.md" && n.type === "folder"));
});

test("folders come before files at every level", async () => {
  const { buildTree } = await load();
  const tree = buildTree([
    file("Alpha.md"),
    folder("Zulu"),
    file("Zulu/apple.md"),
    folder("Zulu/Sub"),
    file("Zulu/Aardvark.md"),
  ]);
  assert.deepStrictEqual(tree.map((n) => n.type), ["folder", "file"]);
  assert.deepStrictEqual(names(tree), ["Zulu", "Alpha"]);
  assert.deepStrictEqual(names(tree[0].children), ["Sub", "Aardvark", "apple"]);
});

test("name-asc is the default: case-insensitive and natural", async () => {
  const { buildTree } = await load();
  const tree = buildTree([file("Note 10.md"), file("note 2.md"), file("Note 1.md"), file("banana.md"), file("Apple.md")]);
  assert.deepStrictEqual(names(tree), ["Apple", "banana", "Note 1", "note 2", "Note 10"]);
  assert.deepStrictEqual(names(buildTree([file("b.md"), file("a.md")], { sort: "name-asc" })), ["a", "b"]);
});

test("natural sort applies to folders too", async () => {
  const { buildTree } = await load();
  const tree = buildTree([folder("Week 10"), folder("Week 9"), folder("Week 1")]);
  assert.deepStrictEqual(names(tree), ["Week 1", "Week 9", "Week 10"]);
});

test("name-desc reverses the file order and keeps folders first", async () => {
  const { buildTree } = await load();
  const tree = buildTree([file("Note 10.md"), file("Note 2.md"), file("apple.md"), folder("Zed")], { sort: "name-desc" });
  assert.deepStrictEqual(names(tree), ["Zed", "Note 10", "Note 2", "apple"]);
});

test("modified-desc puts the newest file first; folders stay by name", async () => {
  const { buildTree } = await load();
  const tree = buildTree(
    [file("old.md", 100), file("newest.md", 300), file("middle.md", 200), folder("B"), folder("A")],
    { sort: "modified-desc" },
  );
  assert.deepStrictEqual(names(tree), ["A", "B", "newest", "middle", "old"]);
});

test("modified-asc puts the oldest file first and breaks ties by name", async () => {
  const { buildTree } = await load();
  const tree = buildTree([file("b.md", 100), file("a.md", 100), file("c.md", 50)], { sort: "modified-asc" });
  assert.deepStrictEqual(names(tree), ["c", "a", "b"]);
});

test("an unknown sort falls back to name-asc", async () => {
  const { buildTree } = await load();
  assert.deepStrictEqual(names(buildTree([file("b.md"), file("a.md")], { sort: "bogus" })), ["a", "b"]);
});

test("nodes never carry mtime or extra fields", async () => {
  const { buildTree } = await load();
  const tree = buildTree([file("Plan.md", 5), folder("Dir")]);
  assert.deepStrictEqual(Object.keys(tree[0]).sort(), ["children", "name", "path", "type"]);
  assert.deepStrictEqual(Object.keys(tree[1]).sort(), ["name", "path", "type"]);
});

test("flatten walks depth-first in display order with depth values", async () => {
  const { buildTree, flatten } = await load();
  const tree = buildTree([file("Top.md"), file("Projects/Plan.md"), file("Projects/Sub/Deep.md"), folder("Archive")]);
  const flat = flatten(tree);
  assert.deepStrictEqual(
    flat.map((n) => [n.path, n.depth]),
    [
      ["Archive", 0],
      ["Projects", 0],
      ["Projects/Sub", 1],
      ["Projects/Sub/Deep.md", 2],
      ["Projects/Plan.md", 1],
      ["Top.md", 0],
    ],
  );
  assert.deepStrictEqual(flatten([]), []);
});

test("findNode returns the matching node", async () => {
  const { buildTree, findNode } = await load();
  const tree = buildTree([file("Top.md"), file("Projects/Sub/Deep.md")]);
  assert.deepStrictEqual(findNode(tree, "Projects/Sub/Deep.md"), { name: "Deep", path: "Projects/Sub/Deep.md", type: "file" });
  assert.strictEqual(findNode(tree, "Projects/Sub").type, "folder");
  assert.strictEqual(findNode(tree, "Top.md").name, "Top");
  assert.strictEqual(findNode(tree, "Projects\\Sub\\Deep.md").path, "Projects/Sub/Deep.md");
});

test("findNode returns null when nothing matches", async () => {
  const { buildTree, findNode } = await load();
  const tree = buildTree([file("Top.md"), file("Projects/Sub/Deep.md")]);
  assert.strictEqual(findNode(tree, "Missing.md"), null);
  assert.strictEqual(findNode(tree, "Projects/Nope.md"), null);
  assert.strictEqual(findNode(tree, "Top"), null);
  assert.strictEqual(findNode(tree, ""), null);
  assert.strictEqual(findNode([], "Top.md"), null);
});
