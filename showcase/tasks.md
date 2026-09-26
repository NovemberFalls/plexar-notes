# Every task

## t1 · Path guard keeps every request inside the folder

Lane **critical**, waits for —. Gate exit 0. QA file: [`qa/QA-T-2465ce0369.md`](../qa/QA-T-2465ce0369.md).

**The task's check** (must fail before, pass after):

```
node --test tests/paths.test.js
```

Before the work: exit 1. After: exit 0.

**Verifier** (sonnet), attempt 1: **pass**. lib/paths.js exports toPosix, isSafeRelative, safeJoin, isMarkdown and displayName as specified. The full `node --test` run passes 13/13, and the new tests cover every required rejected and accepted case.

**Approver** (opus), attempt 1: **approve**. lib/paths.js meets the spec: every required rejected case gives a 400 'path escapes folder' and the accepted paths resolve under the root, including backslash inputs on Windows. The full suite is green and only the two new files changed. The only quirk fails safe: '..notes.md' passes isSafeRelative but safeJoin rejects it, because the spec's literal startsWith('..') rule catches it.

---

## t2 · Tree builder sorts folders and files like Obsidian

Lane **workhorse**, waits for —. Gate exit 0. QA file: [`qa/QA-T-43b31192ab.md`](../qa/QA-T-43b31192ab.md).

**The task's check** (must fail before, pass after):

```
node --test tests/tree.test.js
```

Before the work: exit 1. After: exit 0.

**Verifier** (sonnet), attempt 1: **pass**. lib/tree.js and tests/tree.test.js meet the spec: the full suite passes 29/29 and a manual modified-desc check gave the correct order with implied folders and .md stripped.

**Approver** (opus), attempt 1: **approve**. lib/tree.js implements buildTree, flatten and findNode as specified. The tests cover every required case and the whole suite passes 29/29 with no literal colours or 'vault' in the new files.

---

## t3 · Server serves the app and lists the folder tree

Lane **critical**, waits for t1, t2. Gate exit 0. QA file: [`qa/QA-T-2b76226165.md`](../qa/QA-T-2b76226165.md).

**The task's check** (must fail before, pass after):

```
node --test tests/server.tree.test.js
```

Before the work: exit 1. After: exit 0.

**Verifier** (sonnet), attempt 1: **pass**. Full test suite passes (81/81, including the 9 server tests), and a live run served the shell and /api/tree with the correct JSON content type; layout moves and toy deletion match the task.

**Approver** (opus), attempt 1: **approve**. Every requirement is met: files moved and toy files deleted, public/ shell and server with createServer/start, all static routes and /files guarded by safeJoin, /api/tree with sort, README updated, and the tests are thorough. The full suite passes and extra Windows path-escape probes all return 400.

---

## t4 · API reads, writes, renames, moves and deletes safely

Lane **critical**, waits for t3. Gate exit 0. QA file: [`qa/QA-T-87f11f436a.md`](../qa/QA-T-87f11f436a.md).

**The task's check** (must fail before, pass after):

```
node --test tests/server.files.test.js
```

Before the work: exit 1. After: exit 0.

**Verifier** (sonnet), attempt 1: **fail**. The file and folder API works and all tests are green, but a body over 20 MB gets a connection reset (ECONNRESET / fetch failed) instead of the required 413, and no test covers it.

**Verifier** (sonnet), attempt 2: **pass**. The full `node --test` run passes (112 of 112), including the 15 new file and folder API tests. Those tests cover the path guard, round-trips, 409/404/413 statuses and root-delete refusal.

**Approver** (opus), attempt 2: **reject**. All 112 tests pass, but query paths are URL-decoded twice (in queryValue and again in requirePath). The task says they must be decoded exactly once, and the double decode makes GET/DELETE refuse real files or act on the wrong one. The tests miss it because no test path contains a '%'.

**Verifier** (sonnet), attempt 3: **pass**. I ran `node --test` myself and it passed 113 of 113. That includes the 16 new file and folder API tests and the style test. The routes, status codes, path guard, root-delete refusal and 413 behaviour match the task; the symlink check is in the code but no test exercises it.

