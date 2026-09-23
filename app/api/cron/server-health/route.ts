/**
 * Cron (каждые 15 мин): здоровье сервера — память/swap/диск/OOM.
 *
 * Алерт админам в Telegram при пробитом пороге. Антиспам: тот же набор
 * проблем повторяем не чаще раза в 6 часов; изменившийся набор (новая
 * проблема или ухудшение) шлём сразу. Восстановление сообщаем один раз.
 *
 * ?dry=1 — вернуть замер без отправки и без heartbeat.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireCronAuth } from '@/lib/cron-auth';
import { markCronOk } from '@/lib/cron-heartbeat';
import { checkServerHealth } from '@/lib/server-health';
import { notifyAdminsTelegram } from '@/lib/telegram-admin-notify';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const STATE_KEY = 'server_health_alert_state';
const REPEAT_AFTER_MS = 6 * 60 * 60 * 1000;

type AlertState = { signature: string; at: string };

export async function GET(request: NextRequest) {
  const authError = await requireCronAuth(request);
  if (authError) return authError;
  const dryRun = new URL(request.url).searchParams.get('dry') === '1';

  const h = await checkServerHealth();
  const summary =
    `память ${h.memAvailableMb}/${h.memTotalMb} МБ доступно (${h.memAvailablePct} %) · ` +
    `swap ${h.swapUsedMb}/${h.swapTotalMb} МБ · диск ${h.diskUsedPct} %` +
    (h.oomKillsRecent == null ? '' : ` · OOM: ${h.oomKillsRecent}`);

  if (dryRun) return NextResponse.json({ ok: true, health: h, summary, dryRun });

  const row = await prisma.systemSetting.findUnique({ where: { key: STATE_KEY } });
  let prev: AlertState | null = null;
  try {
    prev = row?.value ? (JSON.parse(row.value) as AlertState) : null;
  } catch {
    prev = null;
  }

  const signature = h.problems.join('|');
  let sent = false;

  if (h.problems.length > 0) {
    const same = prev?.signature === signature;
    const recent = prev ? Date.now() - new Date(prev.at).getTime() < REPEAT_AFTER_MS : false;
    if (!same || !recent) {
      await notifyAdminsTelegram('server_health', [
        '⚠ Сервер: пробит порог ресурсов',
        ...h.problems.map((p) => `· ${p}`),
        '',
        summary,
      ]);
      sent = true;
      await prisma.systemSetting.upsert({
        where: { key: STATE_KEY },
        create: { key: STATE_KEY, value: JSON.stringify({ signature, at: new Date().toISOString() }), category: 'ops' },
        update: { value: JSON.stringify({ signature, at: new Date().toISOString() }) },
      });
    }
  } else if (prev?.signature) {
    // Было плохо — стало хорошо: сообщаем один раз и сбрасываем состояние.
    await notifyAdminsTelegram('server_health', ['✅ Сервер: ресурсы в норме', summary]);
    sent = true;
    await prisma.systemSetting.upsert({
      where: { key: STATE_KEY },
      create: { key: STATE_KEY, value: JSON.stringify({ signature: '', at: new Date().toISOString() }), category: 'ops' },
      update: { value: JSON.stringify({ signature: '', at: new Date().toISOString() }) },
    });
  }

  await markCronOk('server-health');
  return NextResponse.json({ ok: true, health: h, summary, sent });
}
