/**
 * Лид-воронка Telegram-бота AVATERRA (адаптация DenisBot1 funnel_flow + knowledge base).
 * Для непривязанных пользователей на /start; warm/hot сегменты уведомляют админов.
 */
import { prisma } from '@/lib/db';
import { notifyAdminsTelegramAsync } from '@/lib/telegram-admin-notify';
import type { BotContext } from './types';
import { findUserByTelegramId } from './auth';
import { botReply } from './messaging';
import { setSessionState, clearBotSession } from './session';
import { backToMainKeyboard } from './keyboards';
import { getBotSiteSettings } from './settings-cache';

export type FunnelChoice = 'learn' | 'thinking' | 'ready';
export type FunnelSegment = 'info' | 'warm' | 'hot';

const LINK_ABOUT = 'https://avaterra.pro/about';
const LINK_BODY = 'https://avaterra.pro/course/navyki-myshechnogo-testirovaniya';
const LINK_AWAKENING = 'https://avaterra.pro/course/probuzhdenie';
const LINK_FAQ = 'https://avaterra.pro/faq';
const LINK_BLOG = 'https://avaterra.pro/blog/pervye-shagi-myshechnogo-testirovaniya';

export const FUNNEL_WELCOME_TEXT =
  'Здравствуйте! Я бот <b>AVATERRA</b> — Phygital-школы мышечного тестирования.\n\n' +
  '<i>Тело помнит всё.</i> Помогу понять, что вам сейчас ближе: освоить метод «Тело не врёт», ' +
  'практики «Пробуждения» или просто разобраться с вопросами.\n\n' +
  'Выберите вариант — пришлю подходящие материалы или передам команде.';

export const FUNNEL_CHOICE_LABELS: Record<FunnelChoice, string> = {
  learn: 'Хочу узнать о методике подробнее',
  thinking: 'Думаю про курс — есть вопросы',
  ready: 'Готов(а) обсудить участие',
};

const FUNNEL_RESPONSES: Record<FunnelChoice, { text: string; notifyAdmin: boolean; segment: FunnelSegment }> = {
  learn: {
    text:
      'Отлично! Короткая подборка для старта:\n\n' +
      `• Что такое мышечное тестирование: <a href="${LINK_ABOUT}">avaterra.pro/about</a>\n` +
      `• Первые шаги: <a href="${LINK_BLOG}">читать в блоге</a>\n` +
      `• Программа курса «Тело не врёт»: <a href="${LINK_BODY}">страница курса</a>\n` +
      `• Практики «Пробуждение» (21 день): <a href="${LINK_AWAKENING}">страница курса</a>\n` +
      `• Ответы на частые вопросы: <a href="${LINK_FAQ}">avaterra.pro/faq</a>\n\n` +
      'Если появятся вопросы — напишите сюда или нажмите «💬 Написать в поддержку» в меню.',
    notifyAdmin: false,
    segment: 'info',
  },
  thinking: {
    text:
      'Понимаю — выбрать формат важно. Расскажите коротко, что именно хочется решить с помощью практики? ' +
      'Я передам команде, и вам ответит специалист.\n\n' +
      `Пока можно посмотреть: <a href="${LINK_BODY}">«Тело не врёт»</a> · ` +
      `<a href="${LINK_AWAKENING}">«Пробуждение»</a> · <a href="${LINK_FAQ}">FAQ</a>\n\n` +
      'Можете отправить текстовое сообщение.',
    notifyAdmin: true,
    segment: 'warm',
  },
  ready: {
    text:
      'Отлично, что вы готовы! Один уточняющий вопрос: когда планируете начать — ' +
      'в ближайший поток или гибко?\n\n' +
      `Курсы на выбор: <a href="${LINK_BODY}">«Тело не врёт»</a> · ` +
      `<a href="${LINK_AWAKENING}">«Пробуждение»</a>\n\n` +
      'Просто напишите ответ ниже — передам менеджеру.',
    notifyAdmin: true,
    segment: 'hot',
  },
};

/** Источник лида в CRM — по нему фильтруется таблица «Лиды». */
const LEAD_SOURCE = 'telegram_bot';

const SEGMENT_LABEL: Record<FunnelSegment, string> = {
  info: 'холодный',
  warm: 'тёплый',
  hot: 'горячий',
};

/** Контакт для CRM: username, по которому менеджер напишет в Telegram; иначе chat ID. */
function funnelContact(ctx: BotContext): string {
  return ctx.telegramUsername ? `@${ctx.telegramUsername}` : `tg:${ctx.chatId}`;
}

/**
 * Лид воронки в CRM — один лид на Telegram-чат.
 * Повторный /start и свободное сообщение дополняют существующую запись (новое сверху),
 * а не плодят дубли. Ошибки БД не должны ломать диалог — логируем и возвращаем null.
 */
