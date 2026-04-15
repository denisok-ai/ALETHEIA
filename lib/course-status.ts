/**
 * Статусы курса (мероприятия): подписи и описание для админки и карточки.
 */
export const COURSE_STATUS = {
  draft: 'В разработке',
  published: 'Опубликован',
  cancelled: 'Отменено',
  archived: 'В архиве',
} as const;

export type CourseStatusKey = keyof typeof COURSE_STATUS;

export const COURSE_STATUS_OPTIONS: { value: CourseStatusKey; label: string }[] = [
  { value: 'draft', label: COURSE_STATUS.draft },
  { value: 'published', label: COURSE_STATUS.published },
  { value: 'cancelled', label: COURSE_STATUS.cancelled },
  { value: 'archived', label: COURSE_STATUS.archived },
];

export function getCourseStatusLabel(status: string): string {
  return (COURSE_STATUS as Record<string, string>)[status] ?? status;
}
