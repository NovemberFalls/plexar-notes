// The server over a temp folder: the app shell, brand assets, the folder tree API, raw files
// from the folder, and the path guard on every static route.
const test = require("node:test");
const { after, before } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");

const { createServer } = require("../server/server.js");

// A 1x1 PNG so the image route has a real file to send.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

let tmp;
let server;
let base;

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "plexar-notes-"));
  fs.mkdirSync(path.join(tmp, "sub", "deep"), { recursive: true });
  fs.mkdirSync(path.join(tmp, ".hidden"));
  fs.mkdirSync(path.join(tmp, "node_modules"));
  fs.writeFileSync(path.join(tmp, "Zulu.md"), "# Zulu\n");
  fs.writeFileSync(path.join(tmp, "alpha.md"), "# alpha\n");
  fs.writeFileSync(path.join(tmp, "readme.txt"), "not a note\n");
  fs.writeFileSync(path.join(tmp, "sub", "Note.md"), "# Note\n");
  fs.writeFileSync(path.join(tmp, "sub", "skip.txt"), "no\n");
  fs.writeFileSync(path.join(tmp, "sub", "img.png"), PNG);
  fs.writeFileSync(path.join(tmp, "sub", "deep", "Deeper.md"), "# Deeper\n");
  fs.writeFileSync(path.join(tmp, ".hidden", "secret.md"), "# hidden\n");
  fs.writeFileSync(path.join(tmp, "node_modules", "pkg.md"), "# pkg\n");

  server = createServer(tmp);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

// fetch() normalises '..' away before the request leaves, so traversal probes go out verbatim
// over a plain http request instead. Resolves to {status, body, type}.
function rawGet(rawPath) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port: server.address().port, path: rawPath }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        resolve({ status: res.statusCode, type: res.headers["content-type"], body: Buffer.concat(chunks).toString() }),
      );
    });
    req.on("error", reject);
  });
}

test("GET / serves the app shell", async () => {
  const res = await fetch(`${base}/`);
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get("content-type"), /^text\/html/);
  const html = await res.text();
  assert.ok(html.includes("Plexar Notes"));
  assert.ok(html.includes("/brand/plexar-tokens.css"));
  const alias = await fetch(`${base}/index.html`);
  assert.strictEqual(alias.status, 200);
});

test("GET /brand/plexar-tokens.css is text/css and the font next to it loads", async () => {
  const res = await fetch(`${base}/brand/plexar-tokens.css`);
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get("content-type"), /^text\/css/);
  assert.ok((await res.text()).includes("--px-font-display"));
  const font = await fetch(`${base}/brand/fonts/montserrat-medium.woff2`);
  assert.strictEqual(font.status, 200);
  assert.strictEqual(font.headers.get("content-type"), "font/woff2");
});

test("app css, js and lib modules are served with the right types", async () => {
  const css = await fetch(`${base}/css/app.css`);
  assert.strictEqual(css.status, 200);
  assert.match(css.headers.get("content-type"), /^text\/css/);
  const js = await fetch(`${base}/js/app.js`);
  assert.strictEqual(js.status, 200);
  assert.match(js.headers.get("content-type"), /^text\/javascript/);
  const lib = await fetch(`${base}/lib/tree.js`);
  assert.strictEqual(lib.status, 200);
  assert.ok((await lib.text()).includes("export function buildTree"));
});

test("GET /api/tree lists folders first, nests children, drops .txt and the .md suffix", async () => {
  const res = await fetch(`${base}/api/tree`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get("content-type"), "application/json; charset=utf-8");
  const body = await res.json();
  assert.strictEqual(body.folder, path.basename(tmp));
  assert.strictEqual(body.root, path.resolve(tmp));

  const names = (nodes) => nodes.map((n) => n.name);
  assert.deepStrictEqual(names(body.tree), ["sub", "alpha", "Zulu"]);
  assert.strictEqual(body.tree[0].type, "folder");
  assert.deepStrictEqual(names(body.tree[0].children), ["deep", "Note"]);
  assert.deepStrictEqual(body.tree[0].children[0].children, [{ name: "Deeper", path: "sub/deep/Deeper.md", type: "file" }]);
  assert.deepStrictEqual(body.tree[0].children[1], { name: "Note", path: "sub/Note.md", type: "file" });

  const all = JSON.stringify(body.tree);
  assert.ok(!all.includes(".txt"));
  assert.ok(!all.includes("hidden"));
  assert.ok(!all.includes("node_modules"));
  assert.ok(!all.includes("img.png"));
});

test("GET /api/tree?sort=name-desc reverses the file order and keeps folders first", async () => {
  const body = await (await fetch(`${base}/api/tree?sort=name-desc`)).json();
  assert.deepStrictEqual(body.tree.map((n) => n.name), ["sub", "Zulu", "alpha"]);
});

test("GET /files/<path> sends a raw file from the folder with its content type", async () => {
  const res = await fetch(`${base}/files/sub/img.png`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get("content-type"), "image/png");
  assert.deepStrictEqual(Buffer.from(await res.arrayBuffer()), PNG);
  const note = await fetch(`${base}/files/sub/Note.md`);
  assert.match(note.headers.get("content-type"), /^text\/markdown/);
  assert.strictEqual(await note.text(), "# Note\n");
});

test("missing files and unknown routes are JSON 404s", async () => {
  for (const p of ["/files/nope.md", "/css/nope.css", "/brand/nope.png", "/lib/nope.js", "/nope", "/api/nope"]) {
    const res = await fetch(`${base}${p}`);
    assert.strictEqual(res.status, 404, p);
    assert.strictEqual(res.headers.get("content-type"), "application/json; charset=utf-8", p);
    assert.strictEqual(typeof (await res.json()).error, "string", p);
  }
  const folder = await fetch(`${base}/files/sub`);
  assert.strictEqual(folder.status, 404);
});

test("path traversal out of the folder is a 400", async () => {
  for (const p of ["/files/../package.json", "/files/%2e%2e/x", "/files/..%2fserver/server.js", "/files/%2E%2E%2Fx"]) {
    const res = await rawGet(p);
    assert.strictEqual(res.status, 400, p);
    assert.match(res.type, /^application\/json/);
    assert.ok(!res.body.includes("createServer"), p);
    assert.strictEqual(typeof JSON.parse(res.body).error, "string", p);
  }
  // The same probe through fetch is normalised to /package.json, which the server does not know.
  const viaFetch = await fetch(`${base}/files/../package.json`);
  assert.strictEqual(viaFetch.status, 404);
});

test("static routes never leak the server source", async () => {
  for (const p of ["/css/../server/server.js", "/css/..%2f..%2fserver/server.js", "/brand/../server/server.js", "/lib/../server/server.js"]) {
    const res = await rawGet(p);
    assert.ok(res.status === 400 || res.status === 404, `${p} -> ${res.status}`);
    assert.ok(!res.body.includes("createServer"), p);
  }
  const viaFetch = await fetch(`${base}/css/../server/server.js`);
  assert.ok(viaFetch.status === 400 || viaFetch.status === 404);
  assert.ok(!(await viaFetch.text()).includes("createServer"));
});
