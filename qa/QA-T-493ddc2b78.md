# QA — T-493ddc2b78

> **About this report.** The review chain ran, checked and photographed this work to get you through QA faster, and it is usually right. It is still AI judgement, and it is not a replacement for yours: results depend on how the task was prompted and on your project, and what works reliably for us may not for you. **Treat every AI verdict below as a lead to confirm, not a sign-off.** Your verdicts are recorded, and they are what makes the next report more accurate.

Generated 2026-09-26T08:50:48-04:00 by the review chain.

**Task:** This repo is Plexar Notes, a Markdown note taker with no build step, no npm install and no CDN at runtime. Browser code lives in public/ as ES modules.  TASK: add the two third-party libraries as plain files under public/vendor/ with their licence files, and a note on how to update them.  - public/vendor/marked/marked.esm.js: the ES module build of marked (latest 15.x or newer; from the npm package lib/marked.esm.js, e.g. download https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js once with curl or PowerShell Invoke-WebRequest) plus public/vendor/marked/LICENSE.md (the marked licence, MIT, 

**Branch:** `plexar/T-493ddc2b78` · **commit:** `1507c8c0cb5a` · **chain result:** `approved`

Record your verdict per case in `/app` (open the task, then *QA cases*), or edit *Your status* here.

## 1 · Seen by the AI: confirm what it claims to see (VISUAL)

None.

## 2 · Needs your eyes: the AI could not capture it (MANUAL)

None.

## 3 · Proven by a command (AUTO: backend smoke)

Re-runnable; these belong in the larger QA as regression checks. Spot-check any you doubt.

| ID | Section | Test | Class | AI verdict | Your status | What the AI observed | Commit | What & how to test |
|---|---|---|---|---|---|---|---|---|
| QA-1 | vendor | Gate: node --test green | AUTO | pass | VERIFIED (chain) | 29 pass, 0 fail | 1507c8c0cb | node --test — expect: exit 0, no failures |
| QA-2 | vendor | Both ES modules import and work; required languages registered | AUTO | pass | VERIFIED (chain) | true,true,true,true,true,true,true <h1>hi</h1> | 1507c8c0cb | node -e import both from public/vendor; getLanguage for 7 languages; marked.parse — expect: all languages true, markdown renders |
| QA-3 | vendor | Files, licences, README present, no extras | AUTO | pass | VERIFIED (chain) | README.md, highlight/{LICENSE,highlight.min.js}, marked/{LICENSE.md,marked.esm.js} | 1507c8c0cb | ls public/vendor/*; git status — expect: 5 expected files only |

## The chain, hop by hop

| hop | attempt | stage | model | verdict | judgement | feedback |
|---|---|---|---|---|---|---|
| 1 | 1 | verifier | sonnet | **pass** | All five vendor files exist, marked 18.0.14 and highlight.js 11.12.0 import and work in Node with all seven required languages, and node --test passes 29/29. |  |
| 2 | 1 | approver | opus | **approve** | All five vendor files are present with correct licences and README (marked 18.0.14, highlight.js 11.12.0), both modules import and work offline with all seven required languages, and node --test is green 29/29. The literal `export default` string is absent only because the upstream build uses the equivalent `export{Ke as default}`, which the README documents. |  |

## Evidence the reviewers recorded

**hop 1 (verifier)** `node --test`

```
pass 29, fail 0
```

**hop 1 (verifier)** `node import of both vendor modules, getLanguage for 7 languages, marked.parse('# hi')`

```
true x7; <h1>hi</h1>
```

**hop 1 (verifier)** `tail of highlight.min.js`

```
export{Ke as default};
```

**hop 2 (approver)** `wc -c; head/tail of marked.esm.js; grep export forms, python, sql in highlight.min.js; ls package.json node_modules`

```
marked.esm.js 46091 bytes, header 'marked v18.0.14', ends with export{...,k as marked,...,bn as parse,...}; highlight.min.js 130411 bytes; grep -c 'export default' = 0; 'export{Ke as default}' present; python lines 4, sql lines 2; package.json and node_modules do not exist
```

**hop 2 (approver)** `node --test`

```
tests 29, pass 29, fail 0
```

**hop 2 (approver)** `node --input-type=module import hljs + marked; getLanguage x7; highlight SQL; marked.parse('**b**')`

```
true,true,true,true,true,true,true <span class="hljs-keyword">SELECT</span> <span class="hljs-number">1</span> <p><strong>b</strong></p>
```

**hop 2 (approver)** `grep -rlE 'https?://' public (*.js, *.html) excluding vendor`

```
no output (no network URLs outside vendor)
```

