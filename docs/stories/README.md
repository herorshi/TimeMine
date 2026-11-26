<!-- wave-story index. `arpctl story init` writes this as <stories dir>/README.md; replace the
<…> row with one row per wave as stories are written. -->
# Stories

A story is the page written before each wave starts. It says what the wave builds and for whom, how
each topic works, and how a person tries it to accept it. Each topic tells the mechanism first, with
its real rules and numbers, then the picture that sits beside it, then the acceptance scenarios.
A story has no status: whether the work is done is read from the wave's milestone, and each issue
points back to a scenario of the story with a `Story:` line.

| Wave | Story | Summary | Progress |
|---|---|---|---|
| <wN — the wave's name> | [<wN>-<slug>](<wN>-<slug>/README.md) | <one sentence: when the wave ends, who can do what> | [milestone <wN>](<milestone link>) |

To write the story of a new wave, copy [TEMPLATE.md](TEMPLATE.md) to `<wN>-<slug>/README.md` and
follow the story method: `arp_guide("story/story")`.

Write the try-it plan, try-it.md, at the same time: `arpctl story init <wN>-<slug>/README.md`
scaffolds it from the story's scenarios.

```
<stories dir>/
  README.md            this page: one row per wave
  TEMPLATE.md          the shared template, installed by arpctl story init
  <wN>-<slug>/
    README.md          the story of that wave
    try-it.md          the try-it plan, scenario by scenario (arpctl story init scaffolds it)
    draw.py            the script that draws this story's pictures (if you use svgkit)
    img/               SVG only, named NN-<topic>.svg in the order they appear
```
