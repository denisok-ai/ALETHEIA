/**
 * Автодогоны лидов Telegram-бота: два касания без участия менеджера.
 *
 * Работает только с теми, кто САМ начал диалог с ботом (есть telegramChatId) —
 * писать первым другим людям Telegram запрещает. Как только человек отвечает,
 * догоны прекращаются: `respondedAt` проставляет роутер на любое входящее.
 *
 * Идемпотентность: `followupStage` (0 → 1 → 2) и окно от `lastBotMessageAt`.
 * Один прогон = не больше MAX_PER_RUN отправок, чтобы не упереться в лимиты.
 */
import { prisma } from './db';
import { sendTelegramMessageWithResult } from './telegram';
import { TELEGRAM_BOT_URL } from './social-links';
import { sendOffer } from './telegram-bot/offer';
import {
  sendOfferNudge,
  NUDGE_AFTER_OFFER_MS,
  LOST_AFTER_NUDGE_MS,
} from './telegram-bot/offer-nudge';
import { markLost } from './telegram-bot/lead-qualify';

const STAGE1_AFTER_MS = 2 * 60 * 60 * 1000; // касание 1: 2 часа тишины
const STAGE2_AFTER_MS = 24 * 60 * 60 * 1000; // касание 2: сутки после касания 1
const STAGE3_AFTER_MS = 2 * 24 * 60 * 60 * 1000; // касание 3 (оффер): 2 суток после касания 2
const MAX_AGE_MS = 10 * 24 * 60 * 60 * 1000; // старше 10 дней не греем
const MAX_PER_RUN = 25;
const FINAL_STAGE = 3;

const LINK_BODY = 'https://avaterra.pro/course/navyki-myshechnogo-testirovaniya';
const LINK_AWAKENING = 'https://avaterra.pro/course/probuzhdenie';
const LINK_FAQ = 'https://avaterra.pro/faq';

type Stage = 1 | 2 | 3;

/** Тексты держим мягкими: школа не давит, второе касание — последнее. */
function followupText(stage: Stage, segment: string | null): string {
  if (stage === 1) {
    const opener =
      segment === 'hot'
        ? 'Здравствуйте! Вы отмечали, что готовы обсудить участие — не хочу потерять ваш запрос.'
        : 'Здравствуйте! Вы заходили к нам с вопросами про курс — вдруг они всё ещё открыты.';
    return [
      opener,
      '',
      'Чтобы ответить точнее, достаточно пары слов: что хочется решить — телесное напряжение и усталость, ' +
        'личная ситуация, или вы помогающий специалист и берёте метод в работу?',
      '',
      `Пока можно посмотреть программы: <a href="${LINK_BODY}">«Тело не врёт»</a> · ` +
        `<a href="${LINK_AWAKENING}">«Пробуждение»</a> · <a href="${LINK_FAQ}">частые вопросы</a>.`,
    ].join('\n');
  }
  return [
    'Не буду больше напоминать — просто оставлю всё нужное в одном месте.',
    '',
    `• <a href="${LINK_BODY}">«Тело не врёт»</a> — базовый навык мышечного тестирования, подходит с нуля.`,
    `• <a href="${LINK_AWAKENING}">«Пробуждение»</a> — 21 день практик, в группе или индивидуально.`,
    `• <a href="${LINK_FAQ}">Ответы на частые вопросы</a>.`,
    '',
    'Захотите вернуться к разговору — просто напишите сюда, я на связи.',
    '',
    '<i>Не хотите напоминаний — напишите «стоп».</i>',
  ].join('\n');
}

function followupKeyboard(stage: Stage) {
  const rows: { text: string; url?: string; callback_data?: string }[][] = [
    [{ text: '📚 Программа «Тело не врёт»', url: LINK_BODY }],
  ];
  if (stage === 1) {
    rows.push([{ text: '💬 Написать менеджеру', url: `${TELEGRAM_BOT_URL}?start=write` }]);
  } else {
    rows.push([{ text: '🌿 «Пробуждение» (21 день)', url: LINK_AWAKENING }]);
  }
  return { inline_keyboard: rows };
}

/**
 * Лиды, до которых бот дотянуться не может: нет диалога в Telegram (пришли из
 * чата на сайте или из старой воронки) либо оба догона уже израсходованы.
 * Их разбирает человек — раз в сутки напоминаем, чтобы не залёживались.
 */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const STALE_NOTICE_KEY = 'stale_leads_notified_at';

