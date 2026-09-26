// The file and folder API over a temp folder: create, read, write, move, rename and delete,
// and the path guard on every one of those routes with a real file outside the folder that
// must stay untouched.
const test = require("node:test");
const { after, before } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const { createServer } = require("../server/server.js");

const OUTSIDE_CONTENT = "# outside\nthis file must never change\n";

let tmp;
let server;
let base;
let outsideName; // sibling of tmp inside os.tmpdir(), so '../<outsideName>' points at it
let outsideAbs;

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "plexar-notes-"));
  outsideName = `plexar-outside-${path.basename(tmp).slice("plexar-notes-".length)}.md`;
  outsideAbs = path.join(os.tmpdir(), outsideName);
  fs.writeFileSync(outsideAbs, OUTSIDE_CONTENT);

  server = createServer(tmp);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  if (outsideAbs) fs.rmSync(outsideAbs, { force: true });
});

// One API call. body (if given) goes out as JSON. Resolves to {status, body} with body parsed.
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

const q = (rel) => `?path=${encodeURIComponent(rel)}`;

// Every file path in a tree, depth first.
function filePaths(nodes, out = []) {
  for (const n of nodes) {
    if (n.type === "file") out.push(n.path);
    else filePaths(n.children, out);
  }
  return out;
}

test("create a note then read it back", async () => {
  const created = await api("POST", "/api/file", { path: "Hello.md", content: "# Hello\n" });
  assert.strictEqual(created.status, 200);
  assert.deepStrictEqual(created.body, { ok: true, path: "Hello.md" });
  assert.strictEqual(fs.readFileSync(path.join(tmp, "Hello.md"), "utf8"), "# Hello\n");

  const read = await api("GET", `/api/file${q("Hello.md")}`);
  assert.strictEqual(read.status, 200);
  assert.strictEqual(read.body.path, "Hello.md");
  assert.strictEqual(read.body.content, "# Hello\n");
  assert.strictEqual(typeof read.body.mtime, "number");
  assert.ok(read.body.mtime > 0);
});

test("GET /api/file is 404 for a missing note and 400 for a non-Markdown file", async () => {
  fs.writeFileSync(path.join(tmp, "readme.txt"), "not a note\n");
  assert.strictEqual((await api("GET", `/api/file${q("Nope.md")}`)).status, 404);
  assert.strictEqual((await api("GET", `/api/file${q("readme.txt")}`)).status, 400);
  assert.strictEqual((await api("GET", "/api/file")).status, 400);
});

test("write then read round-trips unicode and Windows line endings unchanged", async () => {
  const content = "# Título ✨ 日本語\r\n\r\nline two — «quotes»\r\nlast line without newline";
  const written = await api("PUT", "/api/file", { path: "Hello.md", content });
  assert.strictEqual(written.status, 200);
  assert.strictEqual(written.body.ok, true);
  assert.strictEqual(typeof written.body.mtime, "number");

  const read = await api("GET", `/api/file${q("Hello.md")}`);
  assert.strictEqual(read.status, 200);
  assert.strictEqual(read.body.content, content);
  assert.deepStrictEqual(fs.readFileSync(path.join(tmp, "Hello.md")), Buffer.from(content, "utf8"));
});

test("PUT needs an existing parent folder, a .md path and a string content", async () => {
  assert.strictEqual((await api("PUT", "/api/file", { path: "missing/Note.md", content: "x" })).status, 404);
  assert.ok(!fs.existsSync(path.join(tmp, "missing")));
  assert.strictEqual((await api("PUT", "/api/file", { path: "notes.txt", content: "x" })).status, 400);
  assert.ok(!fs.existsSync(path.join(tmp, "notes.txt")));
  assert.strictEqual((await api("PUT", "/api/file", { path: "Hello.md" })).status, 400);
  assert.strictEqual((await api("PUT", "/api/file", { content: "x" })).status, 400);
});

test("create adds .md when missing and makes the parent folders", async () => {
  const res = await api("POST", "/api/file", { path: "Ideas/2026/plan" });
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, { ok: true, path: "Ideas/2026/plan.md" });
  assert.strictEqual(fs.readFileSync(path.join(tmp, "Ideas", "2026", "plan.md"), "utf8"), "");
});

test("409 on a duplicate create, with or without the .md suffix", async () => {
  assert.strictEqual((await api("POST", "/api/file", { path: "Hello.md" })).status, 409);
  assert.strictEqual((await api("POST", "/api/file", { path: "Hello" })).status, 409);
  assert.strictEqual((await api("POST", "/api/file", { path: "Ideas/2026/plan" })).status, 409);
  // The originals are untouched.
  assert.ok(fs.readFileSync(path.join(tmp, "Hello.md"), "utf8").startsWith("# Título"));
});

