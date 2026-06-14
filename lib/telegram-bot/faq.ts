/**
 * FAQ для Telegram-бота: категории из landing-faq и поддержки портала.
 */
import { FAQ_SECTION_ITEMS, PRACTICE_AND_FORMAT_FAQ } from '@/lib/landing-faq';

export type FaqCategoryId = 'portal' | 'practice' | 'method' | 'format' | 'course';

export type FaqCategory = {
  id: FaqCategoryId;
  title: string;
  items: { q: string; a: string }[];
};

const PORTAL_FAQ: { q: string; a: string }[] = [
  {
    q: 'Как получить доступ к курсу после оплаты?',
    a: 'Доступ открывается на email регистрации. Проверьте «Мои курсы» в портале. Если курса нет — создайте обращение в поддержку.',
  },
  {
    q: 'Как привязать Telegram к аккаунту?',
    a: 'В профиле портала укажите Telegram ID из команды /myid в боте. Или отправьте боту /link email@example.com.',
  },
  {
    q: 'Где скачать сертификат?',
    a: 'После 100% прохождения курса — раздел «Сертификаты» в портале или команда /cert в боте.',
  },
  {
    q: 'Как связаться с менеджером?',
    a: 'Кнопка «Написать в поддержку» в боте или раздел поддержки на портале. Ответ придёт на email и в Telegram (если привязан).',
  },
];

export const FAQ_CATEGORIES: FaqCategory[] = [
  { id: 'portal', title: '🌐 Портал и доступ', items: PORTAL_FAQ },
  { id: 'practice', title: '🧘 Практики и формат', items: [...PRACTICE_AND_FORMAT_FAQ] },
  {
    id: 'method',
    title: '📖 Методика',
    items: FAQ_SECTION_ITEMS.filter((i) => i.category === 'Методика').map(({ q, a }) => ({ q, a })),
  },
  {
    id: 'format',
    title: '📅 Формат обучения',
    items: FAQ_SECTION_ITEMS.filter((i) => i.category === 'Формат').map(({ q, a }) => ({ q, a })),
  },
  {
    id: 'course',
    title: '🎓 Курс',
    items: FAQ_SECTION_ITEMS.filter((i) => i.category === 'Курс').map(({ q, a }) => ({ q, a })),
  },
];

export function getFaqCategory(id: string): FaqCategory | undefined {
  return FAQ_CATEGORIES.find((c) => c.id === id);
}

export function formatFaqCategoryText(category: FaqCategory): string {
  const blocks = category.items.map((item) => `<b>${item.q}</b>\n${item.a}`);
  return `<b>${category.title}</b>\n\n${blocks.join('\n\n')}`;
}

export function formatFaqOverviewText(): string {
  const lines = [
    '<b>❓ Частые вопросы AVATERRA</b>',
    '',
    'Выберите категорию кнопкой ниже или команды:',
    '/progress — курсы · /cert — сертификаты · /ticket_status — обращения',
  ];
  return lines.join('\n');
}
