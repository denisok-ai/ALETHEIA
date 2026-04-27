/**
 * Доступ к прохождению курса (SCORM): запись или курс с openAccessForAllStudents.
 */
import { prisma } from '@/lib/db';

export async function hasCourseLearningAccess(
  userId: string,
  courseId: string,
  role: string | undefined
): Promise<boolean> {
  if (role === 'admin') return true;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { status: true, openAccessForAllStudents: true },
  });
  if (!course) return false;
  if (course.status === 'published' && course.openAccessForAllStudents) {
    return true;
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrollment || enrollment.accessClosed) return false;
  return true;
}
