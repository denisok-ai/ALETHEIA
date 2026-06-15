/**
 * Обработчики админ-меню Telegram-бота AVATERRA.
 */
import { getTelegramWebhookInfo } from '@/lib/telegram-webhook-setup';
import {
  formatAdminTelegramMessage,
  getTelegramAdminChatIds,
  notifyAdminsTelegram,
} from '@/lib/telegram-admin-notify';
import { notifyTicketOwnerTelegramReply } from '@/lib/telegram-ticket-notify';
import type { BotContext } from './types';
import { getBotSiteSettings } from './settings-cache';
import {
  adminBackKeyboard,
  adminMainMenuKeyboard,
  adminPortalMenuKeyboard,
  adminTicketsListKeyboard,
  LIST_PAGE_SIZE,
  paginationKeyboard,
} from './keyboards';
import { botReply } from './messaging';
import {
  countOpenTickets,
  countPaidOrders,
  fetchAdminStats,
  fetchDigestStats,
  fetchOpenTickets,
  fetchRecentPaidOrders,
  fetchTicketById,
  fetchUserCardByEmail,
  postManagerTicketReply,
  searchUsersByEmail,
} from './queries';
import { setSessionState } from './session';

function fmtDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short' });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function reply(ctx: BotContext, text: string, keyboard = adminBackKeyboard()) {
  return botReply(ctx, text, { replyMarkup: keyboard });
}

async function adminSiteUrl(): Promise<string> {
  const { siteUrl } = await getBotSiteSettings();
  return siteUrl || 'https://avaterra.pro';
}

export async function handleAdminMenu(ctx: BotContext): Promise<void> {
  await botReply(ctx, '<b>Меню администратора AVATERRA</b>\n\nВыберите раздел:', {
    replyMarkup: adminMainMenuKeyboard(),
  });
}

export async function handleAdminPortalMenu(ctx: BotContext): Promise<void> {
  await botReply(ctx, '<b>🛠 Управление (портал)</b>\n\nCRM, тикеты, оплаты:', {
    replyMarkup: adminPortalMenuKeyboard(),
  });
}

export async function handleAdminStats(ctx: BotContext): Promise<void> {
  const [s, siteUrl] = await Promise.all([fetchAdminStats(), adminSiteUrl()]);
  const portalLinks = siteUrl
    ? `\n\n<a href="${siteUrl}/portal/admin">Админ-портал</a> · <a href="${siteUrl}/portal/manager/tickets">Тикеты</a>`
    : '';
  const text = [
    '<b>📊 Сводка</b>',
    `👥 Активных пользователей: <b>${s.usersActive}</b>`,
    `💳 Оплат сегодня: <b>${s.ordersPaidToday}</b>`,
    `🎫 Открытых тикетов: <b>${s.openTickets}</b>`,
    `📋 Необработанных лидов: <b>${s.unpaidLeads}</b>`,
    portalLinks,
  ].join('\n');
  await reply(ctx, text);
}

export async function handleAdminDigest(ctx: BotContext): Promise<void> {
  const [d, siteUrl] = await Promise.all([fetchDigestStats(), adminSiteUrl()]);
  const now = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  const text = [
    `<b>📰 Дайджест</b> <i>${now}</i>`,
    '',
    '<b>Сегодня</b>',
    `· Новых профилей: <b>${d.newUsersToday}</b>`,
    `· Оплат: <b>${d.ordersPaidToday}</b> (${d.revenueToday.toLocaleString('ru-RU')} ₽)`,
    `· Новых тикетов: <b>${d.ticketsCreatedToday}</b>`,
    '',
    '<b>Текущее</b>',
    `· Открытых тикетов: <b>${d.openTickets}</b>`,
    `· Активных пользователей: <b>${d.usersActive}</b>`,
    `· Лидов в работе: <b>${d.unpaidLeads}</b>`,
    '',
    '<b>За 7 дней</b>',
    `· Регистраций: <b>${d.registrationsWeek}</b>`,
    siteUrl ? `\n<a href="${siteUrl}/portal/admin">Портал администратора</a>` : '',
  ].join('\n');
  await reply(ctx, text);
}

