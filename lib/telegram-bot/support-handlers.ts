/**
 * Обработчики пользовательского меню и поддержки Telegram-бота AVATERRA.
 */
import { getTelegramBotUsername } from '@/lib/telegram';
import type { BotContext } from './types';
import { getBotSiteSettings } from './settings-cache';
import { backToMainKeyboard, faqCategoriesKeyboard, faqCategoryBackKeyboard, supportDeepLinkKeyboard, userMainMenuKeyboard } from './keyboards';
import {
  fetchGuestTicketsByTelegramMeta,
  fetchUserCertificates,
  fetchUserCourseProgress,
  fetchUserOpenTickets,
  fetchPublishedCourses,
  fetchUserNotifications,
  fetchUserInstallmentSchedule,
} from './queries';
import {
  findUserByTelegramId,
  getOrCreateTelegramGuestUser,
  linkTelegramToUser,
} from './auth';
import { clearBotSession, getBotSession, setSessionState } from './session';
import { createTelegramSupportTicket } from './ticket-service';
import { botReply } from './messaging';
import { formatAboutText, formatFaqCategoryText, formatFaqOverviewText, getFaqCategory } from './faq';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function handleUserMainMenu(ctx: BotContext): Promise<void> {
  const [{ portalTitle }, linked] = await Promise.all([
    getBotSiteSettings(),
    ctx.telegramUserId ? findUserByTelegramId(ctx.telegramUserId) : Promise.resolve(null),
  ]);
  const linkHint = linked
    ? `\n\n✅ Аккаунт привязан: <code>${escapeHtml(linked.email)}</code>`
    : '\n\n💡 Привяжите Telegram в профиле портала (поле Telegram ID) или укажите /link email@example.com';

  await botReply(ctx, `<b>${escapeHtml(portalTitle)}</b>\n\nГлавное меню бота поддержки.${linkHint}`, {
    replyMarkup: userMainMenuKeyboard(),
  });
}

export async function handleProgress(ctx: BotContext): Promise<void> {
  if (!ctx.telegramUserId) {
    await botReply(
      ctx,
      '📚 Для просмотра прогресса привяжите Telegram к аккаунту портала (Telegram ID в профиле) или войдите на сайт.',
      { replyMarkup: backToMainKeyboard() }
    );
    return;
  }
  const user = await findUserByTelegramId(ctx.telegramUserId);
  if (!user) {
    await botReply(
      ctx,
      '📚 Аккаунт не найден. Укажите ваш Telegram ID в профиле портала или /link email@example.com',
      { replyMarkup: backToMainKeyboard() }
    );
    return;
  }

  const rows = await fetchUserCourseProgress(user.id);
  if (rows.length === 0) {
    await botReply(
      ctx,
      '📚 У вас пока нет активных курсов.\n\nОформите доступ на сайте или дождитесь зачисления после оплаты.',
      { replyMarkup: backToMainKeyboard() }
    );
    return;
  }

  const lines = rows.map((r) => {
    const done = r.completedAt ? ' ✅ завершён' : '';
    const bar = r.percent >= 100 ? '██████████' : '█'.repeat(Math.floor(r.percent / 10)) + '░'.repeat(10 - Math.floor(r.percent / 10));
    return `• <b>${escapeHtml(r.courseTitle)}</b>${done}\n  ${bar} ${r.percent}%\n  ${r.completedLessons}/${r.totalLessons} уроков`;
  });
  const { siteUrl } = await getBotSiteSettings();
  const footer = siteUrl ? `\n\n<a href="${siteUrl}/portal/student/courses">Открыть «Мои курсы»</a>` : '';

  await botReply(ctx, `<b>📚 Ваш прогресс</b>\n\n${lines.join('\n\n')}${footer}`, {
    replyMarkup: backToMainKeyboard(),
  });
}

