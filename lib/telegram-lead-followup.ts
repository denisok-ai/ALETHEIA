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

const STAGE1_AFTER_MS = 2 * 60 * 60 * 1000; // 2 часа тишины после ответа бота
const STAGE2_AFTER_MS = 24 * 60 * 60 * 1000; // сутки после первого догона
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // старше недели не трогаем
const MAX_PER_RUN = 25;

const LINK_BODY = 'https://avaterra.pro/course/navyki-myshechnogo-testirovaniya';
const LINK_AWAKENING = 'https://avaterra.pro/course/probuzhdenie';
const LINK_FAQ = 'https://avaterra.pro/faq';

type Stage = 1 | 2;

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

export type FollowupResult = {
  candidates: number;
  sent: number;
  failed: number;
  blocked: number;
  dryRun: boolean;
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
  const result: FollowupResult = { candidates: 0, sent: 0, failed: 0, blocked: 0, dryRun, details: [] };

  const leads = await prisma.lead.findMany({
    where: {
      telegramChatId: { not: null },
      respondedAt: null,
      status: 'new',
      followupStage: { lt: 2 },
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
    const stage: Stage = lead.followupStage === 0 ? 1 : 2;
    const threshold = stage === 1 ? STAGE1_AFTER_MS : STAGE2_AFTER_MS;
    if (waited < threshold) continue;

    result.candidates += 1;
    const chatId = lead.telegramChatId as number;

    if (dryRun) {
      result.details.push(`лид ${lead.id} (${lead.name}): догон #${stage} готов`);
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

  return result;
}
