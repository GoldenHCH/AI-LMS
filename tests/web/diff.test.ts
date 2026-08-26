import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyPagePreview,
  applyQuizPreview,
  computeProposalDiff,
  normalizeHtml,
} from '../../lib/changes/diff.ts'
import type { CourseItem } from '../../lib/courses/getCourseTree.ts'
import type { ChangeProposal } from '../../lib/agent/proposal.ts'

function pageItem(overrides: Partial<CourseItem['page']> = {}): CourseItem {
  return {
    id: 'item-1',
    position: 0,
    kind: 'page',
    title: 'Syllabus',
    opaque: null,
    page: {
      id: 'item-1',
      title: 'Syllabus',
      bodyHtml: '<p>Late work is due within 48 hours.</p>',
      published: true,
      frontPage: false,
      ...overrides,
    },
    quiz: null,
    file: null,
  }
}

function quizItem(overrides: {
  engine?: 'classic' | 'new'
  readOnlyReason?: string | null
  questionReadOnlyReason?: string | null
} = {}): CourseItem {
  return {
    id: 'item-2',
    position: 0,
    kind: 'quiz',
    title: 'Policy Quiz',
    opaque: null,
    page: null,
    quiz: {
      id: 'item-2',
      title: 'Policy Quiz',
      engine: overrides.engine ?? 'classic',
      descriptionHtml: '',
      pointsPossible: 10,
      questionCount: 1,
      readOnlyReason: overrides.readOnlyReason ?? null,
      questions: [
        {
          id: 'q-1',
          position: 0,
          questionType: 'multiple_choice_question',
          stemHtml: '<p>When is late work accepted?</p>',
          pointsPossible: 10,
          readOnlyReason: overrides.questionReadOnlyReason ?? null,
          answers: [
            {
              id: 'a-1',
              ordinal: 0,
              textHtml: '<p>Within 48 hours</p>',
              weight: 100,
              isCorrect: true,
              commentsHtml: null,
            },
            {
              id: 'a-2',
              ordinal: 1,
              textHtml: '<p>Within 24 hours</p>',
              weight: 0,
              isCorrect: false,
              commentsHtml: null,
            },
          ],
        },
      ],
    },
    file: null,
  }
}

test('unmarks whitespace and attribute-order differences as changed', () => {
  const before = '<p class="a" id="b">Late   work is due.</p>'
  const after = '<p id="b" class="a">Late work is due.</p>'
  assert.equal(normalizeHtml(before), normalizeHtml(after))
})

test('unmarks purely cosmetic indentation between block tags as changed', () => {
  const before = '<div><p>A</p><p>B</p></div>'
  const after = '<div>\n  <p>A</p>\n  <p>B</p>\n</div>'
  assert.equal(normalizeHtml(before), normalizeHtml(after))
})

test('preserves whitespace-significant content inside <pre> as a real change', () => {
  const before = '<pre>function f() {\n    return 1;\n}</pre>'
  const after = '<pre>function f() {\nreturn 1;\n}</pre>'
  assert.notEqual(normalizeHtml(before), normalizeHtml(after))
})

test('page proposal with only formatting differences is not changed', () => {
  const item = pageItem()
  const proposal: ChangeProposal = {
    kind: 'page',
    itemId: 'item-1',
    bodyHtml: '<p>Late  work is due within 48 hours.</p>',
    rationale: 'No real change.',
  }

  const result = computeProposalDiff(item, proposal)

  assert.equal(result.status, 'ok')
  if (result.status === 'ok' && result.diff.kind === 'page') {
    assert.equal(result.diff.bodyHtml.changed, false)
    assert.equal(result.diff.isSensitive, false)
  }
})

test('page proposal with a real content change is marked changed', () => {
  const item = pageItem()
  const proposal: ChangeProposal = {
    kind: 'page',
    itemId: 'item-1',
    bodyHtml: '<p>Late work is due within 72 hours.</p>',
    rationale: 'Extends the window.',
  }

  const result = computeProposalDiff(item, proposal)

  assert.equal(result.status, 'ok')
  if (result.status === 'ok' && result.diff.kind === 'page') {
    assert.equal(result.diff.bodyHtml.changed, true)
  }
})

test('quiz stem-only change is not sensitive', () => {
  const item = quizItem()
  const proposal: ChangeProposal = {
    kind: 'quiz',
    itemId: 'item-2',
    rationale: 'Clarifies wording.',
    questions: [{ questionId: 'q-1', stemHtml: '<p>New stem</p>' }],
  }

  const result = computeProposalDiff(item, proposal)

  assert.equal(result.status, 'ok')
  if (result.status === 'ok' && result.diff.kind === 'quiz') {
    assert.equal(result.diff.isSensitive, false)
    assert.equal(result.diff.questions[0].stemHtml?.changed, true)
  }
})

