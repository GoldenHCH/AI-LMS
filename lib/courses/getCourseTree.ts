import 'server-only'

import { cache } from 'react'
import sanitizeHtml from 'sanitize-html'

import type { Json } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'

export type ItemKind = 'page' | 'quiz' | 'file' | 'opaque'
export type QuizEngine = 'classic' | 'new'

export type CoursePage = {
  id: string
  title: string
  bodyHtml: string
  published: boolean | null
  frontPage: boolean | null
}

export type CourseAnswer = {
  id: string
  ordinal: number
  textHtml: string
  weight: number | null
  isCorrect: boolean | null
  commentsHtml: string | null
}

export type CourseQuestion = {
  id: string
  position: number
  questionType: string
  stemHtml: string
  pointsPossible: number | null
  readOnlyReason: string | null
  answers: CourseAnswer[]
}

export type CourseQuiz = {
  id: string
  title: string
  engine: QuizEngine
  descriptionHtml: string
  pointsPossible: number | null
  questionCount: number
  readOnlyReason: string | null
  questions: CourseQuestion[]
}

export type CourseFile = {
  id: string
  displayName: string
  contentType: string | null
  url: string
}

export type CourseItem = {
  id: string
  position: number
  kind: ItemKind
  title: string
  opaque: Record<string, Json | undefined> | null
  page: CoursePage | null
  quiz: CourseQuiz | null
  file: CourseFile | null
}

export type CourseModule = {
  id: string
  name: string
  position: number
  items: CourseItem[]
}

export type CourseImportIssue = {
  phase: string
  canvasId: string | null
  message: string
}

export type CourseTree = {
  id: string
  canvasCourseId: string
  name: string
  importStatus: 'complete' | 'partial'
  importIssues: CourseImportIssue[]
  modules: CourseModule[]
  files: CourseFile[]
  moduleCount: number
  itemCount: number
}

export type CourseSummary = Pick<
  CourseTree,
  'id' | 'canvasCourseId' | 'name' | 'moduleCount' | 'itemCount'
>

type RawAnswer = {
  id: string
  ordinal: number
  text_html: string
  weight: number | null
  is_correct: boolean | null
  comments_html: string | null
}

type RawQuestion = {
  id: string
  position: number
  question_type: string
  stem_html: string
  points_possible: number | null
  read_only_reason: string | null
  quiz_answers: RawAnswer[] | null
}

type RawQuiz = {
  id: string
  title: string
  engine: string
  description_html: string
  points_possible: number | null
  question_count: number
  read_only_reason: string | null
  quiz_questions: RawQuestion[] | null
}

type RawPage = {
  id: string
  title: string
  body_html: string
  published: boolean | null
  front_page: boolean | null
}

type RawFile = {
  id: string
  module_item_id: string | null
  display_name: string
  content_type: string | null
  url: string
}

type RawItem = {
  id: string
  position: number
  kind: string
  opaque: Json | null
  pages: RawPage | RawPage[] | null
  quizzes: RawQuiz | RawQuiz[] | null
  files: RawFile[] | null
}

type RawModule = {
  id: string
  name: string
  position: number
  module_items: RawItem[] | null
}

type RawCourse = {
  id: string
  canvas_course_id: string
  name: string
  import_status: string
  import_issues: Json
  modules: RawModule[] | null
  files: RawFile[] | null
}

const COURSE_TREE_SELECT = `
  id,
  canvas_course_id,
  name,
  import_status,
  import_issues,
  modules!modules_course_id_fkey (
    id,
    name,
    position,
    module_items!module_items_module_id_fkey (
      id,
      position,
      kind,
      opaque,
      pages!pages_module_item_id_fkey (
        id,
        title,
        body_html,
        published,
        front_page
      ),
      quizzes!quizzes_module_item_id_fkey (
        id,
        title,
        engine,
        description_html,
        points_possible,
        question_count,
        read_only_reason,
        quiz_questions!quiz_questions_quiz_id_fkey (
          id,
          position,
          question_type,
          stem_html,
          points_possible,
          read_only_reason,
          quiz_answers!quiz_answers_question_id_fkey (
            id,
            ordinal,
            text_html,
            weight,
            is_correct,
            comments_html
          )
        )
      ),
      files!files_module_item_id_fkey (
        id,
        module_item_id,
        display_name,
        content_type,
        url
      )
    )
  ),
  files!files_course_id_fkey (
    id,
    module_item_id,
    display_name,
    content_type,
    url
  )
`

export const getCourseTree = cache(async function getCourseTree(
  courseId: string,
): Promise<CourseTree | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('courses')
    .select(COURSE_TREE_SELECT)
    .eq('id', courseId)
    .maybeSingle()

  if (error) {
    throw new Error(`Could not load course tree: ${error.message}`)
  }
  if (!data) {
    return null
  }

  return mapCourse(data as unknown as RawCourse)
})

export async function listCourseSummaries(): Promise<CourseSummary[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('courses')
    .select(
      `
        id,
        canvas_course_id,
        name,
        modules!modules_course_id_fkey (
          id,
          module_items!module_items_module_id_fkey (id)
        )
      `,
    )
    .order('imported_at', { ascending: false })

  if (error) {
    throw new Error(`Could not load courses: ${error.message}`)
  }

  return (data ?? []).map((course) => ({
    id: course.id,
    canvasCourseId: course.canvas_course_id,
    name: course.name,
    moduleCount: course.modules?.length ?? 0,
    itemCount:
      course.modules?.reduce(
        (count, module) => count + (module.module_items?.length ?? 0),
        0,
      ) ?? 0,
  }))
}

