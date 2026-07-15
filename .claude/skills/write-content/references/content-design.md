# Content design principles

Research-backed rules for generating article-style course pages. Distilled from Phase 0 learning-science research (finding tags F5/F6/F15/F16 reference that evidence base).

## Ordering

- **Backward design, strictly: objective → assessment → content.** Never generate content before the objective (and ideally its assessment item) exists. Content is the last artifact written, not the first (Wiggins & McTighe, F6 rule 1).
- **Page order comes from prerequisite structure, not chapter numbers.** Sequence pages by what must be understood first (topological order over prerequisite links); a circular prerequisite chain is a blocking error, not a warning. This is the strongest-validated piece of the design spec (KST/ALEKS lineage, F6 rule 5).
- **Never infer prerequisite order from Bloom verbs.** Bloom-as-hierarchy is empirically rejected for sequencing. Prerequisite edges come from actual content dependency — explicit statements in source material or instructor input — not "analyze must come after understand" (F6 rule 6).

## The WHERETO template (F6 rule 2, Wiggins & McTighe)

- **W — Why/Where:** state the objective plainly and its place in the course. Functions as the page's advance organizer. Include an explicit "Before you start" prerequisites block with real links (Gagné/KST, F6 rule 4) — never assume silently.
- **H — Hook:** earn attention before explaining (question, scenario, surprising fact).
- **E — Equip:** explanation + at least one fully worked concrete example, always. (The worked-example requirement is prescribed by the template; cognitive-load-theory citations are not in the local evidence base — treat the pairing rule as the spec, not Sweller.)
- **R — Rethink:** retrieval prompts embedded inline mid-article. Retrieval practice is the most replicated effect available (g=0.61, Adesope 2017); putting it inside content, not just quizzes, is where this template cashes it in.
- **E — Evaluate:** the linked assessment item + feedback — hand off to the write-assessments skill.
- **T — Tailor:** remediation link for students who struggled; extension link for students ready to go further.
- **O — Organize:** the page's position in the course structure — what it built on, what builds on it.

## Within-page rules

- **Prequestion every objective before its content** — the objective phrased as a question attempted cold. Effect is strong (g≈0.66, Springer 2023) but does NOT transfer to non-prequestioned material, so coverage must be complete, not sampled (F5).
- **SOLO-gate depth by what the objective requires, not by verb lookup:** if it can be met thinking about one concept alone → single self-contained page, no forced synthesis. If it requires holding two-plus concepts against each other → mandatory synthesis section with ≥2 cross-links. Don't let a high-level objective get shallow single-concept treatment (F6 rule 3). The verb is a hint; the isolation test is the rule — verbs like "predict" or "apply" land on either side depending on what's being predicted.
- **Open with a structural/visual organizer, not a bullet list.** Graphic organizers roughly out-perform text organizers (d≈1.24 vs 0.80, Luiten/Ausubel meta). In Canvas-safe HTML, a simple table or clearly structured "you are here" block beats a flat list; layout clarity matters more than completeness (F6 rule 8).
- **Label every cross-link by relationship type** — *prerequisite of*, *part of*, *contrasts with*, *applies to*. Bare auto-backlinks are argued net-harmful (F6 rule 7).
- **Close Merrill-style: Application → Integration.** Application: practice whose scaffolding fades across examples (fully worked → partially worked → learner-solved). Integration: a transfer prompt in a new context, linking outward (F6 rule 10, moderate evidence).
- **Prefer interactive map-completion over a displayed map when the medium allows** (constructing beats studying, g=0.72 vs 0.43). Canvas Pages are mostly static — render the static organizer, and note the interactive version as the stronger design when the platform supports it (F6 rule 9).

## Grounding and honesty

- **Expert-grounded content is load-bearing, not cosmetic.** The strongest AI-tutoring RCT results (0.63–1.3 SD, Kestin/Harvard) rode on pre-written, expert-vetted content — "design is the treatment" (F15). When the professor supplies material, transform and cite it; don't free-generate over it.
- **Complex material caveat:** the testing effect may shrink as material complexity rises (contested). For dense technical objectives, lean on worked examples and elaboration alongside retrieval prompts, not retrieval alone (F5 honest negatives).
- **Don't fabricate.** No invented citations, statistics, or named studies. If factual grounding is missing, ask.