test('quiz isCorrect change is sensitive', () => {
  const item = quizItem()
  const proposal: ChangeProposal = {
    kind: 'quiz',
    itemId: 'item-2',
    rationale: 'Fixes the correct answer.',
    questions: [
      {
        questionId: 'q-1',
        answers: [
          { answerId: 'a-1', isCorrect: false },
          { answerId: 'a-2', isCorrect: true },
        ],
      },
    ],
  }

  const result = computeProposalDiff(item, proposal)

  assert.equal(result.status, 'ok')
  if (result.status === 'ok' && result.diff.kind === 'quiz') {
    assert.equal(result.diff.isSensitive, true)
  }
})

test('quiz points change is sensitive', () => {
  const item = quizItem()
  const proposal: ChangeProposal = {
    kind: 'quiz',
    itemId: 'item-2',
    rationale: 'Reduces the points.',
    questions: [{ questionId: 'q-1', pointsPossible: 5 }],
  }

  const result = computeProposalDiff(item, proposal)

  assert.equal(result.status, 'ok')
  if (result.status === 'ok' && result.diff.kind === 'quiz') {
    assert.equal(result.diff.isSensitive, true)
  }
})

test('quiz answer weight change is sensitive', () => {
  const item = quizItem()
  const proposal: ChangeProposal = {
    kind: 'quiz',
    itemId: 'item-2',
    rationale: 'Redistributes partial credit.',
    questions: [
      { questionId: 'q-1', answers: [{ answerId: 'a-2', weight: 50 }] },
    ],
  }

  const result = computeProposalDiff(item, proposal)

  assert.equal(result.status, 'ok')
  if (result.status === 'ok' && result.diff.kind === 'quiz') {
    assert.equal(result.diff.isSensitive, true)
  }
})

test('quiz question removal is sensitive', () => {
  const item = quizItem()
  const proposal: ChangeProposal = {
    kind: 'quiz',
    itemId: 'item-2',
    rationale: 'Removes an outdated question.',
    questions: [{ questionId: 'q-1', remove: true }],
  }

  const result = computeProposalDiff(item, proposal)

  assert.equal(result.status, 'ok')
  if (result.status === 'ok' && result.diff.kind === 'quiz') {
    assert.equal(result.diff.isSensitive, true)
    assert.equal(result.diff.questions[0].removed, true)
  }
})

test('drops a proposal whose itemId does not match', () => {
  const item = pageItem()
  const proposal: ChangeProposal = {
    kind: 'page',
    itemId: 'item-999',
    bodyHtml: '<p>x</p>',
    rationale: 'x',
  }

  const result = computeProposalDiff(item, proposal)
  assert.equal(result.status, 'dropped')
})

test('drops a quiz proposal referencing an unknown question', () => {
  const item = quizItem()
  const proposal: ChangeProposal = {
    kind: 'quiz',
    itemId: 'item-2',
    rationale: 'x',
    questions: [{ questionId: 'q-does-not-exist', stemHtml: '<p>x</p>' }],
  }

  const result = computeProposalDiff(item, proposal)
  assert.equal(result.status, 'dropped')
})

test('drops a quiz proposal referencing an unknown answer', () => {
  const item = quizItem()
  const proposal: ChangeProposal = {
    kind: 'quiz',
    itemId: 'item-2',
    rationale: 'x',
    questions: [{ questionId: 'q-1', answers: [{ answerId: 'a-does-not-exist', isCorrect: true }] }],
  }

  const result = computeProposalDiff(item, proposal)
  assert.equal(result.status, 'dropped')
})

test('drops a proposal touching a read-only question', () => {
  const item = quizItem({ questionReadOnlyReason: 'Locked by Canvas' })
  const proposal: ChangeProposal = {
    kind: 'quiz',
    itemId: 'item-2',
    rationale: 'x',
    questions: [{ questionId: 'q-1', stemHtml: '<p>x</p>' }],
  }

  const result = computeProposalDiff(item, proposal)
  assert.equal(result.status, 'dropped')
})

