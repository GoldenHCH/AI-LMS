import type { CourseItem } from '@/lib/courses/getCourseTree'

export type AgentPageContext = {
  itemId: string
  kind: 'page'
  title: string
  bodyHtml: string
}

export type AgentQuizAnswerContext = {
  answerId: string
  textHtml: string
  isCorrect: boolean | null
  weight: number | null
}

export type AgentQuizQuestionContext = {
  questionId: string
  stemHtml: string
  pointsPossible: number | null
  answers: AgentQuizAnswerContext[]
}

export type AgentQuizContext = {
  itemId: string
  kind: 'quiz'
  title: string
  questions: AgentQuizQuestionContext[]
}

export type AgentItemContext = AgentPageContext | AgentQuizContext

// Minimal outbound DTO: title, body/stem HTML, existing answers/points only.
// Explicitly excludes raw_payload, canvas IDs, links, and opaque data — a
// deliberate data boundary for what reaches the LLM provider, not an
// accident of CourseItem's shape (CourseItem already omits those fields,
// but this DTO is the contract that should hold even if CourseItem changes).
export function toAgentContext(item: CourseItem): AgentItemContext | null {
  if (item.page) {
    return {
      itemId: item.id,
      kind: 'page',
      title: item.page.title,
      bodyHtml: item.page.bodyHtml,
    }
  }
  if (item.quiz) {
    return {
      itemId: item.id,
      kind: 'quiz',
      title: item.quiz.title,
      questions: item.quiz.questions.map((question) => ({
        questionId: question.id,
        stemHtml: question.stemHtml,
        pointsPossible: question.pointsPossible,
        answers: question.answers.map((answer) => ({
          answerId: answer.id,
          textHtml: answer.textHtml,
          isCorrect: answer.isCorrect,
          weight: answer.weight,
        })),
      })),
    }
  }
  return null
}
