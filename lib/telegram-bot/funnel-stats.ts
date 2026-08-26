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
  nudged: number; // получили дожим
  offerClicked: number; // кликнули по офферу (пошли платить)
  converted: number; // оплатили
  unsubscribed: number;
  newLast24h: number;
  /** A/B оффера: по варианту — отправлено, кликов, оплат. */
  abTest: Record<'A' | 'B', { sent: number; clicked: number; converted: number }>;
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
      offerNudgedAt: true,
      offerClickedAt: true,
      offerVariant: true,
      unsubscribedAt: true,
      createdAt: true,
    },
  });

  const byStatus: Record<string, number> = {};
  let withDialog = 0;
  let buyIntent = 0;
  let offersSent = 0;
  let nudged = 0;
  let offerClicked = 0;
  let converted = 0;
  let unsubscribed = 0;
  let newLast24h = 0;
  const abTest = { A: { sent: 0, clicked: 0, converted: 0 }, B: { sent: 0, clicked: 0, converted: 0 } };

  for (const l of leads) {
    byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
    if (l.telegramChatId) withDialog += 1;
    if (l.buyIntentAt) buyIntent += 1;
    if (l.offerSentAt) offersSent += 1;
    if (l.offerNudgedAt) nudged += 1;
    if (l.offerClickedAt) offerClicked += 1;
    if (l.status === 'converted') converted += 1;
    if (l.unsubscribedAt) unsubscribed += 1;
    if (l.offerVariant === 'A' || l.offerVariant === 'B') {
      const v = abTest[l.offerVariant];
      if (l.offerSentAt) v.sent += 1;
      if (l.offerClickedAt) v.clicked += 1;
      if (l.status === 'converted') v.converted += 1;
    }
    if (l.createdAt >= dayAgo) newLast24h += 1;
  }

  return {
    total: leads.length,
    byStatus,
    withDialog,
    buyIntent,
    offersSent,
    nudged,
    offerClicked,
    converted,
    unsubscribed,
    newLast24h,
    abTest,
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
    `🔥 Интент: <b>${s.buyIntent}</b> · офферов: <b>${s.offersSent}</b> · кликов: <b>${s.offerClicked}</b> · дожимов: <b>${s.nudged}</b>`,
    `Конверсия в оплату: <b>${conv}%</b>${s.unsubscribed ? ` · отписалось: ${s.unsubscribed}` : ''}`,
    ...abLines(s.abTest),
  ];
}

function abLines(ab: FunnelStats['abTest']): string[] {
  if (ab.A.sent + ab.B.sent === 0) return [];
  const row = (label: string, v: { sent: number; clicked: number; converted: number }) => {
    const cr = v.sent ? Math.round((v.clicked / v.sent) * 100) : 0;
    return `· ${label}: оффер ${v.sent} → клик ${v.clicked} (${cr}%) → оплата ${v.converted}`;
  };
  return ['', '<b>🧪 A/B оффера</b>', row('A (мягкий)', ab.A), row('B (без риска)', ab.B)];
}
