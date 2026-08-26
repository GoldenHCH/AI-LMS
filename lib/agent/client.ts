import Anthropic from '@anthropic-ai/sdk'

import type { AgentItemContext } from './dto'
import { parseAgentResponse, type AgentResponse } from './proposal.ts'

const MODEL = 'claude-opus-4-8'
const MAX_TOKENS = 16000

export class EmptyResponseError extends Error {}
export class SchemaValidationError extends Error {}
export class AgentRefusalError extends Error {
  readonly category: string | null
  constructor(message: string, category: string | null) {
    super(message)
    this.category = category
  }
}

export type AgentCallInput = {
  requestText: string
  items: AgentItemContext[]
}

const SYSTEM_PROMPT = `You help a professor edit their Canvas course. You will be given the professor's request and a JSON snapshot of the course items it plausibly touches (pages and quizzes only).

Call exactly one tool:
- propose_changes: return a batch of proposed after-states for the affected items. Every proposal needs a one-line rationale.
- ask_clarifying_question: use this instead, once, if the request is too ambiguous to safely propose changes.

Rules:
- Only propose changes to items you were given; never invent items or IDs.
- For quiz questions and answers, reference existing questionId/answerId values only — you cannot add a new question or a new answer option.
- Quiz proposals may edit an existing question's stem, points, or answers, or remove a question entirely.
- If a request implies adding a brand-new question, that isn't supported yet — ask a clarifying question explaining that instead of fabricating one.`

const quizAnswerProposalSchema = {
  type: 'object' as const,
  properties: {
    answerId: { type: 'string' },
    textHtml: { type: 'string' },
    isCorrect: { type: 'boolean' },
    weight: { type: 'number' },
  },
  required: ['answerId'],
}

const quizQuestionProposalSchema = {
  type: 'object' as const,
  properties: {
    questionId: { type: 'string' },
    remove: { type: 'boolean' },
    stemHtml: { type: 'string' },
    pointsPossible: { type: 'number' },
    answers: { type: 'array', items: quizAnswerProposalSchema },
  },
  required: ['questionId'],
}

const pageProposalSchema = {
  type: 'object' as const,
  properties: {
    kind: { const: 'page' },
    itemId: { type: 'string' },
    bodyHtml: { type: 'string' },
    rationale: { type: 'string' },
  },
  required: ['kind', 'itemId', 'bodyHtml', 'rationale'],
}

const quizProposalSchema = {
  type: 'object' as const,
  properties: {
    kind: { const: 'quiz' },
    itemId: { type: 'string' },
    questions: { type: 'array', items: quizQuestionProposalSchema, minItems: 1 },
    rationale: { type: 'string' },
  },
  required: ['kind', 'itemId', 'questions', 'rationale'],
}

const proposeChangesTool: Anthropic.Tool = {
  name: 'propose_changes',
  description:
    'Return the batch of proposed page/quiz edits for this request. Call this OR ask_clarifying_question, never both.',
  input_schema: {
    type: 'object',
    properties: {
      batch: {
        type: 'array',
        items: { anyOf: [pageProposalSchema, quizProposalSchema] },
        minItems: 1,
      },
    },
    required: ['batch'],
  },
}

const askClarifyingQuestionTool: Anthropic.Tool = {
  name: 'ask_clarifying_question',
  description:
    'Ask exactly one clarifying question instead of proposing changes, when the request is ambiguous. Call this OR propose_changes, never both.',
  input_schema: {
    type: 'object',
    properties: {
      question: { type: 'string' },
    },
    required: ['question'],
  },
}

// Narrow structural type (not the full Anthropic class) so tests can inject
// a lightweight fake without implementing the entire SDK client surface.
export type AgentApiClient = {
  messages: {
    create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>
  }
}

export async function callAgent(
  input: AgentCallInput,
  options: { client?: AgentApiClient } = {},
): Promise<AgentResponse> {
  const client = options.client ?? new Anthropic()
  const params = buildRequestParams(input)

  try {
    return extractAgentResponse(await client.messages.create(params))
  } catch (error) {
    if (error instanceof AgentRefusalError) throw error
    if (!(error instanceof EmptyResponseError || error instanceof SchemaValidationError)) {
      throw error
    }
    // The Anthropic SDK already retries timeout/429/5xx natively (maxRetries).
    // This single app-level retry covers only a malformed or empty structured
    // response — never a refusal, which is a content decision, not a fluke.
    return extractAgentResponse(await client.messages.create(params))
  }
}

function buildRequestParams(input: AgentCallInput): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [proposeChangesTool, askClarifyingQuestionTool],
    tool_choice: { type: 'any', disable_parallel_tool_use: true },
    messages: [
      {
        role: 'user',
        content: JSON.stringify({ request: input.requestText, items: input.items }),
      },
    ],
  }
}

function extractAgentResponse(response: Anthropic.Message): AgentResponse {
  if (response.stop_reason === 'refusal') {
    throw new AgentRefusalError(
      response.stop_details?.explanation ?? 'The agent declined this request.',
      response.stop_details?.category ?? null,
    )
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  )
  if (!toolUse) {
    throw new EmptyResponseError('Agent response contained no tool call')
  }

  const raw =
    toolUse.name === 'propose_changes'
      ? { type: 'proposals', batch: (toolUse.input as { batch?: unknown }).batch }
      : { type: 'clarification', question: (toolUse.input as { question?: unknown }).question }

  try {
    return parseAgentResponse(raw)
  } catch (error) {
    throw new SchemaValidationError(
      error instanceof Error ? error.message : 'Invalid agent response shape',
    )
  }
}