**Approver** (opus), attempt 3: **reject**. Routes, status codes, root-delete refusal, 413 and tests match the task, but the symlink guard lets a dangling symlink inside the folder through: realpath's ENOENT is treated as 'not created yet', so PUT /api/file writes through the link to a file outside the root, which the task forbids.

**Verifier** (sonnet), attempt 1: **pass**. node --test passes 116/116 and the file API tests pass 19/19 with none skipped, covering 413, single URL-decode, symlink and dangling-link escapes, the path guard, and root-delete refusal.

**Approver** (opus), attempt 1: **approve**. All routes, status codes, the single URL-decode rule, the symlink and dangling-link guard, the 413 read-to-end, root-delete refusal and the required tests are in place. I ran the full suite myself: 116 of 116 pass, none skipped, so the symlink tests really ran on this Windows machine.

---

## t5 · Bundle marked and highlight.js as plain vendor files

Lane **workhorse**, waits for —. Gate exit 0. QA file: [`qa/QA-T-493ddc2b78.md`](../qa/QA-T-493ddc2b78.md).

**The task's check** (must fail before, pass after):

```
node -e "const f=require('fs');for(const p of ['public/vendor/marked/marked.esm.js','public/vendor/marked/LICENSE.md','public/vendor/highlight/highlight.min.js','public/vendor/highlight/LICENSE'])if(f.statSync(p).size<1000)process.exit(1)"
```

Before the work: exit 1. After: exit 0.

**Verifier** (sonnet), attempt 1: **fail**. No vendor files, licences or README exist: public/vendor is absent and the working tree is clean. The gate's file check fails with ENOENT.

**Verifier** (sonnet), attempt 3: **fail**. Vendored files, licences, exports and node --test (29/29) are all fine, but the gate's node -e check exits 1 because public/vendor/README.md is 970 bytes, under the required 1000.

**Verifier** (sonnet), attempt 1: **pass**. All five vendor files exist, marked 18.0.14 and highlight.js 11.12.0 import and work in Node with all seven required languages, and node --test passes 29/29.

**Approver** (opus), attempt 1: **approve**. All five vendor files are present with correct licences and README (marked 18.0.14, highlight.js 11.12.0), both modules import and work offline with all seven required languages, and node --test is green 29/29. The literal `export default` string is absent only because the upstream build uses the equivalent `export{Ke as default}`, which the README documents.

> Question from the worker: Every download route is denied by the permission system in this non-interactive session (curl, Invoke-WebRequest, node running a fetch script, python urllib, the WebFetch tool, and a subagent trying the same), so I cannot create public/vendor at all. Can you either add an allow rule for `curl` or `Invoke-WebRequest` to cdn.jsdelivr.net (plus `node --test`), or pre-place the four files in public/vendor/marked/ and public/vendor/highlight/ before the next run?  
> Answer (verifier (sonnet)): No permission change is needed: the four vendor files (marked 18.0.14, highlight.js 11.12.0) are already in public/vendor/ with the README, and node --test passes. Continue from there, treating the download step as done. highlight.min.js exports its default as `export{Ke as default}`, which is the same as `export default`.

---

## t6 · Sample notes folder shows off every feature

Lane **workhorse**, waits for —. Gate exit 0. QA file: [`qa/QA-T-6dc648ac34.md`](../qa/QA-T-6dc648ac34.md).

**The task's check** (must fail before, pass after):

```
node --test tests/sample-notes.test.js
```

Before the work: exit 1. After: exit 0.

**Verifier** (sonnet), attempt 1: **pass**. `node --test` runs 40 tests with 0 failures. sample-notes/ holds 13 notes, every note has a [[link]], Welcome has 12 distinct links, none contains 'vault', and assets/mark.png is byte-identical to brand/mark.png with brand/ unchanged.

**Approver** (opus), attempt 1: **approve**. All required notes, folders, syntax features, links (including [[Someday]] and the alias form), the asset copy and the test are present, and node --test is green. Nothing in the task list is missing or wrong.

---

## t7 · Wiki link parser and backlinks index

Lane **workhorse**, waits for —. Gate exit 0. QA file: [`qa/QA-T-fdc91ca67d.md`](../qa/QA-T-fdc91ca67d.md).

**The task's check** (must fail before, pass after):

