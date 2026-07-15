---
name: write-content
description: Write article-style course content pages - textbook-replacement readings - for a Canvas course, built from learning objectives. Settles the shape first (purpose, length in reading minutes, terms, misconceptions to kill), then emits Canvas-API-ready Page JSON that validates before upload. Use when a professor wants new instructional reading material - "write the reading", "create a content page", "write the material for module N", "replace the textbook chapter on X", "write an article on Y", "my students can't afford the textbook", "something they read before lecture", "add a page explaining Z", "write remediation material for students who struggled", "give me a version they'll actually finish" - including when they describe a misconception to fix or a topic students trip on rather than saying "page" or "article". Not for copy-editing existing pages, not for writing quizzes or assignments (that is write-assessments), not for importing/exporting courses, and not for converting existing files (slides, PPTX, a textbook PDF) into pages - this authors from objectives, it does not transcribe someone else's deck.
---

# Write Course Content

Generate article-style pages that teach toward specific learning objectives and upload cleanly to Canvas as Pages.

## North Star: learning objectives

Content exists to get a student from "hasn't met the objective" to "can demonstrate it". Backward design is strict ordering: **objective → how it will be assessed → content**. Never draft prose before you know the objective and (ideally) the assessment item it feeds.

- If the professor supplies objectives, use them verbatim and assign stable IDs (`LO1`, `LO2`, …).
- If they supply only a topic, draft objectives first (one observable behavior each). **If you can ask, ask** — confirm before writing, because the whole article inherits the objectives' errors.
- **If you can't ask** (batch run, no reply coming), don't stall: draft them, write the page, and open your summary with the drafted objectives flagged as *unconfirmed — please check these first*, above the article. Surfacing beats stalling; what's forbidden is letting invented objectives pass as the professor's own.
- Every major section of the article maps to an objective; every objective is taught somewhere. The validator enforces this.

## Intake: get the shape before you write

Writing 2,000 words when they wanted a 5-minute primer wastes their review time and yours. Settle the shape first.

**Open with the goal, not a form.** Ask what they want the reading to *do* — replace a textbook chapter, pre-read before a lecture, remediation for students who struggled, a primer before a lab? That one answer implies depth, length, and tone, and it's a question they enjoy answering. Then fill remaining gaps in **one** round, not serially.

**Read before you ask.** The course is already imported. Pull the module's existing pages, terms, and prior readings and ask them to confirm — "your Module 4 page uses 'allosteric' and 'competitive inhibition'; should this build on those?" beats asking them to list vocabulary they already wrote down.

**What to settle, and what to do if they don't say:**

| Ask | Why it changes the artifact | Default if unanswered |
|---|---|---|
| **What it's for** | sets depth and tone | textbook-chapter replacement |
| **Objectives** | everything traces to them | draft from the topic, flag unconfirmed |
| **Length** | in reading minutes or pages — convert with the table below | 10 minutes (≈1,800 words) |
| **Topics and their terms** | the vocabulary the page teaches in | read from the module; confirm |
| **Preferred examples** | professors reuse examples students already know | propose your own; see below |
| **Misconceptions to kill** | the highest-value thing they know and you don't | ask — this one is worth asking even if nothing else is |
| **Source material** | transform and cite theirs over general knowledge | ask if a chapter/slides exist |

**Sizing: minutes, not word counts.** Professors budget class time, so talk in minutes and convert yourself. Students read *new academic material they're trying to learn* at roughly **180 words per minute** — not the 250–300 wpm figure people quote, which measures casual reading and doesn't apply to studying (see `references/content-design.md` for the evidence). Pick the tier by how much of the page is new to the student:

| Material | wpm | 5 min | 10 min | 20 min |
|---|---|---|---|---|
| Review / familiar, narrative | 230 | 1,150 words | 2,300 | 4,600 |
| **New material (default)** | **180** | **900 words** | **1,800** | **3,600** |
| Dense — formulas, heavy jargon, quantitative | 130 | 650 words | 1,300 | 2,600 |

If they ask in pages, a page of course prose is **≈500 words ≈ 3 minutes** at learning speed — use it to translate, then work in minutes.

Tell them the estimate in your summary ("~1,800 words, about 10 minutes"), and count the words you actually wrote rather than guessing. Overshooting the ask by 50% is a real failure: it silently blows the reading budget they planned around, and they find out from students, not from you.

**Ask what they'd correct, not what they'd write.** "What do students always get wrong here?" gets a better page than "what should I cover?" — they have years of watching people trip on the same step, and that's exactly what the Rethink and Tailor sections are for. It's also the one question they can answer instantly.

