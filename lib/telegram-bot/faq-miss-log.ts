/**
 * Журнал вопросов, на которые бот не нашёл выверенного ответа.
 *
 * Это обратная связь для базы знаний: видно, что люди спрашивают, а школа
 * ещё не описала. Пишем в AuditLog — отдельная таблица ради этого избыточна.
 * Ошибки записи глушим: телеметрия не должна ломать диалог.
 */
import { prisma } from '@/lib/db';

const ACTION = 'bot_faq_miss';
const ENTITY = 'telegram_chat';
const MAX_LEN = 400;

export async function logFaqMiss(chatId: number, question: string): Promise<void> {
  const text = question.trim();
  if (text.length < 5) return; // «ок», «ага» — не вопросы, шум в журнале
  try {
    await prisma.auditLog.create({
      data: {
        action: ACTION,
        entity: ENTITY,
        entityId: String(chatId),
        diff: text.slice(0, MAX_LEN),
      },
    });
  } catch (e) {
    console.error('[faq-miss] запись не удалась:', e);
  }
}

export type FaqMissSummary = {
  count: number;
  /** Последние вопросы без ответа — по ним видно, чего не хватает в FAQ. */
  recent: string[];
};

/** Сводка за последние `hours` часов для дайджеста админам. */
export async function fetchFaqMisses(hours = 24, limit = 5): Promise<FaqMissSummary> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  try {
    const [count, rows] = await Promise.all([
      prisma.auditLog.count({ where: { action: ACTION, createdAt: { gte: since } } }),
      prisma.auditLog.findMany({
        where: { action: ACTION, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { diff: true },
      }),
    ]);
    return { count, recent: rows.map((r) => r.diff ?? '').filter(Boolean) };
  } catch (e) {
    console.error('[faq-miss] чтение не удалось:', e);
    return { count: 0, recent: [] };
  }
}
