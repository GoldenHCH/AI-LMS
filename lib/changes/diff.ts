import { parseDocument } from 'htmlparser2'
import serialize from 'dom-serializer'
import type { AnyNode, ChildNode } from 'domhandler'

import type { CoursePage, CourseQuestion, CourseQuiz, CourseItem } from '@/lib/courses/getCourseTree'
import type { ChangeProposal } from '@/lib/agent/proposal'

export type FieldDiff<T> = { before: T; after: T; changed: boolean }

export type PageProposalDiff = {
  kind: 'page'
  itemId: string
  rationale: string
  bodyHtml: FieldDiff<string>
  isSensitive: false
}

export type QuizAnswerDiff = {
  answerId: string
  textHtml: FieldDiff<string> | null
  isCorrect: FieldDiff<boolean | null> | null
  weight: FieldDiff<number | null> | null
}

export type QuizQuestionDiff = {
  questionId: string
  removed: boolean
  stemHtml: FieldDiff<string> | null
  pointsPossible: FieldDiff<number | null> | null
  answers: QuizAnswerDiff[]
}

export type QuizProposalDiff = {
  kind: 'quiz'
  itemId: string
  rationale: string
  questions: QuizQuestionDiff[]
  isSensitive: boolean
}

export type ProposalDiff = PageProposalDiff | QuizProposalDiff

export type ComputeDiffResult =
  | { status: 'ok'; diff: ProposalDiff }
  | { status: 'dropped'; reason: string }

// Server-computed diff against the stored before-state — never trusts the
// agent's own description of what it changed. A proposal that references an
// item/question/answer that doesn't exist, or touches read-only/New Quiz
// content, is dropped whole rather than partially applied.
export function computeProposalDiff(
  beforeItem: CourseItem,
  proposal: ChangeProposal,
): ComputeDiffResult {
  if (proposal.itemId !== beforeItem.id) {
    return {
      status: 'dropped',
      reason: `Proposal itemId ${proposal.itemId} does not match item ${beforeItem.id}`,
    }
  }

  if (proposal.kind === 'page') {
    if (!beforeItem.page) {
      return { status: 'dropped', reason: `Item ${beforeItem.id} is not a page` }
    }
    return {
      status: 'ok',
      diff: {
        kind: 'page',
        itemId: proposal.itemId,
        rationale: proposal.rationale,
        bodyHtml: diffField(beforeItem.page.bodyHtml, proposal.bodyHtml, htmlEquivalent),
        isSensitive: false,
      },
    }
  }

  if (!beforeItem.quiz) {
    return { status: 'dropped', reason: `Item ${beforeItem.id} is not a quiz` }
  }
  if (beforeItem.quiz.engine === 'new') {
    return {
      status: 'dropped',
      reason: 'New Quizzes cannot be edited yet — write-back fidelity is not yet confirmed',
    }
  }
  if (beforeItem.quiz.readOnlyReason) {
    return { status: 'dropped', reason: beforeItem.quiz.readOnlyReason }
  }

  const questionsById = new Map(beforeItem.quiz.questions.map((question) => [question.id, question]))
  const questionDiffs: QuizQuestionDiff[] = []
  let isSensitive = false

  for (const questionProposal of proposal.questions) {
    const beforeQuestion = questionsById.get(questionProposal.questionId)
    if (!beforeQuestion) {
      return {
        status: 'dropped',
        reason: `Question ${questionProposal.questionId} does not exist on item ${beforeItem.id}`,
      }
    }
    if (beforeQuestion.readOnlyReason) {
      return { status: 'dropped', reason: beforeQuestion.readOnlyReason }
    }

    const removed = questionProposal.remove === true
    if (removed) isSensitive = true

    const stemHtml =
      questionProposal.stemHtml === undefined
        ? null
        : diffField(beforeQuestion.stemHtml, questionProposal.stemHtml, htmlEquivalent)

    const pointsPossible =
      questionProposal.pointsPossible === undefined
        ? null
        : diffField<number | null>(beforeQuestion.pointsPossible, questionProposal.pointsPossible)
    if (pointsPossible?.changed) isSensitive = true

    const answersById = new Map(beforeQuestion.answers.map((answer) => [answer.id, answer]))
    const answerDiffs: QuizAnswerDiff[] = []
    for (const answerProposal of questionProposal.answers ?? []) {
      const beforeAnswer = answersById.get(answerProposal.answerId)
      if (!beforeAnswer) {
        return {
          status: 'dropped',
          reason: `Answer ${answerProposal.answerId} does not exist on question ${questionProposal.questionId}`,
        }
      }

      const textHtml =
        answerProposal.textHtml === undefined
          ? null
          : diffField(beforeAnswer.textHtml, answerProposal.textHtml, htmlEquivalent)
      const isCorrect =
        answerProposal.isCorrect === undefined
          ? null
          : diffField<boolean | null>(beforeAnswer.isCorrect, answerProposal.isCorrect)
      if (isCorrect?.changed) isSensitive = true
      const weight =
        answerProposal.weight === undefined
          ? null
          : diffField<number | null>(beforeAnswer.weight, answerProposal.weight)
      if (weight?.changed) isSensitive = true

      answerDiffs.push({ answerId: answerProposal.answerId, textHtml, isCorrect, weight })
    }

    questionDiffs.push({
      questionId: questionProposal.questionId,
      removed,
      stemHtml,
      pointsPossible,
      answers: answerDiffs,
    })
  }

  return {
    status: 'ok',
    diff: {
      kind: 'quiz',
      itemId: proposal.itemId,
      rationale: proposal.rationale,
      questions: questionDiffs,
      isSensitive,
    },
  }
}

