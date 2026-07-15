// Tests for the authoring-skill payload validator.
// Two halves: the shipped examples must pass, and every rule must FAIL when broken.
// The mutation half is the important one — a validator that never rejects is worse
// than no validator, because it manufactures false confidence before a Canvas upload.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { validate } from "../scripts/validate-canvas-payload.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const skills = join(repoRoot, ".claude", "skills");

const load = (path) => JSON.parse(readFileSync(join(skills, path), "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));

const QUIZ = load("write-assessments/references/example-quiz.json");
const ASSIGNMENT = load("write-assessments/references/example-assignment.json");
const PAGE = load("write-content/references/example-page.json");

// Asserts the mutation is rejected AND that the message points at the real problem —
// otherwise a rule can "pass" its test via an unrelated error.
function rejects(envelope, expected) {
  const errors = validate(envelope);
  assert.ok(errors.length > 0, "expected validation to fail, but it passed");
  assert.ok(
    errors.some((error) => error.includes(expected)),
    `expected an error mentioning "${expected}", got:\n${errors.join("\n")}`,
  );
}

// --- The shipped examples are the skills' worked references. If they don't
// --- validate, the skill is teaching Claude to emit invalid payloads.

test("example quiz validates", () => {
  assert.deepEqual(validate(QUIZ), []);
});

test("example assignment validates", () => {
  assert.deepEqual(validate(ASSIGNMENT), []);
});

test("example page validates", () => {
  assert.deepEqual(validate(PAGE), []);
});

// --- Envelope basics

test("rejects an unknown artifact_type", () => {
  const bad = clone(QUIZ);
  bad.artifact_type = "flashcards";
  rejects(bad, "artifact_type");
});

test("rejects a non-object envelope", () => {
  assert.ok(validate("not an envelope").length > 0);
  assert.ok(validate([]).length > 0);
  assert.ok(validate(null).length > 0);
});

// --- Learning objectives: the North Star. These rules are the product's differentiator,
// --- so they get the same enforcement weight as Canvas's own schema.

test("rejects an artifact with no objectives", () => {
  const bad = clone(QUIZ);
  bad.objectives = [];
  rejects(bad, "objectives");
});

test("rejects duplicate objective ids", () => {
  const bad = clone(QUIZ);
  bad.objectives[1].id = "LO1";
  rejects(bad, "duplicate objective id");
});

test("rejects an orphan objective (an objective nothing assesses)", () => {
  const bad = clone(QUIZ);
  bad.objectives.push({ id: "LO9", text: "Never assessed anywhere." });
  rejects(bad, "orphan objective");
});

test("rejects an orphan quiz item (an item serving no objective)", () => {
  const bad = clone(QUIZ);
  bad.alignment = bad.alignment.filter((entry) => entry.item_position !== 3);
  rejects(bad, "orphan item");
});

test("rejects an orphan page", () => {
  const bad = clone(PAGE);
  bad.canvas.pages.push(clone(bad.canvas.pages[0]));
  rejects(bad, "orphan page");
});

test("rejects alignment pointing at an undeclared objective", () => {
  const bad = clone(QUIZ);
  bad.alignment[0].objective_id = "LO_TYPO";
  rejects(bad, "not in objectives");
});

test("rejects one item aligned to two objectives", () => {
  const bad = clone(QUIZ);
  bad.alignment.push({ item_position: 1, objective_id: "LO2", bloom_verb: "explain" });
  rejects(bad, "aligned more than once");
});

test("rejects an alignment entry with no bloom_verb", () => {
  const bad = clone(QUIZ);
  delete bad.alignment[0].bloom_verb;
  rejects(bad, "bloom_verb");
});

// --- Safety: CLAUDE.md says the professor publishes, never the tool.

test("rejects a published quiz", () => {
  const bad = clone(QUIZ);
  bad.canvas.quiz.published = true;
  rejects(bad, "published");
});

test("rejects a published assignment", () => {
  const bad = clone(ASSIGNMENT);
  bad.canvas.assignment.published = true;
  rejects(bad, "published");
});

test("rejects a published page", () => {
  const bad = clone(PAGE);
  bad.canvas.pages[0].wiki_page.published = true;
  rejects(bad, "published");
});

test("rejects a page that would take over the course home page", () => {
  const bad = clone(PAGE);
  bad.canvas.pages[0].wiki_page.front_page = true;
  rejects(bad, "front_page");
});

// --- Canvas New Quiz item shapes

test("rejects a wrong entry_type", () => {
  const bad = clone(QUIZ);
  bad.canvas.items[0].item.entry_type = "Question";
  rejects(bad, "entry_type");
});

test("rejects non-contiguous item positions", () => {
  const bad = clone(QUIZ);
  bad.canvas.items[2].item.position = 7;
  rejects(bad, "position");
});

test("rejects zero-point items", () => {
  const bad = clone(QUIZ);
  bad.canvas.items[0].item.points_possible = 0;
  rejects(bad, "points_possible");
});

test("rejects an unknown interaction_type_slug", () => {
  const bad = clone(QUIZ);
  bad.canvas.items[0].item.entry.interaction_type_slug = "multiple_choice_question";
  rejects(bad, "interaction_type_slug");
});

test("rejects a scoring_algorithm that does not match the interaction type", () => {
  const bad = clone(QUIZ);
  bad.canvas.items[0].item.entry.scoring_algorithm = "AllOrNothing"; // valid slug, wrong type
  rejects(bad, "scoring_algorithm");
});

test("rejects a choice item whose correct answer is not one of its choices", () => {
  const bad = clone(QUIZ);
  bad.canvas.items[0].item.entry.scoring_data.value = "00000000-0000-4000-8000-000000000000";
  rejects(bad, "scoring_data.value");
});

test("rejects a choice item with too few distractors", () => {
  const bad = clone(QUIZ);
  const entry = bad.canvas.items[0].item.entry;
  entry.interaction_data.choices = entry.interaction_data.choices.slice(0, 2);
  entry.scoring_data.value = entry.interaction_data.choices[0].id;
  rejects(bad, "distractors");
});

test("rejects duplicate choice ids", () => {
  const bad = clone(QUIZ);
  const choices = bad.canvas.items[0].item.entry.interaction_data.choices;
  choices[1].id = choices[0].id;
  rejects(bad, "duplicate choice id");
});

test("accepts either itemBody or item_body on choices (Canvas docs are inconsistent)", () => {
  const camel = clone(QUIZ);
  assert.deepEqual(validate(camel), [], "itemBody should be accepted");

  const snake = clone(QUIZ);
  snake.canvas.items[0].item.entry.interaction_data.choices.forEach((choice) => {
    choice.item_body = choice.itemBody;
    delete choice.itemBody;
  });
  assert.deepEqual(validate(snake), [], "item_body should be accepted");
});

test("rejects a choice with neither itemBody nor item_body", () => {
  const bad = clone(QUIZ);
  delete bad.canvas.items[0].item.entry.interaction_data.choices[1].itemBody;
  rejects(bad, "itemBody");
});

test("rejects a multi-answer item whose correct set names an unknown choice", () => {
  const bad = clone(QUIZ);
  bad.canvas.items[2].item.entry.scoring_data.value = ["nope"];
  rejects(bad, "is not a choice id");
});

test("rejects a true-false item missing its true_choice/false_choice labels", () => {
  const bad = clone(QUIZ);
  bad.canvas.items[1].item.entry.interaction_data = {};
  rejects(bad, "true_choice");
});

test("rejects a true-false item with a non-boolean answer", () => {
  const bad = clone(QUIZ);
  bad.canvas.items[1].item.entry.scoring_data.value = "false";
  rejects(bad, "scoring_data.value");
});

test("rejects a numeric item with no accepted-answer rules", () => {
  const bad = clone(QUIZ);
  bad.canvas.items[0].item.entry = {
    item_body: "<p>Boiling point of water in F?</p>",
    interaction_type_slug: "numeric",
    interaction_data: {},
    scoring_data: { value: [] },
    scoring_algorithm: "Numeric",
    feedback: { correct: "<p>212F.</p>" },
  };
  rejects(bad, "scoring_data.value");
});

test("accepts a well-formed numeric item", () => {
  const good = clone(QUIZ);
  good.canvas.items[0].item.entry = {
    item_body: "<p>Boiling point of water in F?</p>",
    interaction_type_slug: "numeric",
    interaction_data: {},
    scoring_data: { value: [{ id: "1", type: "exactResponse", value: "212" }] },
    scoring_algorithm: "Numeric",
    feedback: { correct: "<p>212F at sea level.</p>", incorrect: "<p>Check your scale.</p>" },
  };
  assert.deepEqual(validate(good), []);
});

test("accepts a well-formed matching item and rejects an unmatched question", () => {
  const good = clone(QUIZ);
  good.canvas.items[0].item.entry = {
    item_body: "<p>Match each stage to its location.</p>",
    interaction_type_slug: "matching",
    interaction_data: {
      answers: ["Thylakoid membrane", "Stroma", "Mitochondrion"],
      questions: [
        { id: "q1", item_body: "Light reactions" },
        { id: "q2", item_body: "Calvin cycle" },
      ],
    },
    scoring_data: { value: { q1: "Thylakoid membrane", q2: "Stroma" } },
    scoring_algorithm: "DeepEquals",
    feedback: { correct: "<p>Correct.</p>" },
  };
  assert.deepEqual(validate(good), []);

  const bad = clone(good);
  delete bad.canvas.items[0].item.entry.scoring_data.value.q2;
  rejects(bad, "has no correct answer");

  const strayAnswer = clone(good);
  strayAnswer.canvas.items[0].item.entry.scoring_data.value.q2 = "Nucleus";
  rejects(strayAnswer, "is not in interaction_data.answers");
});

// --- Feedback: the research's cheapest, highest-leverage rule. Enforced, not suggested.

test("rejects an item with no feedback", () => {
  const bad = clone(QUIZ);
  delete bad.canvas.items[0].item.entry.feedback;
  rejects(bad, "feedback");
});

test("accepts an essay item carrying only neutral feedback", () => {
  // Essays are hand-graded; neutral guidance is the right shape, so this must not fail.
  assert.deepEqual(validate(QUIZ), []);
  assert.equal(QUIZ.canvas.items[3].item.entry.interaction_type_slug, "essay");
  assert.ok(QUIZ.canvas.items[3].item.entry.feedback.neutral);
});

// --- Points consistency. Canvas will happily accept a quiz whose declared total
// --- disagrees with its items and then grade against the wrong denominator, and
// --- the professor cannot see that in a diff. So it fails here instead.

test("rejects a quiz whose points_possible disagrees with its items", () => {
  const bad = clone(QUIZ);
  bad.canvas.quiz.points_possible = 99;
  rejects(bad, "items sum to");
});

test("accepts fractional points that sum correctly", () => {
  const good = clone(QUIZ);
  good.canvas.items.forEach((wrapper) => { wrapper.item.points_possible = 0.5; });
  good.canvas.quiz.points_possible = 2;
  assert.deepEqual(validate(good), [], "0.5 x 4 = 2 must not trip float comparison");
});

test("rejects a rubric that cannot add up to the assignment total", () => {
  const bad = clone(ASSIGNMENT);
  bad.canvas.assignment.points_possible = 25; // rubric criteria sum to 20
  rejects(bad, "criteria sum to");
});

// --- Assignments + rubrics

test("rejects an unknown submission_type", () => {
  const bad = clone(ASSIGNMENT);
  bad.canvas.assignment.submission_types = ["carrier_pigeon"];
  rejects(bad, "submission_types");
});

test("rejects an unknown grading_type", () => {
  const bad = clone(ASSIGNMENT);
  bad.canvas.assignment.grading_type = "vibes";
  rejects(bad, "grading_type");
});

test("rejects a malformed due_at", () => {
  const bad = clone(ASSIGNMENT);
  bad.canvas.assignment.due_at = "next Friday";
  rejects(bad, "due_at");
});

test("rejects rubric criteria as an array (Canvas needs an indexed hash)", () => {
  // The bug this whole rule exists for: an array looks right and uploads wrong.
  const bad = clone(ASSIGNMENT);
  bad.canvas.rubric.criteria = Object.values(bad.canvas.rubric.criteria);
  rejects(bad, "indexed hash");
});

test("rejects non-contiguous rubric criteria keys", () => {
  const bad = clone(ASSIGNMENT);
  bad.canvas.rubric.criteria["5"] = bad.canvas.rubric.criteria["1"];
  delete bad.canvas.rubric.criteria["1"];
  rejects(bad, "contiguous index strings");
});

test("rejects a rubric criterion whose top rating cannot earn full marks", () => {
  const bad = clone(ASSIGNMENT);
  bad.canvas.rubric.criteria["0"].ratings[0].points = 8; // criterion is worth 10
  rejects(bad, "highest rating points must equal");
});

test("rejects a rubric criterion with a single rating level", () => {
  const bad = clone(ASSIGNMENT);
  bad.canvas.rubric.criteria["0"].ratings = [{ description: "Fine", points: 10 }];
  rejects(bad, "at least 2 rating levels");
});

test("rejects alignment naming a rubric criterion that does not exist", () => {
  const bad = clone(ASSIGNMENT);
  bad.alignment[0].criterion_key = "9";
  rejects(bad, "criterion_key");
});

// --- Canvas-unsafe HTML. Canvas silently strips these, so the professor would
// --- approve content that then renders broken or empty in the live course.

test("rejects a script tag in a page body", () => {
  const bad = clone(PAGE);
  bad.canvas.pages[0].wiki_page.body += "<script>alert(1)</script>";
  rejects(bad, "script");
});

test("rejects an inline event handler in a page body", () => {
  const bad = clone(PAGE);
  bad.canvas.pages[0].wiki_page.body += '<p onclick="steal()">Click me</p>';
  rejects(bad, "event handler");
});

test("rejects an iframe in a page body", () => {
  const bad = clone(PAGE);
  bad.canvas.pages[0].wiki_page.body += '<iframe src="https://example.com"></iframe>';
  rejects(bad, "iframe");
});

test("rejects unsafe HTML in a quiz stem, not just in pages", () => {
  const bad = clone(QUIZ);
  bad.canvas.items[0].item.entry.item_body += "<script>alert(1)</script>";
  rejects(bad, "script");
});

test("rejects unsafe HTML in an assignment description", () => {
  const bad = clone(ASSIGNMENT);
  bad.canvas.assignment.description += "<script>alert(1)</script>";
  rejects(bad, "script");
});

test("rejects an empty page body", () => {
  const bad = clone(PAGE);
  bad.canvas.pages[0].wiki_page.body = "   ";
  rejects(bad, "body");
});