export async function handleCertificates(ctx: BotContext): Promise<void> {
  if (!ctx.telegramUserId) {
    await botReply(ctx, '🎓 Привяжите Telegram к аккаунту портала.', { replyMarkup: backToMainKeyboard() });
    return;
  }
  const user = await findUserByTelegramId(ctx.telegramUserId);
  if (!user) {
    await botReply(ctx, '🎓 Аккаунт не найден. Используйте /link email@example.com', {
      replyMarkup: backToMainKeyboard(),
    });
    return;
  }

  const certs = await fetchUserCertificates(user.id);
  if (certs.length === 0) {
    await botReply(
      ctx,
      '🎓 Сертификатов пока нет.\n\nОни выдаются после полного прохождения курса.',
      { replyMarkup: backToMainKeyboard() }
    );
    return;
  }

  const { siteUrl } = await getBotSiteSettings();
  const lines = certs.map((c) => {
    const revoked = c.revokedAt ? ' (отозван)' : '';
    const date = c.issuedAt.toLocaleDateString('ru-RU');
    const dl = siteUrl && !c.revokedAt ? `\n  <a href="${siteUrl}/portal/student/certificates">Скачать</a>` : '';
    return `• <b>${escapeHtml(c.courseTitle)}</b>\n  № ${escapeHtml(c.certNumber)} · ${date}${revoked}${dl}`;
  });
  const footer = siteUrl ? `\n\n<a href="${siteUrl}/portal/student/certificates">Все сертификаты в портале</a>` : '';

  await botReply(ctx, `<b>🎓 Ваши сертификаты</b>\n\n${lines.join('\n\n')}${footer}`, {
    replyMarkup: backToMainKeyboard(),
  });
}

export async function handleSupportInfo(ctx: BotContext): Promise<void> {
  const { siteUrl: cachedUrl } = await getBotSiteSettings();
  const siteUrl = cachedUrl || 'https://avaterra.pro';
  const botUsername = await getTelegramBotUsername();
  const text = [
    '<b>🆘 Поддержка</b>',
    '',
    '1. Нажмите «💬 Написать в поддержку» — мы создадим обращение.',
    `2. Или откройте <a href="${siteUrl}/portal/student/support">раздел поддержки</a> на портале.`,
    '',
    'Ответ придёт на email регистрации и в Telegram (если аккаунт привязан).',
  ].join('\n');
  const keyboard = await supportDeepLinkKeyboard(botUsername);
  await botReply(ctx, text, { replyMarkup: keyboard });
}

export async function handleSupportWritePrompt(ctx: BotContext): Promise<void> {
  await setSessionState(ctx.chatId, 'support_compose');
  await botReply(
    ctx,
    '<b>💬 Написать в поддержку</b>\n\nОпишите вопрос одним сообщением (до 2000 символов).\n\nДля отмены — /menu',
    { replyMarkup: backToMainKeyboard() }
  );
}

export async function handleSupportMessage(ctx: BotContext, message: string): Promise<void> {
  const trimmed = message.trim();
  if (trimmed.length < 3) {
    await botReply(ctx, 'Сообщение слишком короткое. Опишите вопрос подробнее.');
    return;
  }
  if (trimmed.length > 2000) {
    await botReply(ctx, 'Сообщение слишком длинное (макс. 2000 символов).');
    return;
  }

  await clearBotSession(ctx.chatId);
  const linked = ctx.telegramUserId ? await findUserByTelegramId(ctx.telegramUserId) : null;

  try {
    const { ticketId, subject } = await createTelegramSupportTicket({
      message: trimmed,
      chatId: ctx.chatId,
      telegramUserId: ctx.telegramUserId,
      telegramUsername: ctx.telegramUsername,
      displayName: ctx.displayName,
      linkedUser: linked,
    });

    const { siteUrl } = await getBotSiteSettings();
    const portalLink = linked && siteUrl ? `\n\n<a href="${siteUrl}/portal/student/support/${ticketId}">Открыть обращение</a>` : '';

    await botReply(
      ctx,
      `✅ <b>Обращение принято</b>\n\nТема: ${escapeHtml(subject)}\nID: <code>${ticketId}</code>${portalLink}\n\nМы ответим в ближайшее время.`,
      { replyMarkup: backToMainKeyboard(), forceNew: true }
    );
  } catch (e) {
    console.error('[telegram-bot] create ticket', e);
    await botReply(
      ctx,
      '❌ Не удалось создать обращение. Попробуйте позже или напишите на email с сайта.',
      { replyMarkup: backToMainKeyboard(), forceNew: true }
    );
  }
}

