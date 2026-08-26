import assert from 'node:assert/strict'
import test from 'node:test'

import { parseAgentResponse } from '../../lib/agent/proposal.ts'
import { nextChatTurnState } from '../../lib/agent/chatTurn.ts'

test('parses a clarification response', () => {
  const response = parseAgentResponse({
    type: 'clarification',
    question: 'Which module has the late-work policy you mean?',
  })

  assert.deepEqual(nextChatTurnState(response), {
    status: 'awaiting-clarification',
    question: 'Which module has the late-work policy you mean?',
  })
})

test('parses a mixed page + quiz proposal batch', () => {
  const response = parseAgentResponse({
    type: 'proposals',
    batch: [
      {
        kind: 'page',
        itemId: 'item-1',
        bodyHtml: '<p>Updated policy</p>',
        rationale: 'Extends the late-work window from 48 to 72 hours.',
      },
      {
        kind: 'quiz',
        itemId: 'item-2',
        rationale: 'Updates the question that tests the late-work window.',
        questions: [
          {
            questionId: 'question-1',
            stemHtml: '<p>New stem</p>',
            answers: [{ answerId: 'answer-1', isCorrect: true }],
          },
        ],
      },
    ],
  })

  assert.equal(response.type, 'proposals')
  assert.equal(nextChatTurnState(response).status, 'batch-ready')
})

test('rejects an empty batch', () => {
  assert.throws(() => parseAgentResponse({ type: 'proposals', batch: [] }))
})

test('drops a single malformed proposal instead of failing the whole batch', () => {
  const response = parseAgentResponse({
    type: 'proposals',
    batch: [
      {
        kind: 'page',
        itemId: 'item-1',
        bodyHtml: '<p>Updated policy</p>',
        rationale: 'Extends the late-work window from 48 to 72 hours.',
      },
      { itemId: 'item-2', bodyHtml: '<p>No kind field</p>' },
    ],
  })

  assert.equal(response.type, 'proposals')
  if (response.type === 'proposals') {
    assert.equal(response.batch.length, 1)
    assert.equal(response.batch[0].itemId, 'item-1')
    assert.equal(response.malformedCount, 1)
  }
})

test('an explicit null on an optional numeric/boolean field is treated as untouched', () => {
  const response = parseAgentResponse({
    type: 'proposals',
    batch: [
      {
        kind: 'quiz',
        itemId: 'item-2',
        rationale: 'Clarifies the stem only.',
        questions: [
          {
            questionId: 'question-1',
            stemHtml: '<p>New stem</p>',
            pointsPossible: null,
            answers: [{ answerId: 'answer-1', isCorrect: null, weight: null }],
          },
        ],
      },
    ],
  })

  assert.equal(response.type, 'proposals')
  if (response.type === 'proposals') {
    const question = response.batch[0]
    assert.equal(question.kind, 'quiz')
    if (question.kind === 'quiz') {
      assert.equal(question.questions[0].pointsPossible, undefined)
      assert.equal(question.questions[0].answers?.[0].isCorrect, undefined)
      assert.equal(question.questions[0].answers?.[0].weight, undefined)
    }
  }
})

test('rejects a proposal missing a discriminant', () => {
  assert.throws(() =>
    parseAgentResponse({
      type: 'proposals',
      batch: [{ itemId: 'item-1', bodyHtml: '<p>No kind field</p>' }],
    }),
  )
})

test('rejects an unknown response type', () => {
  assert.throws(() => parseAgentResponse({ type: 'batch', batch: [] }))
})

test('rejects a quiz proposal with no questions', () => {
  assert.throws(() =>
    parseAgentResponse({
      type: 'proposals',
      batch: [{ kind: 'quiz', itemId: 'item-2', questions: [], rationale: 'x' }],
    }),
  )
})

test('rejects a proposal missing a rationale', () => {
  assert.throws(() =>
    parseAgentResponse({
      type: 'proposals',
      batch: [{ kind: 'page', itemId: 'item-1', bodyHtml: '<p>No rationale</p>' }],
    }),
  )
})