export async function handleAdminOrders(ctx: BotContext, page = 0): Promise<void> {
  const total = await countPaidOrders();
  const totalPages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const [orders, siteUrl] = await Promise.all([
    fetchRecentPaidOrders(LIST_PAGE_SIZE, safePage * LIST_PAGE_SIZE),
    adminSiteUrl(),
  ]);

  if (orders.length === 0) {
    await reply(ctx, '<b>💳 Оплаты</b>\n\nНет оплаченных заказов.');
    return;
  }

  const lines = orders.map(
    (o, i) =>
      `${safePage * LIST_PAGE_SIZE + i + 1}. <code>${escapeHtml(o.orderNumber)}</code> — ${o.amount} ₽\n   ${escapeHtml(o.clientEmail)}\n   ${fmtDate(o.paidAt)}`
  );
  const header = siteUrl
    ? `<b>💳 Оплаты</b> (стр. ${safePage + 1}/${totalPages})\n<a href="${siteUrl}/portal/admin/orders">Все заказы</a>\n`
    : `<b>💳 Оплаты</b> (стр. ${safePage + 1}/${totalPages})\n`;

  await reply(ctx, `${header}\n${lines.join('\n\n')}`, paginationKeyboard('admin:orders', safePage, totalPages));
}

export async function handleAdminTickets(ctx: BotContext, page = 0): Promise<void> {
  const total = await countOpenTickets();
  const totalPages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const [siteUrl, tickets] = await Promise.all([
    adminSiteUrl(),
    fetchOpenTickets(LIST_PAGE_SIZE, safePage * LIST_PAGE_SIZE),
  ]);

  if (tickets.length === 0) {
    await reply(ctx, '<b>🎫 Тикеты</b>\n\nОткрытых обращений нет.');
    return;
  }

  const statusRu: Record<string, string> = {
    open: 'открыт',
    in_progress: 'в работе',
    resolved: 'решён',
    closed: 'закрыт',
  };
  const lines = tickets.map((t, i) => {
    const st = statusRu[t.status] ?? t.status;
    const ticketLink = siteUrl ? ` · <a href="${siteUrl}/portal/manager/tickets/${t.id}">#${t.id.slice(0, 8)}</a>` : '';
    return `${safePage * LIST_PAGE_SIZE + i + 1}. <b>${escapeHtml(t.subject.slice(0, 50))}</b> (${st})\n   ${escapeHtml(t.userEmail)} · ${fmtDate(t.createdAt)}${ticketLink}`;
  });
  const header = siteUrl
    ? `<b>🎫 Открытые тикеты</b> (стр. ${safePage + 1}/${totalPages})\n<a href="${siteUrl}/portal/manager/tickets">Все тикеты</a>\n\nНажмите кнопку ниже, чтобы ответить.\n`
    : `<b>🎫 Открытые тикеты</b> (стр. ${safePage + 1}/${totalPages})\n\nНажмите кнопку ниже, чтобы ответить.\n`;

  await reply(
    ctx,
    `${header}${lines.join('\n\n')}`,
    adminTicketsListKeyboard(
      tickets.map((t) => ({ id: t.id, subject: t.subject })),
      safePage,
      totalPages
    )
  );
}

export async function handleAdminTicketReplyPrompt(ctx: BotContext, ticketId: string): Promise<void> {
  const ticket = await fetchTicketById(ticketId);
  if (!ticket) {
    await reply(ctx, '❌ Тикет не найден.');
    return;
  }
  if (!['open', 'in_progress'].includes(ticket.status)) {
    await reply(ctx, `Тикет уже закрыт (статус: ${ticket.status}).`);
    return;
  }

  await setSessionState(ctx.chatId, 'admin_ticket_reply', { ticketId });
  const siteUrl = await adminSiteUrl();
  const portalLink = siteUrl ? `\n<a href="${siteUrl}/portal/manager/tickets/${ticketId}">Открыть в портале</a>` : '';

  await botReply(
    ctx,
    [
      `<b>✉️ Ответ на тикет</b>`,
      `Тема: <b>${escapeHtml(ticket.subject.slice(0, 80))}</b>`,
      `Клиент: ${escapeHtml(ticket.user.email)}`,
      portalLink,
      '',
      'Введите текст ответа одним сообщением.\nДля отмены — /menu',
    ].join('\n'),
    { replyMarkup: adminBackKeyboard() }
  );
}

