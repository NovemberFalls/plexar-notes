// The API can read, write and delete files, so the server listens on this machine only
// unless HOST says otherwise.
const test = require("node:test");
const assert = require("node:assert");
const os = require("node:os");
const { start, DEFAULT_HOST } = require("../server/server.js");

test("the server listens on 127.0.0.1 by default", async () => {
  assert.strictEqual(DEFAULT_HOST, "127.0.0.1");
  const server = start(os.tmpdir(), 0);
  await new Promise(r => server.once("listening", r));
  assert.strictEqual(server.address().address, "127.0.0.1");
  await new Promise(r => server.close(r));
});
