import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getCourseTree } from '@/lib/courses/getCourseTree'

import { CourseView } from './CourseView'

export const dynamic = 'force-dynamic'

type CoursePageProps = {
  params: Promise<{ courseId: string }>
}

export async function generateMetadata({ params }: CoursePageProps): Promise<Metadata> {
  const { courseId } = await params
  const course = await getCourseTree(courseId)
  return { title: course?.name ?? 'Course not found' }
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { courseId } = await params
  const course = await getCourseTree(courseId)

  if (!course) {
    notFound()
  }

  return <CourseView course={course} />
}
