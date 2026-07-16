import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { getCourseTree } from '@/lib/courses/getCourseTree'
import { getWorkspaceSession } from '@/lib/workspaces/session'

import { CourseView } from './CourseView'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Course workspace' }

type CoursePageProps = {
  params: Promise<{ courseId: string }>
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { courseId } = await params
  const session = await getWorkspaceSession()
  if (!session) {
    redirect('/')
  }

  const course = await getCourseTree(courseId, session.workspaceId)

  if (!course) {
    redirect('/')
  }

  return <CourseView course={course} />
}
