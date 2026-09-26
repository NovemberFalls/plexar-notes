# QA — T-493ddc2b78

> **About this report.** The review chain ran, checked and photographed this work to get you through QA faster, and it is usually right. It is still AI judgement, and it is not a replacement for yours: results depend on how the task was prompted and on your project, and what works reliably for us may not for you. **Treat every AI verdict below as a lead to confirm, not a sign-off.** Your verdicts are recorded, and they are what makes the next report more accurate.

Generated 2026-09-26T08:48:25-04:00 by the review chain.

**Task:** This repo is Plexar Notes, a Markdown note taker with no build step, no npm install and no CDN at runtime. Browser code lives in public/ as ES modules.  TASK: add the two third-party libraries as plain files under public/vendor/ with their licence files, and a note on how to update them.  - public/vendor/marked/marked.esm.js: the ES module build of marked (latest 15.x or newer; from the npm package lib/marked.esm.js, e.g. download https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js once with curl or PowerShell Invoke-WebRequest) plus public/vendor/marked/LICENSE.md (the marked licence, MIT, 

**Branch:** `plexar/T-493ddc2b78` · **commit:** `7fad898f40f2` · **chain result:** `LADDER_EXHAUSTED`

Record your verdict per case in `/app` (open the task, then *QA cases*), or edit *Your status* here.

## 1 · Seen by the AI: confirm what it claims to see (VISUAL)

None.

## 2 · Needs your eyes: the AI could not capture it (MANUAL)

None.

## 3 · Proven by a command (AUTO: backend smoke)

Re-runnable; these belong in the larger QA as regression checks. Spot-check any you doubt.

| ID | Section | Test | Class | AI verdict | Your status | What the AI observed | Commit | What & how to test |
|---|---|---|---|---|---|---|---|---|
| QA-1 | vendor | Gate check script exits 0 | AUTO | fail | UNCONFIRMED | exit 1: README.md is 970 bytes, below the 1000-byte minimum; all other conditions pass | 7fad898f40 | node -e (gate script) — expect: exit 0 |
| QA-2 | vendor | Libraries load and highlight/markdown work; node --test green | AUTO | pass | UNCONFIRMED | 29/29 pass; all 7 languages registered; marked renders | 7fad898f40 | node --test; node --input-type=module -e import both libs — expect: tests pass; languages present |

## The chain, hop by hop

| hop | attempt | stage | model | verdict | judgement | feedback |
|---|---|---|---|---|---|---|
| 1 | 1 | verifier | sonnet | **fail** | No vendor files, licences or README exist: public/vendor is absent and the working tree is clean. The gate's file check fails with ENOENT. | Create public/vendor/marked/{marked.esm.js,LICENSE.md} and public/vendor/highlight/{highlight.min.js,LICENSE} by downloading them from the jsDelivr URLs in the task. Check that marked.esm.js contains `export` and highlight.min.js contains `export default`, 'python' and 'sql'. Add public/vendor/README.md listing each library's version, source URL and licence. Do not add a highlight.js theme css, pa |
| 2 | 3 | verifier | sonnet | **fail** | Vendored files, licences, exports and node --test (29/29) are all fine, but the gate's node -e check exits 1 because public/vendor/README.md is 970 bytes, under the required 1000. | Expand public/vendor/README.md to at least 1000 bytes with useful content, for example the licence copyright holders, the exact pinned-version URLs, a note on how the marked and highlight.js versions were determined, and a verification command. Then re-run the gate node -e check and confirm it exits 0. |

## Evidence the reviewers recorded

**hop 1 (verifier)** `ls -R public/vendor; git status --short`

```
ls: cannot access 'public/vendor': No such file or directory; git status clean
```

**hop 1 (verifier)** `gate node -e size check on the 4 vendor files`

```
ENOENT: no such file or directory, stat public/vendor/marked/marked.esm.js
```

**hop 2 (verifier)** `node --test`

```
tests 29, pass 29, fail 0
```

**hop 2 (verifier)** `gate node -e size/content check`

```
exit code 1; only public/vendor/README.md is under 1000 bytes (970)
```

**hop 2 (verifier)** `node --input-type=module import of highlight.min.js and marked.esm.js`

```
36 languages, python/sql/bash/xml/css/json/javascript all present; marked('# hi') gives <h1>hi</h1>
```