**Propose; don't just collect.** Draft two or three candidate examples or scenarios from their course material and ask which lands, rather than asking them to supply one. If the topic has an obvious sequencing dependency they didn't mention, name it. Suggesting is the job.

If no answer is coming (batch run), take the defaults, write the page, and list the assumptions at the top of your summary.

## Workflow

1. **Plan the page set.** Group objectives into pages (one concept cluster per page).

   Depth is gated by what the objective asks the student to *do with* the concept, not by the verb's dictionary tier. The test that decides it: **can the objective be met while thinking about one concept in isolation?** If yes (define, describe, identify, summarize) → a single self-contained concept page, no forced synthesis. If meeting it requires holding two or more concepts against each other (compare, analyze, evaluate, predict, critique, design) → the page needs a synthesis section with at least two labeled cross-links. Ambiguous verbs resolve by this test, not by lookup: "predict how a tax affects equilibrium price" needs supply *and* demand in play at once, so it's synthesis-level regardless of where "predict" sits on anyone's list.

   Page order follows prerequisite structure (what must be understood first), never chapter numbers — and never inferred from Bloom verbs.
2. **Write each article on the WHERETO template** (structure below).
3. **Assemble the output envelope** (schema below). Exact Canvas payload shape is in `references/canvas-page-format.md`, including the Canvas-safe HTML rules.
4. **Validate:** run `node scripts/validate-canvas-payload.mjs <output-file>` from the repo root. Fix every error and re-run until it exits 0.
5. **Present for review:** show the professor each page title, its objectives, and the article body. Never mark anything `published`.

## Article structure (WHERETO — use for every page)

Full rationale and per-letter evidence in `references/content-design.md`.

1. **Why / Where** — open with a compact **structured** orientation block, not a paragraph: a small Canvas-safe `<table>` (or a labeled "You are here" `<div>`) carrying three things — the objective(s) in plain language, the prerequisites to have covered first (linked when those pages exist), and what this page unlocks next. Structure it spatially rather than narrating it — graphic organizers substantially out-perform prose ones, by the largest margin of any technique in `references/content-design.md`, and this is the cheapest place to collect that. On a simple single-concept page a three-row table is plenty; don't manufacture a diagram where a table says it.
2. **Hook** — a question, scenario, or surprising fact that earns attention. Then a **prequestion**: the objective phrased as a question the student attempts cold ("What happens when X meets Y?" — not "you will understand X").
3. **Equip** — the core explanation, always paired with at least one fully worked, concrete example. Never pure abstract explanation. If the professor supplied source material, transform and cite it rather than generating from general knowledge.
4. **Rethink** — inline self-check questions embedded mid-article (not saved for the end), each followed by its answer in a collapsible `<details>` block. This is retrieval practice living inside the content.
5. **Evaluate** — a closing pointer to the aligned quiz/assessment (the write-assessments skill builds it). If that assessment already exists, name it. If it doesn't exist yet, keep the page body generic — "a short quiz on this material" — and put your proposed title in the review summary instead. A specific title inside the page is a promise Canvas can't keep: name a quiz that never gets created under that name and the published reading points students at nothing.
6. **Tailor** — one remediation path ("if this felt shaky, revisit …") and one extension path ("ready for more: …").
7. **Organize** — close with the page's position: what it built on, what builds on it. Label every cross-link by relationship — *prerequisite of*, *part of*, *contrasts with*, *applies to* — never a bare "see also".

For analyze-or-above objectives, add a **synthesis section** (compare/integrate across ≥2 linked concepts) before Evaluate.

## Output envelope

Write one JSON file per page set. ALWAYS use this exact envelope:

```json
{
  "artifact_type": "page",
  "title": "Photosynthesis: The Light-Dependent Reactions",
  "objectives": [
    { "id": "LO1", "text": "Describe the light-dependent reactions of photosynthesis." }
  ],
  "canvas": {
    "pages": [
      { "wiki_page": { "title": "...", "body": "<h2>...</h2>...", "published": false } }
    ]
  },
  "alignment": [
    { "page_index": 0, "objective_id": "LO1", "section": "The Light Reactions, Step by Step" }
  ]
}
```

Rules the validator enforces: non-empty HTML bodies, no `<script>`/event handlers (Canvas strips them — content would silently break), every alignment ID resolves, no orphan objectives or pages, `published` never true.

## Safety (non-negotiable, from CLAUDE.md)

- Never set `published: true` — the professor publishes after review.
- Content is a proposal until the professor accepts; when *editing* an existing page, present before→after, never a silent rewrite.
- Don't invent citations. If grounding material wasn't supplied and the topic needs factual care (dates, statistics, named studies), say so and ask rather than fabricating.