async function notifyStaleLeads(now: Date): Promise<number> {
  try {
    const marker = await prisma.systemSetting.findUnique({ where: { key: STALE_NOTICE_KEY } });
    const lastAt = marker?.value ? new Date(marker.value).getTime() : 0;
    // Напоминание раз в сутки: cron ходит ежечасно, спамить незачем.
    if (now.getTime() - lastAt < STALE_AFTER_MS) return 0;

    const stale = await prisma.lead.findMany({
      where: {
        status: 'new',
        createdAt: { lt: new Date(now.getTime() - STALE_AFTER_MS) },
        OR: [{ telegramChatId: null }, { followupStage: { gte: 2 } }],
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
      select: { id: true, name: true, phone: true, source: true, createdAt: true },
    });
    if (stale.length === 0) return 0;

    const { notifyAdminsTelegram } = await import('./telegram-admin-notify');
    const stats = await notifyAdminsTelegram('contact_lead', [
      `Лиды без ответа дольше суток: ${stale.length}`,
      'Бот их дальше не ведёт — нужен человек.',
      '',
      ...stale.map((l) => {
        const days = Math.floor((now.getTime() - l.createdAt.getTime()) / STALE_AFTER_MS);
        return `· ${l.id} ${l.name} (${l.phone}) — ${l.source ?? 'без источника'}, ${days} дн.`;
      }),
    ]);

    // Метку суточной паузы ставим, только если напоминание реально ушло:
    // иначе сбой отправки молча съел бы напоминание на целые сутки.
    if (stats.sent === 0) return 0;

    await prisma.systemSetting.upsert({
      where: { key: STALE_NOTICE_KEY },
      create: { key: STALE_NOTICE_KEY, value: now.toISOString(), category: 'crm' },
      update: { value: now.toISOString() },
    });
    return stale.length;
  } catch (e) {
    console.error('[followup] напоминание о залежавшихся лидах:', e);
    return 0;
  }
}

export type FollowupResult = {
  candidates: number;
  sent: number;
  failed: number;
  blocked: number;
  dryRun: boolean;
  /** Сколько залежавшихся лидов попало в напоминание админам (раз в сутки). */
  staleNotified: number;
  nudged: number;
  lostClosed: number;
  details: string[];
};

/**
 * Один прогон догонов. `now` инжектируется для тестов.
 * Возвращает сводку — её же видит cron-роут.
 */
export async function runTelegramLeadFollowup(
  options: { dryRun?: boolean; now?: Date } = {}
): Promise<FollowupResult> {
  const dryRun = options.dryRun ?? false;
  const now = options.now ?? new Date();
  const result: FollowupResult = {
    candidates: 0, sent: 0, failed: 0, blocked: 0, dryRun, staleNotified: 0, nudged: 0, lostClosed: 0, details: [],
  };

  if (!dryRun) result.staleNotified = await notifyStaleLeads(now);

  const leads = await prisma.lead.findMany({
    where: {
      telegramChatId: { not: null },
      respondedAt: null,
      unsubscribedAt: null, // отписавшихся не трогаем
      status: 'new',
      followupStage: { lt: FINAL_STAGE },
      funnelSegment: { in: ['warm', 'hot'] },
      createdAt: { gte: new Date(now.getTime() - MAX_AGE_MS) },
    },
    orderBy: { createdAt: 'asc' },
    take: MAX_PER_RUN * 2,
  });

  for (const lead of leads) {
    if (result.sent >= MAX_PER_RUN) break;

    const since = (lead.lastBotMessageAt ?? lead.createdAt).getTime();
    const waited = now.getTime() - since;
    const stage = (lead.followupStage + 1) as Stage;
    const threshold = stage === 1 ? STAGE1_AFTER_MS : stage === 2 ? STAGE2_AFTER_MS : STAGE3_AFTER_MS;
    if (waited < threshold) continue;

    result.candidates += 1;
    const chatId = lead.telegramChatId as number;

    if (dryRun) {
      result.details.push(`лид ${lead.id} (${lead.name}): касание #${stage}${stage === FINAL_STAGE ? ' (оффер)' : ''} готово`);
      continue;
    }

    // Финальное касание — оффер с тарифом и оплатой (offer уважает отписку).
    if (stage === FINAL_STAGE) {
      const offer = await sendOffer(chatId, {});
      if (offer.sent) {
        await prisma.lead.update({ where: { id: lead.id }, data: { followupStage: FINAL_STAGE, lastBotMessageAt: now } });
        result.sent += 1;
        result.details.push(`лид ${lead.id}: касание #3 — оффер отправлен`);
      } else if (offer.reason === 'unsubscribed') {
        result.details.push(`лид ${lead.id}: отписался — пропуск`);
      } else {
        await prisma.lead.update({ where: { id: lead.id }, data: { followupStage: FINAL_STAGE } });
        result.details.push(`лид ${lead.id}: оффер не отправлен (${offer.reason})`);
      }
      continue;
    }

    const sent = await sendTelegramMessageWithResult(chatId, followupText(stage, lead.funnelSegment), {
      parseMode: 'HTML',
      replyMarkup: followupKeyboard(stage),
      disableWebPagePreview: true,
    });

    if (sent.ok) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { followupStage: stage, lastBotMessageAt: now },
      });
      result.sent += 1;
      result.details.push(`лид ${lead.id}: догон #${stage} отправлен`);
      continue;
    }

    // Заблокировал бота или удалил чат — повторять бессмысленно, закрываем догоны.
    const blocked = /blocked|chat not found|deactivated|user is deactivated/i.test(sent.error);
    if (blocked) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          followupStage: 2,
          notes: [lead.notes, `Бот заблокирован или чат недоступен (${sent.error}).`]
            .filter(Boolean)
            .join('\n')
            .slice(0, 2000),
        },
      });
      result.blocked += 1;
      result.details.push(`лид ${lead.id}: чат недоступен — догоны остановлены`);
      continue;
    }

    result.failed += 1;
    result.details.push(`лид ${lead.id}: ошибка отправки — ${sent.error}`);
  }

  await runOfferNudgeAndClose(now, dryRun, result);
  return result;
}

