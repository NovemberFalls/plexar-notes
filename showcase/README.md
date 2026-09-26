# How Plexar Notes was built

Plexar Notes was built end to end by agents under [Plexar Framework](https://github.com/NovemberFalls/plexar-framework).
Nobody wrote its code by hand. This folder is the record of how, taken from the framework's own logs.

1. **A goal went in** ([goal.md](goal.md)), a few paragraphs describing an Obsidian-style note taker.
2. **A planner sliced it** into 18 tasks, each with a lane (how hard or risky it is, which picks the model),
   what it waits for, and a check: a command that must fail before the task and pass after it.
3. **A named person approved the plan once.**
4. **Agents did each task on its own branch**, in dependency order. After each one, the repository's tests
   (the gate) and the task's check ran.
5. **A review chain judged every task:** a verifier ran the work in a real browser and took screenshots,
   then an approver read the evidence and approved it or sent it back.
6. **A final review** checked the whole plan against the goal: **approve**. Every planned area is present and joined up: the path guard, tree, links, backlinks, search, word count and autosave modules; a standard-library server with the file and folder API and open folder; and an Obsidian-style UI with ribbon, explorer, tabs, top-centre search, reading and edit views, and a status bar. The full node --test suite (172 tests, including tests/style.test.js) passes on the plan branch. marked and highlight.js are vendored with their licences, 13 linked sample notes are included, and 'vault' does not appear in the app or README.
7. **A person tried the result** and accepted it.

| Task | What | Lane | Waits for | Check before → after | Reviews |
|---|---|---|---|---|---|
| t1 | Path guard keeps every request inside the folder | critical | — | fail → pass | verifier pass, approver approve |
| t2 | Tree builder sorts folders and files like Obsidian | workhorse | — | fail → pass | verifier pass, approver approve |
| t3 | Server serves the app and lists the folder tree | critical | t1, t2 | fail → pass | verifier pass, approver approve |
| t4 | API reads, writes, renames, moves and deletes safely | critical | t3 | fail → pass | verifier fail, verifier pass, approver reject, verifier pass, approver reject, verifier pass, approver approve |
| t5 | Bundle marked and highlight.js as plain vendor files | workhorse | — | fail → pass | verifier fail, verifier fail, verifier pass, approver approve |
| t6 | Sample notes folder shows off every feature | workhorse | — | fail → pass | verifier pass, approver approve |
| t7 | Wiki link parser and backlinks index | workhorse | — | fail → pass | verifier pass, approver approve |
| t8 | Search ranks file names and full text | workhorse | — | fail → pass | verifier pass, approver approve |
| t9 | Word and character count | mundane | — | fail → pass | verifier pass, approver approve |
| t10 | Markdown pre-processor for callouts, wiki links and tasks | workhorse | t7 | fail → pass | verifier pass, approver approve |
| t11 | App shell: ribbon, explorer tree, tabs, status bar | workhorse | t3, t2 | fail → pass | verifier pass, approver approve |
| t12 | Reading view renders Markdown with code highlighting | workhorse | t11, t5, t10, t4 | fail → pass | verifier pass, approver approve |
| t13 | Edit mode with autosave and saved indicator | workhorse | t12, t9 | fail → pass | verifier pass, approver approve |
| t14 | Search dropdown finds names and full text | workhorse | t13, t8 | fail → pass | verifier fail, verifier pass, approver approve |
| t15 | Explorer actions: new, rename, move, delete, open folder | critical | t14 | fail → pass | verifier fail, verifier pass, approver approve |
| t16 | Backlinks count and panel in the status bar | workhorse | t15, t7 | fail → pass | verifier pass, approver approve |
| t17 | Starred notes and settings panels | workhorse | t16 | fail → pass | verifier fail, verifier pass, approver approve |
| t18 | README describes the folder-based app | mundane | t17 | fail → pass | verifier pass, approver reject, verifier pass, approver approve |

Every task's evidence (screenshots and the scripts that took them) is in [`../qa/`](../qa/), and
[tasks.md](tasks.md) has each task's check, verdicts, and any question an agent asked on the way.
