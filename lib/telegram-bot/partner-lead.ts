/**
 * Лиды из чужого бота (@AvaterraBot партнёра) — через пересылку уведомления.
 *
 * Бот принадлежит не школе, доступа к нему нет, поэтому его воронку не выключить
 * и не подключить к CRM напрямую. Зато уведомление «Новый лид [warm]» приходит
 * владельцу — переслал его нашему боту, и карточка завелась сама.
 *
 * Numeric id лида достаём из разметки: в тексте партнёра имя обёрнуто в
 * `tg://user?id=…`, и при пересылке эта сущность сохраняется (при копировании
 * текста руками — теряется, тогда обходимся ником).
 */
import { prisma } from '@/lib/db';
import type { TelegramMessageEntity } from './types';

export const PARTNER_LEAD_SOURCE = 'telegram_bot';
export const PARTNER_ENTRY_SOURCE = 'avaterrabot';

export type ParsedPartnerLead = {
  segment: 'info' | 'warm' | 'hot';
  name: string;
  username?: string;
  choice?: string;
  message?: string;
  telegramUserId?: number;
};

const SEGMENT_BY_KEY: Record<string, ParsedPartnerLead['segment']> = {
  info: 'info',
  warm: 'warm',
  hot: 'hot',
  холодный: 'info',
  тёплый: 'warm',
  теплый: 'warm',
  горячий: 'hot',
};

/** Похоже ли сообщение на уведомление чужой воронки. */
export function looksLikePartnerLead(text: string): boolean {
  return /новый лид\s*\[/i.test(text);
}

/** Numeric id из `tg://user?id=…` либо из text_mention. */
function extractUserId(entities?: TelegramMessageEntity[]): number | undefined {
  for (const entity of entities ?? []) {
    if (entity.user?.id) return entity.user.id;
    const match = entity.url?.match(/tg:\/\/user\?id=(\d+)/);
    if (match) return Number(match[1]);
  }
  return undefined;
}

export function parsePartnerLead(
  text: string,
  entities?: TelegramMessageEntity[]
): ParsedPartnerLead | null {
  if (!looksLikePartnerLead(text)) return null;

  const segmentRaw = text.match(/новый лид\s*\[([^\]]+)\]/i)?.[1]?.trim().toLowerCase() ?? '';
  const segment = SEGMENT_BY_KEY[segmentRaw] ?? 'warm';

  const userLine = text.match(/пользователь:\s*(.+)/i)?.[1]?.trim() ?? '';
  const username = userLine.match(/@([A-Za-z0-9_]{4,})/)?.[1];
  const name = userLine.replace(/\(?@[A-Za-z0-9_]+\)?/, '').trim() || username || 'Лид из бота партнёра';

  const choice = text.match(/выбор:\s*(.+)/i)?.[1]?.trim();
  const message = text.match(/сообщение:\s*([\s\S]+)/i)?.[1]?.trim();

  return { segment, name, username, choice, message, telegramUserId: extractUserId(entities) };
}

export type PartnerLeadResult = { leadId: number; created: boolean };

/**
 * Завести или дополнить карточку. Ключ дедупликации — сначала numeric id,
 * затем ник: один и тот же человек часто присылает несколько уведомлений
 * (выбор в воронке, потом свободное сообщение).
 */
export async function upsertPartnerLead(parsed: ParsedPartnerLead): Promise<PartnerLeadResult | null> {
  try {
    const contact = parsed.username ? `@${parsed.username}` : parsed.telegramUserId ? `tg:${parsed.telegramUserId}` : 'tg:id-неизвестен';

    const block = [
      `Воронка бота партнёра (@AvaterraBot), сегмент: ${parsed.segment}.`,
      ...(parsed.choice ? [`Выбор: ${parsed.choice}`] : []),
      ...(parsed.message ? [`Сообщение: ${parsed.message.slice(0, 800)}`] : []),
      ...(parsed.telegramUserId ? [`Telegram ID: ${parsed.telegramUserId}`] : ['Telegram ID неизвестен (уведомление скопировано, а не переслано)']),
      'Наш бот писать ему не может: диалог у человека с ботом партнёра.',
    ].join('\n');

    const existing = await prisma.lead.findFirst({
      where: {
        source: PARTNER_LEAD_SOURCE,
        ...(parsed.telegramUserId
          ? { OR: [{ telegramChatId: parsed.telegramUserId }, ...(parsed.username ? [{ telegramUsername: parsed.username }] : [])] }
          : parsed.username
            ? { telegramUsername: parsed.username }
            : { name: parsed.name }),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      await prisma.lead.update({
        where: { id: existing.id },
        data: {
          funnelSegment: parsed.segment,
          entrySource: PARTNER_ENTRY_SOURCE,
          telegramUsername: parsed.username ?? existing.telegramUsername,
          // chatId пишем только как справочную величину: писать первым всё равно нельзя.
          telegramChatId: parsed.telegramUserId ?? existing.telegramChatId,
          message: `${block}\n\n— ранее —\n${existing.message ?? ''}`.slice(0, 2000),
        },
      });
      return { leadId: existing.id, created: false };
    }

    const lead = await prisma.lead.create({
      data: {
        name: parsed.name.slice(0, 200),
        phone: contact.slice(0, 50),
        message: block.slice(0, 2000),
        status: 'new',
        source: PARTNER_LEAD_SOURCE,
        entrySource: PARTNER_ENTRY_SOURCE,
        funnelSegment: parsed.segment,
        telegramUsername: parsed.username ?? null,
        telegramChatId: parsed.telegramUserId ?? null,
        // Догоны по таким лидам невозможны — сразу помечаем как исчерпанные,
        // чтобы задача не пыталась им писать и не считала их своими.
        followupStage: 2,
      },
    });
    return { leadId: lead.id, created: true };
  } catch (e) {
    console.error('[partner-lead] upsert:', e);
    return null;
  }
}
