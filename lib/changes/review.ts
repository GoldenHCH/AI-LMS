import 'server-only'

import type { CourseItem, CoursePage, CourseQuiz, CourseTree } from '@/lib/courses/getCourseTree'

import type { ChangeProposalRecord, ProposalStatus } from './changeBatch'
import { applyPagePreview, applyQuizPreview, computeProposalDiff, type ProposalDiff } from './diff'

export type ReviewProposal = {
  id: string
  itemId: string
  itemTitle: string
  kind: 'page' | 'quiz'
  rationale: string
  status: ProposalStatus
  isSensitive: boolean
  // null only if the stored item can no longer be found, or the proposal
  // failed the round-trip check — shouldn't happen inside the 30-minute
  // workspace window, but the before-state is recomputed fresh every read,
  // so this stays defensive rather than assumed.
  diff: ProposalDiff | null
  beforePage: CoursePage | null
  afterPage: CoursePage | null
  beforeQuiz: CourseQuiz | null
  afterQuiz: CourseQuiz | null
}

// Diffs (and the after-state preview) are never persisted — recomputed here
// against a freshly-fetched course tree every time a batch is read, since
// nothing else writes to module_items/pages/quizzes during the review
// window.
export function buildReviewProposals(
  tree: CourseTree,
  records: ChangeProposalRecord[],
): ReviewProposal[] {
  const itemsById = new Map<string, CourseItem>()
  for (const module of tree.modules) {
    for (const item of module.items) itemsById.set(item.id, item)
  }

  return records.map((record) => {
    const item = itemsById.get(record.itemId)
    const diffResult = item ? computeProposalDiff(item, record.proposedState) : null
    const diff = diffResult && diffResult.status === 'ok' ? diffResult.diff : null

    const beforePage = diff?.kind === 'page' ? (item?.page ?? null) : null
    const beforeQuiz = diff?.kind === 'quiz' ? (item?.quiz ?? null) : null

    return {
      id: record.id,
      itemId: record.itemId,
      itemTitle: item?.title ?? 'Unknown item',
      kind: record.kind,
      rationale: record.rationale,
      status: record.status,
      isSensitive: record.isSensitive,
      diff,
      beforePage,
      afterPage: diff?.kind === 'page' && beforePage ? applyPagePreview(beforePage, diff) : null,
      beforeQuiz,
      afterQuiz: diff?.kind === 'quiz' && beforeQuiz ? applyQuizPreview(beforeQuiz, diff) : null,
    }
  })
}
