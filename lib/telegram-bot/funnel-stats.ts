/**
 * Сводка автономной воронки бота для дайджеста админам.
 *
 * Показывает, что бот делает сам: сколько лидов ведёт, сколько квалифицировал,
 * скольким показал оффер, сколько дошло до оплаты. По ней видно окупаемость
 * автоматизации и где воронка «протекает».
 */
import { prisma } from '@/lib/db';

export type FunnelStats = {
  total: number;
  byStatus: Record<string, number>;
  withDialog: number; // начали диалог с ботом (есть chat id)
  buyIntent: number; // проявили интент покупки
  offersSent: number; // получили авто-оффер
  converted: number; // оплатили
  unsubscribed: number;
  newLast24h: number;
};

export async function fetchFunnelStats(): Promise<FunnelStats> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const leads = await prisma.lead.findMany({
    where: { source: 'telegram_bot' },
    select: {
      status: true,
      telegramChatId: true,
      buyIntentAt: true,
      offerSentAt: true,
      unsubscribedAt: true,
      createdAt: true,
    },
  });

  const byStatus: Record<string, number> = {};
  let withDialog = 0;
  let buyIntent = 0;
  let offersSent = 0;
  let converted = 0;
  let unsubscribed = 0;
  let newLast24h = 0;

  for (const l of leads) {
    byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
    if (l.telegramChatId) withDialog += 1;
    if (l.buyIntentAt) buyIntent += 1;
    if (l.offerSentAt) offersSent += 1;
    if (l.status === 'converted') converted += 1;
    if (l.unsubscribedAt) unsubscribed += 1;
    if (l.createdAt >= dayAgo) newLast24h += 1;
  }

  return {
    total: leads.length,
    byStatus,
    withDialog,
    buyIntent,
    offersSent,
    converted,
    unsubscribed,
    newLast24h,
  };
}

/** Строки для дайджеста (HTML). Пусто, если лидов из бота ещё нет. */
export function formatFunnelStatsLines(s: FunnelStats): string[] {
  if (s.total === 0) return [];
  const st = s.byStatus;
  const conv = s.total ? Math.round((s.converted / s.total) * 100) : 0;
  return [
    '',
    '<b>🤖 Автоворонка бота</b>',
    `Лидов: <b>${s.total}</b> (+${s.newLast24h} за сутки)`,
    `По статусам: new ${st.new ?? 0} · контакт ${st.contacted ?? 0} · квалиф. ${st.qualified ?? 0} · оплата ${st.converted ?? 0} · потеряно ${st.lost ?? 0}`,
    `🔥 Интент покупки: <b>${s.buyIntent}</b> · офферов отправлено: <b>${s.offersSent}</b>`,
    `Конверсия в оплату: <b>${conv}%</b>${s.unsubscribed ? ` · отписалось: ${s.unsubscribed}` : ''}`,
  ];
}
