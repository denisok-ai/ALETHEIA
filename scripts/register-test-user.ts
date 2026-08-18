/**
 * Регистрация БЕСПЛАТНОГО тестового пользователя на полный дистанционный курс
 * (для проверки курса и пользовательских путей). В отличие от
 * manual-register-student.ts — НЕ создаёт платный Order (нет фейковой выручки
 * в отчётах): только User + Profile + Enrollment + подробное письмо-инструкция.
 *
 *   TEST_EMAIL=my-loft@yandex.ru TEST_NAME="Тестовая Ирина" \
 *     TEST_COURSE_ID=course-avaterra-praktik \
 *     npx tsx scripts/register-test-user.ts
 *
 * Enrollment без Order — это штатный «бесплатный доступ» (как у вводного курса),
 * сверку платежей (reconcile-enrollments ловит paid Order без Enrollment) не
 * ломает: инвариант «Order.userId только вместе с Enrollment» не нарушается,
 * потому что Order вообще не создаётся.
 */
import { randomBytes } from 'crypto';
import { hash } from 'bcryptjs';
import { prisma } from '../lib/db';
import { getSystemSettings } from '../lib/settings';
import { sendTransactionalEmail } from '../lib/email-service';
import { wrapEmailHtml } from '../lib/email-templates';
import { triggerNotification } from '../lib/notifications';
import { validatePassword } from '../lib/password-validation';

function generatePassword(): string {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = letters + digits;
  let p = letters[randomBytes(1)[0] % letters.length] + digits[randomBytes(1)[0] % digits.length];
  for (let i = 0; i < 10; i++) p += all[randomBytes(1)[0] % all.length];
  return p.split('').sort(() => (randomBytes(1)[0] & 1 ? 1 : -1)).join('');
}