```
node --test tests/links.test.js
```

Before the work: exit 1. After: exit 0.

**Verifier** (sonnet), attempt 1: **pass**. The full `node --test` run passes (53 tests, 0 failures), and a direct check confirmed `parseLinks` skips code and splits alias and heading. The new files and tests cover every case in the task.

**Approver** (opus), attempt 1: **approve**. Both modules and the test file cover every case the task lists, and the full suite is green (53/53). My spot checks confirmed that links in code are skipped, alias and heading are split out, and a target with a folder must match the whole path. The only quirks, repeated backlink entries for the same source and [[X.md]] not resolving, are in areas the spec leaves open.

---

## t8 · Search ranks file names and full text

Lane **workhorse**, waits for —. Gate exit 0. QA file: [`qa/QA-T-2c0884cd3b.md`](../qa/QA-T-2c0884cd3b.md).

**The task's check** (must fail before, pass after):

```
node --test tests/search.test.js
```

Before the work: exit 1. After: exit 0.

**Verifier** (sonnet), attempt 1: **pass**. The full `node --test` run exited 0 with 64 of 64 tests passing. A direct spot-check showed exact title ranking above title prefix above content, and `highlight` returned the expected segments for 'a foo b Foo c'. The code has no 'vault' wording and the style test passed.

**Approver** (opus), attempt 1: **approve**. Both files do what the task asks: an empty query returns nothing, every word must match, matching ignores case, scores rank in the order the task lists, results are sorted and limited, and snippets are cut with '…'. highlight returns plain segments with no HTML. The full test suite passes, and the edge cases the verifier didn't try (nested-path titles, a hit at the end of a long line, multi-word ranking, markup in highlight) also behave correctly.

---

## t9 · Word and character count

Lane **mundane**, waits for —. Gate exit 0. QA file: [`qa/QA-T-8804c6f630.md`](../qa/QA-T-8804c6f630.md).

**The task's check** (must fail before, pass after):

```
node --test tests/words.test.js
```

Before the work: exit 1. After: exit 0.

**Verifier** (sonnet), attempt 1: **pass**. Full `node --test` passes 75/75 and my direct spot checks of countWords and stats match the spec (wiki alias, apostrophe/hyphen words, link text without URL, fences, empty input).

**Approver** (opus), attempt 1: **approve**. The code and tests cover every item in the task, and each test traces correctly by hand. The style-test colour pattern doesn't match anything in lib/words.js. I couldn't run node here (denied), so the 75/75 result is the verifier's alone.

---

## t10 · Markdown pre-processor for callouts, wiki links and tasks

Lane **workhorse**, waits for t7. Gate exit 0. QA file: [`qa/QA-T-bb5cf4abfb.md`](../qa/QA-T-bb5cf4abfb.md).

**The task's check** (must fail before, pass after):

```
node --test tests/markdown.test.js
```

Before the work: exit 1. After: exit 0.

**Verifier** (sonnet), attempt 1: **pass**. node --test exits green with 97 tests passing, and manual probes show callouts, task lists and titleFrom behaving as specified; the style check found no colour literals.

**Approver** (opus), attempt 1: **approve**. All requested exports exist and behave as specified. The suite is green, and the helpers are correct on real output from the vendored marked for callouts (titled and default title), task lists and code blocks. Tests cover every requested case, with no 'vault' wording or colour literals.

---

## t11 · App shell: ribbon, explorer tree, tabs, status bar

Lane **workhorse**, waits for t3, t2. Gate exit 0. QA file: [`qa/QA-T-d8a22268fd.md`](../qa/QA-T-d8a22268fd.md).

**The task's check** (must fail before, pass after):

```
node --test tests/ui.shell.test.js
```

Before the work: exit 1. After: exit 0.

**Verifier** (sonnet), attempt 1: **pass**. The shell works in a real browser: layout, tree, tabs, sort, resize clamp, reload persistence, shortcuts and ribbon toggle all passed asserts with no console errors or bad responses, and node --test is green.

**Approver** (opus), attempt 1: **approve**. All shell regions, modules, the tree's keyboard and persistence behaviour, tabs, history and the style rules are implemented as specified; the tests are green and every referenced asset is served with 200.

