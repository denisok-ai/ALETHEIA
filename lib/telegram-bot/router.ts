/**
 * Маршрутизация команд, callback-кнопок и текста Telegram-бота AVATERRA.
 */
import { answerCallbackQuery, sendChatAction } from '@/lib/telegram';
import { claimTelegramUpdate } from '@/lib/telegram-update-dedup';
import type { BotContext, TelegramUpdate } from './types';
import { appendAdminChatId, isTelegramAdmin } from './auth';
import { botReply } from './messaging';
import {
  handleAdminCallback,
  handleAdminMenu,
  handleAdminStats,
  handleAdminOrders,
  handleAdminTickets,
  handleAdminUsersPrompt,
  handleAdminUserCard,
  handleAdminDigest,
  handleAdminTicketReplyPrompt,
  handleNotifyTest,
  handleAdminBroadcast,
  handleAdminBroadcastMessage,
  handleAdminQuickReply,
  handleAdminHealth,
} from './admin-handlers';
import {
  handleCertificates,
  handleHelp,
  handleAbout,
  handleLinkCommand,
  handleMyId,
  handleProgress,
  handleSupportCallback,
  handleSupportWritePrompt,
  handleTextInSession,
  handleTicketStatus,
  handleUserMainMenu,
  handleFaqCategory,
  handleCourses,
  handleNotifications,
  handleSchedule,
} from './support-handlers';
import { handleFunnelChoice, handleFunnelWelcome, shouldShowFunnelOnStart } from './funnel';
import { hasStartPayload, parseStartPayload } from './deep-link';
import { removeKeyboard } from './keyboards';
import { markLeadResponded, upsertBotLead } from './lead-service';
import { handleContentCallback, handleContentCommand } from './content-handlers';

const CONTENT_COMMANDS = new Set([
  '/plan', '/plan_now', '/preview', '/approve', '/publish_now', '/regenerate', '/quality_queue',
  '/dry_run', '/auto', '/pause', '/resume', '/radar', '/radar_now', '/radar_signals',
  '/kb_load', '/kb_show', '/post_stats', '/stat',
]);

const RATE_LIMIT_MS = 400;
const RATE_BURST_PER_MINUTE = 25;
const lastMessageAt = new Map<number, number>();
const messageCounts = new Map<number, { count: number; windowStart: number }>();

function isRateLimited(chatId: number): boolean {
  const now = Date.now();
  const prev = lastMessageAt.get(chatId) ?? 0;
  if (now - prev < RATE_LIMIT_MS) return true;
  lastMessageAt.set(chatId, now);

  const burst = messageCounts.get(chatId) ?? { count: 0, windowStart: now };
  if (now - burst.windowStart > 60_000) {
    burst.count = 0;
    burst.windowStart = now;
  }
  burst.count += 1;
  messageCounts.set(chatId, burst);
  if (burst.count > RATE_BURST_PER_MINUTE) return true;

  if (lastMessageAt.size > 5000) {
    const cutoff = now - 60_000;
    lastMessageAt.forEach((t, id) => {
      if (t < cutoff) lastMessageAt.delete(id);
    });
    messageCounts.forEach((v, id) => {
      if (now - v.windowStart > 120_000) messageCounts.delete(id);
    });
  }
  return false;
}

async function safeReply(chatId: number, text: string): Promise<void> {
  const r = await botReply({ chatId, displayName: '', isAdmin: false }, text, { forceNew: true });
  if (!r.ok) {
    console.error(`[telegram-webhook] send failed chat=${chatId}: ${r.error}`);
  }
}

/** Нормализует /start@BotName → /start (Telegram добавляет @username в группах и из меню команд). */
function normalizeBotCommand(raw: string): string {
  const lower = raw.toLowerCase();
  if (!lower.startsWith('/')) return lower;
  const body = lower.slice(1).split('@')[0] ?? '';
  return body ? `/${body}` : lower;
}