test("a bad JSON body is a 400, not a crash", async () => {
  const res = await fetch(`${base}/api/file`, { method: "POST", body: "{not json", headers: { "content-type": "application/json" } });
  assert.strictEqual(res.status, 400);
  const empty = await fetch(`${base}/api/folder`, { method: "POST" });
  assert.strictEqual(empty.status, 400);
  const list = await api("POST", "/api/folder", ["x"]);
  assert.strictEqual(list.status, 400);
});

test("a body over 20 MB reaches the client as a 413", async () => {
  // Sent in chunks with node:http so the server has to keep reading past the limit; the
  // reply must be a real status, not a reset connection mid-upload.
  const chunk = Buffer.alloc(1024 * 1024, 0x61); // 1 MB of 'a'
  const total = 21 * chunk.length;
  const status = await new Promise((resolve, reject) => {
    const req = http.request(
      `${base}/api/file`,
      { method: "POST", headers: { "content-type": "application/json", "content-length": total } },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      },
    );
    req.on("error", reject);
    let sent = 0;
    const pump = () => {
      while (sent < total) {
        sent += chunk.length;
        if (!req.write(chunk)) return req.once("drain", pump);
      }
      req.end();
    };
    pump();
  });
  assert.strictEqual(status, 413);
});

test("new folder, then move a file into it and the tree reflects it", async () => {
  const made = await api("POST", "/api/folder", { path: "Projects/Alpha" });
  assert.strictEqual(made.status, 200);
  assert.deepStrictEqual(made.body, { ok: true, path: "Projects/Alpha" });
  assert.ok(fs.statSync(path.join(tmp, "Projects", "Alpha")).isDirectory());
  // mkdir -p on an existing folder is fine; a file in the way is a 409.
  assert.strictEqual((await api("POST", "/api/folder", { path: "Projects/Alpha" })).status, 200);
  assert.strictEqual((await api("POST", "/api/folder", { path: "Hello.md" })).status, 409);
  assert.ok(fs.statSync(path.join(tmp, "Hello.md")).isFile());

  const moved = await api("POST", "/api/rename", { from: "Hello.md", to: "Projects/Alpha/Hello.md" });
  assert.strictEqual(moved.status, 200);
  assert.deepStrictEqual(moved.body, { ok: true, path: "Projects/Alpha/Hello.md" });
  assert.ok(!fs.existsSync(path.join(tmp, "Hello.md")));
  assert.ok(fs.readFileSync(path.join(tmp, "Projects", "Alpha", "Hello.md"), "utf8").startsWith("# Título"));

  const tree = (await api("GET", "/api/tree")).body.tree;
  const files = filePaths(tree);
  assert.ok(files.includes("Projects/Alpha/Hello.md"), JSON.stringify(files));
  assert.ok(!files.includes("Hello.md"), JSON.stringify(files));
  const projects = tree.find((n) => n.name === "Projects");
  assert.strictEqual(projects.type, "folder");
  assert.deepStrictEqual(projects.children[0].children, [{ name: "Hello", path: "Projects/Alpha/Hello.md", type: "file" }]);
});

test("rename a folder, and move to a destination whose parent does not exist yet", async () => {
  const renamed = await api("POST", "/api/rename", { from: "Projects", to: "Archive" });
  assert.strictEqual(renamed.status, 200);
  assert.deepStrictEqual(renamed.body, { ok: true, path: "Archive" });
  assert.ok(!fs.existsSync(path.join(tmp, "Projects")));
  assert.ok(fs.statSync(path.join(tmp, "Archive", "Alpha", "Hello.md")).isFile());

  const moved = await api("POST", "/api/rename", { from: "Archive/Alpha/Hello.md", to: "Moved/deep/Hello.md" });
  assert.strictEqual(moved.status, 200);
  assert.ok(fs.statSync(path.join(tmp, "Moved", "deep", "Hello.md")).isFile());
  assert.ok(!fs.existsSync(path.join(tmp, "Archive", "Alpha", "Hello.md")));

  assert.strictEqual((await api("POST", "/api/rename", { from: "Nope.md", to: "Else.md" })).status, 404);
  assert.strictEqual((await api("POST", "/api/rename", { from: "Moved/deep/Hello.md", to: "Ideas/2026/plan.md" })).status, 409);
  assert.strictEqual(fs.readFileSync(path.join(tmp, "Ideas", "2026", "plan.md"), "utf8"), "");
  assert.strictEqual((await api("POST", "/api/rename", { from: "Moved" })).status, 400);
});

