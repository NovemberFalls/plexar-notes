// GET /api/backlinks over a temp folder: A is linked from B (with an alias) and from C (in a
// subfolder), A links to nobody. The count and contexts come back, a PUT that removes a link is
// seen by the next request, and an unsafe path is refused.
const test = require("node:test");
const { after, before } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createServer } = require("../server/server.js");

let tmp;
let server;
let base;

const NOTES = {
  "A.md": "# A\n\nNobody is linked from here.\n",
  "B.md": "# B\n\nSee [[A|the first note]] for the start.\n",
  "Sub/C.md": "# C\n\nAlso [[A]] from a subfolder.\n",
};

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "plexar-backlinks-"));
  for (const [rel, content] of Object.entries(NOTES)) {
    const full = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  server = createServer(tmp);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
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

async function backlinks(p) {
  const res = await api("GET", `/api/backlinks?path=${encodeURIComponent(p)}`);
  assert.strictEqual(res.status, 200, JSON.stringify(res.body));
  return res.body;
}

test("A is linked from B (alias) and C (subfolder), each with the line as context", async () => {
  const body = await backlinks("A.md");
  assert.strictEqual(body.path, "A.md");
  assert.strictEqual(body.count, 2);
  assert.deepStrictEqual(body.backlinks, [
    { from: "B.md", title: "B", context: "See [[A|the first note]] for the start." },
    { from: "Sub/C.md", title: "C", context: "Also [[A]] from a subfolder." },
  ]);
});

test("a note nobody links to has count 0", async () => {
  assert.deepStrictEqual(await backlinks("B.md"), { path: "B.md", count: 0, backlinks: [] });
  assert.deepStrictEqual(await backlinks("Sub/C.md"), { path: "Sub/C.md", count: 0, backlinks: [] });
});

test("a PUT that removes a link is seen by the next request", async () => {
  assert.strictEqual((await backlinks("A.md")).count, 2); // warm the index
  const put = await api("PUT", "/api/file", { path: "Sub/C.md", content: "# C\n\nNo link to the first note any more.\n" });
  assert.strictEqual(put.status, 200);
  const body = await backlinks("A.md");
  assert.strictEqual(body.count, 1);
  assert.deepStrictEqual(body.backlinks.map((b) => b.from), ["B.md"]);
});

test("a missing note is 404, an unsafe or non-Markdown path is 400", async () => {
  assert.strictEqual((await api("GET", "/api/backlinks?path=Missing.md")).status, 404);
  assert.strictEqual((await api("GET", `/api/backlinks?path=${encodeURIComponent("../A.md")}`)).status, 400);
  assert.strictEqual((await api("GET", "/api/backlinks?path=A.txt")).status, 400);
  assert.strictEqual((await api("GET", "/api/backlinks")).status, 400);
});

test("only GET is allowed on /api/backlinks", async () => {
  assert.strictEqual((await api("POST", "/api/backlinks", {})).status, 405);
});
