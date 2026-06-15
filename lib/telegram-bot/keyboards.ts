/**
 * Inline- и reply-клавиатуры Telegram-бота AVATERRA.
 */
import type { TelegramReplyMarkup } from '@/lib/telegram';
import { FAQ_CATEGORIES } from './faq';

export const LIST_PAGE_SIZE = 5;

export function userMainMenuKeyboard(): TelegramReplyMarkup {
  return {
    inline_keyboard: [
      [
        { text: '📚 Мои курсы', callback_data: 'support:progress' },
        { text: '🎓 Сертификаты', callback_data: 'support:cert' },
      ],
      [
        { text: '🆘 Поддержка', callback_data: 'support:support' },
        { text: '❓ FAQ', callback_data: 'support:faq' },
      ],
      [
        { text: '🏫 О школе', callback_data: 'support:about' },
        { text: '🌐 Открыть портал', callback_data: 'support:portal' },
      ],
      [
        { text: '💬 Написать в поддержку', callback_data: 'support:write' },
        { text: '📋 Мои обращения', callback_data: 'support:ticket_status' },
      ],
    ],
  };
}

export function faqCategoriesKeyboard(): TelegramReplyMarkup {
  const rows = FAQ_CATEGORIES.map((c) => [{ text: c.title, callback_data: `faq:cat:${c.id}` }]);
  rows.push([{ text: '◀️ Главное меню', callback_data: 'nav:main' }]);
  return { inline_keyboard: rows };
}

export function faqCategoryBackKeyboard(): TelegramReplyMarkup {
  return {
    inline_keyboard: [
      [{ text: '◀️ К категориям FAQ', callback_data: 'support:faq' }],
      [{ text: '🏠 Главное меню', callback_data: 'nav:main' }],
    ],
  };
}

export async function supportDeepLinkKeyboard(botUsername: string | null): Promise<TelegramReplyMarkup> {
  const rows: TelegramReplyMarkup['inline_keyboard'] = [
    [{ text: '💬 Написать в поддержку', callback_data: 'support:write' }],
  ];
  if (botUsername) {
    rows.unshift([{ text: '📩 Связаться с менеджером', url: `https://t.me/${botUsername}?start=write` }]);
  }
  rows.push([{ text: '◀️ Главное меню', callback_data: 'nav:main' }]);
  return { inline_keyboard: rows };
}

export function adminMainMenuKeyboard(): TelegramReplyMarkup {
  return {
    inline_keyboard: [
      [
        { text: '🛠 Управление (портал)', callback_data: 'admin:menu' },
        { text: '📝 Контент (SMM)', callback_data: 'content:menu' },
      ],
      [{ text: '◀️ Главное меню', callback_data: 'nav:main' }],
    ],
  };
}

export function adminPortalMenuKeyboard(): TelegramReplyMarkup {
  return {
    inline_keyboard: [
      [
        { text: '📊 Сводка', callback_data: 'admin:stats' },
        { text: '📰 Дайджест', callback_data: 'admin:digest' },
      ],
      [
        { text: '👥 Пользователи', callback_data: 'admin:users' },
        { text: '💳 Оплаты', callback_data: 'admin:orders:0' },
      ],
      [
        { text: '🎫 Тикеты', callback_data: 'admin:tickets:0' },
        { text: '🔔 Оповещения', callback_data: 'admin:notify' },
      ],
      [
        { text: '📢 Рассылка', callback_data: 'admin:mailing' },
        { text: '⚙️ Система', callback_data: 'admin:system' },
      ],
      [
        { text: '◀️ Разделы админа', callback_data: 'admin:sections' },
        { text: '🏠 Главное меню', callback_data: 'nav:main' },
      ],
    ],
  };
}

export function contentMainMenuKeyboard(): TelegramReplyMarkup {
  return {
    inline_keyboard: [
      [
        { text: '📅 План', callback_data: 'content:plan' },
        { text: '📡 Radar', callback_data: 'content:radar' },
      ],
      [
        { text: '⚙️ Режим', callback_data: 'content:mode' },
        { text: '🧪 Quality', callback_data: 'content:quality' },
      ],
      [
        { text: '📈 Статистика постов', callback_data: 'content:post_stats' },
      ],
      [
        { text: '◀️ Разделы админа', callback_data: 'admin:sections' },
        { text: '🏠 Главное меню', callback_data: 'nav:main' },
      ],
    ],
  };
}

export function paginationKeyboard(
  prefix: string,
  page: number,
  totalPages: number,
  backAction = 'admin:menu'
): TelegramReplyMarkup {
  const nav: { text: string; callback_data: string }[] = [];
  if (page > 0) nav.push({ text: '◀️ Назад', callback_data: `${prefix}:${page - 1}` });
  if (page < totalPages - 1) nav.push({ text: 'Вперёд ▶️', callback_data: `${prefix}:${page + 1}` });
  const rows: TelegramReplyMarkup['inline_keyboard'] = [];
  if (nav.length) rows.push(nav);
  rows.push([{ text: '◀️ Меню админа', callback_data: backAction }]);
  return { inline_keyboard: rows };
}

export function adminTicketsListKeyboard(
  tickets: { id: string; subject: string }[],
  page: number,
  totalPages: number
): TelegramReplyMarkup {
  const rows: TelegramReplyMarkup['inline_keyboard'] = tickets.map((t) => [
    {
      text: `✉️ ${t.subject.slice(0, 28)}${t.subject.length > 28 ? '…' : ''}`,
      callback_data: `admin:t_reply:${t.id}`,
    },
  ]);
  const nav: { text: string; callback_data: string }[] = [];
  if (page > 0) nav.push({ text: '◀️', callback_data: `admin:tickets:${page - 1}` });
  if (page < totalPages - 1) nav.push({ text: '▶️', callback_data: `admin:tickets:${page + 1}` });
  if (nav.length) rows.push(nav);
  rows.push([{ text: '◀️ Меню админа', callback_data: 'admin:menu' }]);
  return { inline_keyboard: rows };
}

export function backToMainKeyboard(): TelegramReplyMarkup {
  return {
    inline_keyboard: [[{ text: '◀️ Главное меню', callback_data: 'nav:main' }]],
  };
}

export function adminBackKeyboard(): TelegramReplyMarkup {
  return {
    inline_keyboard: [
      [{ text: '◀️ Меню админа', callback_data: 'admin:menu' }],
      [{ text: '🏠 Главное меню', callback_data: 'nav:main' }],
    ],
  };
}
