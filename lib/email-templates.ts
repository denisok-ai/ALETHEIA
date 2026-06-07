/**
 * Шаблоны писем в стиле сайта AVATERRA (уведомления и рассылки).
 * Цвета: primary #2D1B4E, secondary #D4AF37, dark #0A0E27.
 */

const BRAND = {
  primary: '#2D1B4E',
  secondary: '#D4AF37',
  dark: '#0A0E27',
  muted: '#5c5854',
  white: '#ffffff',
  cream: '#f5f2ec',
  border: '#e8e4de',
} as const;

const SCHOOL_NAME = 'AVATERRA';
const SCHOOL_TAGLINE = 'Phygital школа мышечного тестирования';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Готовое приветствие для письма: «Здравствуйте, <strong>ФИО</strong>!» либо «Здравствуйте!»,
 * если имени нет или вместо имени передан email/пустая строка. Это нужно, чтобы вместо
 * локальной части почты («dsosin») в письмах не показывался техлогин.
 */
export function buildEmailGreeting(displayName?: string | null): string {
  const raw = (displayName ?? '').trim();
  if (!raw || /@/.test(raw) || /^[a-z0-9_.+-]+$/i.test(raw)) {
    return 'Здравствуйте!';
  }
  return `Здравствуйте, <strong>${escapeHtml(raw)}</strong>!`;
}

/**
 * Если в шаблоне после подстановки осталось «Здравствуйте, <strong></strong>!» — нормализуем
 * в «Здравствуйте!». Защищает шаблоны уведомлений и рассылок от пустых имён.
 */
function normalizeEmptyGreeting(html: string): string {
  return html
    .replace(/Здравствуйте,\s*<strong>\s*<\/strong>\s*!/gi, 'Здравствуйте!')
    .replace(/Здравствуйте,\s*<strong>\s*[a-z0-9_.+-]+@[^<\s]+<\/strong>\s*!/gi, 'Здравствуйте!')
    .replace(/Здравствуйте,\s*!/gi, 'Здравствуйте!');
}

/** Короткий превью-текст для списка входящих (скрытый preheader в HTML-письме). */
export function emailPreheaderFromHtmlFragment(html: string, maxLen = 140): string {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  return text.length > maxLen ? `${text.slice(0, Math.max(0, maxLen - 1))}…` : text;
}

/**
 * Оборачивает HTML-контент письма в фирменную обёртку AVATERRA.
 * @param innerBody — фрагмент HTML (тело письма)
 * @param options.title — опциональный заголовок для превью/доступности
 * @param options.preheader — необязательная строка превью во входящих (дополняет тему письма)
 */
