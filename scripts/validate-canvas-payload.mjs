#!/usr/bin/env node
// Validates authoring-skill output envelopes (see .claude/skills/*/SKILL.md)
// before their Canvas payloads are shown to a professor or uploaded.
// Usage: node scripts/validate-canvas-payload.mjs <file.json> [...more]
// Exits 0 when every file is valid; prints one line per error otherwise.

import { readFileSync } from "node:fs";

const ARTIFACT_TYPES = ["new_quiz", "assignment", "page"];

// Canvas submission_types / grading_type enums (Assignments API). Exactly these ten —
// "wiki_page" looks like it belongs here but is the Pages API's wrapper key, not a
// submission type; Canvas rejects it.
const SUBMISSION_TYPES = [
  "online_text_entry", "online_url", "online_upload", "media_recording",
  "student_annotation", "on_paper", "external_tool", "none",
  "discussion_topic", "online_quiz",
];
const GRADING_TYPES = ["points", "percent", "letter_grade", "gpa_scale", "pass_fail", "not_graded"];

// Canvas documents due_at/lock_at/unlock_at as ISO 8601. Date.parse alone is far too
// lax — it happily accepts "March 5, 2026", which Canvas then rejects.
const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

// New Quizzes interaction types this product generates, with the
// scoring_algorithm values Canvas accepts for each.
const QUIZ_ITEM_SPECS = {
  "choice": { algorithms: ["Equivalence", "VaryPointsByAnswer"] },
  "multi-answer": { algorithms: ["AllOrNothing", "PartialScore"] },
  "true-false": { algorithms: ["Equivalence"] },
  "essay": { algorithms: ["None"] },
  "matching": { algorithms: ["DeepEquals", "PartialDeep"] },
  "numeric": { algorithms: ["Numeric"] },
};

