---
name: ARP task
about: A task for an agent to build. Keep every heading — the Definition of Ready gate reads them back.
title: ""
labels: ""
---

<!-- Every heading below answers one Definition of Ready check (`arpctl ready <n>`).
A missing heading is a failing check, and a failing check is never dispatched: the
night shift has nobody to answer a question, so a body that still needs a decision
costs a whole run. Worked example: .github/ISSUE_TEMPLATE/examples/arp-task-example.md -->

**Goal**

<!-- The outcome, written so a reader with no context can tell whether it is done.
Never "fix it properly". -->

**Context on main**

<!-- The symbols that already exist and are to be reused, one per line, with the
sha you read them at. Without this an agent reinvents what is already there.
Keep the heading on its own line: the gate reads the lines under it. -->

refined against `<sha>`

- `<Symbol>` — `<path>:<line>`

**Task block**

<!-- The facts the gate and the scope read, written once, in one strict grammar.
Nothing else in this body supplies a dependency, a file or a hotspot: prose is for
people. A line the grammar cannot read is quoted back to you.
  depends on: #<n>, #<n>  or  none
  files:  one bullet per path, `(new)` after a file the base does not have; a
          directory (`dir/`) or a glob (`dir/*.sql`) covers many; `<issue>` and
          `<yyyy-mm-dd>` are placeholders, expanded when the issue is dispatched
  touches hotspots: paths, comma-separated, or none
  tests: the acceptance tests, one per bullet
  roots: only for a nested checkout (a separate git repo inside the worktree):
         `- name: dir`, then `name:path` in files -->

```arp-task
depends on: none
files:
  - `<path>`
  - `<path>` (new)
touches hotspots: none
tests:
  - `<REQ-ID>`: `<TestName>`
```

**Steps**

<!-- The order to work in, and — more useful — the things not to do: the
conventions of this repo that are in your head and not in the code. -->

1.

**Acceptance**

<!-- One line per requirement id, each naming a real test. This is what "done"
means; an acceptance line with no test is a wish. -->

- [ ] `<REQ-ID>`: `<TestName>` — `<path to the test>`

**Out of scope**

<!-- What this issue deliberately leaves alone. This is the section that stops
the work growing past what you reviewed. -->

-

**Requires env:** none

<!-- Environment variables the work cannot be done without (a test account, an
API token), or none. Each one must be a worker.env key or a secrets.by_role
name, else the item is refused: a worker must never be spent discovering that
a credential was never configured. -->

**Migration ts:** none

<!-- The reserved timestamp or sequence number for a migration this issue adds, or none. -->

**Size:** S

<!-- S or M. An L is split before it is filed, not after an agent runs out of room. -->

**Open questions:** none

<!-- Must read none. One open question is one lost run: settle it, paste the
ruling into the body above, then set this back to none. -->
