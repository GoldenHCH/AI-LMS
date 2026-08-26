import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AgentRefusalError,
  EmptyResponseError,
  SchemaValidationError,
  callAgent,
  type AgentApiClient,
} from '../../lib/agent/client.ts'

function fakeClient(responses: unknown[]): { client: AgentApiClient; callCount: () => number } {
  let calls = 0
  return {
    client: {
      messages: {
        create: async () => {
          const response = responses[Math.min(calls, responses.length - 1)]
          calls += 1
          return response as never
        },
      },
    },
    callCount: () => calls,
  }
}

function toolUseResponse(name: string, input: unknown, stopReason = 'tool_use') {
  return {
    stop_reason: stopReason,
    stop_details: null,
    content: [{ type: 'tool_use', id: 'toolu_1', name, input }],
  }
}

test('parses a propose_changes tool call into a proposals response', async () => {
  const { client, callCount } = fakeClient([
    toolUseResponse('propose_changes', {
      batch: [
        {
          kind: 'page',
          itemId: 'item-1',
          bodyHtml: '<p>Updated</p>',
          rationale: 'Extends the deadline.',
        },
      ],
    }),
  ])

  const result = await callAgent({ requestText: 'extend the deadline', items: [] }, { client })

  assert.equal(result.type, 'proposals')
  assert.equal(callCount(), 1)
})

test('parses an ask_clarifying_question tool call into a clarification response', async () => {
  const { client, callCount } = fakeClient([
    toolUseResponse('ask_clarifying_question', { question: 'Which module do you mean?' }),
  ])

  const result = await callAgent({ requestText: 'update it', items: [] }, { client })

  assert.deepEqual(result, { type: 'clarification', question: 'Which module do you mean?' })
  assert.equal(callCount(), 1)
})

test('throws AgentRefusalError on refusal without retrying', async () => {
  const { client, callCount } = fakeClient([
    {
      stop_reason: 'refusal',
      stop_details: { category: 'cyber', explanation: 'Declined.' },
      content: [],
    },
  ])

  await assert.rejects(
    callAgent({ requestText: 'do something unsafe', items: [] }, { client }),
    (error: unknown) => {
      assert.ok(error instanceof AgentRefusalError)
      assert.equal(error.category, 'cyber')
      return true
    },
  )
  assert.equal(callCount(), 1)
})

test('retries once on an empty response, then throws if still empty', async () => {
  const empty = { stop_reason: 'end_turn', stop_details: null, content: [] }
  const { client, callCount } = fakeClient([empty, empty])

  await assert.rejects(
    callAgent({ requestText: 'do something', items: [] }, { client }),
    EmptyResponseError,
  )
  assert.equal(callCount(), 2)
})

test('retries once on a malformed tool response, then succeeds', async () => {
  const { client, callCount } = fakeClient([
    toolUseResponse('propose_changes', { batch: [{ kind: 'page', itemId: 'item-1' }] }), // missing bodyHtml/rationale
    toolUseResponse('propose_changes', {
      batch: [
        {
          kind: 'page',
          itemId: 'item-1',
          bodyHtml: '<p>Fixed</p>',
          rationale: 'Second attempt is valid.',
        },
      ],
    }),
  ])

  const result = await callAgent({ requestText: 'update the page', items: [] }, { client })

  assert.equal(result.type, 'proposals')
  assert.equal(callCount(), 2)
})

test('retries once on a malformed tool response, then throws if still invalid', async () => {
  const malformed = toolUseResponse('propose_changes', { batch: [{ kind: 'page', itemId: 'item-1' }] })
  const { client, callCount } = fakeClient([malformed, malformed])

  await assert.rejects(
    callAgent({ requestText: 'update the page', items: [] }, { client }),
    SchemaValidationError,
  )
  assert.equal(callCount(), 2)
})