---

## t12 · Reading view renders Markdown with code highlighting

Lane **workhorse**, waits for t11, t5, t10, t4. Gate exit 0. QA file: [`qa/QA-T-f998b4030c.md`](../qa/QA-T-f998b4030c.md).

**The task's check** (must fail before, pass after):

```
node --test tests/ui.reading.test.js
```

Before the work: exit 1. After: exit 0.

**Verifier** (sonnet), attempt 1: **pass**. The reading view works when run: code samples, the Plexar Notes note, callouts, tasks, missing-wikilink confirm and create, sanitising, and image and heading rewrites all behaved as specified. `node --test` passes with 128 tests and no page errors in the browser runs. Ctrl+click on a wikilink was not confirmed, and the before-task screenshot was not captured.

**Approver** (opus), attempt 1: **approve**. The change covers every requirement and `node --test` passes 128/128 when I re-ran it. The verifier did not confirm Ctrl+click; the code shows it opens the note in a new tab without switching, because the current tab always has a note open when a link is clicked and only the tab list is saved. The callout icon and Copy button string matches line up with lib/markdown.js output.

---

## t13 · Edit mode with autosave and saved indicator

Lane **workhorse**, waits for t12, t9. Gate exit 0. QA file: [`qa/QA-T-6625425210.md`](../qa/QA-T-6625425210.md).

**The task's check** (must fail before, pass after):

```
node --test tests/autosave.test.js
```

Before the work: exit 1. After: exit 0.

**Verifier** (sonnet), attempt 1: **pass**. node --test is green (141/141), and the Playwright run confirmed Ctrl+E toggling, Tab inserting two spaces, autosave to disk, Ctrl+S, the word count, the Saved/Unsaved indicator, and New-note creation opening in edit mode.

**Approver** (opus), attempt 1: **approve**. All four parts of the task are implemented and match the spec, `node --test` passes 141/141 when I ran it, and the server's existing POST /api/file makes the New note flow work. The browser screenshots show edit mode, the saved indicator and the New note prompt in the Plexar tokens.

---

## t14 · Search dropdown finds names and full text

Lane **workhorse**, waits for t13, t8. Gate exit 0. QA file: [`qa/QA-T-3f1c88a550.md`](../qa/QA-T-3f1c88a550.md).

**The task's check** (must fail before, pass after):

```
node --test tests/server.search.test.js
```

Before the work: exit 1. After: exit 0.

**Verifier** (sonnet), attempt 1: **fail**. `node --test` still exits 1: the worker's own UI test rejects the word 'innerHTML' in a comment at public/js/search.js:4. The code does not use innerHTML, but the gate is red.

**Verifier** (sonnet), attempt 2: **pass**. node --test passes (154/154) and a Playwright run against a copy of sample-notes confirmed the dropdown, both modes, keyboard and mouse handling, No results, Enter-to-open and the ribbon Search icon.

**Approver** (opus), attempt 2: **approve**. All tests pass. The live endpoint on sample-notes ranks title matches first for 'table' and 'roadmap', with line numbers and snippets. Every colour variable the new CSS uses is defined, and the screenshot shows the dropdown built as the task asks.

---

## t15 · Explorer actions: new, rename, move, delete, open folder

Lane **critical**, waits for t14. Gate exit 0. QA file: [`qa/QA-T-1acfb3b4db.md`](../qa/QA-T-1acfb3b4db.md).

**The task's check** (must fail before, pass after):

```
node --test tests/server.open-folder.test.js
```

Before the work: exit 1. After: exit 0.

**Verifier** (sonnet), attempt 1: **fail**. With nothing selected, New note and New folder target the first folder in the tree (focus is mistaken for selection) instead of the root, which breaks item 2. Rename, move, delete and the picker were not exercised in a browser because the run stopped at this failure.

**Verifier** (sonnet), attempt 2: **pass**. node --test is green (159/159) and a Playwright drive of the real app passed for new note, new folder, sort, rename, move, delete, Escape, open folder and settings, with no page errors or native dialogs.

**Approver** (opus), attempt 2: **approve**. The server's open-folder routes meet the spec (absolute existing directory or 400, root switch, search cache cleared, folder listing with parent and no hidden entries) and are covered by the new test file. The in-app menu, dialogs and picker were exercised in a real browser with screenshots, and node --test is green.

