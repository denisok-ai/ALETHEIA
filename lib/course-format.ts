/** Формат курса в Course.courseFormat */
export const COURSE_FORMAT = {
  SCORM: 'scorm',
  LIVE_EVENT: 'live_event',
} as const;

export type CourseFormatValue = (typeof COURSE_FORMAT)[keyof typeof COURSE_FORMAT];

export const COURSE_FORMAT_OPTIONS: { value: CourseFormatValue; label: string; description: string }[] = [
  {
    value: 'scorm',
    label: 'Онлайн (SCORM)',
    description: 'Самостоятельное прохождение уроков в плеере, прогресс и сертификаты по правилам SCORM.',
  },
  {
    value: 'live_event',
    label: 'Очное мероприятие / вебинар',
    description:
      'Обучение по расписанию: очная встреча или онлайн-трансляция. Укажите даты, площадку или ссылку на вебинар. SCORM можно добавить как дополнительные материалы.',
  },
];

export function getCourseFormatLabel(format: string | null | undefined): string {
  if (format === COURSE_FORMAT.LIVE_EVENT) return 'Мероприятие';
  return 'Онлайн';
}

export function isLiveEventCourse(format: string | null | undefined): boolean {
  return format === COURSE_FORMAT.LIVE_EVENT;
}