function mapCourse(raw: RawCourse): CourseTree {
  const modules = [...(raw.modules ?? [])]
    .sort(byPosition)
    .map((module) => ({
      id: module.id,
      name: module.name,
      position: module.position,
      items: [...(module.module_items ?? [])].sort(byPosition).map(mapItem),
    }))

  return {
    id: raw.id,
    canvasCourseId: raw.canvas_course_id,
    name: raw.name,
    importStatus: raw.import_status === 'partial' ? 'partial' : 'complete',
    importIssues: mapImportIssues(raw.import_issues),
    modules,
    files: (raw.files ?? [])
      .filter((file) => file.module_item_id === null)
      .map(mapFile),
    moduleCount: modules.length,
    itemCount: modules.reduce((count, module) => count + module.items.length, 0),
  }
}

function mapImportIssues(value: Json): CourseImportIssue[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 100).flatMap((entry) => {
    const record = asObject(entry)
    if (!record) return []
    const phase = typeof record.phase === 'string' ? record.phase.slice(0, 64) : 'resource'
    const canvasId =
      typeof record.canvasId === 'string' ? record.canvasId.slice(0, 128) : null
    const message =
      typeof record.message === 'string'
        ? record.message.slice(0, 160)
        : 'Canvas resource could not be imported'
    return [{ phase, canvasId, message }]
  })
}

function mapItem(raw: RawItem): CourseItem {
  const kind = itemKind(raw.kind)
  const page = first(raw.pages)
  const quiz = first(raw.quizzes)
  const file = first(raw.files)
  const opaque = asObject(raw.opaque)

  return {
    id: raw.id,
    position: raw.position,
    kind,
    title:
      page?.title ??
      quiz?.title ??
      file?.display_name ??
      jsonString(opaque?.title) ??
      'Untitled item',
    opaque,
    page: page
      ? {
          id: page.id,
          title: page.title,
          bodyHtml: cleanHtml(page.body_html),
          published: page.published,
          frontPage: page.front_page,
        }
      : null,
    quiz: quiz ? mapQuiz(quiz) : null,
    file: file ? mapFile(file) : null,
  }
}

function mapQuiz(raw: RawQuiz): CourseQuiz {
  return {
    id: raw.id,
    title: raw.title,
    engine: quizEngine(raw.engine),
    descriptionHtml: cleanHtml(raw.description_html),
    pointsPossible: raw.points_possible,
    questionCount: raw.question_count,
    readOnlyReason: raw.read_only_reason,
    questions: [...(raw.quiz_questions ?? [])].sort(byPosition).map((question) => ({
      id: question.id,
      position: question.position,
      questionType: question.question_type,
      stemHtml: cleanHtml(question.stem_html),
      pointsPossible: question.points_possible,
      readOnlyReason: question.read_only_reason,
      answers: [...(question.quiz_answers ?? [])]
        .sort((left, right) => left.ordinal - right.ordinal)
        .map((answer) => ({
          id: answer.id,
          ordinal: answer.ordinal,
          textHtml: cleanHtml(answer.text_html),
          weight: answer.weight,
          isCorrect: answer.is_correct,
          commentsHtml:
            answer.comments_html === null
              ? null
              : cleanHtml(answer.comments_html),
        })),
    })),
  }
}

function mapFile(raw: RawFile): CourseFile {
  return {
    id: raw.id,
    displayName: raw.display_name,
    contentType: raw.content_type,
    url: safeExternalUrl(raw.url),
  }
}

function cleanHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      'article',
      'aside',
      'figure',
      'figcaption',
      'footer',
      'header',
      'img',
      'main',
      'section',
    ],
    allowedAttributes: {
      '*': ['class', 'dir', 'lang', 'title', 'data-*'],
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      ol: ['start', 'type'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan', 'scope'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attributes) => ({
        tagName: 'a',
        attribs: {
          ...attributes,
          ...(attributes.target === '_blank'
            ? { rel: 'noopener noreferrer' }
            : {}),
        },
      }),
      img: (_tagName, attributes) => ({
        tagName: 'img',
        attribs: {
          ...attributes,
          alt: attributes.alt ?? '',
        },
      }),
    },
  })
}

function safeExternalUrl(value: string): string {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? value : ''
  } catch {
    return ''
  }
}

function itemKind(value: string): ItemKind {
  if (value === 'page' || value === 'quiz' || value === 'file' || value === 'opaque') {
    return value
  }
  throw new Error(`Unsupported module item kind: ${value}`)
}

function quizEngine(value: string): QuizEngine {
  if (value === 'classic' || value === 'new') {
    return value
  }
  throw new Error(`Unsupported quiz engine: ${value}`)
}

function first<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }
  return value
}

function asObject(value: Json | null): Record<string, Json | undefined> | null {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value
  }
  return null
}

function jsonString(value: Json | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function byPosition<T extends { position: number }>(left: T, right: T): number {
  return left.position - right.position
}
