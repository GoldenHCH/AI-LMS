import assert from 'node:assert/strict'
import test from 'node:test'

import { toAgentContext } from '../../lib/agent/dto.ts'
import type { CourseItem } from '../../lib/courses/getCourseTree.ts'

test('page context carries only title and bodyHtml', () => {
  const item: CourseItem = {
    id: 'item-1',
    position: 0,
    kind: 'page',
    title: 'Syllabus',
    opaque: { canvasPageId: 'canvas-page-1' },
    page: {
      id: 'item-1',
      title: 'Syllabus',
      bodyHtml: '<p>Late work is due within 48 hours.</p>',
      published: true,
      frontPage: false,
    },
    quiz: null,
    file: null,
  }

  const context = toAgentContext(item)

  assert.deepEqual(context, {
    itemId: 'item-1',
    kind: 'page',
    title: 'Syllabus',
    bodyHtml: '<p>Late work is due within 48 hours.</p>',
  })
})

test('quiz context carries only stem, points, and answers', () => {
  const item: CourseItem = {
    id: 'item-2',
    position: 0,
    kind: 'quiz',
    title: 'Policy Quiz',
    opaque: null,
    page: null,
    quiz: {
      id: 'item-2',
      title: 'Policy Quiz',
      engine: 'classic',
      descriptionHtml: '<p>Instructions</p>',
      pointsPossible: 10,
      questionCount: 1,
      readOnlyReason: null,
      questions: [
        {
          id: 'q-1',
          position: 0,
          questionType: 'multiple_choice_question',
          stemHtml: '<p>When is late work accepted?</p>',
          pointsPossible: 10,
          readOnlyReason: null,
          answers: [
            {
              id: 'a-1',
              ordinal: 0,
              textHtml: '<p>Within 48 hours</p>',
              weight: 100,
              isCorrect: true,
              commentsHtml: null,
            },
          ],
        },
      ],
    },
    file: null,
  }

  const context = toAgentContext(item)

  assert.deepEqual(context, {
    itemId: 'item-2',
    kind: 'quiz',
    title: 'Policy Quiz',
    questions: [
      {
        questionId: 'q-1',
        stemHtml: '<p>When is late work accepted?</p>',
        pointsPossible: 10,
        answers: [
          { answerId: 'a-1', textHtml: '<p>Within 48 hours</p>', isCorrect: true, weight: 100 },
        ],
      },
    ],
  })
})

test('returns null for file and opaque items', () => {
  const file: CourseItem = {
    id: 'item-3',
    position: 0,
    kind: 'file',
    title: 'notes.pdf',
    opaque: null,
    page: null,
    quiz: null,
    file: { id: 'file-1', displayName: 'notes.pdf', contentType: 'application/pdf', url: '' },
  }

  assert.equal(toAgentContext(file), null)
})
