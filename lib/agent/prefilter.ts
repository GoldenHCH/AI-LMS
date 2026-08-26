import type { CourseItem, CourseTree } from '@/lib/courses/getCourseTree'

export const PRE_FILTER_ITEM_CAP = 20

const MIN_KEYWORD_LENGTH = 3
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'this', 'that', 'these', 'those',
  'it', 'its', 'as', 'at', 'by', 'from', 'into', 'about',
])

export type FilteredItem = {
  moduleId: string
  moduleName: string
  item: CourseItem
}

// Zero-match and too-broad are distinct outcomes the caller must handle
// explicitly (T5 / design doc's item-count cap) — never silently proceed
// with an empty or oversized snapshot.
export type PreFilterResult =
  | { status: 'ok'; items: FilteredItem[] }
  | { status: 'zero-match' }
  | { status: 'too-broad'; matchCount: number }

// Blunt keyword/title-substring match over the course tree, not semantic
// search — false negatives (a relevant item with no matching keyword) are
// an accepted MVP limitation per the design doc.
export function prefilterCourseTree(
  tree: CourseTree,
  requestText: string,
): PreFilterResult {
  const keywords = extractKeywords(requestText)
  const matches: FilteredItem[] = []

  for (const module of tree.modules) {
    for (const item of module.items) {
      if (item.kind !== 'page' && item.kind !== 'quiz') continue
      if (matchesKeywords(item, keywords)) {
        matches.push({ moduleId: module.id, moduleName: module.name, item })
      }
    }
  }

  if (matches.length === 0) return { status: 'zero-match' }
  if (matches.length > PRE_FILTER_ITEM_CAP) {
    return { status: 'too-broad', matchCount: matches.length }
  }
  return { status: 'ok', items: matches }
}

function extractKeywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= MIN_KEYWORD_LENGTH && !STOPWORDS.has(word)),
    ),
  )
}

function matchesKeywords(item: CourseItem, keywords: string[]): boolean {
  if (keywords.length === 0) return false
  const haystack = itemSearchText(item)
  // Word-boundary match, not plain substring — otherwise "late" would false-
  // match inside unrelated words like "unrelated". Keywords are pre-filtered
  // to [a-z0-9]+ by extractKeywords, so they're safe to embed in a regex.
  return keywords.some((keyword) => new RegExp(`\\b${keyword}\\b`).test(haystack))
}

function itemSearchText(item: CourseItem): string {
  const parts: string[] = [item.title]
  if (item.page) {
    parts.push(item.page.title, stripHtml(item.page.bodyHtml))
  }
  if (item.quiz) {
    parts.push(item.quiz.title, stripHtml(item.quiz.descriptionHtml))
    for (const question of item.quiz.questions) {
      parts.push(stripHtml(question.stemHtml))
      for (const answer of question.answers) {
        parts.push(stripHtml(answer.textHtml))
      }
    }
  }
  return parts.join(' ').toLowerCase()
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ')
}
