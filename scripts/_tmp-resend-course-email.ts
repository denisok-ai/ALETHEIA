/**
 * Одноразовая повторная отправка письма с доступом к курсу без смены пароля.
 */
import { prisma } from '../lib/db';
import { getSystemSettings } from '../lib/settings';
import { sendTransactionalEmail } from '../lib/email-service';
import { buildEmailGreeting, wrapEmailHtml } from '../lib/email-templates';

const EMAIL = 'rudenkoelena7667@gmail.com';
const PASSWORD = 'v2XHYZbnJEgb';
const COURSE_SEARCH = 'Практик';

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    console.error('USER_NOT_FOUND');
    process.exit(2);
  }

  const courses = await prisma.course.findMany({
    where: { title: { contains: COURSE_SEARCH } },
    orderBy: { sortOrder: 'asc' },
  });
  const course = courses.find((c) => c.price === 25000) ?? courses[0];
  if (!course) {
    console.error('COURSE_NOT_FOUND');
    process.exit(2);
  }

  const order = await prisma.order.findFirst({
    where: { userId: user.id, status: 'paid' },
    orderBy: { createdAt: 'desc' },
  });
  const orderNumber = order?.orderNumber ?? `MANUAL-resend-${Date.now()}`;
  const amount = order?.amount ?? 25000;
  const displayName = user.displayName ?? 'Студент';

  const settings = await getSystemSettings();
  const siteUrl = (settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const portalTitle = settings.portal_title || 'AVATERRA';
  const supportEmail = settings.resend_notify_email?.trim() || 'info@avaterra.pro';
  const loginUrl = `${siteUrl}/login`;
  const coursesUrl = `${siteUrl}/portal/courses`;

  const subject = `Добро пожаловать в ${portalTitle} — доступ к курсу открыт`;
  const innerBody = `<p>${buildEmailGreeting(displayName)}</p>
<p>Для вас создан доступ к обучению на платформе <strong>${portalTitle}</strong>.</p>
<p><strong>Курс:</strong> «${course.title}»</p>
<p><strong>Оплата:</strong> ${amount.toLocaleString('ru-RU')} ₽ (заказ ${orderNumber})</p>
<hr style="border:none;border-top:1px solid #e8e4de;margin:20px 0;" />
<p><strong>Данные для входа в личный кабинет:</strong></p>
<ul>
<li><strong>Логин (email):</strong> ${EMAIL}</li>
<li><strong>Пароль:</strong> ${PASSWORD}</li>
</ul>
<p>Рекомендуем после первого входа сменить пароль в разделе «Профиль».</p>
<p><a href="${loginUrl}" style="display:inline-block;background:#2D1B4E;color:#ffffff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Войти в личный кабинет</a></p>
<hr style="border:none;border-top:1px solid #e8e4de;margin:20px 0;" />
<p><strong>Как начать обучение:</strong></p>
<ol>
<li>Перейдите на страницу входа: <a href="${loginUrl}">${loginUrl}</a></li>
<li>Введите email и пароль из этого письма</li>
<li>Откройте раздел <strong>«Мои курсы»</strong>: <a href="${coursesUrl}">${coursesUrl}</a></li>
<li>Выберите курс «${course.title}» и нажмите «Начать» или «Продолжить»</li>
</ol>
<p>Если возникнут вопросы, напишите: <a href="mailto:${supportEmail}">${supportEmail}</a></p>
<p>С уважением,<br/>команда ${portalTitle}</p>`;

  const mailResult = await sendTransactionalEmail({
    to: EMAIL,
    subject,
    html: wrapEmailHtml(innerBody, { title: subject }),
    context: { module: 'crm', entityId: orderNumber, userId: user.id },
  });

  console.log(JSON.stringify({
    email: EMAIL,
    course: course.title,
    passwordUnchanged: true,
    emailSent: mailResult.ok,
    emailError: mailResult.ok ? null : mailResult.error,
  }));
  await prisma.$disconnect();
  if (!mailResult.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