// HTML that Canvas strips, or that would execute. Two different harms share this list:
// executable content (a real XSS risk in a page students load), and silently-stripped
// markup (the professor approves something that renders wrong or empty).
const UNSAFE_HTML = [
  [/<script\b/i, "contains a <script> tag"],
  // Anchored inside a start tag on purpose: a bare /\son[a-z]+=/ also matches ordinary
  // prose like "oncogene = a mutated gene" or "onset = the age symptoms begin", which
  // is exactly the vocabulary a biology or psychology page is made of.
  [/<[^>]*\son[a-z]+\s*=/i, "contains an inline event handler (on*=)"],
  [/<iframe\b/i, "contains an <iframe> (only allowlisted LTI domains survive Canvas sanitization)"],
  [/<style\b/i, "contains a <style> block (Canvas strips it at render)"],
  [/<(form|input)\b/i, "contains a <form>/<input> element (Canvas strips it at render)"],
  // Whitespace-tolerant: browsers parse "jav\tascript:" as the javascript scheme, so a
  // naive /javascript:/ check is trivially bypassed.
  [
    /\b(?:href|src|action|formaction)\s*=\s*["']?\s*j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/i,
    "contains a javascript: URI (executable content in a page students load)",
  ],
];

export function validate(envelope) {
  const errors = [];
  const err = (path, message) => errors.push(`${path}: ${message}`);

  if (typeof envelope !== "object" || envelope === null || Array.isArray(envelope)) {
    return ["envelope: must be a JSON object"];
  }

  if (!ARTIFACT_TYPES.includes(envelope.artifact_type)) {
    err("artifact_type", `must be one of ${ARTIFACT_TYPES.join(", ")}`);
  }
  if (!isNonEmptyString(envelope.title)) err("title", "must be a non-empty string");

  // Objectives: the North Star. Unique ids, non-empty text.
  const objectiveIds = new Set();
  if (!Array.isArray(envelope.objectives) || envelope.objectives.length === 0) {
    err("objectives", "must be a non-empty array — every artifact traces to learning objectives");
  } else {
    envelope.objectives.forEach((objective, index) => {
      const path = `objectives[${index}]`;
      if (!isNonEmptyString(objective?.id)) err(path, "missing id");
      else if (objectiveIds.has(objective.id)) err(path, `duplicate objective id "${objective.id}"`);
      else objectiveIds.add(objective.id);
      if (!isNonEmptyString(objective?.text)) err(path, "missing text");
    });
  }

  if (typeof envelope.canvas !== "object" || envelope.canvas === null) {
    err("canvas", "must be an object holding the Canvas API payload(s)");
    return errors;
  }
  if (!Array.isArray(envelope.alignment) || envelope.alignment.length === 0) {
    err("alignment", "must be a non-empty array mapping artifacts to objectives");
    return errors;
  }

  // Every alignment entry must reference a declared objective…
  const alignedObjectives = new Set();
  envelope.alignment.forEach((entry, index) => {
    if (!objectiveIds.has(entry?.objective_id)) {
      err(`alignment[${index}]`, `objective_id "${entry?.objective_id}" is not in objectives[]`);
    } else {
      alignedObjectives.add(entry.objective_id);
    }
  });
  // …and every objective must be covered (no orphan objectives).
  for (const id of objectiveIds) {
    if (!alignedObjectives.has(id)) err("alignment", `objective "${id}" has no aligned artifact (orphan objective)`);
  }

  if (envelope.artifact_type === "new_quiz") validateNewQuiz(envelope, err);
  if (envelope.artifact_type === "assignment") validateAssignment(envelope, err);
  if (envelope.artifact_type === "page") validatePages(envelope, err);

  return errors;
}

function validateNewQuiz(envelope, err) {
  const quiz = envelope.canvas.quiz;
  if (!quiz || !isNonEmptyString(quiz.title)) err("canvas.quiz.title", "must be a non-empty string");
  checkUnpublished(quiz, "canvas.quiz", err);
  checkDates(quiz, "canvas.quiz", err);
  if (isNonEmptyString(quiz?.instructions)) checkHtml(quiz.instructions, "canvas.quiz.instructions", err);

  const items = envelope.canvas.items;
  if (!Array.isArray(items) || items.length === 0) {
    err("canvas.items", "must be a non-empty array of New Quiz item payloads");
    return;
  }

  // A quiz whose declared total disagrees with its items grades wrong in Canvas
  // and the professor has no way to see it in a diff — catch it here instead.
  const itemPoints = items.reduce((sum, wrapper) => sum + (Number(wrapper?.item?.points_possible) || 0), 0);
  if (typeof quiz?.points_possible === "number" && !approxEqual(quiz.points_possible, itemPoints)) {
    err("canvas.quiz.points_possible", `is ${quiz.points_possible} but the items sum to ${itemPoints}`);
  }

  items.forEach((wrapper, index) => {
    const path = `canvas.items[${index}]`;
    const item = wrapper?.item;
    if (typeof item !== "object" || item === null) {
      err(path, 'must be shaped {"item": {...}} (the POST body for the items endpoint)');
      return;
    }
    if (item.entry_type !== "Item") err(`${path}.item.entry_type`, 'must be "Item"');
    if (!(typeof item.points_possible === "number" && item.points_possible > 0)) {
      err(`${path}.item.points_possible`, "must be a number > 0");
    }
    if (item.position !== index + 1) {
      err(`${path}.item.position`, `must be ${index + 1} (contiguous, in array order)`);
    }
    validateQuizEntry(item.entry, `${path}.item.entry`, err);
  });

  // Alignment: exactly one objective per item (1:1), every item aligned.
  const seenPositions = new Set();
  envelope.alignment.forEach((entry, index) => {
    const path = `alignment[${index}]`;
    const position = entry?.item_position;
    if (!(Number.isInteger(position) && position >= 1 && position <= items.length)) {
      err(path, `item_position must be an integer between 1 and ${items.length}`);
      return;
    }
    if (seenPositions.has(position)) err(path, `item ${position} is aligned more than once — one item, one objective`);
    seenPositions.add(position);
    if (!isNonEmptyString(entry?.bloom_verb)) err(path, "missing bloom_verb (the objective verb this item matches)");
  });
  for (let position = 1; position <= items.length; position += 1) {
    if (!seenPositions.has(position)) err("alignment", `item ${position} has no objective (orphan item)`);
  }
}

function validateQuizEntry(entry, path, err) {
  if (typeof entry !== "object" || entry === null) {
    err(path, "must be an object (title, item_body, interaction_type_slug, interaction_data, scoring_data, scoring_algorithm)");
    return;
  }
  if (!isNonEmptyString(entry.item_body)) err(`${path}.item_body`, "must be non-empty HTML (the question stem)");
  else checkHtml(entry.item_body, `${path}.item_body`, err);

  const spec = QUIZ_ITEM_SPECS[entry.interaction_type_slug];
  if (!spec) {
    err(`${path}.interaction_type_slug`, `must be one of ${Object.keys(QUIZ_ITEM_SPECS).join(", ")}`);
    return;
  }
  if (!spec.algorithms.includes(entry.scoring_algorithm)) {
    err(`${path}.scoring_algorithm`, `must be ${spec.algorithms.join(" or ")} for ${entry.interaction_type_slug}`);
  }
  if (typeof entry.interaction_data !== "object" || entry.interaction_data === null) {
    err(`${path}.interaction_data`, "is required");
    return;
  }
  if (!("scoring_data" in entry)) {
    err(`${path}.scoring_data`, "is required");
    return;
  }

  const slug = entry.interaction_type_slug;
  if (slug === "choice" || slug === "multi-answer") {
    const choices = entry.interaction_data.choices;
    if (!Array.isArray(choices) || choices.length < 2) {
      err(`${path}.interaction_data.choices`, "must be an array of at least 2 choices");
      return;
    }
    const ids = new Set();
    choices.forEach((choice, index) => {
      const choicePath = `${path}.interaction_data.choices[${index}]`;
      if (!isNonEmptyString(choice?.id)) err(choicePath, "missing id (client-generated UUID)");
      else if (ids.has(choice.id)) err(choicePath, `duplicate choice id "${choice.id}"`);
      else ids.add(choice.id);
      // Canvas docs use itemBody for `choice` but item_body for `multi-answer`.
      // The inconsistency is theirs; accept either rather than fail valid payloads.
      if (!isNonEmptyString(choice?.itemBody) && !isNonEmptyString(choice?.item_body)) {
        err(choicePath, "missing itemBody (choice) / item_body (multi-answer)");
      }
      if (choice?.position !== index + 1) err(`${choicePath}.position`, `must be ${index + 1}`);
    });
    const value = entry.scoring_data.value;
    // Naming the misconception behind each option is the cheapest, highest-leverage thing
    // this product does, and item-level feedback can't do it — a student who picked option C
    // needs to know why C is tempting and wrong, not a generic "incorrect". Enforced on both
    // choice types rather than choice alone: an unenforced rule gets skipped on exactly the
    // items where writing it was most tedious, which is where students needed it most.
    requireAnswerFeedback(entry, ids, path, err);
    if (slug === "choice") {
      if (choices.length < 3) err(`${path}.interaction_data.choices`, "choice items need >=3 options (one correct, >=2 distractors)");
      if (!ids.has(value)) err(`${path}.scoring_data.value`, "must equal the id of exactly one choice (the correct answer)");
    } else {
      if (!Array.isArray(value) || value.length === 0) err(`${path}.scoring_data.value`, "must be a non-empty array of correct choice ids");
      else value.forEach((id) => { if (!ids.has(id)) err(`${path}.scoring_data.value`, `"${id}" is not a choice id`); });
    }
  } else if (slug === "true-false") {
    if (!isNonEmptyString(entry.interaction_data.true_choice) || !isNonEmptyString(entry.interaction_data.false_choice)) {
      err(`${path}.interaction_data`, 'must be {"true_choice": "True", "false_choice": "False"}');
    }
    if (typeof entry.scoring_data.value !== "boolean") err(`${path}.scoring_data.value`, "must be true or false");
  } else if (slug === "matching") {
    const questions = entry.interaction_data.questions;
    const answers = entry.interaction_data.answers;
    if (!Array.isArray(questions) || questions.length === 0) err(`${path}.interaction_data.questions`, "must be a non-empty array");
    if (!Array.isArray(answers) || answers.length === 0) err(`${path}.interaction_data.answers`, "must be a non-empty array");
    const value = entry.scoring_data.value;
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      err(`${path}.scoring_data.value`, "must map each question id to its correct answer string");
    } else if (Array.isArray(questions)) {
      questions.forEach((question) => {
        if (isNonEmptyString(question?.id) && !(question.id in value)) {
          err(`${path}.scoring_data.value`, `question "${question.id}" has no correct answer`);
        }
      });
      if (Array.isArray(answers)) {
        Object.values(value).forEach((answer) => {
          if (!answers.includes(answer)) err(`${path}.scoring_data.value`, `answer "${answer}" is not in interaction_data.answers`);
        });
      }
    }
  } else if (slug === "numeric") {
    const value = entry.scoring_data.value;
    if (!Array.isArray(value) || value.length === 0) {
      err(`${path}.scoring_data.value`, "must be a non-empty array of numeric response rules");
    }
  }
  // essay: no machine-checkable answer; SpeedGrader handles scoring.

  const feedback = entry.feedback;
  if (typeof feedback !== "object" || feedback === null ||
      !(isNonEmptyString(feedback.correct) || isNonEmptyString(feedback.neutral))) {
    err(`${path}.feedback`, "must include correct (and ideally incorrect) feedback — feedback doubles the learning effect");
  } else {
    // Feedback is HTML rendered to students, same as the stem — it needs the same scan.
    for (const key of ["correct", "incorrect", "neutral"]) {
      if (isNonEmptyString(feedback[key])) checkHtml(feedback[key], `${path}.feedback.${key}`, err);
    }
  }

  const answerFeedback = entry.answer_feedback;
  if (answerFeedback !== undefined) {
    if (typeof answerFeedback !== "object" || answerFeedback === null || Array.isArray(answerFeedback)) {
      err(`${path}.answer_feedback`, "must be an object keyed by choice id");
    } else {
      Object.entries(answerFeedback).forEach(([key, value]) => {
        if (isNonEmptyString(value)) checkHtml(value, `${path}.answer_feedback["${key}"]`, err);
      });
    }
  }
}