/**
 * Телефон из кнопки «Поделиться телефоном»: пишем в карточку лида и зовём
 * менеджера. Чужой контакт (переслали чью-то визитку) не принимаем — в CRM
 * должен попасть номер собеседника, а не третьего лица.
 */
async function handleSharedContact(
  ctx: BotContext,
  contact: NonNullable<NonNullable<TelegramUpdate['message']>['contact']>
): Promise<void> {
  if (!contact.phone_number) return;

  const own = !contact.user_id || contact.user_id === ctx.telegramUserId;
  if (!own) {
    await safeReply(ctx.chatId, 'Это чужой контакт — пришлите, пожалуйста, свой номер кнопкой ниже.');
    return;
  }

  const { saveLeadPhone } = await import('./lead-service');
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ');
  const leadId = await saveLeadPhone(ctx, contact.phone_number, name);

  await botReply(
    ctx,
    'Спасибо! Записал номер — специалист школы свяжется с вами. ' +
      'Если удобнее в переписке, просто напишите сюда.',
    { replyMarkup: removeKeyboard(), forceNew: true }
  );

  const { notifyAdminsTelegramAsync } = await import('@/lib/telegram-admin-notify');
  notifyAdminsTelegramAsync('contact_lead', [
    'Лид оставил телефон в Telegram-боте.',
    `Имя: ${name || ctx.displayName}`,
    `Телефон: ${contact.phone_number}`,
    `Контакт: ${ctx.telegramUsername ? `@${ctx.telegramUsername}` : `chat ${ctx.chatId}`}`,
    ...(leadId ? [`CRM: лид ${leadId}`] : []),
  ]);
}

/**
 * Уведомление бота партнёра, пересланное владельцем. Работает только для
 * админов: это внутренний канал, а не публичная команда.
 * Возвращает true, если сообщение обработано.
 */
async function handlePartnerLeadForward(
  ctx: BotContext,
  text: string,
  entities: NonNullable<TelegramUpdate['message']>['entities']
): Promise<boolean> {
  const { looksLikePartnerLead, parsePartnerLead, upsertPartnerLead } = await import('./partner-lead');
  if (!looksLikePartnerLead(text)) return false;

  const parsed = parsePartnerLead(text, entities);
  if (!parsed) return false;

  const result = await upsertPartnerLead(parsed);
  if (!result) {
    await safeReply(ctx.chatId, '❌ Не удалось записать лид — посмотрите логи приложения.');
    return true;
  }

  const { getBotSiteSettings } = await import('./settings-cache');
  const { siteUrl } = await getBotSiteSettings();
  const base = siteUrl || 'https://avaterra.pro';
  const segmentWord = parsed.segment === 'hot' ? 'горячий' : parsed.segment === 'warm' ? 'тёплый' : 'холодный';

  await safeReply(
    ctx.chatId,
    [
      result.created ? '✅ Лид заведён в CRM' : '♻️ Лид дополнен (карточка уже была)',
      `Имя: ${parsed.name}`,
      `Сегмент: ${segmentWord}`,
      parsed.username ? `Ник: @${parsed.username}` : 'Ника нет',
      parsed.telegramUserId
        ? `Telegram ID: ${parsed.telegramUserId} — профиль откроется тапом по имени в исходном уведомлении`
        : 'Telegram ID не считался: перешлите уведомление, а не копируйте текст',
      '',
      `${base}/portal/admin/crm/leads/${result.leadId}`,
    ].join('\n')
  );
  return true;
}

function buildContextFromMessage(
  message: NonNullable<TelegramUpdate['message']>,
  isAdmin: boolean
): BotContext {
  const from = message.from;
  const displayName = [from?.first_name, from?.last_name].filter(Boolean).join(' ') || from?.username || 'Пользователь';
  const text = message.text?.trim() ?? '';
  const cmd = text.startsWith('/') ? normalizeBotCommand(text.split(/\s+/)[0] ?? '') : undefined;
  return {
    chatId: message.chat.id,
    telegramUserId: from?.id,
    telegramUsername: from?.username,
    displayName,
    text,
    command: cmd,
    isAdmin,
  };
}

