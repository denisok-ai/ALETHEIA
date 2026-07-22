/**
 * Ручная регистрация студента на курс (прод / локально).
 *
 * Переменные окружения:
 *   MANUAL_EMAIL       — email (обязательно)
 *   MANUAL_NAME        — ФИО (обязательно)
 *   MANUAL_COURSE      — подстрока в названии курса (по умолчанию «Практик»)
 *   MANUAL_AMOUNT      — сумма оплаты в ₽ (по умолчанию 25000)
 *   MANUAL_COURSE_ID   — если задан, поиск по названию пропускается
 *   MANUAL_DRY_RUN=1   — только просмотр, без изменений
 *
 * Пример (на VPS):
 *   MANUAL_EMAIL=user@example.com MANUAL_NAME="Иван Иванов" \
 *     npx tsx scripts/manual-register-student.ts
 */
import { randomBytes } from 'crypto';
import { hash } from 'bcryptjs';
import { prisma } from '../lib/db';
import { getSystemSettings } from '../lib/settings';
import { sendTransactionalEmail } from '../lib/email-service';
import { buildEmailGreeting, wrapEmailHtml } from '../lib/email-templates';
import { triggerNotification } from '../lib/notifications';
import { validatePassword } from '../lib/password-validation';

function generatePassword(): string {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = letters + digits;
  let p = '';
  p += letters[randomBytes(1)[0] % letters.length];
  p += digits[randomBytes(1)[0] % digits.length];
  for (let i = 0; i < 10; i++) {
    p += all[randomBytes(1)[0] % all.length];
  }
  return p.split('').sort(() => (randomBytes(1)[0] & 1 ? 1 : -1)).join('');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function main() {
  const email = normalizeEmail(process.env.MANUAL_EMAIL ?? '');
  const displayName = (process.env.MANUAL_NAME ?? '').trim();
  const courseSearch = (process.env.MANUAL_COURSE ?? 'Практик').trim();
  const amount = parseInt(process.env.MANUAL_AMOUNT ?? '25000', 10);
  const courseIdOverride = process.env.MANUAL_COURSE_ID?.trim() || null;
  const dryRun = process.env.MANUAL_DRY_RUN === '1';

  if (!email || !email.includes('@')) {
    console.error('MANUAL_EMAIL обязателен');
    process.exit(1);
  }
  if (!displayName) {
    console.error('MANUAL_NAME обязателен');
    process.exit(1);
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    console.error('MANUAL_AMOUNT должен быть положительным числом');
    process.exit(1);
  }

  let course = courseIdOverride
    ? await prisma.course.findUnique({
        where: { id: courseIdOverride },
        select: { id: true, title: true, price: true, status: true },
      })
    : null;

  if (!course) {
    const matches = await prisma.course.findMany({
      where: { title: { contains: courseSearch } },
      select: { id: true, title: true, price: true, status: true },
      orderBy: { sortOrder: 'asc' },
    });
    if (matches.length === 0) {
      console.error(`Курс с «${courseSearch}» в названии не найден`);
      process.exit(1);
    }
    course =
      matches.find((c) => c.price === amount) ??
      matches.find((c) => c.status === 'published') ??
      matches[0];
    if (matches.length > 1) {
      console.log('Найдено несколько курсов, выбран:', course.title, `(${course.id})`);
      console.log('Все совпадения:', matches.map((c) => `${c.id}: ${c.title} (${c.price ?? '—'} ₽)`).join('; '));
    }
  }

  const service = await prisma.service.findFirst({
    where: { courseId: course.id, isActive: true },
    select: { id: true, slug: true, name: true, paykeeperTariffId: true, price: true },
  });

  const tariffId = service?.paykeeperTariffId ?? service?.slug ?? `course-${course.id}`;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { profile: true, enrollments: { where: { courseId: course.id } } },
  });

  const password = generatePassword();
  const pwCheck = validatePassword(password);
  if (!pwCheck.ok) {
    console.error('Сгенерированный пароль не прошёл валидацию:', pwCheck.error);
    process.exit(1);
  }

  const settings = await getSystemSettings();
  const siteUrl = (settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const portalTitle = settings.portal_title || 'AVATERRA';
  const supportEmail = settings.resend_notify_email?.trim() || 'info@avaterra.pro';
  const loginUrl = `${siteUrl}/login`;
  const portalUrl = `${siteUrl}/portal`;
  const coursesUrl = `${siteUrl}/portal/courses`;

  if (dryRun) {
    console.log(JSON.stringify({
      dryRun: true,
      email,
      displayName,
      course,
      service,
      tariffId,
      existingUser: existingUser
        ? { id: existingUser.id, enrolled: existingUser.enrollments.length > 0 }
        : null,
    }, null, 2));
    await prisma.$disconnect();
    return;
  }

  let userId: string;
  let userCreated = false;
  let passwordForEmail = password;

  if (existingUser) {
    userId = existingUser.id;
    const passwordHash = await hash(password, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { displayName, passwordHash },
    });
    if (existingUser.profile) {
      await prisma.profile.update({
        where: { userId },
        data: { displayName, email, emailVerifiedAt: new Date(), status: 'active' },
      });
    } else {
      await prisma.profile.create({
        data: {
          id: `p-${userId}`,
          userId,
          role: 'user',
          status: 'active',
          email,
          displayName,
          emailVerifiedAt: new Date(),
        },
      });
    }
  } else {
    userCreated = true;
    const passwordHash = await hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, displayName },
    });
    userId = user.id;
    await prisma.profile.create({
      data: {
        id: `p-${userId}`,
        userId,
        role: 'user',
        status: 'active',
        email,
        displayName,
        emailVerifiedAt: new Date(),
      },
    });
  }

  let enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
  });

  let enrollmentCreated = false;
  if (!enrollment) {
    enrollment = await prisma.enrollment.create({
      data: { userId, courseId: course.id, accessClosed: false },
    });
    enrollmentCreated = true;
    await triggerNotification({
      eventType: 'enrollment',
      userId,
      metadata: { objectname: course.title },
    });
  } else if (enrollment.accessClosed) {
    enrollment = await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { accessClosed: false },
    });
  }

  const orderNumber = `MANUAL-${Date.now()}`;
  const order = await prisma.order.create({
    data: {
      orderNumber,
      tariffId,
      amount,
      paidAmountRub: amount,
      clientEmail: email,
      clientName: displayName,
      status: 'paid',
      paidAt: new Date(),
      userId,
      paykeeperStatus: 'manual',
      paykeeperRawStatus: 'manual_register_script',
    },
  });

  const subject = `Добро пожаловать в ${portalTitle} — доступ к курсу открыт`;
  const innerBody = `<p>${buildEmailGreeting(displayName)}</p>
<p>Для вас создан доступ к обучению на платформе <strong>${portalTitle}</strong>.</p>
<p><strong>Курс:</strong> «${course.title}»</p>
<p><strong>Оплата:</strong> ${amount.toLocaleString('ru-RU')} ₽ (заказ ${orderNumber})</p>
<hr style="border:none;border-top:1px solid #e8e4de;margin:20px 0;" />
<p><strong>Данные для входа в личный кабинет:</strong></p>
<ul>
<li><strong>Логин (email):</strong> ${email}</li>
<li><strong>Пароль:</strong> ${passwordForEmail}</li>
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
<li>Проходите уроки последовательно; прогресс сохраняется автоматически</li>
</ol>
<p>Если возникнут вопросы по доступу или техническим моментам, напишите в поддержку: <a href="mailto:${supportEmail}">${supportEmail}</a> или через раздел «Поддержка» в личном кабинете.</p>
<p>С уважением,<br/>команда ${portalTitle}</p>`;

  const emailHtml = wrapEmailHtml(innerBody, { title: subject });
  const mailResult = await sendTransactionalEmail({
    to: email,
    subject,
    html: emailHtml,
    context: {
      module: 'crm',
      entityId: orderNumber,
      userId,
    },
  });

  const report = {
    success: mailResult.ok,
    userId,
    userCreated,
    email,
    displayName,
    courseId: course.id,
    courseTitle: course.title,
    enrollmentId: enrollment.id,
    enrollmentCreated,
    enrollmentAccessClosed: enrollment.accessClosed,
    orderId: order.id,
    orderNumber,
    amount,
    emailSent: mailResult.ok,
    emailError: mailResult.ok ? null : mailResult.error,
    emailSubject: subject,
    emailBodyPlain: innerBody
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li>/gi, '• ')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
    password: passwordForEmail,
    loginUrl,
    portalUrl,
  };

  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();

  if (!mailResult.ok) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