export async function handleTicketStatus(ctx: BotContext): Promise<void> {
  const statusRu: Record<string, string> = {
    open: 'открыт',
    in_progress: 'в работе',
  };

  let tickets: { id: string; subject: string; status: string; updatedAt: Date }[] = [];

  if (ctx.telegramUserId) {
    const user = await findUserByTelegramId(ctx.telegramUserId);
    if (user) {
      tickets = await fetchUserOpenTickets(user.id);
    }
  }

  if (tickets.length === 0) {
    const guestId = await getOrCreateTelegramGuestUser();
    tickets = await fetchGuestTicketsByTelegramMeta(guestId, ctx.chatId);
  }

  if (tickets.length === 0) {
    await botReply(
      ctx,
      '📋 У вас нет открытых обращений.\n\nСоздайте новое через «💬 Написать в поддержку».',
      { replyMarkup: backToMainKeyboard() }
    );
    return;
  }

  const { siteUrl } = await getBotSiteSettings();
  const lines = tickets.map((t, i) => {
    const link = siteUrl ? ` · <a href="${siteUrl}/portal/student/support/${t.id}">открыть</a>` : '';
    return `${i + 1}. <b>${escapeHtml(t.subject.slice(0, 50))}</b>\n   Статус: ${statusRu[t.status] ?? t.status} · ${t.updatedAt.toLocaleDateString('ru-RU')}${link}`;
  });
  await botReply(ctx, `<b>📋 Открытые обращения</b>\n\n${lines.join('\n\n')}`, {
    replyMarkup: backToMainKeyboard(),
  });
}

export async function handleFaqMenu(ctx: BotContext): Promise<void> {
  await botReply(ctx, formatFaqOverviewText(), { replyMarkup: faqCategoriesKeyboard() });
}

export async function handleFaqCategory(ctx: BotContext, categoryId: string): Promise<void> {
  const category = getFaqCategory(categoryId);
  if (!category) {
    await handleFaqMenu(ctx);
    return;
  }
  const text = formatFaqCategoryText(category);
  if (text.length > 3900) {
    await botReply(ctx, `${text.slice(0, 3900)}…`, { replyMarkup: faqCategoryBackKeyboard() });
    return;
  }
  await botReply(ctx, text, { replyMarkup: faqCategoryBackKeyboard() });
}

export async function handleHelp(ctx: BotContext): Promise<void> {
  await handleFaqMenu(ctx);
}

export async function handleAbout(ctx: BotContext): Promise<void> {
  await botReply(ctx, formatAboutText(), { replyMarkup: backToMainKeyboard() });
}

export async function handlePortalLink(ctx: BotContext): Promise<void> {
  const { siteUrl: cachedUrl } = await getBotSiteSettings();
  const siteUrl = cachedUrl || 'https://avaterra.pro';
  await botReply(
    ctx,
    `🌐 <a href="${siteUrl}">Открыть портал AVATERRA</a>\n\n<a href="${siteUrl}/portal/student/courses">Мои курсы</a> · <a href="${siteUrl}/portal/student/support">Поддержка</a>`,
    { replyMarkup: backToMainKeyboard(), disableWebPagePreview: false }
  );
}

export async function handleLinkCommand(ctx: BotContext, emailArg?: string): Promise<void> {
  if (!ctx.telegramUserId) {
    await botReply(ctx, 'Не удалось определить ваш Telegram ID.');
    return;
  }
  if (!emailArg?.includes('@')) {
    await botReply(
      ctx,
      'Использование: /link email@example.com\n\nEmail должен совпадать с регистрацией на портале.',
      { replyMarkup: backToMainKeyboard() }
    );
    return;
  }
  const r = await linkTelegramToUser(emailArg, ctx.telegramUserId);
  await botReply(ctx, r.ok ? `✅ ${r.message}` : `❌ ${r.message}`, { replyMarkup: backToMainKeyboard() });
}

export async function handleMyId(ctx: BotContext): Promise<void> {
  await botReply(
    ctx,
    `Ваш Chat ID: <code>${ctx.chatId}</code>${ctx.telegramUserId ? `\nTelegram user ID: <code>${ctx.telegramUserId}</code>` : ''}\n\nСкопируйте Telegram user ID в профиль портала или отправьте /admin_on для подписки на оповещения админа.`,
    { forceNew: true }
  );
}

export async function handleSupportCallback(ctx: BotContext, action: string): Promise<void> {
  switch (action) {
    case 'progress':
      await handleProgress(ctx);
      break;
    case 'cert':
      await handleCertificates(ctx);
      break;
    case 'support':
      await handleSupportInfo(ctx);
      break;
    case 'faq':
      await handleFaqMenu(ctx);
      break;
    case 'about':
      await handleAbout(ctx);
      break;
    case 'portal':
      await handlePortalLink(ctx);
      break;
    case 'write':
      await handleSupportWritePrompt(ctx);
      break;
    case 'ticket_status':
      await handleTicketStatus(ctx);
      break;
    default:
      await handleUserMainMenu(ctx);
  }
}

