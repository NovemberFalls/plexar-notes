# Vendored libraries

Plain files, no build step. The app never loads anything from the network at runtime.

| Library | Version | Source | Licence |
|---|---|---|---|
| marked | 18.0.14 | https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js | MIT (marked/LICENSE.md) |
| highlight.js (common languages, ES build) | 11.12.0 | https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11/es/highlight.min.js | BSD-3-Clause (highlight/LICENSE) |

No highlight.js theme css is vendored; code is styled with Plexar tokens.

## Updating

Re-download each file once with curl (or Invoke-WebRequest) from the source URLs above, plus the LICENSE files
(https://cdn.jsdelivr.net/npm/marked/LICENSE.md, https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11/LICENSE),
pin the version in the URL if desired, update the versions in this table, and run `node --test`.
Check marked.esm.js has `export`, and highlight.min.js ends with `export{...as default}` and includes python and sql.
