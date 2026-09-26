# Team

Who built Plexar Notes. Most of the team are agents running under the Plexar Framework; one is a person. The person is [[Len]].

## Roles

| Role | Who | Does |
|------|-----|------|
| Owner | [[Len]] | Writes the goal, approves the plan, gives the final verdict |
| Planner | agent | Slices the goal into tasks, each with a check |
| Builder | agent, one per task | Does the task on its own branch |
| Gate | script | Runs `node --test` and the style scan before anyone reads the code |
| Verifier | agent | Reads the diff and runs its own checks |
| Approver | agent | Reads the verifier's report and says approve or send back |

## How a task flows

1. Len writes a long-form goal.
2. The planner turns it into tasks and Len approves the plan once.
3. A builder picks up a task, works on a branch and leaves notes for the next run.
4. The gate runs the tests. Red means the task goes back.
5. The verifier and approver each write a report.
6. Len reads the reports and merges or sends it back.

The record of all of this, for every task, is in the showcase folder of the repo. The app itself is described in [[Plexar Notes]].

## Ways of working

- One task, one branch, one check.
- Tests before reviews. Reviews before merges.
- Plain words in every note, including these. See the wording rules in [[Len]].
- Anything not decided goes in [[Ideas]], anything with a date goes in [[Roadmap]].
- The week's story goes in the journal, like [[Week 39]].

## Joining

Open the folder, read [[Welcome]], then read the cheatsheet. If the renderer breaks on anything you write, that is a bug and you have already helped.
