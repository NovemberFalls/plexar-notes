# Plexar Notes

A small notes app, built end to end by agents under the
[Plexar Framework](https://github.com/NovemberFalls/plexar-framework): a long-form goal
went in, a planner sliced it into tasks with checks, a named human approved the plan once,
agents did each task on its own branch, a deterministic gate and a review chain judged the
work, and a human gave the final verdict.

    node server/server.js [folder]   # serve the app at http://localhost:3000 over a folder of .md files
    node --test                      # the tests the gate runs

The folder defaults to `sample-notes/` in the repo (created if missing); set `PORT` to use
another port. No build step and no dependencies beyond Node 24.

`showcase/` holds the record of how it was built: the goal as typed, the plan, every task's
check before and after, each reviewer's verdict, screenshots, and the framework's own logs.
