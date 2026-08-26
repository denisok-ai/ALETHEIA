/**
 * Лид бота в CRM: запись диалога, сегмента и источника.
 *
 * Ключевая ценность полей `telegramChatId`/`telegramUsername` — право писать
 * первым. Оно появляется у бота только после того, как человек сам нажал
 * «Начать», и именно на нём держатся автодогоны (lib/telegram-lead-followup.ts).
 *
 * Ошибки БД здесь не пробрасываются: диалог с человеком важнее записи в CRM.
 */
import { prisma } from '@/lib/db';
import type { BotContext } from './types';

export const LEAD_SOURCE = 'telegram_bot';

export type FunnelSegment = 'info' | 'warm' | 'hot';

export const SEGMENT_LABEL: Record<FunnelSegment, string> = {
  info: 'холодный',
  warm: 'тёплый',
  hot: 'горячий',
};

/** Контакт для менеджера: ник, по которому реально написать; иначе chat id. */
export function funnelContact(ctx: BotContext): string {
  return ctx.telegramUsername ? `@${ctx.telegramUsername}` : `tg:${ctx.chatId}`;
}

/** Найти лид этого чата: сперва по chat id, затем по контакту (старые записи). */
async function findLeadForChat(ctx: BotContext) {
  const byChat = await prisma.lead.findFirst({
    where: { telegramChatId: ctx.chatId },
    orderBy: { createdAt: 'desc' },
  });
  if (byChat) return byChat;
  return prisma.lead.findFirst({
    where: { source: LEAD_SOURCE, phone: funnelContact(ctx) },
    orderBy: { createdAt: 'desc' },
  });
}

type UpsertParams = {
  segment?: FunnelSegment;
  choiceLabel?: string;
  freeform?: string;
  entrySource?: string;
  /** Привязать этот чат к уже существующему лиду (deep link `l-<id>`). */
  bindLeadId?: number;
  /** Отметить, что бот только что написал человеку (сброс окна догона). */
  botMessaged?: boolean;
};

/**
 * Создать или дополнить лид. Один лид на Telegram-чат: повторный /start и
 * свободные сообщения дополняют запись (новое сверху), а не плодят дубли.
 */
export async function upsertBotLead(
  ctx: BotContext,
  params: UpsertParams
): Promise<number | null> {
  try {
    const contact = funnelContact(ctx);
    const blockLines = [
      params.segment
        ? `Воронка Telegram-бота (${SEGMENT_LABEL[params.segment]} лид).`
        : 'Диалог с Telegram-ботом.',
      ...(params.choiceLabel ? [`Выбор: ${params.choiceLabel}`] : []),
      ...(params.freeform ? [`Сообщение: ${params.freeform.slice(0, 1000)}`] : []),
      ...(params.entrySource ? [`Источник: ${params.entrySource}`] : []),
      `Chat ID: ${ctx.chatId}`,
    ];
    const block = blockLines.join('\n');

    const dialogData = {
      telegramChatId: ctx.chatId,
      telegramUsername: ctx.telegramUsername ?? null,
      ...(params.segment ? { funnelSegment: params.segment } : {}),
      ...(params.entrySource ? { entrySource: params.entrySource } : {}),
      ...(params.botMessaged ? { lastBotMessageAt: new Date(), followupStage: 0 } : {}),
      ...(params.freeform ? { respondedAt: new Date() } : {}),
    };

    const existing = params.bindLeadId
      ? await prisma.lead.findUnique({ where: { id: params.bindLeadId } })
      : await findLeadForChat(ctx);

    if (existing) {
      const message = (existing.message ? `${block}\n\n— ранее —\n${existing.message}` : block).slice(0, 2000);
      await prisma.lead.update({
        where: { id: existing.id },
        data: {
          ...dialogData,
          message,
          // Контакт из бота полезнее пустого телефона, но телефон из формы не затираем.
          ...(existing.phone && !existing.phone.startsWith('tg:') && !existing.phone.startsWith('@')
            ? {}
            : { phone: contact.slice(0, 50) }),
        },
      });
      return existing.id;
    }

    const lead = await prisma.lead.create({
      data: {
        name: ctx.displayName.slice(0, 200),
        phone: contact.slice(0, 50),
        message: block.slice(0, 2000),
        status: 'new',
        source: LEAD_SOURCE,
        ...dialogData,
      },
    });
    return lead.id;
  } catch (e) {
    console.error('[bot-lead] upsert:', e);
    return null;
  }
}

