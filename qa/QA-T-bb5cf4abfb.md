# QA — T-bb5cf4abfb

> **About this report.** The review chain ran, checked and photographed this work to get you through QA faster, and it is usually right. It is still AI judgement, and it is not a replacement for yours: results depend on how the task was prompted and on your project, and what works reliably for us may not for you. **Treat every AI verdict below as a lead to confirm, not a sign-off.** Your verdicts are recorded, and they are what makes the next report more accurate.

Generated 2026-09-26T09:13:31-04:00 by the review chain.

**Task:** This repo is Plexar Notes, a Markdown note taker. lib/ holds pure logic as ES modules (export), no DOM; lib/links.js exports parseLinks(markdown) and resolveLink(target, notePaths). tests are CommonJS under tests/ run with `node --test` (Node 24; load ESM with `await import('../lib/x.js')`). The browser will render Markdown with marked (public/vendor/marked/marked.esm.js) and highlight.js; this module prepares the Markdown and post-processes HTML strings without any DOM.  TASK: create lib/markdown.js and tests/markdown.test.js.  Exports: - `escapeHtml(s)`. - `wikiLinksToHtml(markdown, notePath

**Branch:** `plexar/T-bb5cf4abfb` · **commit:** `1f7bb129500d` · **chain result:** `approved`

Record your verdict per case in `/app` (open the task, then *QA cases*), or edit *Your status* here.

## 1 · Seen by the AI: confirm what it claims to see (VISUAL)

None.

## 2 · Needs your eyes: the AI could not capture it (MANUAL)

None.

## 3 · Proven by a command (AUTO: backend smoke)

Re-runnable; these belong in the larger QA as regression checks. Spot-check any you doubt.

| ID | Section | Test | Class | AI verdict | Your status | What the AI observed | Commit | What & how to test |
|---|---|---|---|---|---|---|---|---|
| QA-1 | lib/markdown.js | Full suite plus the new markdown tests, and edge probes of the exports | AUTO | pass | VERIFIED (chain) | 97/97 pass; probe outputs match the spec | 1f7bb12950 | node --test; node --input-type=module -e probes — expect: exit 0 and correct HTML output |

## The chain, hop by hop

| hop | attempt | stage | model | verdict | judgement | feedback |
|---|---|---|---|---|---|---|
| 1 | 1 | verifier | sonnet | **pass** | node --test exits green with 97 tests passing, and manual probes show callouts, task lists and titleFrom behaving as specified; the style check found no colour literals. |  |
| 2 | 1 | approver | opus | **approve** | All requested exports exist and behave as specified. The suite is green, and the helpers are correct on real output from the vendored marked for callouts (titled and default title), task lists and code blocks. Tests cover every requested case, with no 'vault' wording or colour literals. |  |

## Evidence the reviewers recorded

**hop 1 (verifier)** `node --test`

```
tests 97, pass 97, fail 0
```

**hop 1 (verifier)** `node --input-type=module probe of calloutsToHtml/taskListsToHtml/titleFrom`

```
callout-note with title T; callout-bug default title 'Bug'; li class 'task task-done' with disabled removed; titleFrom 'Hi'
```

**hop 1 (verifier)** `grep colour literals in lib/markdown.js`

```
no matches
```

**hop 2 (approver)** `node --test`

```
tests 97, pass 97, fail 0
```

**hop 2 (approver)** `grep lib/links.js for parseLinks fields`

```
out.push({ target, alias, heading, raw, index: m.index })
```

**hop 2 (approver)** `node /tmp/p.mjs (real marked.parse, then calloutsToHtml/taskListsToHtml/addCopyButtons)`

```
callout-note title 'Hello' body '<p>body <strong>b</strong></p>'; callout-danger default title 'Danger'; li class 'task task-done' / 'task' with disabled removed; codeblock data-lang="py" with Copy button
```

**hop 2 (approver)** `grep -ni vault and colour-literal regex on the new files`

```
no matches
```

