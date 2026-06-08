import assert from 'node:assert/strict';
import {
  DEFAULT_NOTIFICATION_TEMPLATES,
  buildContactConfirmationEmail,
  buildContactNotificationEmail,
  buildEmailVerificationEmail,
  buildPasswordResetEmail,
  buildSettingsTestEmail,
  buildSetPasswordEmail,
  buildTicketAutoReplyEmail,
  buildTicketCreatedEmail,
  buildTicketManagerNotificationEmail,
  emailPreheaderFromHtmlFragment,
  wrapEmailHtml,
  renderMailingTemplate,
} from '../lib/email-templates';

function assertIncludes(haystack: string, needle: string) {
  assert.ok(
    haystack.includes(needle),
    `Expected text to include "${needle}", got:\n${haystack.slice(0, 500)}`
  );
}

const verification = buildEmailVerificationEmail({
  displayName: 'Анна <script>',
  verifyUrl: 'https://avaterra.pro/verify-email?token=abc',
  systemTitle: 'AVATERRA',
});
assert.equal(verification.subject, 'Подтвердите email — AVATERRA');
assertIncludes(verification.html, 'Анна &lt;script&gt;');
assertIncludes(verification.html, 'https://avaterra.pro/verify-email?token=abc');
assertIncludes(verification.html, '<!DOCTYPE html>');

const ticketCreated = buildTicketCreatedEmail({
  displayName: 'Анна',
  subject: 'Не приходит доступ',
  ticketId: 'ticket-1',
  systemTitle: 'AVATERRA',
});
assert.equal(ticketCreated.subject, 'Обращение в поддержку принято — AVATERRA');
assertIncludes(ticketCreated.body, 'ticket-1');

const managerNotification = buildTicketManagerNotificationEmail({
  displayName: 'Анна',
  email: 'anna@example.com',
  subject: 'Не приходит доступ',
  message: 'Здравствуйте <b>команда</b>',
  ticketId: 'ticket-2',
  ticketUrl: 'https://avaterra.pro/portal/manager/tickets',
  orderNumber: 'ORD-1',
});
assertIncludes(managerNotification.html, 'Здравствуйте &lt;b&gt;команда&lt;/b&gt;');
assertIncludes(managerNotification.html, 'ORD-1');
assertIncludes(managerNotification.html, 'https://avaterra.pro/portal/manager/tickets');

const autoReply = buildTicketAutoReplyEmail({
  displayName: 'Анна',
  subject: 'Сертификат',
  autoReply: 'Мы проверим данные.\nОтветим в тикете.',
  ticketUrl: 'https://avaterra.pro/portal/student/support/ticket-3',
  systemTitle: 'AVATERRA',
});
assert.equal(autoReply.subject, 'Ответ по обращению — AVATERRA');
assertIncludes(autoReply.html, 'Мы проверим данные.<br/>Ответим в тикете.');

const passwordReset = buildPasswordResetEmail({
  displayName: 'Анна',
  setPasswordUrl: 'https://avaterra.pro/set-password?token=abc',
  systemTitle: 'AVATERRA',
});
assert.equal(passwordReset.subject, 'Сброс пароля — AVATERRA');
assertIncludes(passwordReset.html, 'https://avaterra.pro/set-password?token=abc');
assertIncludes(passwordReset.html, 'Если вы не запрашивали сброс пароля');

const setPassword = buildSetPasswordEmail({
  displayName: 'Лид <b>',
  setPasswordUrl: 'https://avaterra.pro/set-password?token=lead',
  systemTitle: 'AVATERRA',
});
assert.equal(setPassword.subject, 'Доступ в личный кабинет — AVATERRA');
assertIncludes(setPassword.html, 'Лид &lt;b&gt;');
assertIncludes(setPassword.html, 'https://avaterra.pro/set-password?token=lead');

const contactNotify = buildContactNotificationEmail({
  name: 'Иван <script>',
  phone: '+7 999 000',
  email: 'ivan@example.com',
  message: 'Хочу курс <b>сейчас</b>',
});
assertIncludes(contactNotify.html, 'Иван &lt;script&gt;');
assertIncludes(contactNotify.html, 'Хочу курс &lt;b&gt;сейчас&lt;/b&gt;');

const contactConfirm = buildContactConfirmationEmail({
  name: 'Иван',
  systemTitle: 'AVATERRA',
});
assert.equal(contactConfirm.subject, 'Заявка принята — AVATERRA');
assertIncludes(contactConfirm.html, 'Мы получили вашу заявку');

const settingsTest = buildSettingsTestEmail({ systemTitle: 'AVATERRA' });
assert.equal(settingsTest.subject, 'Тестовое письмо — AVATERRA');
assertIncludes(settingsTest.html, 'исходящая почта настроена корректно');

assert.equal(emailPreheaderFromHtmlFragment('<p>Привет, <strong>мир</strong>!</p>'), 'Привет, мир !');
assert.ok(emailPreheaderFromHtmlFragment('x'.repeat(200)).length <= 140);

const wrappedPre = wrapEmailHtml('<p>Тело</p>', { title: 'Тема', preheader: 'Превью <скрыто>' });
assertIncludes(wrappedPre, 'Превью &lt;скрыто&gt;');
assertIncludes(wrappedPre, 'display:none');

const mailingRendered = renderMailingTemplate('Привет %systemtitle%', '<p>%loginUrl%</p>', {
  FirstName: 'Иван',
  LastName: 'Петров',
  date: '01.01.2026',
  unsubscribe: 'https://avaterra.pro/unsubscribe',
  systemtitle: 'AVATERRA',
  portalUrl: 'https://avaterra.pro',
  loginUrl: 'https://avaterra.pro/login',
});
assert.equal(mailingRendered.subject, 'Привет AVATERRA');
assertIncludes(mailingRendered.body, 'https://avaterra.pro/login');

for (const eventType of [
  'system',
  'mailing',
  'support_ticket_created',
  'support_ticket_reply',
  'email_verification',
  'password_reset',
]) {
  assert.ok(
    DEFAULT_NOTIFICATION_TEMPLATES.some((t) => t.eventType === eventType),
    `Missing default notification template: ${eventType}`
  );
}

console.log('email-templates smoke test: ok');
