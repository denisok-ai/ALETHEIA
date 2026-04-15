/**
 * Media access control: check if a student can access media by course enrollment or group membership.
 *
 * Правила доступа:
 * - Если media.courseId задан: доступ только при активном enrollment на этот курс.
 * - Если media привязан к группам (mediaGroups): доступ только при членстве в одной из групп.
 * - Если media без courseId и без mediaGroups: доступ любому авторизованному пользователю (публичный ресурс).
 *   Это intentional: неразмещённые в курсах/группах материалы считаются общими для всех студентов.
 */
import { prisma } from '@/lib/db';

export async function canStudentAccessMedia(
  userId: string,
  media: { courseId: string | null; mediaGroups?: { groupId: string }[] }
): Promise<boolean> {
  if (media.courseId) {
    const enrollment = await prisma.enrollment.findFirst({
      where: { userId, courseId: media.courseId, accessClosed: false },
    });
    if (enrollment) return true;
  }
  const mediaGroupIds = media.mediaGroups?.map((mg) => mg.groupId) ?? [];
  if (mediaGroupIds.length > 0) {
    const userGroup = await prisma.userGroup.findFirst({
      where: { userId, groupId: { in: mediaGroupIds } },
    });
    if (userGroup) return true;
    return false;
  }
  return true;
}
