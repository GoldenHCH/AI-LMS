import assert from 'node:assert/strict'
import test from 'node:test'

import { PRE_FILTER_ITEM_CAP, prefilterCourseTree } from '../../lib/agent/prefilter.ts'
import type { CourseItem, CourseModule, CourseTree } from '../../lib/courses/getCourseTree.ts'

function pageItem(id: string, title: string, bodyHtml: string): CourseItem {
  return {
    id,
    position: 0,
    kind: 'page',
    title,
    opaque: null,
    page: { id, title, bodyHtml, published: true, frontPage: false },
    quiz: null,
    file: null,
  }
}

function quizItem(id: string, title: string, stemHtml: string): CourseItem {
  return {
    id,
    position: 0,
    kind: 'quiz',
    title,
    opaque: null,
    page: null,
    quiz: {
      id,
      title,
      engine: 'classic',
      descriptionHtml: '',
      pointsPossible: 10,
      questionCount: 1,
      readOnlyReason: null,
      questions: [
        {
          id: `${id}-q1`,
          position: 0,
          questionType: 'multiple_choice_question',
          stemHtml,
          pointsPossible: 10,
          readOnlyReason: null,
          answers: [],
        },
      ],
    },
    file: null,
  }
}

function tree(modules: CourseModule[]): CourseTree {
  return {
    id: 'course-1',
    canvasCourseId: 'canvas-1',
    name: 'Test Course',
    expiresAt: new Date().toISOString(),
    importStatus: 'complete',
    importIssues: [],
    modules,
    files: [],
    moduleCount: modules.length,
    itemCount: modules.reduce((count, module) => count + module.items.length, 0),
  }
}

test('matches a page by body text', () => {
  const course = tree([
    {
      id: 'mod-1',
      name: 'Module 1',
      position: 0,
      items: [
        pageItem('item-1', 'Syllabus', '<p>Late work is due within 48 hours.</p>'),
        pageItem('item-2', 'Unrelated page', '<p>Nothing relevant here.</p>'),
      ],
    },
  ])

  const result = prefilterCourseTree(course, 'update the late-work policy')

  assert.equal(result.status, 'ok')
  if (result.status === 'ok') {
    assert.deepEqual(result.items.map((match) => match.item.id), ['item-1'])
  }
})

test('matches a quiz by question stem text', () => {
  const course = tree([
    {
      id: 'mod-1',
      name: 'Module 1',
      position: 0,
      items: [quizItem('item-1', 'Policy Quiz', '<p>When is late work accepted?</p>')],
    },
  ])

  const result = prefilterCourseTree(course, 'late work deadline change')

  assert.equal(result.status, 'ok')
  if (result.status === 'ok') {
    assert.equal(result.items.length, 1)
    assert.equal(result.items[0].item.id, 'item-1')
  }
})

test('returns zero-match when nothing matches', () => {
  const course = tree([
    {
      id: 'mod-1',
      name: 'Module 1',
      position: 0,
      items: [pageItem('item-1', 'Syllabus', '<p>Nothing about grading here.</p>')],
    },
  ])

  const result = prefilterCourseTree(course, 'update the quantum mechanics section')

  assert.equal(result.status, 'zero-match')
})

test('returns zero-match when the request has no substantive keywords', () => {
  const course = tree([
    {
      id: 'mod-1',
      name: 'Module 1',
      position: 0,
      items: [pageItem('item-1', 'Syllabus', '<p>Some content.</p>')],
    },
  ])

  const result = prefilterCourseTree(course, 'the and of')

  assert.equal(result.status, 'zero-match')
})

test('returns too-broad when matches exceed the item cap', () => {
  const items = Array.from({ length: PRE_FILTER_ITEM_CAP + 1 }, (_, index) =>
    pageItem(`item-${index}`, `Deadline page ${index}`, '<p>deadline content</p>'),
  )
  const course = tree([{ id: 'mod-1', name: 'Module 1', position: 0, items }])

  const result = prefilterCourseTree(course, 'update every deadline')

  assert.equal(result.status, 'too-broad')
  if (result.status === 'too-broad') {
    assert.equal(result.matchCount, PRE_FILTER_ITEM_CAP + 1)
  }
})

test('ignores file and opaque items', () => {
  const course = tree([
    {
      id: 'mod-1',
      name: 'Module 1',
      position: 0,
      items: [
        {
          id: 'item-1',
          position: 0,
          kind: 'file',
          title: 'deadline-schedule.pdf',
          opaque: null,
          page: null,
          quiz: null,
          file: { id: 'file-1', displayName: 'deadline-schedule.pdf', contentType: 'application/pdf', url: '' },
        },
      ],
    },
  ])

  const result = prefilterCourseTree(course, 'update the deadline schedule')

  assert.equal(result.status, 'zero-match')
})
