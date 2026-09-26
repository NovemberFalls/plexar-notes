# QA — T-fdc91ca67d

> **About this report.** The review chain ran, checked and photographed this work to get you through QA faster, and it is usually right. It is still AI judgement, and it is not a replacement for yours: results depend on how the task was prompted and on your project, and what works reliably for us may not for you. **Treat every AI verdict below as a lead to confirm, not a sign-off.** Your verdicts are recorded, and they are what makes the next report more accurate.

Generated 2026-09-26T08:59:25-04:00 by the review chain.

**Task:** This repo is Plexar Notes, a Markdown note taker over a folder of .md files. lib/ holds pure logic as ES modules (export), no DOM; tests are CommonJS under tests/ run with `node --test` (Node 24; load ESM with `await import('../lib/x.js')`).  TASK: create lib/links.js and lib/backlinks.js with tests/links.test.js.  lib/links.js: - `parseLinks(markdown)` → array of `{target, alias, raw, index}` for every [[Target]] and [[Target|alias]] occurrence, ignoring ones inside fenced code blocks (``` ... ```) and inline code (`...`). target is trimmed; a '#heading' suffix is stripped into `heading`. Emp

**Branch:** `plexar/T-fdc91ca67d` · **commit:** `15b9733af1e1` · **chain result:** `approved`

Record your verdict per case in `/app` (open the task, then *QA cases*), or edit *Your status* here.

## 1 · Seen by the AI: confirm what it claims to see (VISUAL)

None.

## 2 · Needs your eyes: the AI could not capture it (MANUAL)

None.

## 3 · Proven by a command (AUTO: backend smoke)

Re-runnable; these belong in the larger QA as regression checks. Spot-check any you doubt.

| ID | Section | Test | Class | AI verdict | Your status | What the AI observed | Commit | What & how to test |
|---|---|---|---|---|---|---|---|---|
| QA-1 | links | The full test suite is green, including style.test.js and the new links tests | AUTO | pass | VERIFIED (chain) | 53 pass, 0 fail | 15b9733af1 | node --test — expect: exit 0, no failures |
| QA-2 | links | parseLinks ignores code, splits alias and heading | AUTO | pass | VERIFIED (chain) | only X (alias al, heading h) and Y returned | 15b9733af1 | node -e with a sample string — expect: only the non-code links are returned, with alias and heading parsed |

## The chain, hop by hop

| hop | attempt | stage | model | verdict | judgement | feedback |
|---|---|---|---|---|---|---|
| 1 | 1 | verifier | sonnet | **pass** | The full `node --test` run passes (53 tests, 0 failures), and a direct check confirmed `parseLinks` skips code and splits alias and heading. The new files and tests cover every case in the task. |  |
| 2 | 1 | approver | opus | **approve** | Both modules and the test file cover every case the task lists, and the full suite is green (53/53). My spot checks confirmed that links in code are skipped, alias and heading are split out, and a target with a folder must match the whole path. The only quirks, repeated backlink entries for the same source and [[X.md]] not resolving, are in areas the spec leaves open. |  |

## Evidence the reviewers recorded

**hop 1 (verifier)** `node --test`

```
tests 53, pass 53, fail 0
```

**hop 1 (verifier)** `node -e parseLinks on text mixing alias/heading, inline code and a fenced block`

```
only X (alias al, heading h) and Y returned; code links ignored
```

**hop 1 (verifier)** `sed -n 55,62p lib/paths.js`

```
displayName strips the .md from the last path segment, so backlinksFor titles are correct
```

**hop 2 (approver)** `node --test | tail`

```
tests 53, pass 53, fail 0
```

**hop 2 (approver)** `grep -rni vault lib/links.js lib/backlinks.js tests/links.test.js; git status --short`

```
no output (no 'vault', clean tree)
```

**hop 2 (approver)** `node -e parseLinks("a [[X]]\n```\n[[H]]\n```\nb [[Y]] `x` [[Z|z]]")`

```
[X, Y, Z(alias z)] with correct indexes 2, 24, 34; H in fence ignored
```

**hop 2 (approver)** `node -e resolveLink('sub/plan', ['a/sub/plan.md','sub/Plan.md']); resolveLink('Plan.md',['Plan.md'])`

```
sub/Plan.md null
```

**hop 2 (approver)** `node -e buildIndex A='[[B]] [[B]]' then backlinksFor B`

```
two identical entries {from:A.md,title:A,context:'[[B]] [[B]]'}: one per occurrence, acceptable under spec
```

