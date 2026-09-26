// GET /api/search over a temp folder of notes: ranking, line numbers and snippets, multi-word
// queries, the empty query, the limit, and the content cache being dropped when a route writes.
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
  "Roadmap.md": "# Roadmap\n\nWhat is next.\n\n- [ ] Search across the folder\n",
  "Projects/Plan.md": "# Plan\n\nThe roadmap for the quarter.\n\nFirst milestone in October.\nSecond milestone in November.\n",
  "Reference/Tables.md": "# Tables\n\nTwo tables for checking the renderer.\n\n| Note | Folder |\n|------|--------|\n| Roadmap | Projects |\n",
  "Other.md": "# Other\n\nNothing relevant here.\n",
  "Both.md": "alpha here\nbeta there\n",
  "OnlyAlpha.md": "alpha alone\n",
};

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "plexar-search-"));
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

async function search(q, limit) {
  const query = `?q=${encodeURIComponent(q)}` + (limit === undefined ? "" : `&limit=${limit}`);
  const res = await api("GET", `/api/search${query}`);
  assert.strictEqual(res.status, 200, JSON.stringify(res.body));
  return res.body;
}

test("a title match ranks first, content matches follow", async () => {
  const body = await search("roadmap");
  assert.strictEqual(body.query, "roadmap");
  const paths = body.results.map((r) => r.path);
  assert.strictEqual(paths[0], "Roadmap.md");
  assert.ok(paths.includes("Projects/Plan.md"), JSON.stringify(paths));
  assert.ok(paths.includes("Reference/Tables.md"), JSON.stringify(paths));
  assert.ok(!paths.includes("Other.md"));
  assert.strictEqual(body.results[0].title, "Roadmap");
  assert.strictEqual(typeof body.results[0].score, "number");
  for (let i = 1; i < body.results.length; i += 1) assert.ok(body.results[i - 1].score >= body.results[i].score);
});

test("a content match carries 1-based line numbers and snippets", async () => {
  const body = await search("milestone");
  assert.deepStrictEqual(body.results.map((r) => r.path), ["Projects/Plan.md"]);
  const [result] = body.results;
  assert.deepStrictEqual(result.matches, [
    { line: 5, text: "First milestone in October." },
    { line: 6, text: "Second milestone in November." },
  ]);
});

test("a multi-word query needs every word somewhere in the note", async () => {
  const both = await search("alpha beta");
  assert.deepStrictEqual(both.results.map((r) => r.path), ["Both.md"]);
  assert.deepStrictEqual((await search("alpha gamma")).results, []);
  const either = await search("alpha");
  assert.deepStrictEqual(either.results.map((r) => r.path).sort(), ["Both.md", "OnlyAlpha.md"]);
});

test("an empty or missing q is {query: '', results: []}", async () => {
  for (const route of ["/api/search", "/api/search?q=", "/api/search?q=%20%20"]) {
    const res = await api("GET", route);
    assert.strictEqual(res.status, 200, route);
    assert.deepStrictEqual(res.body, { query: "", results: [] }, route);
  }
});

test("limit caps the results", async () => {
  const all = await search("roadmap");
  assert.ok(all.results.length >= 2);
  const one = await search("roadmap", 1);
  assert.strictEqual(one.results.length, 1);
  assert.strictEqual(one.results[0].path, "Roadmap.md");
  // A limit that is not a number falls back to the default rather than failing.
  const odd = await api("GET", "/api/search?q=roadmap&limit=lots");
  assert.strictEqual(odd.status, 200);
  assert.strictEqual(odd.body.results.length, all.results.length);
});

test("a PUT is visible to the next search: the cache does not serve the old content", async () => {
  // Warm the cache with the note as it is.
  const before = await search("quokka");
  assert.deepStrictEqual(before.results, []);
  assert.strictEqual((await search("nothing relevant")).results[0].path, "Other.md");

  const put = await api("PUT", "/api/file", { path: "Other.md", content: "# Other\n\nA quokka smiled.\n" });
  assert.strictEqual(put.status, 200);

  const after = await search("quokka");
  assert.deepStrictEqual(after.results.map((r) => r.path), ["Other.md"]);
  assert.deepStrictEqual(after.results[0].matches, [{ line: 3, text: "A quokka smiled." }]);
  assert.deepStrictEqual((await search("nothing relevant")).results, []);
});

test("created, renamed and deleted notes are reflected by the next search", async () => {
  assert.strictEqual((await api("POST", "/api/file", { path: "Fresh", content: "a wombat appears\n" })).status, 200);
  assert.deepStrictEqual((await search("wombat")).results.map((r) => r.path), ["Fresh.md"]);

  assert.strictEqual((await api("POST", "/api/rename", { from: "Fresh.md", to: "Animals/Fresh.md" })).status, 200);
  assert.deepStrictEqual((await search("wombat")).results.map((r) => r.path), ["Animals/Fresh.md"]);

  assert.strictEqual((await api("DELETE", `/api/file?path=${encodeURIComponent("Animals/Fresh.md")}`)).status, 200);
  assert.deepStrictEqual((await search("wombat")).results, []);
});

test("only GET is allowed on /api/search", async () => {
  assert.strictEqual((await api("POST", "/api/search", {})).status, 405);
});
