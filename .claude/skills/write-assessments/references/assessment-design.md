# Assessment design principles

Research-backed rules for generating quiz items and assignments. Distilled from Phase 0 learning-science research (finding tags F5/F6/F15/F16 reference that evidence base). Follow these at generation time; the SKILL.md workflow tells you when.

## Alignment (the load-bearing rule)

- **One item ↔ one objective, Bloom-verb matched.** Every item tags exactly one learning objective — never zero, never several. The item's cognitive operation must match the objective's verb: a "list" objective gets a recall item; an "analyze" objective gets an item that requires analysis, not recall of an analysis's conclusion. This is constructive alignment (Biggs) — the product's core bet (F6).
- **Bloom verbs are for matching, never for sequencing or difficulty.** Bloom-as-hierarchy is empirically rejected; only a relaxed ordering survives. Use the verb to pick cognitive *demand*, not to decide which items come first or which are "harder" (F6, PMC9727608).
- **Cover every objective — no sampling.** The prequestion benefit (g≈0.66) does not spill over to untested material, so an objective with no items gets nothing (F5). The validator enforces no-orphan-objectives.

## Item writing

- **Distractors are near-misses from the course's own vocabulary.** The researched method traverses the concept graph to adjacent nodes — common misconceptions, confusable prerequisites, near-miss terms (F6). Without a graph, draw distractors from the same module's topics/terms list — never invent plausible-sounding answers from outside the course's vocabulary. All options grammatically parallel, similar length; no "all of the above".
- **Explanatory feedback on every option, never bare correct/incorrect.** Feedback nearly doubles the retrieval-practice effect (g=0.73 vs 0.39, Rowland 2014) and is the cheapest high-leverage addition an LLM can make (F5/F15). For each option — correct and each distractor — write one line: why it's right, or which misconception it reflects.
- **Counter the easiness bias.** A 2026 IRT field study (91 courses) found LLM items match or beat human items on discrimination and reliability but skew easier (F5). Include at least one application-level item per objective — a scenario, calculation, or transfer task — not just recognition MCQs.
- **Multiple retrieval opportunities per objective.** Retrieval practice is the most replicated effect in the evidence base (g=0.61, Adesope 2017). Default to 2+ items per objective so items can be reused across spaced review; the objective tag is what lets a scheduler resurface them later.
- **Stems are self-contained.** A student who mastered the objective should be able to answer from the stem before reading the options. Avoid negatives in stems; if unavoidable, bold the negation.
- **Prequestions phrase the objective as a question to attempt cold.** "Students will understand X" → bad prequestion. "What happens when X interacts with Y?" → good. Use for pre-check quizzes ahead of a unit, one per objective (F5).

## Assignments and rubrics

- **Rubric criteria map 1:1 to objectives.** Each criterion row traces to a specific objective or an explicit sub-skill of one. Don't add generic criteria ("writing quality") unless the objective set includes one (F6, constructive alignment extended to graded work).
- **Criterion levels describe observable behavior.** Note: the local research supports only the alignment rule; specific rating-level phrasing mechanics are convention, not cited evidence. Name what a response at each level demonstrably does, not adjectives ("thorough" → "identifies all three factors and explains their interaction").

## Honest limits (don't oversell)

- Objective-anchored generation beating text-anchored generation is the product's hypothesis, not proven — no head-to-head study exists (F5/F16). Don't claim it in professor-facing copy; the edit-rate telemetry is the proof.
- Mastery-gating effects are real but modest (d≈0.4–0.6, concentrated in weaker students; modern replications mixed). Trigger remediation on demonstrated struggle; don't gate all progress behind thresholds.
- The verb→question-format mapping in SKILL.md is a sensible heuristic, not researched fact — only the general verb-matching rule is evidence-backed.
