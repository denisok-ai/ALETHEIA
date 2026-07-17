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
  'probuzhdenie-21-den-osoznannosti': [
    {
      href: '/course/probuzhdenie',
      label: 'Программа курса «Пробуждение» — 21 день практик осознанности',
    },
    {
      href: '/course/probuzhdenie#tariffs',
      label: 'Тарифы: групповой и индивидуальный формат',
    },
  ],
};

/**
 * Призыв к действию внизу статьи: ведёт к продуктам (каталог тарифов и релевантный тариф).
 * Распределяет вес страниц на /services и создаёт путь «статья → покупка».
 */
export const BLOG_CTA: Partial<
  Record<string, { heading: string; text: string; primary: { href: string; label: string }; secondary?: { href: string; label: string } }>
> = {
  'telo-znaet-otvet': {
    heading: 'Готовы научиться слышать своё тело?',
    text: 'Начните с бесплатного знакомства с методом или выберите полный курс мышечного тестирования.',
    primary: { href: '/services/kod-tela-start', label: 'Бесплатное знакомство с методом' },
    secondary: { href: '/services', label: 'Все тарифы и цены' },
  },
  'pochemu-problemy-vozvrashautysya': {
    heading: 'Дойти до причины и убрать её',
    text: 'На курсе вы научитесь находить корень проблемы и работать с ним — на себе и с близкими.',
    primary: { href: '/services/avaterra-praktik', label: 'Тариф «Практик» — полный курс' },
    secondary: { href: '/services', label: 'Сравнить тарифы' },
  },
  'mify-o-myshechnom-testirovanii': {
    heading: 'Проверьте метод на практике',
    text: 'Мышечное тестирование основано на физиологии. Убедитесь сами на бесплатном мини-курсе.',
    primary: { href: '/services/kod-tela-start', label: 'Попробовать бесплатно' },
    secondary: { href: '/services', label: 'Все форматы обучения' },
  },
  'stress-hronika-ili-signal-tela': {
    heading: 'Научитесь распознавать сигналы тела',
    text: 'Полный курс даёт инструмент, который остаётся с вами навсегда — без подписок и внешнего доступа.',
    primary: { href: '/services/avaterra-praktik', label: 'Тариф «Практик»' },
    secondary: { href: '/services', label: 'Тарифы и цены' },
  },
  'pervye-shagi-myshechnogo-testirovaniya': {
    heading: 'Сделайте первые шаги с поддержкой',
    text: 'Бесплатный мини-курс проведёт вас через первый самотест, а полный курс — через всю систему.',
    primary: { href: '/services/kod-tela-start', label: 'Начать бесплатно' },
    secondary: { href: '/services', label: 'Выбрать тариф' },
  },
  'probuzhdenie-21-den-osoznannosti': {
    heading: 'Пройти «Пробуждение»',
    text: '21 день практик осознанности — в группе или индивидуально с обратной связью.',
    primary: { href: '/services/probuzhdenie-group', label: 'Групповой формат' },
    secondary: { href: '/services/probuzhdenie-individual', label: 'Индивидуально' },
  },
};

/** Слаги статей для блока «По теме» на странице курса. */
export const COURSE_PAGE_BLOG_HIGHLIGHTS = [
  'stress-hronika-ili-signal-tela',
  'pochemu-problemy-vozvrashautysya',
  'telo-znaet-otvet',
] as const;