function validateAssignment(envelope, err) {
  const assignment = envelope.canvas.assignment;
  if (typeof assignment !== "object" || assignment === null) {
    err("canvas.assignment", "must be an object (the POST /assignments body's assignment field)");
    return;
  }
  if (!isNonEmptyString(assignment.name)) err("canvas.assignment.name", "must be a non-empty string");
  if (!isNonEmptyString(assignment.description)) err("canvas.assignment.description", "must be non-empty HTML");
  else checkHtml(assignment.description, "canvas.assignment.description", err);
  if (!(typeof assignment.points_possible === "number" && assignment.points_possible >= 0)) {
    err("canvas.assignment.points_possible", "must be a number >= 0");
  }
  // Same trap as quizzes: a rubric that can't add up to the assignment's total
  // means students literally cannot earn full marks.
  const scored = envelope.canvas.rubric?.criteria;
  if (scored && !Array.isArray(scored) && typeof assignment.points_possible === "number") {
    const rubricPoints = Object.values(scored).reduce((sum, criterion) => sum + (Number(criterion?.points) || 0), 0);
    if (!approxEqual(rubricPoints, assignment.points_possible)) {
      err("canvas.rubric", `criteria sum to ${rubricPoints} but the assignment is worth ${assignment.points_possible}`);
    }
  }
  if (!Array.isArray(assignment.submission_types) || assignment.submission_types.length === 0) {
    err("canvas.assignment.submission_types", "must be a non-empty array");
  } else {
    assignment.submission_types.forEach((type) => {
      if (!SUBMISSION_TYPES.includes(type)) {
        err("canvas.assignment.submission_types", `"${type}" is not a Canvas submission type`);
      }
    });
  }
  if (assignment.grading_type !== undefined && !GRADING_TYPES.includes(assignment.grading_type)) {
    err("canvas.assignment.grading_type", `must be one of ${GRADING_TYPES.join(", ")}`);
  }
  checkDates(assignment, "canvas.assignment", err);
  checkUnpublished(assignment, "canvas.assignment", err);

  const rubric = envelope.canvas.rubric;
  if (rubric === undefined) return;

  if (typeof rubric !== "object" || rubric === null || Array.isArray(rubric)) {
    err("canvas.rubric", "must be a Canvas rubric object with title and criteria");
    return;
  }
  if (!isNonEmptyString(rubric.title)) err("canvas.rubric.title", "must be a non-empty string");
  // Canvas takes criteria as an "indexed Hash" keyed "0", "1", … — NOT a JSON array.
  // An array here uploads wrong, so reject it explicitly rather than passing it through.
  const criteria = rubric.criteria;
  if (Array.isArray(criteria)) {
    err("canvas.rubric.criteria", 'must be an indexed hash ({"0": {...}, "1": {...}}), not an array — Canvas rejects arrays');
    return;
  }
  if (typeof criteria !== "object" || criteria === null || Object.keys(criteria).length === 0) {
    err("canvas.rubric.criteria", 'must be a non-empty indexed hash ({"0": {...}})');
    return;
  }
  Object.keys(criteria).forEach((key, index) => {
    const path = `canvas.rubric.criteria["${key}"]`;
    if (key !== String(index)) err(path, `keys must be contiguous index strings starting at "0" (expected "${index}")`);
    const criterion = criteria[key];
    if (!isNonEmptyString(criterion?.description)) err(path, "missing description");
    if (!(typeof criterion?.points === "number" && criterion.points > 0)) err(`${path}.points`, "must be a number > 0");
    if (!Array.isArray(criterion?.ratings) || criterion.ratings.length < 2) {
      err(`${path}.ratings`, "must have at least 2 rating levels");
      return;
    }
    const top = Math.max(...criterion.ratings.map((rating) => rating?.points ?? Number.NEGATIVE_INFINITY));
    if (top !== criterion.points) err(`${path}.ratings`, "highest rating points must equal the criterion points");
    criterion.ratings.forEach((rating, ratingIndex) => {
      if (!isNonEmptyString(rating?.description)) err(`${path}.ratings[${ratingIndex}]`, "missing description");
    });
  });

  // Rubric criteria trace to objectives on the same terms quiz items do: one criterion,
  // one objective, and no criterion left dangling.
  const seenKeys = new Set();
  envelope.alignment.forEach((entry, index) => {
    const key = entry?.criterion_key;
    if (key === undefined) return;
    if (!(key in criteria)) {
      err(`alignment[${index}]`, `criterion_key "${key}" is not in canvas.rubric.criteria`);
      return;
    }
    if (seenKeys.has(key)) {
      err(`alignment[${index}]`, `criterion "${key}" is aligned more than once — one criterion, one objective`);
    }
    seenKeys.add(key);
    if (!isNonEmptyString(entry?.bloom_verb)) {
      err(`alignment[${index}]`, "missing bloom_verb (the objective verb this criterion matches)");
    }
  });
  Object.keys(criteria).forEach((key) => {
    if (!seenKeys.has(key)) err(`canvas.rubric.criteria["${key}"]`, "has no aligned objective (orphan criterion)");
  });
}