function buildContextFromCallback(
  cq: NonNullable<TelegramUpdate['callback_query']>,
  isAdmin: boolean
): BotContext {
  const from = cq.from;
  const displayName = [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || 'Пользователь';
  const chatId = cq.message?.chat?.id ?? from.id;
  return {
    chatId,
    telegramUserId: from.id,
    telegramUsername: from.username,
    displayName,
    callbackData: cq.data,
    callbackQueryId: cq.id,
    messageId: cq.message?.message_id,
    isAdmin,
  };
}

function parseTicketCommand(cmd: string): string | null {
  const m = cmd.match(/^\/ticket_(.+)$/i);
  return m?.[1] ?? null;
}

async function handleCommand(ctx: BotContext): Promise<void> {
  const cmd = ctx.command ?? '';
  const args = (ctx.text ?? '').split(/\s+/).slice(1);
  const arg0 = args[0];

  const ticketIdFromCmd = parseTicketCommand(cmd);
  if (ticketIdFromCmd) {
    if (!ctx.isAdmin) {
      await safeReply(ctx.chatId, '⛔ Команда только для администраторов.');
      return;
    }
    await handleAdminTicketReplyPrompt(ctx, ticketIdFromCmd);
    return;
  }

  switch (cmd) {
    case '/start':
    case '/menu': {
      if (cmd === '/start' && arg0 === 'write') {
        await handleSupportWritePrompt(ctx);
        break;
      }
      if (cmd === '/start' && arg0 === 'support') {
        const { handleSupportInfo } = await import('./support-handlers');
        await handleSupportInfo(ctx);
        break;
      }
      // Deep link `?start=s-<источник>_l-<лид>`: человек сам открыл диалог —
      // фиксируем источник и привязываем чат к заявке с сайта, если она была.
      const payload = cmd === '/start' ? parseStartPayload(arg0) : {};
      if (cmd === '/start' && hasStartPayload(payload)) {
        await upsertBotLead(ctx, {
          entrySource: payload.entrySource,
          bindLeadId: payload.leadId,
          botMessaged: true,
        });
      }
      if (cmd === '/start' && (await shouldShowFunnelOnStart(ctx))) {
        await handleFunnelWelcome(ctx);
        break;
      }
      await handleUserMainMenu(ctx);
      if (ctx.isAdmin) {
        await botReply(
          ctx,
          '🔧 У вас есть права администратора. Команда /admin — меню управления.',
          {
            forceNew: true,
            replyMarkup: { inline_keyboard: [[{ text: '⚙️ Админ-меню', callback_data: 'admin:menu' }]] },
          }
        );
      }
      break;
    }
    case '/help':
    case '/faq':
      await handleHelp(ctx);
      break;
    case '/about':
      await handleAbout(ctx);
      break;
    case '/progress':
      await handleProgress(ctx);
      break;
    case '/cert':
      await handleCertificates(ctx);
      break;
    case '/courses':
      await handleCourses(ctx);
      break;
    case '/notifications':
      await handleNotifications(ctx);
      break;
    case '/schedule':
      await handleSchedule(ctx);
      break;
    case '/ticket_status':
      await handleTicketStatus(ctx);
      break;
    case '/myid':
      await handleMyId(ctx);
      break;
    case '/admin_on':
    case '/admin_subscribe': {
      const added = await appendAdminChatId(ctx.chatId);
      await safeReply(
        ctx.chatId,
        added
          ? `Вы подписаны на оповещения администратора (Chat ID: <code>${ctx.chatId}</code>).`
          : `Chat ID <code>${ctx.chatId}</code> уже в списке оповещений.`
      );
      break;
    }
    case '/link':
      await handleLinkCommand(ctx, arg0);
      break;
    case '/admin':
      if (!ctx.isAdmin) {
        await safeReply(ctx.chatId, '⛔ Нет доступа к админ-меню.');
        return;
      }
      await handleAdminMenu(ctx);
      break;
    case '/stats':
      if (!ctx.isAdmin) {
        await safeReply(ctx.chatId, '⛔ Команда только для администраторов.');
        return;
      }
      await handleAdminStats(ctx);
      break;
    case '/digest':
      if (!ctx.isAdmin) {
        await safeReply(ctx.chatId, '⛔ Команда только для администраторов.');
        return;
      }
      await handleAdminDigest(ctx);
      break;
    case '/tickets':
      if (!ctx.isAdmin) {
        await handleTicketStatus(ctx);
        return;
      }
      await handleAdminTickets(ctx);
      break;
    case '/ticket':
      if (!ctx.isAdmin) {
        await safeReply(ctx.chatId, '⛔ Команда только для администраторов.');
        return;
      }
      if (!arg0) {
        await handleAdminTickets(ctx);
        return;
      }
      await handleAdminTicketReplyPrompt(ctx, arg0);
      break;
    case '/orders':
      if (!ctx.isAdmin) {
        await safeReply(ctx.chatId, '⛔ Команда только для администраторов.');
        return;
      }
      await handleAdminOrders(ctx);
      break;
    case '/users':
      if (!ctx.isAdmin) {
        await safeReply(ctx.chatId, '⛔ Команда только для администраторов.');
        return;
      }
      await handleAdminUsersPrompt(ctx);
      break;
    case '/user':
      if (!ctx.isAdmin) {
        await safeReply(ctx.chatId, '⛔ Команда только для администраторов.');
        return;
      }
      if (!arg0?.includes('@')) {
        await safeReply(ctx.chatId, 'Использование: /user email@example.com');
        return;
      }
      await handleAdminUserCard(ctx, arg0);
      break;
    case '/notify_test':
      if (!ctx.isAdmin) {
        await safeReply(ctx.chatId, '⛔ Команда только для администраторов.');
        return;
      }
      await handleNotifyTest(ctx);
      break;
    case '/broadcast':
      if (!ctx.isAdmin) {
        await safeReply(ctx.chatId, '⛔ Команда только для администраторов.');
        return;
      }
      await handleAdminBroadcast(ctx);
      break;
    case '/reply':
      if (!ctx.isAdmin) {
        await safeReply(ctx.chatId, '⛔ Команда только для администраторов.');
        return;
      }
      await handleAdminQuickReply(ctx);
      break;
    case '/health':
      if (!ctx.isAdmin) {
        await safeReply(ctx.chatId, '⛔ Команда только для администраторов.');
        return;
      }
      await handleAdminHealth(ctx);
      break;
    default: {
      if (CONTENT_COMMANDS.has(cmd)) {
        if (!ctx.isAdmin) {
          await safeReply(ctx.chatId, '⛔ Команда только для администраторов.');
          return;
        }
        const handled = await handleContentCommand(ctx, cmd, args);
        if (handled) return;
      }
      break;
    }
  }
}

async function handleCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackData ?? '';
  if (ctx.callbackQueryId) {
    const ack = await answerCallbackQuery(ctx.callbackQueryId);
    if (!ack.ok) {
      console.error(`[telegram-webhook] answerCallbackQuery failed: ${ack.error}`);
    }
  }

  const parts = data.split(':');
  const prefix = parts[0];

  if (prefix === 'nav' && parts[1] === 'main') {
    await handleUserMainMenu(ctx);
    return;
  }
  if (prefix === 'faq' && parts[1] === 'cat' && parts[2]) {
    await handleFaqCategory(ctx, parts[2]);
    return;
  }
  if (prefix === 'funnel' && parts[1]) {
    await handleFunnelChoice(ctx, parts[1]);
    return;
  }
  if (prefix === 'admin') {
    if (!ctx.isAdmin) {
      await safeReply(ctx.chatId, '⛔ Нет доступа.');
      return;
    }
    await handleAdminCallback(ctx, parts[1] ?? 'menu', parts.slice(2).join(':'));
    return;
  }
  if (prefix === 'content') {
    if (!ctx.isAdmin) {
      await safeReply(ctx.chatId, '⛔ Нет доступа.');
      return;
    }
    await handleContentCallback(ctx, parts[1] ?? 'menu');
    return;
  }
  if (prefix === 'support') {
    await handleSupportCallback(ctx, parts[1] ?? 'menu');
    return;
  }
  await handleUserMainMenu(ctx);
}

