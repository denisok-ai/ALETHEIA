/**
 * Подстановки в текстах для публичного чата и AI-тьютора курса.
 * В админке в базе знаний / playbook можно использовать {{COURSE_URL}}, {{PORTAL_URL}} и т.д.
 */

export type PublicChatPlaceholderCtx = {
  siteBase: string;
  courseUrl: string;
  supportEmail: string;
};

/** Публичный чат (лендинг): база знаний и шаблоны промпта. */
export function applyPublicChatPlaceholders(text: string, ctx: PublicChatPlaceholderCtx): string {
  const pricing = `${ctx.siteBase}/#pricing`;
  const portal = `${ctx.siteBase}/portal`;
  const dashboard = `${ctx.siteBase}/portal/student/dashboard`;
  return text
    .replace(/\{\{COURSE_URL\}\}/g, ctx.courseUrl)
    .replace(/\{\{PORTAL_URL\}\}/g, portal)
    .replace(/\{\{STUDENT_DASHBOARD_URL\}\}/g, dashboard)
    .replace(/\{\{PRICING_URL\}\}/g, pricing)
    .replace(/\{\{SUPPORT_EMAIL\}\}/g, ctx.supportEmail);
}

export type CourseTutorPlaceholderCtx = PublicChatPlaceholderCtx & { courseId: string };

/** Инструкция тьютора в плеере: те же плюс ссылки на конкретный курс. */
export function applyCourseTutorPlaceholders(text: string, ctx: CourseTutorPlaceholderCtx): string {
  const withPublic = applyPublicChatPlaceholders(text, ctx);
  const courseBase = `${ctx.siteBase}/portal/student/courses/${ctx.courseId}`;
  return withPublic
    .replace(/\{\{PORTAL_COURSE_URL\}\}/g, courseBase)
    .replace(/\{\{PORTAL_COURSE_PLAY_URL\}\}/g, `${courseBase}/play`);
}