function validatePages(envelope, err) {
  const pages = envelope.canvas.pages;
  if (!Array.isArray(pages) || pages.length === 0) {
    err("canvas.pages", "must be a non-empty array of wiki_page payloads");
    return;
  }
  pages.forEach((wrapper, index) => {
    const path = `canvas.pages[${index}]`;
    const page = wrapper?.wiki_page;
    if (typeof page !== "object" || page === null) {
      err(path, 'must be shaped {"wiki_page": {...}} (the POST body for the pages endpoint)');
      return;
    }
    if (!isNonEmptyString(page.title)) err(`${path}.wiki_page.title`, "must be a non-empty string");
    if (!isNonEmptyString(page.body)) err(`${path}.wiki_page.body`, "must be non-empty HTML");
    else checkHtml(page.body, `${path}.wiki_page.body`, err);
    checkUnpublished(page, `${path}.wiki_page`, err);
    if (page.front_page === true) err(`${path}.wiki_page.front_page`, "must not be true — setting it swaps the course home page");
  });

  const alignedPages = new Set();
  envelope.alignment.forEach((entry, index) => {
    const pageIndex = entry?.page_index;
    if (!(Number.isInteger(pageIndex) && pageIndex >= 0 && pageIndex < pages.length)) {
      err(`alignment[${index}]`, `page_index must be an integer between 0 and ${pages.length - 1}`);
      return;
    }
    alignedPages.add(pageIndex);
  });
  pages.forEach((_, index) => {
    if (!alignedPages.has(index)) err("alignment", `page ${index} teaches no objective (orphan page)`);
  });
}

