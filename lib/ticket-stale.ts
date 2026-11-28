/**
 * Тикеты поддержки, которые ждут человека.
 *
 * Инцидент 26–27.11.2026: тёплый лид (почти покупатель практикума) открыл тикет, получил
 * автоответ «уточним и вернёмся» — и сутки никто не ответил; клиентка написала «Вы не забыли
 * обо мне?». Тревога по лидам была, по тикетам — нет, а автоответ записывается ролью manager,
 * поэтому тикет выглядел отвеченным.
 *
 * Тикет ждёт человека, если последнее сообщение от клиента ИЛИ со стороны поддержки были
 * только автоответы. Автоответ — флаг `auto: true` (с 28.11) или, для старых тикетов, сообщение
 * manager в пределах AUTO_REPLY_WINDOW_MS после сообщения клиента.
 * Напоминание — когда клиент ждёт дольше STALE_AFTER_MS, один раз на каждое новое его сообщение.
 * Вызывается из ежечасного cron telegram-lead-followup.
 */
import { prisma } from '@/lib/db';

export type TicketMessage = { role: 'user' | 'manager'; content: string; at?: string; auto?: boolean };

export const STALE_AFTER_MS = 4 * 60 * 60 * 1000;
export const AUTO_REPLY_WINDOW_MS = 2 * 60 * 1000;
const NOTIFIED_KEY = 'stale_tickets_notified';

/** Время последнего сообщения клиента, если тикет ждёт человека; иначе null. */
export function waitingSince(messages: TicketMessage[]): Date | null {
  let lastUserAt: Date | null = null;
  let humanAfterLastUser = false;
  for (const m of messages) {
    const at = m.at ? new Date(m.at) : null;
    if (m.role === 'user') {
      lastUserAt = at;
      humanAfterLastUser = false;
      continue;
    }
    const looksAuto =
      m.auto === true ||
      (m.auto === undefined && at && lastUserAt && at.getTime() - lastUserAt.getTime() <= AUTO_REPLY_WINDOW_MS);
    if (!looksAuto) humanAfterLastUser = true;
  }
  if (!lastUserAt || Number.isNaN(lastUserAt.getTime()) || humanAfterLastUser) return null;
  return lastUserAt;
}

export function parseTicketMessages(raw: unknown): TicketMessage[] {
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? (raw.filter((m) => m && typeof m === 'object') as TicketMessage[]) : [];
}

/** Шлёт админам напоминание о тикетах без ответа человека. Возвращает число тикетов в напоминании. */
export async function notifyStaleTickets(now: Date): Promise<number> {
  try {
    const tickets = await prisma.ticket.findMany({
      where: { status: { in: ['open', 'in_progress'] } },
      select: { id: true, subject: true, messages: true, user: { select: { email: true } } },
    });
    const marker = await prisma.systemSetting.findUnique({ where: { key: NOTIFIED_KEY } });
    let notified: Record<string, string> = {};
    try {
      notified = marker?.value ? (JSON.parse(marker.value) as Record<string, string>) : {};
    } catch {
      notified = {};
    }

    const stale: { id: string; subject: string; email: string; since: Date }[] = [];
    for (const t of tickets) {
      const since = waitingSince(parseTicketMessages(t.messages));
      if (!since || now.getTime() - since.getTime() < STALE_AFTER_MS) continue;
      if (notified[t.id] === since.toISOString()) continue; // об этом сообщении клиента уже напоминали
      stale.push({ id: t.id, subject: t.subject, email: t.user?.email ?? '', since });
    }
    if (stale.length === 0) return 0;

    const { notifyAdminsTelegram } = await import('./telegram-admin-notify');
    const stats = await notifyAdminsTelegram('support_ticket', [
      `Тикеты без ответа человека: ${stale.length}`,
      'Клиент ждёт дольше 4 часов (автоответ не считается ответом).',
      '',
      ...stale.map((t) => {
        const hours = Math.floor((now.getTime() - t.since.getTime()) / 3_600_000);
        return `· «${t.subject}» — ${t.email}, ждёт ${hours} ч · /portal/manager/tickets/${t.id}`;
      }),
    ]);
    // Метку ставим, только если напоминание ушло — иначе сбой отправки съел бы тревогу.
    if (stats.sent === 0) return 0;

    for (const t of stale) notified[t.id] = t.since.toISOString();
    const open = new Set(tickets.map((t) => t.id));
    for (const id of Object.keys(notified)) if (!open.has(id)) delete notified[id];
    await prisma.systemSetting.upsert({
      where: { key: NOTIFIED_KEY },
      create: { key: NOTIFIED_KEY, value: JSON.stringify(notified), category: 'crm' },
      update: { value: JSON.stringify(notified) },
    });
    return stale.length;
  } catch (e) {
    console.error('[tickets] напоминание о тикетах без ответа:', e);
    return 0;
  }
}
