import { z } from 'zod'

// Approach A explicitly defers question-adding and answer-option-adding to a
// later milestone (both need a stable new ID scheme the agent can't generate
// safely yet) — every question/answer reference below must match an existing
// stored ID, never introduce one.

const pageProposalSchema = z.object({
  kind: z.literal('page'),
  itemId: z.string().min(1),
  bodyHtml: z.string(),
  rationale: z.string().min(1),
})

// The context sent to the model types isCorrect/weight/pointsPossible as
// `T | null` (see AgentQuizAnswerContext/AgentQuizQuestionContext in dto.ts),
// so a model that echoes an explicit `null` back — instead of omitting the
// key — must not fail validation. `.nullish()` accepts both, and the
// transform folds null back to undefined so downstream code's existing
// `=== undefined` check ("field not touched") still holds; an explicit
// null must never be read as "set this field to null."
const optionalNumberField = z
  .number()
  .nullish()
  .transform((value) => value ?? undefined)
const optionalBooleanField = z
  .boolean()
  .nullish()
  .transform((value) => value ?? undefined)

const quizAnswerProposalSchema = z.object({
  answerId: z.string().min(1),
  textHtml: z.string().optional(),
  isCorrect: optionalBooleanField,
  weight: optionalNumberField,
})

const quizQuestionProposalSchema = z.object({
  questionId: z.string().min(1),
  remove: z.boolean().optional(),
  stemHtml: z.string().optional(),
  pointsPossible: optionalNumberField,
  answers: z.array(quizAnswerProposalSchema).optional(),
})

const quizProposalSchema = z.object({
  kind: z.literal('quiz'),
  itemId: z.string().min(1),
  questions: z.array(quizQuestionProposalSchema).min(1),
  rationale: z.string().min(1),
})

export const changeProposalSchema = z.discriminatedUnion('kind', [
  pageProposalSchema,
  quizProposalSchema,
])

// Validates only the envelope shape here — each batch item is validated
// individually in parseAgentResponse below, so one malformed proposal from
// the model doesn't invalidate an otherwise-usable batch.
const rawAgentResponseSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('proposals'),
    batch: z.array(z.unknown()).min(1),
  }),
  z.object({
    type: z.literal('clarification'),
    question: z.string().min(1),
  }),
])

export type QuizAnswerProposal = z.infer<typeof quizAnswerProposalSchema>
export type QuizQuestionProposal = z.infer<typeof quizQuestionProposalSchema>
export type PageProposal = z.infer<typeof pageProposalSchema>
export type QuizProposal = z.infer<typeof quizProposalSchema>
export type ChangeProposal = z.infer<typeof changeProposalSchema>
export type AgentResponse =
  | { type: 'proposals'; batch: ChangeProposal[]; malformedCount: number }
  | { type: 'clarification'; question: string }

// Per-item parsing: a single malformed proposal (bad shape, unknown kind) is
// dropped and counted rather than failing the whole response — the caller
// folds malformedCount into the same droppedCount it reports for proposals
// computeProposalDiff rejects. Only throws if the envelope itself is invalid
// or literally nothing in the batch parses.
export function parseAgentResponse(value: unknown): AgentResponse {
  const envelope = rawAgentResponseSchema.parse(value)
  if (envelope.type === 'clarification') return envelope

  const batch: ChangeProposal[] = []
  let malformedCount = 0
  for (const item of envelope.batch) {
    const result = changeProposalSchema.safeParse(item)
    if (result.success) {
      batch.push(result.data)
    } else {
      malformedCount += 1
    }
  }
  if (batch.length === 0) {
    throw new Error('Every proposal in the agent response was malformed')
  }
  return { type: 'proposals', batch, malformedCount }
}
