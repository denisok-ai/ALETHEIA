/**
 * Автоквалификация лида: бот сам двигает статус по объективным фактам.
 *
 * Принцип — только ВПЕРЁД и только по наблюдаемым событиям (ответил, оставил
 * телефон, спросил про покупку, оплатил, пропал). Никакой смысловой догадки
 * «этот точно купит» — это остаётся человеку. Статусы CRM: new → contacted →
 * qualified → converted, отдельная ветка lost.
 *
 * Порядок статусов важен: понижать нельзя (converted не откатываем в contacted).
 */
import { prisma } from '@/lib/db';
import type { Lead } from '@prisma/client';

const RANK: Record<string, number> = {
  new: 0,
  contacted: 1,
  qualified: 2,
  converted: 3,
  lost: 3, // терминальный, вровень с converted — из него не двигаем автоматически
};

function isForward(from: string, to: string): boolean {
  return (RANK[to] ?? 0) > (RANK[from] ?? 0);
}

/** Контакт состоялся: бот ответил по существу или человек написал сам. */
export async function markContacted(chatId: number, reason: string): Promise<void> {
  try {
    const lead = await prisma.lead.findFirst({ where: { telegramChatId: chatId }, orderBy: { createdAt: 'desc' } });
    if (!lead || !isForward(lead.status, 'contacted')) return;
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: 'contacted', qualifyReason: appendReason(lead.qualifyReason, `contacted: ${reason}`) },
    });
  } catch (e) {
    console.error('[qualify] markContacted:', e);
  }
}

/**
 * Квалификация: лид готов к разговору о покупке. Триггеры (любой):
 * оставил телефон, обнаружен интент покупки, сегмент hot.
 * `buyIntent` — если квалифицируем из-за интента (для метки времени).
 */
export async function markQualified(
  chatId: number,
  reason: string,
  opts: { buyIntent?: boolean } = {}
): Promise<number | null> {
  try {
    const lead = await prisma.lead.findFirst({ where: { telegramChatId: chatId }, orderBy: { createdAt: 'desc' } });
    if (!lead) return null;
    const data: Record<string, unknown> = {
      qualifyReason: appendReason(lead.qualifyReason, `qualified: ${reason}`),
    };
    if (opts.buyIntent && !lead.buyIntentAt) data.buyIntentAt = new Date();
    if (isForward(lead.status, 'qualified')) {
      data.status = 'qualified';
      data.qualifiedAt = new Date();
    }
    await prisma.lead.update({ where: { id: lead.id }, data });
    return lead.id;
  } catch (e) {
    console.error('[qualify] markQualified:', e);
    return null;
  }
}

/** Лид потерян: неделя тишины после прогрева или бот заблокирован. */
export async function markLost(leadId: number, reason: string): Promise<void> {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    // Оплаченного/квалифицированного с покупкой не хороним автоматически.
    if (!lead || lead.status === 'converted') return;
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: 'lost', qualifyReason: appendReason(lead.qualifyReason, `lost: ${reason}`) },
    });
  } catch (e) {
    console.error('[qualify] markLost:', e);
  }
}

/** История квалификации — новая причина сверху, ограничение по длине. */
function appendReason(prev: string | null, line: string): string {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  return `${stamp} ${line}${prev ? `\n${prev}` : ''}`.slice(0, 2000);
}

/** Приоритет лида для менеджера: горячие с интентом — вверх. Для сортировок/сводок. */
export function leadPriority(lead: Pick<Lead, 'buyIntentAt' | 'funnelSegment' | 'phone' | 'status'>): number {
  let score = 0;
  if (lead.buyIntentAt) score += 100;
  if (lead.funnelSegment === 'hot') score += 50;
  if (lead.funnelSegment === 'warm') score += 20;
  if (lead.phone && !lead.phone.startsWith('@') && !lead.phone.startsWith('tg:')) score += 30;
  if (lead.status === 'qualified') score += 40;
  return score;
}