export async function handleAdminTicketReplyMessage(ctx: BotContext, text: string): Promise<void> {
  const session = await import('./session').then((m) => m.getBotSession(ctx.chatId));
  const ticketId = session.data?.ticketId;
  if (!ticketId) {
    await setSessionState(ctx.chatId, 'idle');
    await reply(ctx, '❌ Сессия ответа устарела. Выберите тикет снова.');
    return;
  }

  const trimmed = text.trim();
  if (trimmed.length < 2) {
    await botReply(ctx, 'Ответ слишком короткий. Введите текст или /menu для отмены.');
    return;
  }
  if (trimmed.length > 4000) {
    await botReply(ctx, 'Ответ слишком длинный (макс. 4000 символов).');
    return;
  }

  const ticket = await fetchTicketById(ticketId);
  if (!ticket) {
    await setSessionState(ctx.chatId, 'idle');
    await reply(ctx, '❌ Тикет не найден.');
    return;
  }

  const result = await postManagerTicketReply(ticketId, trimmed);
  await setSessionState(ctx.chatId, 'idle');

  if (!result.ok) {
    await reply(ctx, `❌ ${result.error}`);
    return;
  }

  try {
    await notifyTicketOwnerTelegramReply({
      ticketId,
      subject: ticket.subject,
      replyContent: trimmed,
      ticketUserId: ticket.userId,
      messagesRaw: JSON.stringify(result.messages),
    });
  } catch (e) {
    console.error('[telegram-bot] notify ticket reply', e);
  }

  const siteUrl = await adminSiteUrl();
  const link = siteUrl ? `\n<a href="${siteUrl}/portal/manager/tickets/${ticketId}">Портал</a>` : '';

  await reply(
    ctx,
    `✅ <b>Ответ отправлен</b>\n\nТикет: <code>${ticketId}</code>${link}\n\nПревью:\n${escapeHtml(trimmed.slice(0, 300))}${trimmed.length > 300 ? '…' : ''}`
  );
}

export async function handleAdminUserCard(ctx: BotContext, email: string): Promise<void> {
  const card = await fetchUserCardByEmail(email);
  if (!card) {
    await reply(ctx, `👤 Пользователь <code>${escapeHtml(email)}</code> не найден.`);
    return;
  }

  const siteUrl = await adminSiteUrl();
  const courseLines =
    card.enrollments.length > 0
      ? card.enrollments.map((e) => `· ${escapeHtml(e.courseTitle)} — ${e.percent}%`).join('\n')
      : '· нет активных курсов';

  const orderLine = card.lastOrder
    ? `Последний заказ: <code>${escapeHtml(card.lastOrder.orderNumber)}</code> — ${card.lastOrder.amount} ₽ (${card.lastOrder.status})${card.lastOrder.paidAt ? `, ${fmtDate(card.lastOrder.paidAt)}` : ''}`
    : 'Последний заказ: —';

  const portalLink = siteUrl ? `\n<a href="${siteUrl}/portal/admin/users/${card.id}">Карточка в портале</a>` : '';
  const tgLine = card.telegramId ? `Telegram ID: <code>${card.telegramId}</code>` : 'Telegram: не привязан';

  await reply(
    ctx,
    [
      `<b>👤 ${escapeHtml(card.displayName ?? card.email)}</b>`,
      escapeHtml(card.email),
      `Роль: <b>${card.role}</b> · Статус: ${card.status}`,
      tgLine,
      '',
      '<b>Курсы</b>',
      courseLines,
      '',
      orderLine,
      portalLink,
    ].join('\n')
  );
}

export async function handleAdminUsersPrompt(ctx: BotContext): Promise<void> {
  await setSessionState(ctx.chatId, 'admin_user_search');
  await botReply(
    ctx,
    '<b>👥 Поиск пользователя</b>\n\nВведите email или его часть.\nИли команда: <code>/user email@example.com</code>\n\nДля отмены — /menu',
    { replyMarkup: adminBackKeyboard() }
  );
}

export async function handleAdminUserSearch(ctx: BotContext, query: string): Promise<void> {
  await setSessionState(ctx.chatId, 'idle');
  const users = await searchUsersByEmail(query, 5);
  if (users.length === 0) {
    await reply(ctx, `<b>👥 Поиск</b>\n\nПо запросу «${escapeHtml(query)}» ничего не найдено.`);
    return;
  }
  const lines = users.map(
    (u, i) =>
      `${i + 1}. <b>${escapeHtml(u.displayName ?? u.email)}</b>\n   ${escapeHtml(u.email)}\n   Роль: ${u.role}, статус: ${u.status}, курсов: ${u.enrollments}`
  );
  await reply(ctx, `<b>👥 Результаты поиска</b>\n\n${lines.join('\n\n')}\n\nПодробнее: /user email@…`);
}

export async function handleAdminMailing(ctx: BotContext): Promise<void> {
  const siteUrl = await adminSiteUrl();
  const text = [
    '<b>📢 Рассылки</b>',
    'Массовые email-рассылки настраиваются в портале:',
    `<a href="${siteUrl}/portal/admin/mailings">Портал → Рассылки</a>`,
    '',
    'Telegram-рассылки по шаблонам — в разделе «Коммуникации».',
    `<a href="${siteUrl}/portal/admin/communications">Портал → Коммуникации</a>`,
  ].join('\n');
  await reply(ctx, text);
}

