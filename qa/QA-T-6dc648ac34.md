# QA — T-6dc648ac34

> **About this report.** The review chain ran, checked and photographed this work to get you through QA faster, and it is usually right. It is still AI judgement, and it is not a replacement for yours: results depend on how the task was prompted and on your project, and what works reliably for us may not for you. **Treat every AI verdict below as a lead to confirm, not a sign-off.** Your verdicts are recorded, and they are what makes the next report more accurate.

Generated 2026-09-26T08:56:14-04:00 by the review chain.

**Task:** This repo is Plexar Notes, a desktop-style Markdown note taker for a folder of .md files. The server will default to serving sample-notes/ at the repo root. Tests run with `node --test` (Node 24, CommonJS under tests/).  TASK: create sample-notes/, a demo folder, and tests/sample-notes.test.js that checks it.  Contents (at least 12 .md notes, real and readable, written as if by a Plexar team member; sentence-case titles; each note starts with a `# Title` line matching its file name): - Top level: 'Welcome.md' (explains the app, links to most others with [[Note name]] links, includes a task lis

**Branch:** `plexar/T-6dc648ac34` · **commit:** `36b14949112b` · **chain result:** `approved`

Record your verdict per case in `/app` (open the task, then *QA cases*), or edit *Your status* here.

## 1 · Seen by the AI: confirm what it claims to see (VISUAL)

None.

## 2 · Needs your eyes: the AI could not capture it (MANUAL)

None.

## 3 · Proven by a command (AUTO: backend smoke)

Re-runnable; these belong in the larger QA as regression checks. Spot-check any you doubt.

| ID | Section | Test | Class | AI verdict | Your status | What the AI observed | Commit | What & how to test |
|---|---|---|---|---|---|---|---|---|
| QA-1 | tests | Full suite is green | AUTO | pass | VERIFIED (chain) | 40 pass, 0 fail | 36b1494911 | node --test — expect: exit 0, 0 failures |
| QA-2 | content | At least 12 notes, every note links to another, Welcome has 6+ links, no 'vault', png is a copy of brand/mark.png | AUTO | pass | VERIFIED (chain) | 13 notes, no NOLINK output, 12 distinct links in Welcome, no vault matches, cmp printed same | 36b1494911 | shell checks: ls with wc -l; grep for [[ in each note; grep -o on Welcome.md; grep -rli vault; cmp — expect: 13 notes, no NOLINK, 12 links in Welcome, no vault matches, files identical |

## The chain, hop by hop

| hop | attempt | stage | model | verdict | judgement | feedback |
|---|---|---|---|---|---|---|
| 1 | 1 | verifier | sonnet | **pass** | `node --test` runs 40 tests with 0 failures. sample-notes/ holds 13 notes, every note has a [[link]], Welcome has 12 distinct links, none contains 'vault', and assets/mark.png is byte-identical to brand/mark.png with brand/ unchanged. |  |
| 2 | 1 | approver | opus | **approve** | All required notes, folders, syntax features, links (including [[Someday]] and the alias form), the asset copy and the test are present, and node --test is green. Nothing in the task list is missing or wrong. |  |

## Evidence the reviewers recorded

**hop 1 (verifier)** `node --test | tail`

```
tests 40, pass 40, fail 0
```

**hop 1 (verifier)** `cmp brand/mark.png sample-notes/assets/mark.png`

```
same
```

**hop 1 (verifier)** `grep -rli vault sample-notes`

```
no matches
```

**hop 1 (verifier)** `count .md files; check each for [[; count distinct Welcome links`

```
13 notes; no NOLINK output; 12 distinct links in Welcome
```

**hop 2 (approver)** `node --test 2>&1 | tail -8`

```
tests 40, pass 40, fail 0
```

**hop 2 (approver)** `cmp brand/mark.png sample-notes/assets/mark.png && echo same`

```
same
```

**hop 2 (approver)** `git status --short; git diff main --stat -- brand`

```
no output (clean, brand/ unchanged)
```

**hop 2 (approver)** `grep -rli vault sample-notes tests/sample-notes.test.js`

```
tests/sample-notes.test.js only (the assertion itself); no notes match
```

**hop 2 (approver)** `find sample-notes -name '*.md' | wc -l; per-file grep for [[`

```
13; no NOLINK lines
```

**hop 2 (approver)** `grep -c '^    - ' 'sample-notes/Projects/Plexar Notes.md'`

```
6 (third-level bullets present)
```

