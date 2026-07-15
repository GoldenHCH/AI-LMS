---
name: write-content
description: Write article-style course content pages (textbook-replacement readings) for a Canvas course from learning objectives. Produces Canvas-API-ready Page JSON that validates before upload. Use when the professor asks to "write an article", "create a reading", "add a content page", "write the material for module N", "replace the textbook chapter on X", or any request to generate new instructional content — even if they don't say "page".
---

# Write Course Content

Generate article-style pages that teach toward specific learning objectives and upload cleanly to Canvas as Pages.

## North Star: learning objectives

Content exists to get a student from "hasn't met the objective" to "can demonstrate it". Backward design is strict ordering: **objective → how it will be assessed → content**. Never draft prose before you know the objective and (ideally) the assessment item it feeds.

- If the professor supplies objectives, use them verbatim and assign stable IDs (`LO1`, `LO2`, …).
- If they supply only a topic, draft objectives first (one observable behavior each). **If you can ask, ask** — confirm before writing, because the whole article inherits the objectives' errors.
- **If you can't ask** (batch run, no reply coming), don't stall: draft them, write the page, and open your summary with the drafted objectives flagged as *unconfirmed — please check these first*, above the article. Surfacing beats stalling; what's forbidden is letting invented objectives pass as the professor's own.
- Every major section of the article maps to an objective; every objective is taught somewhere. The validator enforces this.

## Inputs

| Input | Required | Notes |
|---|---|---|
| Learning objectives | yes (or derivable from a topic) | one observable verb each |
| Module / course context | no | imported pages, terms, prerequisite pages to link |
| Length / depth guidance | no | default: one page per coherent objective cluster, 800–1500 words |
| Source material | no | professor-supplied text to transform — prefer it over general knowledge, and cite it |

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

1. **Why / Where** — open with a compact **structured** orientation block, not a paragraph: a small Canvas-safe `<table>` (or a labeled "You are here" `<div>`) carrying three things — the objective(s) in plain language, the prerequisites to have covered first (linked when those pages exist), and what this page unlocks next. Structure it spatially rather than narrating it: graphic organizers substantially out-perform prose ones (d≈1.24 vs 0.80 — the largest effect in the research base, see `references/content-design.md`), and this is the cheapest place to collect it. On a simple single-concept page a three-row table is plenty; don't manufacture a diagram where a table says it.
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
