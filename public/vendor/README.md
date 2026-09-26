# Vendored libraries

Plain files, no build step, no npm install. The app never loads anything from
the network at runtime; everything the browser needs is checked in here.

| Library | Version | Source | Licence |
|---|---|---|---|
| marked (ES module build) | 18.0.14 | https://cdn.jsdelivr.net/npm/marked@18.0.14/lib/marked.esm.js | MIT, see marked/LICENSE.md |
| highlight.js (ES build, common languages) | 11.12.0 | https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.12.0/es/highlight.min.js | BSD-3-Clause, see highlight/LICENSE |

Copyright holders: marked is (c) 2018+ MarkedJS and (c) 2011-2018 Christopher
Jeffrey, with the original Markdown (c) 2004 John Gruber. highlight.js is
(c) 2006 Ivan Sagalaev.

The highlight.js common bundle includes javascript, python, xml (HTML), css,
json, bash (shell) and sql among others. No highlight.js theme css is vendored;
the app styles code with Plexar tokens.

Versions were read from the `package.json` of each npm package on jsDelivr at
the time of download (https://cdn.jsdelivr.net/npm/marked/package.json and
https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11/package.json).

## Updating

1. Download each file once with curl or PowerShell Invoke-WebRequest from the
   unpinned URLs (https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js and
   https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11/es/highlight.min.js),
   plus the licence files (https://cdn.jsdelivr.net/npm/marked/LICENSE.md and
   https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11/LICENSE).
2. Read the new version numbers from the two package.json URLs above and update
   the table, including the pinned version in each source URL.
3. Verify: marked.esm.js contains `export`; highlight.min.js ends with
   `export{... as default}` and contains the strings `python` and `sql`.
4. Run `node --test`. tests/style.test.js skips any directory named vendor, so
   colours inside these files are allowed; nothing outside vendor may hard-code
   colours.