/**
 * Телефон, которым человек поделился кнопкой Telegram.
 *
 * Это единственный способ получить настоящий номер без ручной переписки:
 * менеджер сможет позвонить, а не только писать в Telegram. Ник при этом
 * не теряем — он уходит в текст карточки.
 */
export async function saveLeadPhone(
  ctx: BotContext,
  phone: string,
  contactName?: string
): Promise<number | null> {
  const clean = phone.replace(/[^\d+]/g, '').slice(0, 50);
  if (clean.replace(/\D/g, '').length < 10) return null;

  try {
    const existing = await findLeadForChat(ctx);
    const note = [
      `Телефон получен из Telegram: ${clean}`,
      `Контакт в боте: ${funnelContact(ctx)}`,
    ].join('\n');

    if (existing) {
      const qualifyUp =
        existing.status === 'new' || existing.status === 'contacted'
          ? { status: 'qualified', qualifiedAt: new Date() }
          : {};
      await prisma.lead.update({
        where: { id: existing.id },
        data: {
          phone: clean,
          telegramChatId: ctx.chatId,
          telegramUsername: ctx.telegramUsername ?? null,
          respondedAt: new Date(),
          ...qualifyUp,
          qualifyReason: `${new Date().toISOString().slice(0, 16).replace('T', ' ')} qualified: оставил телефон${existing.qualifyReason ? `\n${existing.qualifyReason}` : ''}`.slice(0, 2000),
          message: `${note}\n\n— ранее —\n${existing.message ?? ''}`.slice(0, 2000),
        },
      });
      return existing.id;
    }

    const lead = await prisma.lead.create({
      data: {
        name: (contactName || ctx.displayName).slice(0, 200),
        phone: clean,
        message: note,
        // Оставил телефон — это готовность к разговору о покупке.
        status: 'qualified',
        qualifiedAt: new Date(),
        qualifyReason: `${new Date().toISOString().slice(0, 16).replace('T', ' ')} qualified: оставил телефон`,
        source: LEAD_SOURCE,
        telegramChatId: ctx.chatId,
        telegramUsername: ctx.telegramUsername ?? null,
        respondedAt: new Date(),
      },
    });
    return lead.id;
  } catch (e) {
    console.error('[bot-lead] saveLeadPhone:', e);
    return null;
  }
}

/**
 * Есть ли у лида настоящий телефон (а не ник/chat id в поле телефона).
 * По нему решаем, предлагать ли поделиться номером — повторно не просим.
 */
export async function leadHasRealPhone(chatId: number): Promise<boolean> {
  try {
    const lead = await prisma.lead.findFirst({
      where: { telegramChatId: chatId },
      orderBy: { createdAt: 'desc' },
      select: { phone: true },
    });
    if (!lead?.phone) return false;
    return !lead.phone.startsWith('@') && !lead.phone.startsWith('tg:');
  } catch (e) {
    console.error('[bot-lead] leadHasRealPhone:', e);
    return true; // при сбое лучше не приставать с просьбой
  }
}

/**
 * Человек написал боту — догоны прекращаются.
 * Вызывается на любое входящее сообщение, поэтому молча игнорирует отсутствие лида.
 */
export async function markLeadResponded(chatId: number): Promise<void> {
  try {
    await prisma.lead.updateMany({
      where: { telegramChatId: chatId, respondedAt: null },
      data: { respondedAt: new Date() },
    });
  } catch (e) {
    console.error('[bot-lead] markLeadResponded:', e);
  }
}

/** Отметить отправку сообщения ботом (окно догона отсчитывается от неё). */
export async function markBotMessaged(chatId: number): Promise<void> {
  try {
    await prisma.lead.updateMany({
      where: { telegramChatId: chatId },
      data: { lastBotMessageAt: new Date() },
    });
  } catch (e) {
    console.error('[bot-lead] markBotMessaged:', e);
  }
}
