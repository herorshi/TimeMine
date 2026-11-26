<!-- wave-story template. Copy to <stories dir>/<wN>-<slug>/README.md, replace every <…>, delete
this comment. How to write it: arp_guide("story/story"), "story/voice", "story/diagrams" and
"story/checklist"; the bar: "story/example/README". Then `arpctl story init <file>` scaffolds its
test plan, try-it.md, next to it. `arpctl story check <file>` must pass before the PM reads it.
This template's prose is English; the story you write is in `stories.language` (th or en). The
headings below are the `en` strings; for `th`, use the Thai strings of the table at the end of
arp_guide("story/story"). Alt text and screen words follow the story's language. -->
# <wN> — <the wave's name, the same words the screen shows>

<2–3 sentences: when this wave ends, who can do what, by which mechanism, and what is still missing>

| **<number>** | **<number>** | **<number>** | **<number>** |
|---|---|---|---|
| <one line: what this number is> | <…> | <…> | <…> |

This page says what <wN> builds and how it is accepted; progress is on the [milestone <wN>](<milestone link>).

## What this wave is

<two short paragraphs: why this wave exists, who gains what, and what the next wave gains from it>

| Topic | Before <wN> | After <wN> |
|---|---|---|
| <what changes> | <how it is now> | <how it is when the wave ends> |

What a reader would expect to find but is not in <wN>:

| Topic | Where it is |
|---|---|
| <topic> | <the wave that has it> |

## Overview

<1–2 sentences: who uses what, and which path matters most>

![<alt text, in the story's language, describing the whole picture>](img/01-overview.svg)

*Figure 1 <where to look, and what the picture shows>*

## 1. <the first topic, in the words the screen shows>

### How it works

<the mechanism a person sees and must understand, with the real rules and numbers from the spec, a
decision or a default: what does it, who is bound by it, under what condition, and what happens on
a mistake or when something is already lost. Quote the screen's text in quotation marks. Where the
spec is silent, write "not specified yet">

<1–2 sentences that lead into the picture>

![<alt text, in the story's language, describing the whole picture>](img/02-<topic>.svg)

*Figure 2 <where to look, which branch matters, what the picture proves>*

### Acceptance scenarios

<a id="s1-<short-english-name>"></a>
#### S1 — <scenario name>

As a <who>, I want <what>, so that <why>.

**Try this**
1. <a step a person can do on the screen>

**It passes if**
- <what is seen, so that pass or fail is clear at once, in the screen's own words>

<details><summary>Requirement IDs</summary>

<the IDs from the spec, the related settings, and the decision numbers>

</details>

## 2. <the next topic>

<repeat the same shape: how it works → picture and caption → acceptance scenarios>

## <N>. <a topic the team checks itself, if any>

<scenarios an ordinary person cannot try; use T1, T2 … instead of S, and write them as the team>

## How to check

<one paragraph: which site to check on, who gives the account, what to do if the site asks for a
code, which scenario needs the dev team to simulate something, who records the result, and who
accepts the wave>

Follow the [try-it plan](try-it.md) scenario by scenario: it names the site, the test account (a
link to its vault entry), the steps, what to expect at each step, and which scenarios are on the
demo already.

<details><summary>For developers</summary>

<how to run it locally, prepare the data, and simulate the events a scenario needs>

</details>

## Definition of Done

- <the criteria for the whole wave, taken from the project's Definition of Done; invent no new rule>