async function routeTelegramUpdateImpl(update: TelegramUpdate): Promise<void> {
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message?.chat?.id ?? cq.from.id;
    if (isRateLimited(chatId)) return;
    const isAdmin = await isTelegramAdmin(chatId, cq.from.id);
    const ctx = buildContextFromCallback(cq, isAdmin);
    await handleCallback(ctx);
    return;
  }

  const message = update.message;
  if (!message?.chat?.id) return;

  const chatId = message.chat.id;

  // Человек нажал «Поделиться телефоном» — это сообщение без текста.
  if (message.contact?.phone_number) {
    const isAdminContact = await isTelegramAdmin(chatId, message.from?.id);
    await handleSharedContact(buildContextFromMessage(message, isAdminContact), message.contact);
    return;
  }

  const text = message.text?.trim();
  if (!text) return;

  if (isRateLimited(chatId) && !text.startsWith('/')) return;

  const isAdmin = await isTelegramAdmin(chatId, message.from?.id);
  const ctx = buildContextFromMessage(message, isAdmin);

  // Пересланное уведомление чужой воронки: заводим карточку в CRM.
  if (isAdmin && (await handlePartnerLeadForward(ctx, text, message.entities))) return;

  // Человек написал сам — автодогоны по нему прекращаются (не ждём cron).
  if (!isAdmin) void markLeadResponded(chatId);

  if (text.startsWith('/')) {
    await handleCommand(ctx);
    return;
  }

  const handled = await handleTextInSession(ctx, text);
  if (handled) return;

  // Вне сценария человек чаще всего просто задаёт вопрос — пробуем ответить
  // готовым текстом из FAQ, и только если не узнали, отправляем в меню.
  const { matchFaqAnswer } = await import('./faq-match');
  const faq = matchFaqAnswer(text);
  if (faq) {
    const { formatFaqAutoAnswer } = await import('./funnel');
    await safeReply(ctx.chatId, formatFaqAutoAnswer(faq.question, faq.answer));
    return;
  }

  // Вопрос не узнан — фиксируем: по этому журналу видно, чего не хватает в FAQ.
  if (!isAdmin) {
    const { logFaqMiss } = await import('./faq-miss-log');
    void logFaqMiss(ctx.chatId, text);
  }

  await safeReply(
    ctx.chatId,
    'Используйте /menu для главного меню или /help для справки.'
  );
}

/** Обработать одно входящее обновление Telegram (с логом и ответом при сбое). */
export async function routeTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const updateId = update.update_id ?? 0;
  if (!claimTelegramUpdate(updateId)) {
    console.log(`[telegram-webhook] skip duplicate update=${updateId}`);
    return;
  }

  const chatId =
    update.message?.chat?.id ??
    update.callback_query?.message?.chat?.id ??
    update.callback_query?.from?.id;

  if (chatId) {
    void sendChatAction(chatId, 'typing');
  }

  const started = Date.now();
  try {
    await routeTelegramUpdateImpl(update);
    console.log(
      `[telegram-webhook] done update=${updateId} chat=${chatId ?? '?'} ms=${Date.now() - started}`
    );
  } catch (err) {
    console.error(
      `[telegram-webhook] FAILED update=${updateId} chat=${chatId ?? '?'} ms=${Date.now() - started}`,
      err
    );
    if (chatId) {
      await safeReply(
        chatId,
        '❌ Ошибка обработки команды. Попробуйте /menu через минуту.'
      ).catch((e) => console.error('[telegram-webhook] error reply failed', e));
    }
  }
}
