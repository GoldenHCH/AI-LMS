import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { getCourseTree } from '@/lib/courses/getCourseTree'
import { getWorkspaceSession } from '@/lib/workspaces/session'

import { ReviewWorkbench } from './ReviewWorkbench'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Review changes' }

type ReviewPageProps = {
  params: Promise<{ courseId: string }>
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { courseId } = await params
  const session = await getWorkspaceSession()
  if (!session) {
    redirect('/')
  }

  const course = await getCourseTree(courseId, session.workspaceId)
  if (!course) {
    redirect('/')
  }

  return (
    <ReviewWorkbench
      courseId={courseId}
      courseName={course.name}
      expiresAt={course.expiresAt}
    />
  )
}
