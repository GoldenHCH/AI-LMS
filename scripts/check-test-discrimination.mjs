#!/usr/bin/env node
// Are the validator's tests real? Deletes each rule in a scratch copy and checks that a
// test actually fails. A rule whose deletion leaves the suite green is dead: it can be
// dropped by any refactor with no CI signal, and it makes `npm test` passing mean less
// than it appears to. Six rules were exactly that before this existed.
//
// Usage: npm run check:tests   (audit tool — run when adding or reworking a rule)
//
// Deliberately brittle: rules are matched by exact source snippet, so rewording a message
// fails this check rather than silently skipping it. If that trips you, update the list —
// that is the check working, not breaking.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// [snippet to remove, replacement, human name]. Replacement is "" unless deleting the
// line outright would be a syntax error.
const MUTATIONS = [
  ['if (!isNonEmptyString(envelope.title)) err("title", "must be a non-empty string");', "", "envelope.title required"],
  ['err("alignment", "must be a non-empty array mapping artifacts to objectives");', "", "alignment non-empty"],
  ['err("canvas.items", "must be a non-empty array of New Quiz item payloads");', "", "canvas.items non-empty"],
  ['err("canvas.assignment.points_possible", "must be a number >= 0");', "", "assignment points >= 0"],
  ["err(path, `item_position must be an integer between 1 and ${items.length}`);", "", "item_position range"],
  ["err(`alignment[${index}]`, `page_index must be an integer between 0 and ${pages.length - 1}`);", "", "page_index range"],
  ['[/<style\\b/i, "contains a <style> block (Canvas strips it at render)"],', "", "style tag blocked"],
  ["if (!SUBMISSION_TYPES.includes(type)) {", "if (false) {", "submission_types enum"],
];

const work = mkdtempSync(join(tmpdir(), "discrimination-"));
for (const dir of ["scripts", "tests", ".claude"]) cpSync(join(repoRoot, dir), join(work, dir), { recursive: true });
const target = join(work, "scripts/validate-canvas-payload.mjs");
const testFile = join(work, "tests/validate-canvas-payload.test.mjs");
const pristine = readFileSync(target, "utf8");

let broken = 0;
for (const [snippet, replacement, name] of MUTATIONS) {
  if (!pristine.includes(snippet)) {
    broken += 1;
    console.error(`STALE  ${name} — snippet no longer in the validator; update this list`);
    continue;
  }
  writeFileSync(target, pristine.replace(snippet, replacement));
  let failures = 0;
  try {
    execFileSync("node", ["--test", testFile], { encoding: "utf8" });
  } catch (error) {
    failures = (String(error.stdout).match(/^not ok/gm) || []).length;
  }
  writeFileSync(target, pristine);

  if (failures === 0) {
    broken += 1;
    console.error(`DEAD   ${name} — deleting this rule breaks no test`);
  } else {
    console.log(`ok     ${name} — ${failures} test(s) fail when deleted`);
  }
}

if (broken > 0) {
  console.error(`\n${broken} rule(s) not covered by a discriminating test.`);
  process.exit(1);
}
console.log("\nEvery checked rule is covered by a test that fails without it.");