async function upsertFunnelLead(
  ctx: BotContext,
  params: { segment: FunnelSegment; choiceLabel?: string; freeform?: string }
): Promise<number | null> {
  try {
    const contact = funnelContact(ctx);
    const block = [
      `Воронка Telegram-бота (${SEGMENT_LABEL[params.segment]} лид).`,
      ...(params.choiceLabel ? [`Выбор: ${params.choiceLabel}`] : []),
      ...(params.freeform ? [`Сообщение: ${params.freeform.slice(0, 1000)}`] : []),
      `Chat ID: ${ctx.chatId}`,
    ].join('\n');

    const existing = await prisma.lead.findFirst({
      where: { source: LEAD_SOURCE, phone: contact },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      const message = (existing.message ? `${block}\n\n— ранее —\n${existing.message}` : block).slice(0, 2000);
      await prisma.lead.update({ where: { id: existing.id }, data: { message } });
      return existing.id;
    }

    const lead = await prisma.lead.create({
      data: {
        name: ctx.displayName.slice(0, 200),
        phone: contact.slice(0, 50),
        message: block.slice(0, 2000),
        status: 'new',
        source: LEAD_SOURCE,
      },
    });
    return lead.id;
  } catch (e) {
    console.error('Funnel lead upsert:', e);
    return null;
  }
}

/** Ссылка на карточку лида в админке — чтобы из уведомления сразу открыть CRM. */
async function leadCrmLink(leadId: number | null): Promise<string[]> {
  if (!leadId) return [];
  try {
    const { siteUrl } = await getBotSiteSettings();
    const base = siteUrl || 'https://avaterra.pro';
    return [`CRM: ${base}/portal/admin/crm/leads/${leadId}`];
  } catch {
    return [];
  }
}

export const FUNNEL_THANKS_AFTER_FREEFORM =
  'Спасибо! Сообщение передано команде AVATERRA. С вами свяжется специалист в ближайшее время.';

export const FUNNEL_UNKNOWN_INPUT =
  'Чтобы я не запутался — выберите один из вариантов кнопками или напишите /start, чтобы начать сначала.';

export function funnelChoiceKeyboard() {
  const rows = (Object.keys(FUNNEL_CHOICE_LABELS) as FunnelChoice[]).map((key) => [
    { text: FUNNEL_CHOICE_LABELS[key], callback_data: `funnel:${key}` },
  ]);
  rows.push([{ text: '🏠 Главное меню', callback_data: 'nav:main' }]);
  return { inline_keyboard: rows };
}

/** Показать приветствие воронки (непривязанный пользователь). */
export async function handleFunnelWelcome(ctx: BotContext): Promise<void> {
  await clearBotSession(ctx.chatId);
  await botReply(ctx, FUNNEL_WELCOME_TEXT, { replyMarkup: funnelChoiceKeyboard() });
}

/** Нужна ли воронка на /start (гость без привязки к порталу). */
export async function shouldShowFunnelOnStart(ctx: BotContext): Promise<boolean> {
  if (ctx.isAdmin || !ctx.telegramUserId) return false;
  const linked = await findUserByTelegramId(ctx.telegramUserId);
  return !linked;
}

export async function handleFunnelChoice(ctx: BotContext, choice: string): Promise<void> {
  const key = choice as FunnelChoice;
  const step = FUNNEL_RESPONSES[key];
  if (!step) {
    await botReply(ctx, FUNNEL_UNKNOWN_INPUT, { replyMarkup: funnelChoiceKeyboard() });
    return;
  }

  if (step.notifyAdmin) {
    await setSessionState(ctx.chatId, 'funnel_freeform', { segment: step.segment });
  } else {
    await clearBotSession(ctx.chatId);
  }

  await botReply(ctx, step.text, {
    replyMarkup: step.notifyAdmin ? backToMainKeyboard() : funnelChoiceKeyboard(),
    forceNew: true,
  });

  const leadId = await upsertFunnelLead(ctx, {
    segment: step.segment,
    choiceLabel: FUNNEL_CHOICE_LABELS[key],
  });

  if (step.notifyAdmin) {
    notifyAdminsTelegramAsync('contact_lead', [
      `Лид из Telegram-бота (${step.segment === 'hot' ? 'горячий' : 'тёплый'}).`,
      `Выбор: ${FUNNEL_CHOICE_LABELS[key]}`,
      `Пользователь: ${ctx.displayName}${ctx.telegramUsername ? ` (@${ctx.telegramUsername})` : ''}`,
      `Chat ID: ${ctx.chatId}`,
      ...(await leadCrmLink(leadId)),
    ]);
  }
}

export async function handleFunnelFreeform(ctx: BotContext, text: string): Promise<void> {
  const trimmed = text.trim();
  if (trimmed.length < 2) {
    await botReply(ctx, 'Напишите чуть подробнее — хотя бы пару слов.');
    return;
  }

  const session = await import('./session').then((m) => m.getBotSession(ctx.chatId));
  const segment = (session.data?.segment as FunnelSegment | undefined) ?? 'warm';

  await clearBotSession(ctx.chatId);
  await botReply(ctx, FUNNEL_THANKS_AFTER_FREEFORM, { replyMarkup: backToMainKeyboard(), forceNew: true });

  const leadId = await upsertFunnelLead(ctx, { segment, freeform: trimmed });

  notifyAdminsTelegramAsync('contact_lead', [
    `Сообщение из воронки Telegram (${segment === 'hot' ? 'горячий' : 'тёплый'} лид).`,
    `От: ${ctx.displayName}${ctx.telegramUsername ? ` (@${ctx.telegramUsername})` : ''}`,
    `Chat ID: ${ctx.chatId}`,
    ...(await leadCrmLink(leadId)),
    '',
    trimmed.slice(0, 500),
  ]);
}