// Every selectable option needs its own line of feedback, keyed by option id.
function requireAnswerFeedback(entry, ids, path, err) {
  const perOption = entry.answer_feedback;
  if (typeof perOption !== "object" || perOption === null || Array.isArray(perOption)) {
    err(`${path}.answer_feedback`, "needs answer_feedback keyed by option id — one line per option naming why it's right, or which misconception it reflects");
    return;
  }
  for (const id of ids) {
    if (!isNonEmptyString(perOption[id])) err(`${path}.answer_feedback["${id}"]`, "missing feedback for this option");
  }
}

function checkUnpublished(payload, path, err) {
  if (payload?.published === true) {
    err(`${path}.published`, "must not be true — the professor publishes after review, never this tool");
  }
}

// Canvas enforces unlock_at <= due_at <= lock_at and rejects the POST otherwise —
// a window that closes before the work is due locks students out of their own assignment.
function checkDates(payload, path, err) {
  const parsed = {};
  for (const field of ["due_at", "unlock_at", "lock_at"]) {
    const value = payload?.[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== "string" || !ISO_8601.test(value)) {
      err(`${path}.${field}`, "must be an ISO 8601 datetime (e.g. 2026-09-15T23:59:00Z)");
      continue;
    }
    parsed[field] = Date.parse(value);
  }
  if (parsed.due_at !== undefined && parsed.lock_at !== undefined && parsed.lock_at < parsed.due_at) {
    err(`${path}.lock_at`, "is before due_at — students would be locked out before the work is due");
  }
  if (parsed.due_at !== undefined && parsed.unlock_at !== undefined && parsed.unlock_at > parsed.due_at) {
    err(`${path}.unlock_at`, "is after due_at — the work would be due before students can open it");
  }
  if (parsed.unlock_at !== undefined && parsed.lock_at !== undefined && parsed.lock_at < parsed.unlock_at) {
    err(`${path}.lock_at`, "is before unlock_at — the availability window never opens");
  }
}

function checkHtml(html, path, err) {
  for (const [pattern, message] of UNSAFE_HTML) {
    if (pattern.test(html)) err(path, message);
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// Points are often fractional (0.5 per item); exact === would false-alarm on float drift.
function approxEqual(a, b) {
  return Math.abs(a - b) < 0.001;
}

// CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: node scripts/validate-canvas-payload.mjs <file.json> [...more]");
    process.exit(2);
  }
  let failed = false;
  for (const file of files) {
    let envelope;
    try {
      envelope = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      console.error(`${file}: not readable as JSON — ${error.message}`);
      failed = true;
      continue;
    }
    const errors = validate(envelope);
    if (errors.length === 0) {
      console.log(`${file}: OK`);
    } else {
      failed = true;
      for (const message of errors) console.error(`${file} — ${message}`);
    }
  }
  process.exit(failed ? 1 : 0);
}