export async function handleAdminNotify(ctx: BotContext): Promise<void> {
  const ids = await getTelegramAdminChatIds();
  const subscribed = ids.includes(String(ctx.chatId));
  const text = [
    '<b>🔔 Оповещения администратора</b>',
    subscribed
      ? `✅ Ваш Chat ID (<code>${ctx.chatId}</code>) в списке оповещений.`
      : `❌ Вы не подписаны. Отправьте /admin_on для подписки.`,
    '',
    `Всего подписчиков: <b>${ids.length}</b>`,
    '',
    'События: заявки с сайта, регистрации, оплаты, тикеты, ошибки PayKeeper.',
  ].join('\n');
  await reply(ctx, text);
}

export async function handleAdminSystem(ctx: BotContext): Promise<void> {
  const [siteUrl, webhook] = await Promise.all([adminSiteUrl(), getTelegramWebhookInfo()]);

  let siteHealth = 'не проверено';
  if (siteUrl) {
    try {
      const res = await fetch(`${siteUrl}/api/health`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      const data = (await res.json()) as { ok?: boolean; database?: string; version?: string };
      siteHealth = res.ok && data.ok
        ? `OK (БД: ${data.database ?? '?'}, v${data.version ?? '?'})`
        : `ошибка HTTP ${res.status}`;
    } catch (e) {
      siteHealth = e instanceof Error ? e.message : 'недоступен';
    }
  }

  const lines = [
    '<b>⚙️ Система</b>',
    '',
    '<b>Webhook Telegram:</b>',
    webhook.ok
      ? `URL: ${escapeHtml(webhook.url || '(не задан)')}\nОжидает: ${webhook.pending_update_count ?? 0}${webhook.last_error_message ? `\nОшибка: ${escapeHtml(webhook.last_error_message)}` : ''}`
      : `Ошибка: ${escapeHtml(webhook.error ?? 'неизвестно')}`,
    '',
    `<b>Сайт /api/health:</b> ${escapeHtml(siteHealth)}`,
    siteUrl ? `\n<a href="${siteUrl}">${escapeHtml(siteUrl)}</a>` : '',
  ];
  await reply(ctx, lines.join('\n'));
}

export async function handleNotifyTest(ctx: BotContext): Promise<void> {
  const text = formatAdminTelegramMessage('contact_lead', [
    'Тестовое оповещение из Telegram-бота (/notify_test).',
    `Инициатор: ${ctx.displayName} (chat ${ctx.chatId})`,
    `Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`,
  ]);
  const r = await botReply(ctx, text, { forceNew: true });
  if (!r.ok) {
    await botReply(ctx, `❌ Не удалось отправить тест: ${escapeHtml(r.error)}`, { forceNew: true });
    return;
  }
  const stats = await notifyAdminsTelegram('contact_lead', [
    'Тест рассылки админам из /notify_test.',
    `Инициатор: chat ${ctx.chatId}`,
  ]);
  await reply(
    ctx,
    `✅ Тест отправлен вам. Рассылка админам: sent=${stats.sent}, failed=${stats.failed}${stats.skipped ? ', нет подписчиков' : ''}.`
  );
}

export async function handleAdminCallback(ctx: BotContext, action: string, extra?: string): Promise<void> {
  if (action === 'orders' && extra !== undefined) {
    await handleAdminOrders(ctx, parseInt(extra, 10) || 0);
    return;
  }
  if (action === 'tickets' && extra !== undefined) {
    await handleAdminTickets(ctx, parseInt(extra, 10) || 0);
    return;
  }
  if (action === 't_reply' && extra) {
    await handleAdminTicketReplyPrompt(ctx, extra);
    return;
  }

  switch (action) {
    case 'sections':
      await handleAdminMenu(ctx);
      break;
    case 'menu':
      await handleAdminPortalMenu(ctx);
      break;
    case 'stats':
      await handleAdminStats(ctx);
      break;
    case 'digest':
      await handleAdminDigest(ctx);
      break;
    case 'orders':
      await handleAdminOrders(ctx, 0);
      break;
    case 'tickets':
      await handleAdminTickets(ctx, 0);
      break;
    case 'users':
      await handleAdminUsersPrompt(ctx);
      break;
    case 'mailing':
      await handleAdminMailing(ctx);
      break;
    case 'notify':
      await handleAdminNotify(ctx);
      break;
    case 'system':
      await handleAdminSystem(ctx);
      break;
    default:
      await handleAdminMenu(ctx);
  }
}