---

## t16 · Backlinks count and panel in the status bar

Lane **workhorse**, waits for t15, t7. Gate exit 0. QA file: [`qa/QA-T-0c092d2efd.md`](../qa/QA-T-0c092d2efd.md).

**The task's check** (must fail before, pass after):

```
node --test tests/server.backlinks.test.js
```

Before the work: exit 1. After: exit 0.

**Verifier** (sonnet), attempt 1: **pass**. Full suite passes (164/164), the new API tests pass, and a headless browser run against sample-notes confirmed the count, the docked panel, accent link text, opening a source note, Escape and toggle closing, and the active button state. The empty state was not exercised in the browser.

**Approver** (opus), attempt 1: **approve**. The endpoint, index rebuild on cache change, 404/400 handling, tests and the status-bar button/panel (title, empty state, accent link text, click-to-open, Escape/toggle close, active state, refresh on open/save/rename) all match the task, and the tests I re-ran pass. Remaining nits (a failed request leaves the old count; Escape in other widgets may also close the panel) are minor.

---

## t17 · Starred notes and settings panels

Lane **workhorse**, waits for t16. Gate exit 0. QA file: [`qa/QA-T-ca1c0c0b69.md`](../qa/QA-T-ca1c0c0b69.md).

**The task's check** (must fail before, pass after):

```
node --test tests/ui.panels.test.js
```

Before the work: exit 1. After: exit 0.

**Verifier** (sonnet), attempt 1: **fail**. Starring, the Starred panel, the settings dialog and the tooltips work in the browser, but 'Show file extensions in the tree' has no visible effect: the server already strips .md from tree names, so the tree never shows extensions.

**Verifier** (sonnet), attempt 2: **pass**. node --test is green (172/172) and a real Playwright run confirmed starring, the Starred panel, the settings dialog with immediate and persistent settings, and data-tip tooltips.

**Approver** (opus), attempt 2: **approve**. All four parts of the task are in the code. `node --test` passes 172/172 when I run it, and the screenshots show the starred panel (folder paths dimmed, filled accent star) and the settings dialog with every required option plus the About line. No icon button relies on `title` any more; the ones left are on non-icon elements, and 'vault' does not appear anywhere under `public/`.

---

## t18 · README describes the folder-based app

Lane **mundane**, waits for t17. Gate exit 0. QA file: [`qa/QA-T-848c09c5d1.md`](../qa/QA-T-848c09c5d1.md).

**The task's check** (must fail before, pass after):

```
node -e "const r=require('fs').readFileSync('README.md','utf8');for(const s of ['node server/server.js','sample-notes','Ctrl+E','Ctrl+P','open folder','public/vendor'])if(!r.includes(s))process.exit(1);if(/vault/i.test(r))process.exit(1)"
```

Before the work: exit 1. After: exit 0.

**Verifier** (sonnet), attempt 1: **pass**. README.md covers every requested section, and every path and shortcut it names exists in the repo. There is no 'vault', `node --test` passes with 172 tests and 0 failures, and the dropped `showcase/` paragraph was correctly removed because no such folder exists.

**Approver** (opus), attempt 1: **reject**. The README is accurate almost everywhere: shortcuts, paths, licences, settings and the style test description all check out. But the required 'how to open folder' section puts the button at the top of the explorer, and it is actually in the explorer's footer.

**Verifier** (sonnet), attempt 2: **pass**. README covers every requested section, and every path, shortcut and handler it names exists (checked by grep and ls). The stale showcase/ paragraph was correctly replaced, 'vault' is absent, and node --test passes with 172 tests.

**Approver** (opus), attempt 2: **approve**. The README covers every requested section in sentence case and without the word 'vault'. Each shortcut, path, the open-folder button, the right-click actions, Ctrl-click to open a background tab, the PORT/default-folder behaviour and the style-test rules match the code, and node --test is green. The only gap is that the style test also skips qa/, tests/, notes, .plexar and node_modules, and exempts the tokens file by name, so 'anywhere outside' is a bit broader than what the test checks. The wording still matches what the task asked for.
