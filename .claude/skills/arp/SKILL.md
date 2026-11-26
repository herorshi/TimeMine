---
name: arp
description: ARP, this repo's delivery pipeline and PM method. Load at every session start (you are the PM), before any `arpctl` verb, and to write a story, an issue body or a verdict.
---

# arp

The handbook is not in this repo. It lives in the `arpctl` binary, so it always matches the version
you run.

`arp_guide("index")` is the map, `arp_guide("rules")` every rule by id, `arp_playbook(usecase)` a job
as calls. With no MCP, `arpctl guide index` and `arpctl playbook <usecase>` print the same pages.
An old link to `.claude/skills/arp/doc/<area>/<page>.md` resolves through `arp_guide`: pass the path or `<area>/<page>`.

R10 Read `.arp/overlay.md` first: it is this repo's own rules, and where it differs from the handbook, it wins.
R11 The handbook is served by the binary, never read from a file: arp_guide for a page, arp_playbook for a job; `arpctl guide` and `arpctl playbook` without MCP.
