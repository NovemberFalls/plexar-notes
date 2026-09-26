// Plexar Notes server. Serves the app from public/, the shared lib/ modules and brand assets,
// and a JSON API over one folder of Markdown files. The folder given here is the starting
// point; POST /api/open-folder can switch to another while the server runs. Node standard
// library only.
//
//   node server/server.js [folder]     folder defaults to sample-notes/ next to the repo root
//   PORT=4000 node server/server.js    env PORT overrides the default port 3000
//   HOST=0.0.0.0 node server/server.js env HOST overrides the default 127.0.0.1
//
// Localhost only by default: the API reads, writes and deletes files and can open any folder
// on this machine, so listening on the network is something you choose, never the default.
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { handler } = require("./routes.js");

const DEFAULT_FOLDER = path.join(__dirname, "..", "sample-notes");
const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "127.0.0.1";

// An http.Server over rootFolder, not yet listening.
function createServer(rootFolder) {
  return http.createServer(handler(path.resolve(rootFolder)));
}

// Create the folder if missing, listen on port, and log where the app is. Returns the server.
function start(rootFolder = DEFAULT_FOLDER, port = DEFAULT_PORT, host = DEFAULT_HOST) {
  const root = path.resolve(rootFolder);
  fs.mkdirSync(root, { recursive: true });
  const server = createServer(root);
  server.listen(port, host, () => {
    const actual = server.address().port;
    console.log(`Plexar Notes: open folder ${root}`);
    console.log(`Plexar Notes: http://${host === DEFAULT_HOST ? "localhost" : host}:${actual}`);
  });
  return server;
}

if (require.main === module) {
  const folder = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_FOLDER;
  const port = Number(process.env.PORT) || DEFAULT_PORT;
  start(folder, port, process.env.HOST || DEFAULT_HOST);
}

module.exports = { createServer, start, DEFAULT_FOLDER, DEFAULT_PORT, DEFAULT_HOST };
