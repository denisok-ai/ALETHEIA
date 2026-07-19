/**
 * Проверка права на получение сертификата по шаблону курса (minScore, requiredStatus).
 */
import { prisma } from '@/lib/db';

export interface EligibilityResult {
  eligible: boolean;
  templateId: string | null;
  template?: {
    id: string;
    validityDays: number | null;
    numberingFormat: string | null;
  };
}

/**
 * Находит шаблон по курсу (courseId). Если шаблонов несколько — берёт первый (приоритет можно расширить).
 * Проверяет: score >= template.minScore (если задан), status === template.requiredStatus (если задан).
 * courseScore: 0–100 (например, от прогресса SCORM или 100 при «все уроки завершены»).
 * courseStatus: например "completed".
 */
export async function findCertificateTemplate(courseId: string) {
  return prisma.certificateTemplate.findFirst({
    where: { courseId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function checkCertificateEligibility(
  userId: string,
  courseId: string,
  courseScore?: number,
  courseStatus?: string,
  /**
   * Готовый шаблон курса. Нужен для массовой выдачи: courseId там один на весь
   * прогон, и без этого параметра одинаковый запрос к шаблону повторялся на
   * каждого студента — при выдаче на пару тысяч человек это тысячи лишних
   * обращений к БД. Не передан — ищем сами (одиночная выдача).
   */
  presetTemplate?: Awaited<ReturnType<typeof findCertificateTemplate>>
): Promise<EligibilityResult> {
  const template = presetTemplate !== undefined ? presetTemplate : await findCertificateTemplate(courseId);
  if (!template) {
    return { eligible: true, templateId: null };
  }

  const score = courseScore ?? 100;
  const status = courseStatus ?? 'completed';

  if (template.minScore != null && score < template.minScore) {
    return { eligible: false, templateId: template.id, template: { id: template.id, validityDays: template.validityDays, numberingFormat: template.numberingFormat } };
  }
  if (template.requiredStatus != null && template.requiredStatus.trim() !== '' && status !== template.requiredStatus.trim()) {
    return { eligible: false, templateId: template.id, template: { id: template.id, validityDays: template.validityDays, numberingFormat: template.numberingFormat } };
  }

  return {
    eligible: true,
    templateId: template.id,
    template: { id: template.id, validityDays: template.validityDays, numberingFormat: template.numberingFormat },
  };
}

/**
 * Находит шаблон по курсу для ручной выдачи или расчёта номера/срока.
 */
export async function getTemplateForCourse(courseId: string) {
  return prisma.certificateTemplate.findFirst({
    where: { courseId },
    orderBy: { createdAt: 'asc' },
  });
}
