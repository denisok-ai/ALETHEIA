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

/**
 * Оборачивает HTML-контент письма в фирменную обёртку AVATERRA.
 * @param innerBody — фрагмент HTML (тело письма)
 * @param options.title — опциональный заголовок для превью/доступности
 */
export function wrapEmailHtml(
  innerBody: string,
  options?: { title?: string }
): string {
  const title = options?.title ?? SCHOOL_NAME;
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0; padding:0; background-color:${BRAND.cream}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.5; color: ${BRAND.dark};">
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// —— Шаблоны уведомлений (для модуля Уведомления) ——
// Плейсхолдеры: %recfirstname%, %reclastname%, %date%, %systemtitle%, %objectname%, %coursename%

export interface NotificationTemplateDef {
  eventType: string;
  name: string;
  subject: string;
  body: string; // HTML-фрагмент с плейсхолдерами
}

export const DEFAULT_NOTIFICATION_TEMPLATES: NotificationTemplateDef[] = [
  {
    eventType: 'enrollment',
    name: 'Запись на курс',
    subject: 'Вы записаны на курс — %systemtitle%',
    body: `<p>Здравствуйте, <strong>%recfirstname% %reclastname%</strong>!</p>
<p>Вы успешно записаны на мероприятие <strong>%objectname%</strong>.</p>
<p>Дата уведомления: %date%.</p>
<p>Подробности доступны в личном кабинете на портале ${SCHOOL_NAME}.</p>`,
  },
  {
    eventType: 'certificate_issued',
    name: 'Выдан сертификат',
    subject: 'Вам выдан сертификат — %systemtitle%',
    body: `<p>Здравствуйте, <strong>%recfirstname% %reclastname%</strong>!</p>
<p>Поздравляем! Вам выдан сертификат о прохождении курса <strong>%objectname%</strong>.</p>
<p>Дата выдачи: %date%.</p>
<p>Скачать сертификат в формате PDF можно в разделе «Мои сертификаты» личного кабинета.</p>
<p>С уважением,<br/>Команда ${SCHOOL_NAME}</p>`,
  },
  {
    eventType: 'enrollment_excluded',
    name: 'Отчисление с курса',
    subject: 'Изменение записи на курс — %systemtitle%',
    body: `<p>Здравствуйте, <strong>%recfirstname% %reclastname%</strong>!</p>
<p>Информируем об отчислении с мероприятия <strong>%objectname%</strong>.</p>
<p>Дата: %date%.</p>
<p>По вопросам обращайтесь в поддержку портала ${SCHOOL_NAME}.</p>`,
  },
  {
    eventType: 'access_opened',
    name: 'Доступ открыт',
    subject: 'Доступ к курсу открыт — %systemtitle%',
    body: `<p>Здравствуйте, <strong>%recfirstname% %reclastname%</strong>!</p>
<p>Вам открыт доступ к мероприятию <strong>%objectname%</strong>.</p>
<p>Дата: %date%. Заходите в личный кабинет и приступайте к обучению.</p>
<p>Команда ${SCHOOL_NAME}</p>`,
  },
  {
    eventType: 'access_closed',
    name: 'Доступ закрыт',
    subject: 'Доступ к курсу закрыт — %systemtitle%',
    body: `<p>Здравствуйте, <strong>%recfirstname% %reclastname%</strong>!</p>
<p>Доступ к мероприятию <strong>%objectname%</strong> временно закрыт.</p>
<p>Дата: %date%. По вопросам обращайтесь в поддержку.</p>
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
  return { subject, body };
}

// —— Шаблон рассылки (для модуля Рассылки) ——
// Плейсхолдеры: %FirstName%, %LastName%, %date%, %unsubscribe%

export const DEFAULT_MAILING_BODY = `<p>Здравствуйте, <strong>%FirstName% %LastName%</strong>!</p>
<p>Сообщение от школы <strong>${SCHOOL_NAME}</strong> — ${SCHOOL_TAGLINE}.</p>
<hr style="border: none; border-top: 1px solid ${BRAND.border}; margin: 20px 0;" />
<p><em>Текст рассылки вставьте здесь. Можно использовать HTML.</em></p>
<p>Дата: %date%.</p>
<hr style="border: none; border-top: 1px solid ${BRAND.border}; margin: 20px 0;" />
<p style="font-size: 12px; color: ${BRAND.muted};">
  <a href="%unsubscribe%" style="color: ${BRAND.primary}; text-decoration: underline;">Отписаться от рассылок</a>
</p>`;

export const DEFAULT_MAILING_SUBJECT = 'Новости %systemtitle% — %date%';

/**
 * Подставляет переменные в шаблон рассылки (%FirstName%, %LastName%, %date%, %unsubscribe%).
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
  return { subject: subj, body: b };
}
