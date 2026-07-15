---
name: write-content
description: Write article-style course content pages (textbook-replacement readings) for a Canvas course from learning objectives. Produces Canvas-API-ready Page JSON that validates before upload. Use when the professor asks to "write an article", "create a reading", "add a content page", "write the material for module N", "replace the textbook chapter on X", or any request to generate new instructional content — even if they don't say "page".
---

# Write Course Content

Generate article-style pages that teach toward specific learning objectives and upload cleanly to Canvas as Pages.

## North Star: learning objectives

Content exists to get a student from "hasn't met the objective" to "can demonstrate it". Backward design is strict ordering: **objective → how it will be assessed → content**. Never draft prose before you know the objective and (ideally) the assessment item it feeds.

- If the professor supplies objectives, use them verbatim and assign stable IDs (`LO1`, `LO2`, …).
- If they supply only a topic, draft objectives first (one observable behavior each), confirm with the professor, then write.
- Every major section of the article maps to an objective; every objective is taught somewhere. The validator enforces this.

## Inputs

| Input | Required | Notes |
|---|---|---|
| Learning objectives | yes (or derivable from a topic) | one observable verb each |
| Module / course context | no | imported pages, terms, prerequisite pages to link |
| Length / depth guidance | no | default: one page per coherent objective cluster, 800–1500 words |
| Source material | no | professor-supplied text to transform — prefer it over general knowledge, and cite it |

## Workflow

1. **Plan the page set.** Group objectives into pages (one concept cluster per page). Depth is SOLO-gated by the objective's verb: remember/understand verbs → a single self-contained concept page; analyze-or-above verbs → the page must include a synthesis section with at least two labeled cross-links to related pages. Page order follows prerequisite structure (what must be understood first), never chapter numbers — and never inferred from Bloom verbs.
2. **Write each article on the WHERETO template** (structure below).
3. **Assemble the output envelope** (schema below). Exact Canvas payload shape is in `references/canvas-page-format.md`, including the Canvas-safe HTML rules.
4. **Validate:** run `node scripts/validate-canvas-payload.mjs <output-file>` from the repo root. Fix every error and re-run until it exits 0.
5. **Present for review:** show the professor each page title, its objectives, and the article body. Never mark anything `published`.

## Article structure (WHERETO — use for every page)

Full rationale and per-letter evidence in `references/content-design.md`.

1. **Why / Where** — open by stating the objective(s) plainly and where this page sits in the course: a short "Before you start" block listing prerequisite pages (as links when they exist), and what this page unlocks next.
2. **Hook** — a question, scenario, or surprising fact that earns attention. Then a **prequestion**: the objective phrased as a question the student attempts cold ("What happens when X meets Y?" — not "you will understand X").
3. **Equip** — the core explanation, always paired with at least one fully worked, concrete example. Never pure abstract explanation. If the professor supplied source material, transform and cite it rather than generating from general knowledge.
4. **Rethink** — inline self-check questions embedded mid-article (not saved for the end), each followed by its answer in a collapsible `<details>` block. This is retrieval practice living inside the content.
5. **Evaluate** — a closing pointer to the aligned quiz/assessment (hand off to the write-assessments skill; reference it by title if it exists).
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
