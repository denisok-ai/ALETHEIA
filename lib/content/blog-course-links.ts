/**
 * Перелинковка: статья блога → раздел программы на странице курса (якоря #module-N).
 */
import { COURSE_SLUG } from '@/lib/content/course-lynda-teaser';

const courseBase = `/course/${COURSE_SLUG}`;

export const BLOG_TO_COURSE_ANCHORS: Partial<
  Record<
    string,
    { href: string; label: string }[]
  >
> = {
  'stress-hronika-ili-signal-tela': [
    {
      href: `${courseBase}#module-3`,
      label: 'Тизер модуля про энергию, мотивацию и «честный» запрос к телу',
    },
  ],
  'pochemu-problemy-vozvrashautysya': [
    {
      href: `${courseBase}#module-5`,
      label: 'Фрагмент программы про работу с причиной и регресс',
    },
  ],
  'mify-o-myshechnom-testirovanii': [
    {
      href: `${courseBase}#module-1`,
      label: 'Введение в философию метода на странице курса',
    },
  ],
  'pervye-shagi-myshechnogo-testirovaniya': [
    {
      href: `${courseBase}#module-1`,
      label: 'Первый блок программы: философия и основы тестирования',
    },
  ],
  'telo-znaet-otvet': [
    {
      href: `${courseBase}#module-2`,
      label: 'Фрагмент про эмоции и «карту» тела в программе курса',
    },
  ],
};

/** Слаги статей для блока «По теме» на странице курса. */
export const COURSE_PAGE_BLOG_HIGHLIGHTS = [
  'stress-hronika-ili-signal-tela',
  'pochemu-problemy-vozvrashautysya',
  'telo-znaet-otvet',
] as const;