test("delete a file, then reading and deleting it again are 404s", async () => {
  assert.strictEqual((await api("POST", "/api/file", { path: "Temp.md", content: "bye" })).status, 200);
  const del = await api("DELETE", `/api/file${q("Temp.md")}`);
  assert.strictEqual(del.status, 200);
  assert.deepStrictEqual(del.body, { ok: true });
  assert.ok(!fs.existsSync(path.join(tmp, "Temp.md")));
  assert.strictEqual((await api("GET", `/api/file${q("Temp.md")}`)).status, 404);
  assert.strictEqual((await api("DELETE", `/api/file${q("Temp.md")}`)).status, 404);
  // A folder is not a file.
  assert.strictEqual((await api("DELETE", `/api/file${q("Moved")}`)).status, 404);
  assert.ok(fs.statSync(path.join(tmp, "Moved")).isDirectory());
});

test("delete a folder recursively", async () => {
  fs.mkdirSync(path.join(tmp, "Trash", "a", "b"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "Trash", "a", "b", "n.md"), "# n\n");
  fs.writeFileSync(path.join(tmp, "Trash", "img.png"), "not really a png");
  const del = await api("DELETE", `/api/folder${q("Trash")}`);
  assert.strictEqual(del.status, 200);
  assert.deepStrictEqual(del.body, { ok: true });
  assert.ok(!fs.existsSync(path.join(tmp, "Trash")));
  assert.strictEqual((await api("DELETE", `/api/folder${q("Trash")}`)).status, 404);
  // A file is not a folder.
  assert.strictEqual((await api("DELETE", `/api/folder${q("Ideas/2026/plan.md")}`)).status, 404);
  assert.ok(fs.existsSync(path.join(tmp, "Ideas", "2026", "plan.md")));
});

test("deleting the open folder itself is refused", async () => {
  for (const rel of ["", ".", "./", "/"]) {
    const res = await api("DELETE", `/api/folder${q(rel)}`);
    assert.strictEqual(res.status, 400, JSON.stringify(rel));
    assert.strictEqual(typeof res.body.error, "string");
  }
  assert.strictEqual((await api("DELETE", "/api/folder")).status, 400);
  assert.ok(fs.statSync(tmp).isDirectory());
  assert.ok(fs.existsSync(path.join(tmp, "Ideas", "2026", "plan.md")));
});

test("every route is a 400 for '..', backslash '..' and absolute paths; the outside file is untouched", async () => {
  assert.strictEqual((await api("POST", "/api/file", { path: "Anchor.md", content: "stay" })).status, 200);
  const anchor = path.join(tmp, "Anchor.md");

  const probes = [
    `../${outsideName}`,
    `..\\${outsideName}`,
    `a/../../${outsideName}`,
    `a\\..\\..\\${outsideName}`,
    outsideAbs,
    outsideAbs.replace(/\\/g, "/"),
    `/${outsideName}`,
  ];

  const untouched = (label) => {
    assert.strictEqual(fs.readFileSync(outsideAbs, "utf8"), OUTSIDE_CONTENT, label);
    assert.strictEqual(fs.readFileSync(anchor, "utf8"), "stay", label);
  };
  const expect400 = async (label, promise) => {
    const res = await promise;
    assert.strictEqual(res.status, 400, `${label} -> ${res.status} ${JSON.stringify(res.body)}`);
    assert.strictEqual(typeof res.body.error, "string", label);
    assert.ok(!("content" in res.body), label);
    untouched(label);
  };

  for (const p of probes) {
    await expect400(`GET file ${p}`, api("GET", `/api/file${q(p)}`));
    await expect400(`PUT file ${p}`, api("PUT", "/api/file", { path: p, content: "pwned" }));
    await expect400(`POST file ${p}`, api("POST", "/api/file", { path: p, content: "pwned" }));
    await expect400(`POST folder ${p}`, api("POST", "/api/folder", { path: p }));
    await expect400(`rename from ${p}`, api("POST", "/api/rename", { from: p, to: "Renamed.md" }));
    await expect400(`rename to ${p}`, api("POST", "/api/rename", { from: "Anchor.md", to: p }));
    await expect400(`DELETE file ${p}`, api("DELETE", `/api/file${q(p)}`));
    await expect400(`DELETE folder ${p}`, api("DELETE", `/api/folder${q(p)}`));
    assert.ok(!fs.existsSync(path.join(tmp, "Renamed.md")), p);
  }
  assert.ok(fs.existsSync(outsideAbs));
});

test("unknown API paths are 404 and wrong methods are 405", async () => {
  assert.strictEqual((await api("GET", "/api/nope")).status, 404);
  assert.strictEqual((await api("PATCH", "/api/file")).status, 405);
  assert.strictEqual((await api("GET", "/api/rename")).status, 405);
  assert.strictEqual((await api("POST", "/api/tree", {})).status, 405);
});