export function wrapEmailHtml(
  innerBody: string,
  options?: { title?: string; preheader?: string }
): string {
  const title = options?.title ?? SCHOOL_NAME;
  const preRaw = options?.preheader?.trim();
  const preheaderBlock = preRaw
    ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:transparent;opacity:0;">${escapeHtml(preRaw)}</div>`
    : '';
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0; padding:0; background-color:${BRAND.cream}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.5; color: ${BRAND.dark};">
${preheaderBlock}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.cream}; padding: 24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: ${BRAND.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(45, 27, 78, 0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND.primary} 0%, #3d2960 100%); padding: 28px 32px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 2px; color: ${BRAND.white};">
                ${SCHOOL_NAME}
              </h1>
              <p style="margin: 6px 0 0; font-size: 12px; color: ${BRAND.secondary}; letter-spacing: 0.5px;">
                ${SCHOOL_TAGLINE}
              </p>
              <div style="width: 80px; height: 3px; background-color: ${BRAND.secondary}; margin: 20px auto 0;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 36px; color: ${BRAND.dark};">
${innerBody}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 36px; border-top: 1px solid ${BRAND.border}; font-size: 12px; color: ${BRAND.muted}; text-align: center;">
              <p style="margin: 0;">${SCHOOL_NAME} · ${SCHOOL_TAGLINE}</p>
              <p style="margin: 4px 0 0;">Это письмо отправлено автоматически. По вопросам обращайтесь в поддержку портала.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// —— Шаблоны уведомлений (для модуля Уведомления) ——
// Плейсхолдеры: %recfirstname%, %reclastname%, %date%, %systemtitle%, %objectname%, %coursename%

export interface NotificationTemplateDef {
  eventType: string;
  name: string;
  subject: string;
  body: string; // HTML-фрагмент с плейсхолдерами
  /** Если задано, используется при отсутствии правила в БД (например только лента, без email). */
  deliveryType?: 'internal' | 'email' | 'both';
}

export const DEFAULT_NOTIFICATION_TEMPLATES: NotificationTemplateDef[] = [
  {
    eventType: 'enrollment',
    name: 'Запись на курс',
    subject: 'Вы записаны на курс — %objectname%',
    body: `<p>Здравствуйте, <strong>%recfirstname% %reclastname%</strong>!</p>
<p>Вы записаны на курс <strong>%objectname%</strong>. Доступ и материалы появятся в личном кабинете.</p>
<p>Следующий шаг: откройте раздел <strong>«Мои курсы»</strong> и проверьте расписание или доступные уроки.</p>
<p>Если что-то выглядит не так, напишите в поддержку — мы поможем разобраться.</p>
<p>С теплом,<br/>команда ${SCHOOL_NAME}</p>`,
  },
  {
    eventType: 'certificate_issued',
    name: 'Выдан сертификат',
    subject: 'Ваш сертификат готов — %objectname%',
    body: `<p>Здравствуйте, <strong>%recfirstname% %reclastname%</strong>!</p>
<p>Поздравляем: сертификат по курсу <strong>%objectname%</strong> готов.</p>
<p>Вы можете скачать его в личном кабинете в разделе <strong>«Мои сертификаты»</strong>.</p>
<p>Проверьте ФИО в документе. Если заметите ошибку, напишите в поддержку — подскажем, как исправить данные.</p>
<p>С уважением,<br/>команда ${SCHOOL_NAME}</p>`,
  },
  {
    eventType: 'enrollment_excluded',
    name: 'Отчисление с курса',
    subject: 'Изменение участия в курсе — %objectname%',
    body: `<p>Здравствуйте, <strong>%recfirstname% %reclastname%</strong>!</p>
<p>Ваше участие в курсе <strong>%objectname%</strong> изменено: запись снята.</p>
<p>Если это ожидаемое действие, ничего делать не нужно. Если вы считаете, что произошла ошибка, пожалуйста, обратитесь в поддержку.</p>
<p>Дата изменения: %date%.</p>
<p>Команда ${SCHOOL_NAME}</p>`,
  },
  {
    eventType: 'access_opened',
    name: 'Доступ открыт',
    subject: 'Доступ к курсу открыт — %objectname%',
    body: `<p>Здравствуйте, <strong>%recfirstname% %reclastname%</strong>!</p>
<p>Мы открыли вам доступ к курсу <strong>%objectname%</strong>.</p>
<p>Следующий шаг: зайдите в личный кабинет и начните обучение с доступного урока или продолжите с того места, где остановились.</p>
<p>Если доступ не отображается, обновите страницу или напишите в поддержку.</p>
<p>Хорошего обучения!<br/>команда ${SCHOOL_NAME}</p>`,
  },
  {
    eventType: 'access_closed',
    name: 'Доступ закрыт',
    subject: 'Доступ к курсу закрыт — %objectname%',
    body: `<p>Здравствуйте, <strong>%recfirstname% %reclastname%</strong>!</p>
<p>Доступ к курсу <strong>%objectname%</strong> закрыт.</p>
<p>Такое может происходить после окончания периода обучения, изменения записи или ручной настройки доступа.</p>
<p>Если вам нужен доступ или вы видите ошибку, обратитесь в поддержку — проверим ситуацию.</p>
<p>Команда ${SCHOOL_NAME}</p>`,
  },
  {
    eventType: 'welcome',
    name: 'Добро пожаловать',
    subject: 'Добро пожаловать в %systemtitle%',
    body: `<p>Здравствуйте, <strong>%recfirstname% %reclastname%</strong>!</p>
<p>Рады видеть вас в личном кабинете ${SCHOOL_NAME}.</p>
<p>Здесь вы сможете проходить курсы, отслеживать прогресс, получать сертификаты и писать в поддержку, если понадобится помощь.</p>
<p>Для начала откройте раздел <strong>«Мои курсы»</strong>. Если курсы ещё не отображаются, проверьте покупку или обратитесь в поддержку.</p>
<p>С теплом,<br/>команда ${SCHOOL_NAME}</p>`,
  },
  {
    eventType: 'gamification_level_up',
    name: 'Новый уровень заряда',
    subject: 'Новый уровень заряда — %level%',
    body: `<p>Здравствуйте, <strong>%recfirstname% %reclastname%</strong>!</p>
<p>Ваш уровень заряда вырос до <strong>%level%</strong>. Сейчас накоплено единиц заряда: <strong>%total_xp%</strong>.</p>
<p>Продолжайте обучение в своём темпе — каждый завершённый шаг приближает вас к результату.</p>`,
    deliveryType: 'internal',
  },
  {
    eventType: 'event_cancelled',
    name: 'Отмена мероприятия',
    subject: 'Мероприятие отменено — %objectname%',
    body: `<p>Здравствуйте, <strong>%recfirstname% %reclastname%</strong>!</p>
<p>Сообщаем, что мероприятие <strong>%objectname%</strong> отменено.</p>
<p>Мы понимаем, что это может повлиять на ваши планы. Если будет новая дата или альтернатива, команда сообщит отдельно.</p>
<p>По организационным вопросам напишите в поддержку или координатору программы.</p>
<p>Команда ${SCHOOL_NAME}</p>`,
  },
  {
    eventType: 'event_completed',
    name: 'Завершение мероприятия',
    subject: 'Мероприятие завершено — %objectname%',
    body: `<p>Здравствуйте, <strong>%recfirstname% %reclastname%</strong>!</p>
<p>Мероприятие <strong>%objectname%</strong> завершено.</p>
<p>Спасибо за участие. Если по программе доступны материалы, результаты или сертификат, вы найдёте их в личном кабинете.</p>
<p>Если остались вопросы по итогам обучения, напишите в поддержку.</p>
<p>Команда ${SCHOOL_NAME}</p>`,
  },
  {
    eventType: 'training_start',
    name: 'Старт обучения по расписанию',
    subject: 'Обучение началось — %objectname%',
    body: `<p>Здравствуйте, <strong>%recfirstname% %reclastname%</strong>!</p>
<p>Наступила дата начала обучения по программе <strong>%objectname%</strong>.</p>
<p>Откройте раздел <strong>«Мои курсы»</strong>, чтобы начать занятия или посмотреть ближайшие шаги.</p>
<p>Желаем спокойного и продуктивного старта!<br/>команда ${SCHOOL_NAME}</p>`,
  },
  {
    eventType: 'gamification_badge_unlocked',
    name: 'Новый бейдж',
    subject: 'Новый бейдж — %badgename%',
    body: `<p>Здравствуйте, <strong>%recfirstname% %reclastname%</strong>!</p>
<p>Вы получили бейдж <strong>%badgeemoji% %badgename%</strong>.</p>
<p>Это отметка вашего движения в обучении. Продолжайте в своём темпе — прогресс уже виден.</p>`,
    deliveryType: 'internal',
  },
  {
    eventType: 'system',
    name: 'Системное уведомление',
    subject: 'Важное уведомление — %systemtitle%',
    body: `<p>Здравствуйте, <strong>%recfirstname% %reclastname%</strong>!</p>
<p>На портале <strong>%systemtitle%</strong> есть важное уведомление для вас.</p>
<p>%objectname%</p>
<p>Если сообщение связано с доступом, оплатой или обучением, проверьте личный кабинет. При вопросах напишите в поддержку.</p>
<p>Команда ${SCHOOL_NAME}</p>`,
  },
  {
    eventType: 'mailing',
    name: 'Рассылка',
    subject: 'Новое сообщение от %systemtitle%',
    body: `<p>Здравствуйте, <strong>%recfirstname% %reclastname%</strong>!</p>
<p>Для вас опубликовано сообщение от команды <strong>%systemtitle%</strong>.</p>
<p>%objectname%</p>
<p>Подробности смотрите в письме или личном кабинете.</p>
<p>Команда ${SCHOOL_NAME}</p>`,
  },
  {
    eventType: 'support_ticket_created',
    name: 'Обращение в поддержку создано',
    subject: 'Обращение в поддержку принято — %systemtitle%',
    body: `<p>Здравствуйте, <strong>%recfirstname% %reclastname%</strong>!</p>
<p>Мы получили ваше обращение в поддержку: <strong>%objectname%</strong>.</p>
<p>Команда посмотрит сообщение и ответит в личном кабинете. Если появятся дополнительные детали, добавьте их в тикет.</p>
<p>Спасибо, что написали нам.</p>`,
  },
  {
    eventType: 'support_ticket_reply',
    name: 'Ответ по обращению в поддержку',
    subject: 'Ответ по обращению — %systemtitle%',
    body: `<p>Здравствуйте, <strong>%recfirstname% %reclastname%</strong>!</p>
<p>По вашему обращению <strong>%objectname%</strong> появился ответ.</p>
<p>Откройте раздел <strong>«Поддержка»</strong> в личном кабинете, чтобы прочитать сообщение и при необходимости ответить.</p>
<p>Команда ${SCHOOL_NAME}</p>`,
  },
  {
    eventType: 'email_verification',
    name: 'Подтверждение email',
    subject: 'Подтвердите email — %systemtitle%',
    body: `<p>Здравствуйте, <strong>%recfirstname% %reclastname%</strong>!</p>
<p>Чтобы защитить ваш личный кабинет и получать важные уведомления, подтвердите email.</p>
<p>Ссылка действует ограниченное время. Если вы не создавали аккаунт на портале, просто проигнорируйте это письмо.</p>
<p>Команда ${SCHOOL_NAME}</p>`,
  },
  {
    eventType: 'password_reset',
    name: 'Сброс пароля',
    subject: 'Сброс пароля — %systemtitle%',
    body: `<p>Здравствуйте, <strong>%recfirstname% %reclastname%</strong>!</p>
<p>Для вашей учётной записи подготовлено действие по восстановлению доступа.</p>
<p>Следуйте инструкции из письма или обратитесь в поддержку, если вы не запрашивали изменение пароля.</p>
<p>Команда ${SCHOOL_NAME}</p>`,
  },
];

/**
 * Подставляет переменные в шаблон уведомления (плейсхолдеры %key%).
 */
export function renderNotificationTemplate(
  template: { subject: string; body: string },
  vars: Record<string, string>
): { subject: string; body: string } {
  let subject = template.subject;
  let body = template.body;
  for (const [k, v] of Object.entries(vars)) {
    const re = new RegExp(`%${k}%`, 'gi');
    subject = subject.replace(re, v);
    body = body.replace(re, v);
  }
  return { subject, body: normalizeEmptyGreeting(body) };
}

// —— Транзакционные письма (auth/support) ——

export interface TransactionalEmailTemplate {
  subject: string;
  body: string;
  html: string;
}

function buildTransactionalEmail(subject: string, body: string): TransactionalEmailTemplate {
  return {
    subject,
    body,
    html: wrapEmailHtml(body, { title: subject }),
  };
}

export function buildEmailVerificationEmail(params: {
  displayName: string;
  verifyUrl: string;
  systemTitle: string;
  isResend?: boolean;
}): TransactionalEmailTemplate {
  const systemTitle = params.systemTitle.trim() || SCHOOL_NAME;
  const subject = `Подтвердите email — ${systemTitle}`;
  const intro = params.isResend
    ? 'Вы запросили повторную ссылку для подтверждения email.'
    : 'Остался один шаг, чтобы завершить регистрацию.';
  const body = `<p>${buildEmailGreeting(params.displayName)}</p>
<p>${intro}</p>
<p>Подтвердите email, чтобы защитить личный кабинет и получать важные уведомления по обучению.</p>
<p><a href="${escapeHtml(params.verifyUrl)}" style="display:inline-block;background:${BRAND.primary};color:${BRAND.white};padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Подтвердить email</a></p>
<p style="font-size:14px;color:${BRAND.muted};">Ссылка действует 48 часов. Если вы не регистрировались на портале, просто проигнорируйте это письмо.</p>
<p>С уважением,<br/>команда ${escapeHtml(systemTitle)}</p>`;

  return buildTransactionalEmail(subject, body);
}

export function buildPasswordResetEmail(params: {
  displayName: string;
  setPasswordUrl: string;
  systemTitle: string;
}): TransactionalEmailTemplate {
  const systemTitle = params.systemTitle.trim() || SCHOOL_NAME;
  const subject = `Сброс пароля — ${systemTitle}`;
  const body = `<p>${buildEmailGreeting(params.displayName)}</p>
<p>Вы запросили восстановление доступа к личному кабинету.</p>
<p>Чтобы установить новый пароль, перейдите по ссылке ниже. Ссылка действует 48 часов.</p>
<p><a href="${escapeHtml(params.setPasswordUrl)}" style="display:inline-block;background:${BRAND.primary};color:${BRAND.white};padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Установить новый пароль</a></p>
<p style="font-size:14px;color:${BRAND.muted};">Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо. Ваш текущий пароль останется без изменений.</p>
<p>С уважением,<br/>команда ${escapeHtml(systemTitle)}</p>`;

  return buildTransactionalEmail(subject, body);
}

export function buildSetPasswordEmail(params: {
  displayName: string;
  setPasswordUrl: string;
  systemTitle: string;
}): TransactionalEmailTemplate {
  const systemTitle = params.systemTitle.trim() || SCHOOL_NAME;
  const subject = `Доступ в личный кабинет — ${systemTitle}`;
  const body = `<p>${buildEmailGreeting(params.displayName)}</p>
<p>Для вас создан аккаунт в личном кабинете <strong>${escapeHtml(systemTitle)}</strong>.</p>
<p>Чтобы войти, установите пароль по ссылке ниже. Ссылка действует 48 часов.</p>
<p><a href="${escapeHtml(params.setPasswordUrl)}" style="display:inline-block;background:${BRAND.primary};color:${BRAND.white};padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Установить пароль</a></p>
<p>После входа вы сможете открыть курсы, профиль и поддержку.</p>
<p>Если вы не ожидали это письмо, просто проигнорируйте его или напишите в поддержку.</p>
<p>С уважением,<br/>команда ${escapeHtml(systemTitle)}</p>`;

  return buildTransactionalEmail(subject, body);
}

export function buildContactNotificationEmail(params: {
  name: string;
  phone: string;
  email?: string | null;
  message?: string | null;
}): TransactionalEmailTemplate {
  const subject = `AVATERRA: новая заявка от ${params.name.slice(0, 50)}`;
  const emailLine = params.email
    ? `<p><strong>Email:</strong> ${escapeHtml(params.email)}</p>`
    : '';
  const messageLine = params.message
    ? `<p><strong>Сообщение:</strong><br/>${escapeHtml(params.message).replace(/\n/g, '<br/>')}</p>`
    : '';
  const body = `<p>Новая заявка с сайта AVATERRA.</p>
<p><strong>Имя:</strong> ${escapeHtml(params.name)}</p>
<p><strong>Телефон:</strong> ${escapeHtml(params.phone)}</p>
${emailLine}
${messageLine}
<p>Следующий шаг: свяжитесь с человеком и зафиксируйте результат в CRM.</p>`;

  return buildTransactionalEmail(subject, body);
}

export function buildContactConfirmationEmail(params: {
  name: string;
  systemTitle: string;
}): TransactionalEmailTemplate {
  const systemTitle = params.systemTitle.trim() || SCHOOL_NAME;
  const subject = `Заявка принята — ${systemTitle}`;
  const body = `<p>${buildEmailGreeting(params.name)}</p>
<p>Мы получили вашу заявку и скоро свяжемся с вами.</p>
<p>Если хотите добавить детали, ответьте на это письмо или напишите через форму на сайте.</p>
<p>Спасибо за интерес к программам ${escapeHtml(systemTitle)}.<br/>команда ${escapeHtml(systemTitle)}</p>`;

  return buildTransactionalEmail(subject, body);
}

export function buildSettingsTestEmail(params: {
  systemTitle: string;
}): TransactionalEmailTemplate {
  const systemTitle = params.systemTitle.trim() || SCHOOL_NAME;
  const subject = `Тестовое письмо — ${systemTitle}`;
  const body = `<p>Это тестовое письмо отправлено из раздела настроек <strong>${escapeHtml(systemTitle)}</strong>.</p>
<p>Если вы получили его, исходящая почта настроена корректно.</p>
<p>Можно продолжать пользоваться транзакционными письмами, уведомлениями и рассылками.</p>`;

  return buildTransactionalEmail(subject, body);
}

export function buildTicketCreatedEmail(params: {
  displayName: string;
  subject: string;
  ticketId: string;
  systemTitle: string;
}): TransactionalEmailTemplate {
  const systemTitle = params.systemTitle.trim() || SCHOOL_NAME;
  const subject = `Обращение в поддержку принято — ${systemTitle}`;
  const body = `<p>${buildEmailGreeting(params.displayName)}</p>
<p>Мы получили ваше обращение в поддержку и взяли его в работу.</p>
<p><strong>Тема:</strong> ${escapeHtml(params.subject)}</p>
<p><strong>Номер обращения:</strong> #${escapeHtml(params.ticketId)}</p>
<p>Ответ появится в личном кабинете. Если появятся дополнительные детали, добавьте их в это же обращение.</p>
<p>Спасибо, что написали нам.<br/>команда ${escapeHtml(systemTitle)}</p>`;

  return buildTransactionalEmail(subject, body);
}

export function buildTicketManagerNotificationEmail(params: {
  displayName: string;
  email: string;
  subject: string;
  message: string;
  ticketId: string;
  ticketUrl?: string;
  orderNumber?: string | null;
}): TransactionalEmailTemplate {
  const subject = `Поддержка: новое обращение — ${params.subject.slice(0, 50)}`;
  const orderLine = params.orderNumber
    ? `<p><strong>Привязан заказ (нет доступа):</strong> ${escapeHtml(params.orderNumber)}</p>`
    : '';
  const messageLine = params.message
    ? `<p><strong>Сообщение:</strong><br/>${escapeHtml(params.message).replace(/\n/g, '<br/>')}</p>`
    : '';
  const ticketLink = params.ticketUrl
    ? `<p><a href="${escapeHtml(params.ticketUrl)}" style="color:${BRAND.primary};text-decoration:underline;">Открыть очередь обращений</a></p>`
    : '';
  const body = `<p>Новое обращение в поддержку.</p>
<p><strong>От:</strong> ${escapeHtml(params.displayName)} (${escapeHtml(params.email)})</p>
<p><strong>Тема:</strong> ${escapeHtml(params.subject)}</p>
${orderLine}
${messageLine}
<p><strong>Тикет:</strong> #${escapeHtml(params.ticketId)}</p>
${ticketLink}`;

  return buildTransactionalEmail(subject, body);
}

export function buildTicketAutoReplyEmail(params: {
  displayName: string;
  subject: string;
  autoReply: string;
  ticketUrl?: string;
  systemTitle: string;
}): TransactionalEmailTemplate {
  const systemTitle = params.systemTitle.trim() || SCHOOL_NAME;
  const subject = `Ответ по обращению — ${systemTitle}`;
  const ticketLink = params.ticketUrl
    ? `<p><a href="${escapeHtml(params.ticketUrl)}" style="color:${BRAND.primary};text-decoration:underline;">Открыть обращение</a></p>`
    : '';
  const body = `<p>${buildEmailGreeting(params.displayName)}</p>
<p>По вашему обращению «${escapeHtml(params.subject)}» подготовлен ответ.</p>
<p><strong>Ответ:</strong></p>
<p>${escapeHtml(params.autoReply).replace(/\n/g, '<br/>')}</p>
${ticketLink}
<p>Если вопрос остался, ответьте в этом же обращении — команда поддержки увидит сообщение.</p>
<p>Команда ${escapeHtml(systemTitle)}</p>`;

  return buildTransactionalEmail(subject, body);
}

// —— Шаблон рассылки (для модуля Рассылки) ——
// Подстановки при отправке: %FirstName%, %LastName%, %date%, %unsubscribe%, %systemtitle%, %portalUrl%, %loginUrl%

const MAILING_UNSUB_FOOTER = `<p style="font-size:12px;color:${BRAND.muted};margin-top:24px;border-top:1px solid ${BRAND.border};padding-top:14px;">
Получаете это письмо как пользователь портала <strong>%systemtitle%</strong>.<br/>
<a href="%loginUrl%" style="color:${BRAND.primary};text-decoration:underline;">Войти в личный кабинет</a>
&nbsp;·&nbsp;
<a href="%unsubscribe%" style="color:${BRAND.primary};text-decoration:underline;">Отписаться от маркетинговых рассылок</a>
</p>`;

export const DEFAULT_MAILING_BODY = `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>Команда <strong>%systemtitle%</strong> делится с вами важным сообщением по обучению, расписанию или событиям школы.</p>
<hr style="border: none; border-top: 1px solid ${BRAND.border}; margin: 20px 0;" />
<p><em>Замените этот блок на основной текст письма. Пишите коротко: что изменилось, почему это важно и что человеку сделать дальше.</em></p>
<ul>
<li><strong>Главное:</strong> сформулируйте суть в первом абзаце.</li>
<li><strong>Следующий шаг:</strong> открыть «Мои курсы», записаться, ответить на письмо или написать в поддержку.</li>
</ul>
<p>Если у вас возникнут вопросы, команда поддержки поможет в личном кабинете.</p>
<p>С уважением,<br/>команда %systemtitle%</p>
<p style="font-size:13px;color:${BRAND.muted};">Дата отправки: %date%.</p>
${MAILING_UNSUB_FOOTER}`;

export const DEFAULT_MAILING_SUBJECT = 'Новости и анонсы %systemtitle% — %date%';

/** Готовые тексты для массовых рассылок (модуль «Рассылки»). Доступные подстановки: %FirstName%, %LastName%, %date%, %unsubscribe%, %systemtitle%, %portalUrl%, %loginUrl%. */
export interface MailingPreset {
  id: string;
  /** Подпись в списке выбора */
  label: string;
  internalTitle: string;
  emailSubject: string;
  emailBody: string;
}

export const DEFAULT_MAILING_PRESETS: MailingPreset[] = [
  {
    id: 'welcome_student',
    label: 'Приветствие нового ученика',
    internalTitle: '[Типовое] Приветствие нового ученика',
    emailSubject: 'Добро пожаловать в %systemtitle%',
    emailBody: `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>Вы зарегистрировались на образовательном портале <strong>%systemtitle%</strong>. Мы рады видеть вас в сообществе школы мышечного тестирования AVATERRA.</p>
<p>В личном кабинете вам доступны: раздел <strong>«Мои курсы»</strong> — материалы и прогресс; <strong>«Поддержка»</strong> — вопросы к команде; <strong>«Профиль»</strong> — данные учётной записи.</p>
<p>Если понадобится помощь с входом или доступом — ответьте на это письмо или напишите через форму поддержки на портале.</p>
<p>С уважением,<br/>Команда %systemtitle%</p>
<p style="font-size:13px;color:${BRAND.muted};">Дата: %date%.</p>
${MAILING_UNSUB_FOOTER}`,
  },
  {
    id: 'training_start',
    label: 'Старт обучения',
    internalTitle: '[Типовое] Старт обучения по программе',
    emailSubject: 'Стартует обучение — %systemtitle%',
    emailBody: `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>Наступил старт по вашей программе на портале <strong>%systemtitle%</strong>. Откройте раздел <strong>«Мои курсы»</strong>, чтобы приступить к урокам или продолжить с того места, где остановились.</p>
<p>Рекомендуем заложить регулярное время для прохождения модулей и выполнения практических заданий — так материал лучше усваивается.</p>
<p>Технические вопросы и доступ можно обсудить со службой поддержки через кабинет.</p>
<p>Успехов в обучении!<br/>Команда %systemtitle%</p>
<p style="font-size:13px;color:${BRAND.muted};">%date%</p>
${MAILING_UNSUB_FOOTER}`,
  },
  {
    id: 'reminder_progress',
    label: 'Напоминание о прохождении курса',
    internalTitle: '[Типовое] Напоминание продолжить курс',
    emailSubject: 'Напоминание: продолжите обучение — %systemtitle%',
    emailBody: `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>Мы заметили, что вы некоторое время не заходили к материалам программы на портале <strong>%systemtitle%</strong>. Это удобный момент вернуться: уроки доступны в любое время, прогресс сохраняется.</p>
<p>Откройте <strong>«Мои курсы»</strong>, выберите программу и продолжите с актуального модуля. Даже 20–30 минут в неделю заметно приближают вас к цели курса.</p>
<p>Если что-то мешает (техника, доступ, содержание) — напишите в поддержку, мы поможем.</p>
<p>С наилучшими пожеланиями,<br/>%systemtitle%</p>
<p style="font-size:13px;color:${BRAND.muted};">%date%</p>
${MAILING_UNSUB_FOOTER}`,
  },
  {
    id: 'reminder_verification',
    label: 'Напоминание о задании / верификации',
    internalTitle: '[Типовое] Ожидается задание или проверка',
    emailSubject: 'Требуется ваше действие по курсу — %systemtitle%',
    emailBody: `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>По вашей программе на портале <strong>%systemtitle%</strong> ожидается действие: выполнение задания и/или отправка материалов на проверку (верификацию).</p>
<p>Пожалуйста, зайдите в <strong>«Мои курсы»</strong> — там отображаются подсказки по текущему этапу и сроки, если они заданы методистом.</p>
<p>Без выполнения обязательных шагов может быть ограничен доступ к следующим модулям или выдаче сертификата — уточните детали в интерфейсе курса.</p>
<p>Если нужны разъяснения, обращайтесь в поддержку.</p>
<p>%systemtitle%</p>
<p style="font-size:13px;color:${BRAND.muted};">%date%</p>
${MAILING_UNSUB_FOOTER}`,
  },
  {
    id: 'certificate_ready',
    label: 'Выдача сертификата',
    internalTitle: '[Типовое] Сертификат доступен в кабинете',
    emailSubject: 'Ваш сертификат готов — %systemtitle%',
    emailBody: `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>Поздравляем: вам доступен сертификат о прохождении программы на портале <strong>%systemtitle%</strong>.</p>
<p>Скачать документ в формате PDF можно в разделе <strong>«Мои сертификаты»</strong>. Проверьте корректность ФИО; при ошибке сообщите в поддержку — подскажем, как исправить.</p>
<p>Благодарим за участие и желаем применять полученные навыки на практике!</p>
<p>С уважением,<br/>Команда %systemtitle%</p>
<p style="font-size:13px;color:${BRAND.muted};">%date%</p>
${MAILING_UNSUB_FOOTER}`,
  },
  {
    id: 'service_notice',
    label: 'Сервисное уведомление',
    internalTitle: '[Типовое] Сервисное уведомление портала',
    emailSubject: 'Важное уведомление — %systemtitle%',
    emailBody: `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>Информируем пользователей портала <strong>%systemtitle%</strong> об изменениях или событиях, которые могут касаться вашего доступа к материалам, расписания или технической работы сайта.</p>
<p><strong>Суть сообщения:</strong> уточните здесь конкретику (техработы, обновление оферты, смена контактов поддержки и т.д.). При необходимости добавьте ссылку на страницу портала или новость.</p>
<p>По вопросам ответьте на это письмо или воспользуйтесь разделом поддержки в кабинете.</p>
<p>%systemtitle%</p>
<p style="font-size:13px;color:${BRAND.muted};">%date%</p>
${MAILING_UNSUB_FOOTER}`,
  },
  {
    id: 'news_digest',
    label: 'Новостная рассылка',
    internalTitle: '[Типовое] Новости и события школы',
    emailSubject: 'Новости %systemtitle% — %date%',
    emailBody: `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>Краткий дайджест новостей образовательной платформы <strong>%systemtitle%</strong>.</p>
<hr style="border:none;border-top:1px solid ${BRAND.border};margin:16px 0;" />
<p><strong>Заголовок новости или блока 1</strong><br/>
<em>Добавьте текст: анонс модуля, статья блога, дата вебинара и т.д.</em></p>
<p><strong>Заголовок блока 2</strong><br/>
<em>При необходимости — второй блок.</em></p>
<hr style="border:none;border-top:1px solid ${BRAND.border};margin:16px 0;" />
<p>Актуальные материалы и расписание всегда в вашем личном кабинете.</p>
<p>С уважением,<br/>Редакция %systemtitle%</p>
<p style="font-size:13px;color:${BRAND.muted};">%date%</p>
${MAILING_UNSUB_FOOTER}`,
  },
  {
    id: 'event_invitation',
    label: 'Приглашение на консультацию / мероприятие',
    internalTitle: '[Типовое] Приглашение на мероприятие',
    emailSubject: 'Приглашение — %systemtitle%',
    emailBody: `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>Приглашаем вас на мероприятие школы <strong>%systemtitle%</strong> (консультация, вебинар, очная встреча — уточните формат и тему в тексте ниже).</p>
<p><strong>Что будет:</strong> <em>опишите программу и спикера.</em></p>
<p><strong>Когда и как:</strong> <em>дата, время, ссылка или адрес.</em></p>
<p>Регистрация или подтверждение участия — по инструкции в личном кабинете или ответом на это письмо.</p>
<p>Будем рады видеть вас!<br/>%systemtitle%</p>
<p style="font-size:13px;color:${BRAND.muted};">%date%</p>
${MAILING_UNSUB_FOOTER}`,
  },
  {
    id: 'support_care',
    label: 'Мы на связи (поддержка)',
    internalTitle: '[Типовое] Напоминание: поддержка рядом',
    emailSubject: 'Мы рядом, если нужна помощь — %systemtitle%',
    emailBody: `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>Напоминаем: команда поддержки портала <strong>%systemtitle%</strong> помогает с доступом к курсам, оплатой, техническими сбоями и организационными вопросами.</p>
<p>Написать можно из раздела <strong>«Поддержка»</strong> в личном кабинете — тикеты обрабатываются в порядке очереди; срочные случаи отметьте в теме обращения.</p>
<p>Хорошего дня и продуктивного обучения!</p>
<p>Служба поддержки %systemtitle%</p>
<p style="font-size:13px;color:${BRAND.muted};">%date%</p>
${MAILING_UNSUB_FOOTER}`,
  },
  {
    id: 'new_program_announce',
    label: 'Анонс новой программы / курса',
    internalTitle: '[Типовое] Анонс новой программы',
    emailSubject: 'Новая программа на %systemtitle% — %date%',
    emailBody: `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>На портале <strong>%systemtitle%</strong> доступна или открыта запись на новую программу обучения. Кратко о ней:</p>
<ul>
<li><strong>Формат:</strong> <em>онлайн / гибрид / с ограничением по времени.</em></li>
<li><strong>Для кого:</strong> <em>целевая аудитория.</em></li>
<li><strong>Результат:</strong> <em>что получит слушатель.</em></li>
</ul>
<p>Подробности, демо и зачисление — в каталоге курсов в личном кабинете. При вопросах по оплате и доступу напишите в поддержку.</p>
<p>С уважением,<br/>%systemtitle%</p>
<p style="font-size:13px;color:${BRAND.muted};">%date%</p>
${MAILING_UNSUB_FOOTER}`,
  },
  {
    id: 'feedback_request',
    label: 'Опрос и обратная связь',
    internalTitle: '[Типовое] Мы ценим ваше мнение',
    emailSubject: 'Поделитесь впечатлением о %systemtitle%',
    emailBody: `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>Команда <strong>%systemtitle%</strong> развивает программы и сервис для вас. Нам важно узнать, что получилось удачно, а что стоит улучшить.</p>
<p><em>Здесь можно вставить ссылку на короткий опрос (Google Forms, Яндекс.Формы и т.д.) или попросить ответить парой предложений на это письмо.</em></p>
<p>Обратная связь анонимна, если вы не укажете контакты в ответе. Искренне благодарим за ваше время!</p>
<p>%systemtitle%</p>
<p style="font-size:13px;color:${BRAND.muted};">%date%</p>
${MAILING_UNSUB_FOOTER}`,
  },
  {
    id: 'probuzhdenie_invite',
    label: 'Анонс курса «Пробуждение»',
    internalTitle: '[Пробуждение] Анонс старта курса',
    emailSubject: '«Пробуждение»: 21 день практик осознанности — старт скоро',
    emailBody: `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>Татьяна Стрельцова (<strong>%systemtitle%</strong>) запускает авторский курс <strong>«Пробуждение»</strong> — 21 день глубоких практик настоящего момента, чтобы:</p>
<ul>
<li>выйти из автопилота и хронического стресса;</li>
<li>освободить заблокированные эмоции и системы убеждений;</li>
<li>вернуть состояние «здесь и сейчас» и контакт со своей Силой Духа.</li>
</ul>
<p><strong>Что внутри:</strong> диагностика и осознанность (неделя 1), очищение и новое рождение (неделя 2), переход на новый уровень «Я новая» (неделя 3).</p>
<p><strong>Форматы:</strong> групповой (22 000 ₽) или индивидуальный (44 000 ₽). Доступ к материалам — без ограничения по времени.</p>
<p><a href="%portalUrl%/course/probuzhdenie" style="display:inline-block;background:${BRAND.primary};color:${BRAND.white};padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Узнать подробнее и записаться</a></p>
<p>Если есть вопросы — ответьте на это письмо или напишите в поддержку.</p>
<p>С теплом,<br/>%systemtitle%</p>
<p style="font-size:13px;color:${BRAND.muted};">%date%</p>
${MAILING_UNSUB_FOOTER}`,
  },
  {
    id: 'probuzhdenie_welcome',
    label: 'Приветствие после оплаты «Пробуждения»',
    internalTitle: '[Пробуждение] Welcome для нового участника',
    emailSubject: 'Добро пожаловать в «Пробуждение» — следующий шаг',
    emailBody: `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>Поздравляем — вы записаны на курс <strong>«Пробуждение»</strong> от Татьяны Стрельцовой и команды <strong>%systemtitle%</strong>.</p>
<p><strong>Как устроены 21 день:</strong></p>
<ul>
<li><strong>Неделя 1 — Диагностика.</strong> Видеть, осознавать, принимать. Базовые практики осознанности и состояние «Я ЕСТЬ».</li>
<li><strong>Неделя 2 — Очищение и Новое Рождение.</strong> Освобождение заблокированных эмоций, выход из систем убеждений, контакт с Источником.</li>
<li><strong>Неделя 3 — Я новая.</strong> Освобождение от дуальности, новая реальность, ресурс на переход.</li>
</ul>
<p><strong>Следующий шаг:</strong> откройте раздел <a href="%portalUrl%/portal/student/courses">«Мои курсы»</a> в личном кабинете — там появится расписание и материалы. Если что-то не отображается, напишите в поддержку.</p>
<p>Желаем мягкого и глубокого пробуждения!<br/>команда %systemtitle%</p>
<p style="font-size:13px;color:${BRAND.muted};">%date%</p>
${MAILING_UNSUB_FOOTER}`,
  },
  {
    id: 'mt_invite',
    label: 'Анонс курса «Навыки мышечного тестирования»',
    internalTitle: '[МТ] Анонс курса «Навыки мышечного тестирования»',
    emailSubject: '«Навыки мышечного тестирования»: получите ответы тела за 5–15 минут',
    emailBody: `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>Авторский курс Татьяны Стрельцовой <strong>«Навыки мышечного тестирования»</strong> — это 6 модулей и 2 месяца практики, чтобы научиться «разговаривать» с телом без слов и находить корневые причины состояний.</p>
<ul>
<li>6 модулей: от калибровки до глубокого регресса и нового образа;</li>
<li>6 живых сессий с куратором + 2 встречи с автором;</li>
<li>Доступ к материалам — 3 месяца, обучение в своём темпе;</li>
<li>Результат уже на первом уроке у 95% участников.</li>
</ul>
<p>Курс подойдёт и специалистам (психологам, коучам, массажистам), и тем, кто только знакомится с методом.</p>
<p><a href="%portalUrl%/course/navyki-myshechnogo-testirovaniya" style="display:inline-block;background:${BRAND.primary};color:${BRAND.white};padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Программа курса и тарифы</a></p>
<p>С теплом,<br/>%systemtitle%</p>
<p style="font-size:13px;color:${BRAND.muted};">%date%</p>
${MAILING_UNSUB_FOOTER}`,
  },
];

/**
 * Подставляет переменные в шаблон рассылки (%FirstName%, %LastName%, %date%, %unsubscribe%, %systemtitle%, %portalUrl%, %loginUrl%).
 */
export function renderMailingTemplate(
  subject: string,
  body: string,
  vars: Record<string, string>
): { subject: string; body: string } {
  let subj = subject;
  let b = body;
  for (const [k, v] of Object.entries(vars)) {
    const re = new RegExp(`%${k}%`, 'g');
    subj = subj.replace(re, v);
    b = b.replace(re, v);
  }
  return { subject: subj, body: normalizeEmptyGreeting(b) };
}