test('drops a proposal touching a read-only quiz', () => {
  const item = quizItem({ readOnlyReason: 'Locked by Canvas' })
  const proposal: ChangeProposal = {
    kind: 'quiz',
    itemId: 'item-2',
    rationale: 'x',
    questions: [{ questionId: 'q-1', stemHtml: '<p>x</p>' }],
  }

  const result = computeProposalDiff(item, proposal)
  assert.equal(result.status, 'dropped')
})

test('drops a proposal touching a New Quiz', () => {
  const item = quizItem({ engine: 'new' })
  const proposal: ChangeProposal = {
    kind: 'quiz',
    itemId: 'item-2',
    rationale: 'x',
    questions: [{ questionId: 'q-1', stemHtml: '<p>x</p>' }],
  }

  const result = computeProposalDiff(item, proposal)
  assert.equal(result.status, 'dropped')
})

test('drops a page proposal when the item is actually a quiz', () => {
  const item = quizItem()
  const proposal: ChangeProposal = {
    kind: 'page',
    itemId: 'item-2',
    bodyHtml: '<p>x</p>',
    rationale: 'x',
  }

  const result = computeProposalDiff(item, proposal)
  assert.equal(result.status, 'dropped')
})

test('applyPagePreview returns the proposed body without mutating the original', () => {
  const item = pageItem()
  const before = item.page!
  const result = computeProposalDiff(item, {
    kind: 'page',
    itemId: 'item-1',
    bodyHtml: '<p>Late work is due within 72 hours.</p>',
    rationale: 'Extends the window.',
  })

  assert.equal(result.status, 'ok')
  if (result.status === 'ok' && result.diff.kind === 'page') {
    const after = applyPagePreview(before, result.diff)
    assert.equal(after.bodyHtml, '<p>Late work is due within 72 hours.</p>')
    assert.equal(before.bodyHtml, '<p>Late work is due within 48 hours.</p>')
  }
})

test('applyQuizPreview updates a touched question and answer without mutating the original', () => {
  const item = quizItem()
  const before = item.quiz!
  const proposal: ChangeProposal = {
    kind: 'quiz',
    itemId: 'item-2',
    rationale: 'Fixes the answer key.',
    questions: [
      {
        questionId: 'q-1',
        answers: [
          { answerId: 'a-1', isCorrect: false },
          { answerId: 'a-2', isCorrect: true },
        ],
      },
    ],
  }

  const result = computeProposalDiff(item, proposal)
  assert.equal(result.status, 'ok')
  if (result.status === 'ok' && result.diff.kind === 'quiz') {
    const after = applyQuizPreview(before, result.diff)
    assert.equal(after.questions.length, 1)
    const answers = after.questions[0].answers
    assert.equal(answers.find((answer) => answer.id === 'a-1')?.isCorrect, false)
    assert.equal(answers.find((answer) => answer.id === 'a-2')?.isCorrect, true)
    // Original stays untouched.
    assert.equal(before.questions[0].answers.find((answer) => answer.id === 'a-1')?.isCorrect, true)
  }
})

test('applyQuizPreview leaves questions the proposal never touched unchanged', () => {
  const item = quizItem()
  // Add a second, untouched question to the fixture.
  item.quiz!.questions.push({
    id: 'q-2',
    position: 1,
    questionType: 'multiple_choice_question',
    stemHtml: '<p>Untouched question</p>',
    pointsPossible: 5,
    readOnlyReason: null,
    answers: [],
  })
  const before = item.quiz!
  const result = computeProposalDiff(item, {
    kind: 'quiz',
    itemId: 'item-2',
    rationale: 'Only touches q-1.',
    questions: [{ questionId: 'q-1', stemHtml: '<p>New stem</p>' }],
  })

  assert.equal(result.status, 'ok')
  if (result.status === 'ok' && result.diff.kind === 'quiz') {
    const after = applyQuizPreview(before, result.diff)
    assert.equal(after.questions.length, 2)
    assert.equal(after.questions.find((q) => q.id === 'q-2')?.stemHtml, '<p>Untouched question</p>')
  }
})

test('applyQuizPreview drops a removed question from the preview', () => {
  const item = quizItem()
  const before = item.quiz!
  const result = computeProposalDiff(item, {
    kind: 'quiz',
    itemId: 'item-2',
    rationale: 'Removes an outdated question.',
    questions: [{ questionId: 'q-1', remove: true }],
  })

  assert.equal(result.status, 'ok')
  if (result.status === 'ok' && result.diff.kind === 'quiz') {
    const after = applyQuizPreview(before, result.diff)
    assert.equal(after.questions.length, 0)
    assert.equal(after.questionCount, 0)
    assert.equal(before.questions.length, 1)
  }
})