async function main() {
  const email = (process.env.TEST_EMAIL ?? '').trim().toLowerCase();
  const displayName = (process.env.TEST_NAME ?? '').trim();
  const courseId = (process.env.TEST_COURSE_ID ?? 'course-avaterra-praktik').trim();
  if (!email || !email.includes('@') || !displayName) {
    console.error('TEST_EMAIL и TEST_NAME обязательны');
    process.exit(1);
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, status: true, courseFormat: true },
  });
  if (!course) {
    console.error(`Курс ${courseId} не найден`);
    process.exit(1);
  }

  const settings = await getSystemSettings();
  const siteUrl = (settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const portalTitle = settings.portal_title || 'АВАТЕРРА';
  const supportEmail = settings.resend_notify_email?.trim() || 'info@avaterra.pro';
  const loginUrl = `${siteUrl}/login`;
  const coursesUrl = `${siteUrl}/portal/student/courses`;

  // Пароль — генерируем, если пользователь новый или явно не задан.
  let password = generatePassword();
  const pw = validatePassword(password);
  if (!pw.ok) {
    console.error('Пароль не прошёл валидацию:', pw.error);
    process.exit(1);
  }
  const passwordHash = await hash(password, 10);

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { profile: true },
  });

  let userId: string;
  if (existing) {
    userId = existing.id;
    await prisma.user.update({ where: { id: userId }, data: { displayName, passwordHash } });
    if (existing.profile) {
      await prisma.profile.update({
        where: { userId },
        data: { displayName, email, status: 'active', emailVerifiedAt: new Date() },
      });
    } else {
      await prisma.profile.create({
        data: { id: `p-${userId}`, userId, role: 'user', status: 'active', email, displayName, emailVerifiedAt: new Date() },
      });
    }
  } else {
    const user = await prisma.user.create({ data: { email, passwordHash, displayName } });
    userId = user.id;
    await prisma.profile.create({
      data: { id: `p-${userId}`, userId, role: 'user', status: 'active', email, displayName, emailVerifiedAt: new Date() },
    });
  }

  // Бесплатное зачисление (без Order).
  const enrollment = await prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId: course.id } },
    create: { userId, courseId: course.id, accessClosed: false },
    update: { accessClosed: false },
  });
  await triggerNotification({ eventType: 'enrollment', userId, metadata: { objectname: course.title } }).catch(() => undefined);

  const subject = `${portalTitle}: доступ к курсу «${course.title}» открыт — инструкция`;
  const body = `<p>Здравствуйте, ${displayName}!</p>
<p>Для вас открыт <strong>бесплатный полный доступ</strong> к дистанционному курсу «${course.title}» на платформе <strong>${portalTitle}</strong> для ознакомления и проверки. Ниже — подробная инструкция по системе и прохождению курса.</p>

<h3 style="margin:22px 0 8px;">1. Вход в личный кабинет</h3>
<ul>
<li><strong>Адрес входа:</strong> <a href="${loginUrl}">${loginUrl}</a></li>
<li><strong>Логин (email):</strong> ${email}</li>
<li><strong>Пароль:</strong> ${password}</li>
</ul>
<p><a href="${loginUrl}" style="display:inline-block;background:#1E293B;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Войти в личный кабинет</a></p>
<p style="color:#64748B;font-size:13px;">После первого входа пароль можно сменить в разделе «Профиль».</p>

<h3 style="margin:22px 0 8px;">2. Как устроен личный кабинет</h3>
<p>После входа вы попадёте на <strong>Дашборд</strong> — сводку: ваши курсы, прогресс, «Шкала энергии» (баллы за активность), уведомления. Слева (или в меню на телефоне) разделы:</p>
<ul>
<li><strong>Мои курсы</strong> — список доступных курсов и переход к урокам;</li>
<li><strong>Сертификаты</strong> — здесь появится сертификат после завершения курса (PDF, можно скачать);</li>
<li><strong>Медиатека</strong> — дополнительные видео и материалы;</li>
<li><strong>Уведомления</strong> — системные сообщения;</li>
<li><strong>Задания на проверку</strong> — если по курсу нужно отправить видео/отчёт;</li>
<li><strong>Поддержка</strong> — задать вопрос;</li>
<li><strong>Профиль</strong> — данные и смена пароля.</li>
</ul>

<h3 style="margin:22px 0 8px;">3. Как проходить курс</h3>
<ol>
<li>Откройте раздел <strong>«Мои курсы»</strong>: <a href="${coursesUrl}">${coursesUrl}</a></li>
<li>Выберите курс «${course.title}» и нажмите <strong>«Начать»</strong> (или «Продолжить»).</li>
<li>Откроется встроенный плеер: проходите уроки последовательно, кнопкой <strong>«Далее»</strong>. Внутри есть видео, тексты, практики и проверочные вопросы.</li>
<li><strong>Прогресс сохраняется автоматически</strong> — можно закрыть и продолжить с того же места на любом устройстве (компьютер, телефон, планшет).</li>
<li>После прохождения всех модулей курс отметится завершённым, и в разделе «Сертификаты» появится сертификат.</li>
</ol>

<h3 style="margin:22px 0 8px;">4. Что проверить (для теста)</h3>
<p>Пожалуйста, обратите внимание, работает ли: вход и выход, открытие курса и кнопка «Далее», сохранение прогресса при повторном входе, отображение на телефоне, разделы кабинета, приходят ли уведомления. О любых неудобствах или ошибках — сразу напишите нам.</p>

<p style="margin-top:22px;">Вопросы по доступу или технике — на <a href="mailto:${supportEmail}">${supportEmail}</a> или через раздел «Поддержка» в кабинете.</p>
<p>Спасибо, что помогаете проверить систему! 🌿<br/>С уважением, команда «${portalTitle}»</p>`;

  const html = wrapEmailHtml(body, { title: subject });
  const mail = await sendTransactionalEmail({
    to: email,
    subject,
    html,
    context: { module: 'crm', userId, critical: true },
  });

  console.log(JSON.stringify({
    userId,
    userCreated: !existing,
    email,
    displayName,
    courseId: course.id,
    courseTitle: course.title,
    enrollmentId: enrollment.id,
    accessClosed: enrollment.accessClosed,
    password,
    emailSent: mail.ok,
    emailError: mail.ok ? null : mail.error,
  }, null, 2));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