/**
 * Дожим после оффера и закрытие «глухих» лидов.
 * Дожим — одноразовый, через 2 суток после оффера; затем ещё 3 суток тишины → lost.
 * Всё уважает отписку, ответ и оплату.
 */
async function runOfferNudgeAndClose(now: Date, dryRun: boolean, result: FollowupResult): Promise<void> {
  // 1) Кандидаты на дожим: получили оффер, не дожаты, не ответили после оффера.
  const toNudge = await prisma.lead.findMany({
    where: {
      telegramChatId: { not: null },
      status: { not: 'converted' },
      unsubscribedAt: null,
      offerSentAt: { not: null, lte: new Date(now.getTime() - NUDGE_AFTER_OFFER_MS) },
      offerNudgedAt: null,
    },
    // Кликнувшие по офферу (пошли платить, но не завершили) — горячее, дожимаем первыми.
    orderBy: [{ offerClickedAt: 'desc' }, { offerSentAt: 'asc' }],
    take: 25,
  });
  for (const lead of toNudge) {
    // Ответил уже ПОСЛЕ оффера — значит диалог живой, дожим не нужен (пометим, чтобы не возвращался).
    const answeredAfterOffer = lead.respondedAt && lead.offerSentAt && lead.respondedAt > lead.offerSentAt;
    if (answeredAfterOffer) {
      if (!dryRun) await prisma.lead.update({ where: { id: lead.id }, data: { offerNudgedAt: now } });
      continue;
    }
    if (dryRun) {
      result.details.push(`лид ${lead.id} (${lead.name}): дожим готов`);
      continue;
    }
    const ok = await sendOfferNudge(lead);
    if (ok) {
      result.nudged += 1;
      result.details.push(`лид ${lead.id}: дожим отправлен`);
    }
  }

  // 2) Закрытие: дожали, прошло ещё 3 суток тишины, не оплатил → lost.
  const toClose = await prisma.lead.findMany({
    where: {
      status: { in: ['new', 'contacted', 'qualified'] },
      offerNudgedAt: { not: null, lte: new Date(now.getTime() - LOST_AFTER_NUDGE_MS) },
    },
    take: 50,
  });
  for (const lead of toClose) {
    const answeredAfterNudge = lead.respondedAt && lead.offerNudgedAt && lead.respondedAt > lead.offerNudgedAt;
    if (answeredAfterNudge) continue; // живой диалог — не хороним
    if (dryRun) {
      result.details.push(`лид ${lead.id} (${lead.name}): будет закрыт (lost)`);
      continue;
    }
    await markLost(lead.id, 'нет реакции после дожима');
    result.lostClosed += 1;
  }
}
