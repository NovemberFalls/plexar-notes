# Plexar Notes

A small notes app, built end to end by agents under the
[Plexar Framework](https://github.com/NovemberFalls/plexar-framework): a long-form goal
went in, a planner sliced it into tasks with checks, a named human approved the plan once,
agents did each task on its own branch, a deterministic gate and a review chain judged the
work, and a human gave the final verdict.

    open index.html          # the app, no build step
    node --test              # the tests the gate runs

`showcase/` holds the record of how it was built: the goal as typed, the plan, every task's
check before and after, each reviewer's verdict, screenshots, and the framework's own logs.