function diffField<T>(before: T, after: T, equivalent?: (before: T, after: T) => boolean): FieldDiff<T> {
  const changed = equivalent ? !equivalent(before, after) : before !== after
  return { before, after, changed }
}

function htmlEquivalent(before: string, after: string): boolean {
  if (before === after) return true
  return normalizeHtml(before) === normalizeHtml(after)
}

// Elements whose text content is whitespace-significant per the HTML spec —
// collapsing whitespace inside these would turn genuinely different content
// (e.g. re-indented code in a <pre>) into false "no change" reports.
const WHITESPACE_SIGNIFICANT_TAGS = new Set(['pre', 'textarea'])

// Parses HTML into a DOM tree and normalizes it (sorted attributes,
// collapsed insignificant whitespace) before re-serializing, so whitespace/
// attribute-order differences from the agent's own formatting don't register
// as changes. No global whitespace pass runs on the serialized string —
// that would re-collapse the whitespace this function just preserved inside
// <pre>/<textarea>; per-node normalization below is the only pass.
export function normalizeHtml(html: string): string {
  const document = parseDocument(html)
  normalizeChildren(document.children, false)
  return serialize(document, { decodeEntities: true }).trim()
}

function normalizeChildren(nodes: ChildNode[], preserveWhitespace: boolean): void {
  for (const node of nodes) normalizeNode(node, preserveWhitespace)
}

function normalizeNode(node: AnyNode, preserveWhitespace: boolean): void {
  if (node.type === 'text') {
    if (preserveWhitespace) return
    // A text node made entirely of whitespace is purely cosmetic formatting
    // between tags (indentation/newlines) — drop it rather than collapse it
    // to a stray space, so reformatting alone never produces a "changed"
    // diff. A node with real content still collapses internal runs to one
    // space, since that's insignificant within rendered text.
    node.data = /^\s*$/.test(node.data) ? '' : node.data.replace(/\s+/g, ' ')
    return
  }
  if (node.type === 'tag' || node.type === 'script' || node.type === 'style') {
    const sortedAttribs: Record<string, string> = {}
    for (const key of Object.keys(node.attribs).sort()) {
      sortedAttribs[key] = node.attribs[key]
    }
    node.attribs = sortedAttribs
    normalizeChildren(node.children, preserveWhitespace || WHITESPACE_SIGNIFICANT_TAGS.has(node.name))
  }
}

// Display-only projections of the proposed after-state, for rendering a
// full before/after page (reusing PageDetail as-is). Never used for
// persistence — accept always re-derives the patch from proposed_state via
// the accept_change_proposals RPC, not from these preview objects.
export function applyPagePreview(before: CoursePage, diff: PageProposalDiff): CoursePage {
  return { ...before, bodyHtml: diff.bodyHtml.after }
}

export function applyQuizPreview(before: CourseQuiz, diff: QuizProposalDiff): CourseQuiz {
  const diffsByQuestionId = new Map(diff.questions.map((question) => [question.questionId, question]))
  const questions: CourseQuestion[] = []

  for (const question of before.questions) {
    const questionDiff = diffsByQuestionId.get(question.id)
    if (!questionDiff) {
      questions.push(question)
      continue
    }
    if (questionDiff.removed) continue

    const answersByAnswerId = new Map(questionDiff.answers.map((answer) => [answer.answerId, answer]))
    const answers = question.answers.map((answer) => {
      const answerDiff = answersByAnswerId.get(answer.id)
      if (!answerDiff) return answer
      return {
        ...answer,
        textHtml: answerDiff.textHtml ? answerDiff.textHtml.after : answer.textHtml,
        isCorrect: answerDiff.isCorrect ? answerDiff.isCorrect.after : answer.isCorrect,
        weight: answerDiff.weight ? answerDiff.weight.after : answer.weight,
      }
    })

    questions.push({
      ...question,
      stemHtml: questionDiff.stemHtml ? questionDiff.stemHtml.after : question.stemHtml,
      pointsPossible: questionDiff.pointsPossible
        ? questionDiff.pointsPossible.after
        : question.pointsPossible,
      answers,
    })
  }

  return { ...before, questionCount: questions.length, questions }
}