export async function handleCourses(ctx: BotContext): Promise<void> {
  const courses = await fetchPublishedCourses();
  if (courses.length === 0) {
    await botReply(ctx, 'Пока нет опубликованных курсов.', { replyMarkup: backToMainKeyboard() });
    return;
  }
  const { siteUrl } = await getBotSiteSettings();
  const lines = courses.map((c) => {
    const price = c.price ? `${c.price.toLocaleString('ru-RU')} ₽` : 'Бесплатно';
    return `📚 <b>${escapeHtml(c.title)}</b>\n   ${price}${c.description ? `\n   ${escapeHtml(c.description.slice(0, 100))}` : ''}`;
  });
  const footer = siteUrl ? `\n\n<a href="${siteUrl}/course/probuzhdenie">Перейти на сайт</a>` : '';
  await botReply(ctx, `<b>Каталог курсов</b>\n\n${lines.join('\n\n')}${footer}`, {
    replyMarkup: backToMainKeyboard(),
  });
}

export async function handleNotifications(ctx: BotContext): Promise<void> {
  if (!ctx.telegramUserId) {
    await botReply(ctx, 'Сначала привяжите аккаунт: /link email@example.com', { replyMarkup: backToMainKeyboard() });
    return;
  }
  const user = await findUserByTelegramId(ctx.telegramUserId);
  if (!user) {
    await botReply(ctx, 'Аккаунт не найден. Привяжите: /link email@example.com', { replyMarkup: backToMainKeyboard() });
    return;
  }
  const rows = await fetchUserNotifications(user.id);
  if (rows.length === 0) {
    await botReply(ctx, 'У вас пока нет уведомлений.', { replyMarkup: backToMainKeyboard() });
    return;
  }
  const lines = rows.map((r) => {
    const read = r.isRead ? '✅' : '🔔';
    const date = r.createdAt.toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' });
    const subject = r.type === 'notification' ? r.content.slice(0, 60) : r.type;
    return `${read} <b>${escapeHtml(subject)}</b> (${date})`;
  });
  await botReply(ctx, `<b>Последние уведомления</b>\n\n${lines.join('\n')}`, {
    replyMarkup: backToMainKeyboard(),
  });
}

export async function handleSchedule(ctx: BotContext): Promise<void> {
  if (!ctx.telegramUserId) {
    await botReply(ctx, 'Сначала привяжите аккаунт: /link email@example.com', { replyMarkup: backToMainKeyboard() });
    return;
  }
  const user = await findUserByTelegramId(ctx.telegramUserId);
  if (!user) {
    await botReply(ctx, 'Аккаунт не найден. Привяжите: /link email@example.com', { replyMarkup: backToMainKeyboard() });
    return;
  }
  const rows = await fetchUserInstallmentSchedule(user.id);
  if (rows.length === 0) {
    await botReply(ctx, 'У вас нет активных рассрочек.', { replyMarkup: backToMainKeyboard() });
    return;
  }
  const statusEmoji: Record<string, string> = { paid: '✅', scheduled: '🕐', overdue: '⚠️', failed: '❌' };
  const lines = rows.map((r) => {
    const emoji = statusEmoji[r.status] ?? '❓';
    const date = r.scheduledAt.toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' });
    return `${emoji} Платёж ${r.partNumber}: ${r.amountRub.toLocaleString('ru-RU')} ₽ — ${date} (${r.status})`;
  });
  await botReply(ctx, `<b>График платежей</b>\n\n${lines.join('\n')}`, {
    replyMarkup: backToMainKeyboard(),
  });
}

export async function handleTextInSession(ctx: BotContext, text: string): Promise<boolean> {
  const session = await getBotSession(ctx.chatId);
  if (session.state === 'funnel_freeform') {
    const { handleFunnelFreeform } = await import('./funnel');
    await handleFunnelFreeform(ctx, text);
    return true;
  }
  if (session.state === 'support_compose') {
    await handleSupportMessage(ctx, text);
    return true;
  }
  if (session.state === 'admin_user_search' && ctx.isAdmin) {
    const { handleAdminUserSearch } = await import('./admin-handlers');
    await handleAdminUserSearch(ctx, text);
    return true;
  }
  if (session.state === 'admin_ticket_reply' && ctx.isAdmin) {
    const { handleAdminTicketReplyMessage } = await import('./admin-handlers');
    await handleAdminTicketReplyMessage(ctx, text);
    return true;
  }
  if (session.state === 'admin_broadcast' && ctx.isAdmin) {
    const { handleAdminBroadcastMessage } = await import('./admin-handlers');
    await handleAdminBroadcastMessage(ctx, text);
    return true;
  }
  return false;
}
