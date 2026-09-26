// Switching the open folder at run time: POST /api/open-folder changes which folder every
// later request is served from, GET /api/folder reports it, and GET /api/folders lists the
// subfolders of an absolute path for the in-app folder picker.
const test = require("node:test");
const { after, before } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createServer } = require("../server/server.js");

let folderA;
let folderB;
let server;
let base;

before(async () => {
  folderA = fs.mkdtempSync(path.join(os.tmpdir(), "plexar-notes-a-"));
  folderB = fs.mkdtempSync(path.join(os.tmpdir(), "plexar-notes-b-"));
  fs.writeFileSync(path.join(folderA, "Alpha.md"), "# Alpha\n");
  fs.mkdirSync(path.join(folderB, "Projects"));
  fs.mkdirSync(path.join(folderB, ".hidden"));
  fs.writeFileSync(path.join(folderB, "Bravo.md"), "# Bravo\n");
  fs.writeFileSync(path.join(folderB, "Projects", "Plan.md"), "# Plan\n");
  fs.writeFileSync(path.join(folderB, "notes.txt"), "not a folder\n");

  server = createServer(folderA);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  for (const dir of [folderA, folderB]) if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

async function api(method, route, body) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${base}${route}`, init);
  assert.strictEqual(res.headers.get("content-type"), "application/json; charset=utf-8", `${method} ${route}`);
  return { status: res.status, body: await res.json() };
}

const names = (nodes) => nodes.map((n) => n.name);

test("the tree starts as folder A and GET /api/folder says so", async () => {
  const tree = await api("GET", "/api/tree");
  assert.strictEqual(tree.status, 200);
  assert.strictEqual(tree.body.root, path.resolve(folderA));
  assert.deepStrictEqual(names(tree.body.tree), ["Alpha"]);

  const folder = await api("GET", "/api/folder");
  assert.strictEqual(folder.status, 200);
  assert.deepStrictEqual(folder.body, { folder: path.basename(folderA), root: path.resolve(folderA) });
});

test("POST /api/open-folder switches every later request to folder B", async () => {
  const open = await api("POST", "/api/open-folder", { folder: folderB });
  assert.strictEqual(open.status, 200);
  assert.deepStrictEqual(open.body, { folder: path.basename(folderB), root: path.resolve(folderB) });

  const tree = await api("GET", "/api/tree");
  assert.strictEqual(tree.body.root, path.resolve(folderB));
  assert.strictEqual(tree.body.folder, path.basename(folderB));
  assert.deepStrictEqual(names(tree.body.tree), ["Projects", "Bravo"]);

  const file = await api("GET", `/api/file?path=${encodeURIComponent("Projects/Plan.md")}`);
  assert.strictEqual(file.status, 200);
  assert.strictEqual(file.body.content, "# Plan\n");

  const gone = await api("GET", `/api/file?path=${encodeURIComponent("Alpha.md")}`);
  assert.strictEqual(gone.status, 404);

  const search = await api("GET", "/api/search?q=bravo");
  assert.deepStrictEqual(search.body.results.map((r) => r.path), ["Bravo.md"]);

  const folder = await api("GET", "/api/folder");
  assert.deepStrictEqual(folder.body, { folder: path.basename(folderB), root: path.resolve(folderB) });
});

test("a missing path, a file, a relative path or no folder at all is a 400 and the root stays", async () => {
  const before = (await api("GET", "/api/folder")).body.root;
  const missing = await api("POST", "/api/open-folder", { folder: path.join(folderB, "nope") });
  assert.strictEqual(missing.status, 400);
  assert.strictEqual(typeof missing.body.error, "string");

  const file = await api("POST", "/api/open-folder", { folder: path.join(folderB, "notes.txt") });
  assert.strictEqual(file.status, 400);

  const relative = await api("POST", "/api/open-folder", { folder: "Projects" });
  assert.strictEqual(relative.status, 400);

  const none = await api("POST", "/api/open-folder", {});
  assert.strictEqual(none.status, 400);

  assert.strictEqual((await api("GET", "/api/folder")).body.root, before);
  assert.strictEqual((await api("GET", "/api/tree")).body.root, before);
});

test("GET /api/folders lists the subfolders of an absolute path with its parent", async () => {
  const res = await api("GET", `/api/folders?path=${encodeURIComponent(folderB)}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.path, path.resolve(folderB));
  assert.strictEqual(res.body.parent, path.dirname(path.resolve(folderB)));
  assert.deepStrictEqual(res.body.folders, [{ name: "Projects", path: path.join(path.resolve(folderB), "Projects") }]);

  const sub = await api("GET", `/api/folders?path=${encodeURIComponent(path.join(folderB, "Projects"))}`);
  assert.deepStrictEqual(sub.body.folders, []);
  assert.strictEqual(sub.body.parent, path.resolve(folderB));
});

test("GET /api/folders with no path lists the home folder; bad paths are 400", async () => {
  const home = await api("GET", "/api/folders");
  assert.strictEqual(home.status, 200);
  assert.strictEqual(home.body.path, path.resolve(os.homedir()));
  assert.ok(Array.isArray(home.body.folders));
  for (const f of home.body.folders) assert.ok(!f.name.startsWith("."), f.name);

  const empty = await api("GET", "/api/folders?path=");
  assert.strictEqual(empty.body.path, path.resolve(os.homedir()));

  assert.strictEqual((await api("GET", "/api/folders?path=Projects")).status, 400);
  assert.strictEqual((await api("GET", `/api/folders?path=${encodeURIComponent(path.join(folderB, "nope"))}`)).status, 400);
  assert.strictEqual((await api("GET", `/api/folders?path=${encodeURIComponent(path.join(folderB, "notes.txt"))}`)).status, 400);
});
