# QA — T-2c0884cd3b

> **About this report.** The review chain ran, checked and photographed this work to get you through QA faster, and it is usually right. It is still AI judgement, and it is not a replacement for yours: results depend on how the task was prompted and on your project, and what works reliably for us may not for you. **Treat every AI verdict below as a lead to confirm, not a sign-off.** Your verdicts are recorded, and they are what makes the next report more accurate.

Generated 2026-09-26T09:02:17-04:00 by the review chain.

**Task:** This repo is Plexar Notes, a Markdown note taker over a folder of .md files. lib/ holds pure logic as ES modules (export), no DOM; tests are CommonJS under tests/ run with `node --test` (Node 24; load ESM with `await import('../lib/x.js')`).  TASK: create lib/search.js and tests/search.test.js.  `search(query, notes, options)` where notes is `[{path, content}]` (path POSIX relative, ending .md) and options `{limit = 20}`: - Trims the query; empty query → []. - Splits the query into words; a note matches if every word appears case-insensitively in the file name (without .md), the path, or the c

**Branch:** `plexar/T-2c0884cd3b` · **commit:** `5fc7ad3ea2bf` · **chain result:** `approved`

Record your verdict per case in `/app` (open the task, then *QA cases*), or edit *Your status* here.

## 1 · Seen by the AI: confirm what it claims to see (VISUAL)

None.

## 2 · Needs your eyes: the AI could not capture it (MANUAL)

None.

## 3 · Proven by a command (AUTO: backend smoke)

Re-runnable; these belong in the larger QA as regression checks. Spot-check any you doubt.

| ID | Section | Test | Class | AI verdict | Your status | What the AI observed | Commit | What & how to test |
|---|---|---|---|---|---|---|---|---|
| QA-1 | search | Full suite and ranking spot-check | AUTO | pass | VERIFIED (chain) | Exit 0, 64 of 64 tests passed; scores 1050 > 800 > 250.5 | 5fc7ad3ea2 | node --test; node -e with search('Foo', ...) — expect: Exit 0; exact title above prefix above content |
| QA-2 | highlight | Highlight segments for 'foo' in 'a foo b Foo c' | AUTO | pass | VERIFIED (chain) | a / foo(hit) / b / Foo(hit) / c, as expected | 5fc7ad3ea2 | node -e highlight('a foo b Foo c','foo') — expect: 5 segments with the two hits marked hit: true |

## The chain, hop by hop

| hop | attempt | stage | model | verdict | judgement | feedback |
|---|---|---|---|---|---|---|
| 1 | 1 | verifier | sonnet | **pass** | The full `node --test` run exited 0 with 64 of 64 tests passing. A direct spot-check showed exact title ranking above title prefix above content, and `highlight` returned the expected segments for 'a foo b Foo c'. The code has no 'vault' wording and the style test passed. |  |
| 2 | 1 | approver | opus | **approve** | Both files do what the task asks: an empty query returns nothing, every word must match, matching ignores case, scores rank in the order the task lists, results are sorted and limited, and snippets are cut with '…'. highlight returns plain segments with no HTML. The full test suite passes, and the edge cases the verifier didn't try (nested-path titles, a hit at the end of a long line, multi-word r |  |

## Evidence the reviewers recorded

**hop 1 (verifier)** `node --test`

```
tests 64, pass 64, fail 0, EXIT 0
```

**hop 1 (verifier)** `node -e search('Foo', ...) and highlight('a foo b Foo c','foo')`

```
scores: Foo 1050, Foobar 800, c 250.5; highlight gave the 5 segments a / foo(hit) / b / Foo(hit) / c
```

**hop 1 (verifier)** `grep -n vault lib/search.js tests/search.test.js`

```
no matches
```

**hop 2 (approver)** `node --test`

```
tests 64, pass 64, fail 0
```

**hop 2 (approver)** `grep displayName lib/paths.js`

```
displayName takes the last path segment and strips a trailing .md (case-insensitive)
```

**hop 2 (approver)** `node -e search('needle', long line ending in needle + 'b/needle thing.md')`

```
[["Needle",1020.46,["140:xxxxx needle"]],["needle thing",800,[]]]
```

**hop 2 (approver)** `node -e search('Foo Bar', ...)`

```
[["foo bar",1000],["Foo Bar baz",800],["x",251]]
```

**hop 2 (approver)** `node -e highlight('Café <script>','<script>')`

```
[{"text":"Café ","hit":false},{"text":"<script>","hit":true}]
```

