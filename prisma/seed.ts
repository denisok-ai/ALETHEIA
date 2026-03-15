import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

const N = 50; // минимум 50 объектов где по смыслу

/** Генерация уникального orderNumber */
function orderNumber(prefix: string, i: number) {
  return `ORD-${prefix}-${String(i).padStart(4, '0')}`;
}

async function main() {
  const pw = await hash('Test123!', 10);

  // ——— Пользователи: 1 admin, 2 manager, 50+ студентов ———
  const admin = await prisma.user.upsert({
    where: { email: 'admin@test.local' },
    create: { email: 'admin@test.local', passwordHash: pw, displayName: 'Admin' },
    update: {},
  });
  await prisma.profile.upsert({
    where: { userId: admin.id },
    create: { id: `p-${admin.id}`, userId: admin.id, role: 'admin', status: 'active', displayName: 'Администратор', email: admin.email },
    update: { role: 'admin' },
  });

  const manager1 = await prisma.user.upsert({
    where: { email: 'manager@test.local' },
    create: { email: 'manager@test.local', passwordHash: pw, displayName: 'Manager' },
    update: {},
  });
  await prisma.profile.upsert({
    where: { userId: manager1.id },
    create: { id: `p-${manager1.id}`, userId: manager1.id, role: 'manager', status: 'active', displayName: 'Менеджер', email: manager1.email },
    update: { role: 'manager' },
  });

  const manager2 = await prisma.user.upsert({
    where: { email: 'manager2@test.local' },
    create: { email: 'manager2@test.local', passwordHash: pw, displayName: 'Manager 2' },
    update: {},
  });
  await prisma.profile.upsert({
    where: { userId: manager2.id },
    create: { id: `p-${manager2.id}`, userId: manager2.id, role: 'manager', status: 'active', displayName: 'Менеджер 2', email: manager2.email },
    update: { role: 'manager' },
  });

  const studentEmails = Array.from({ length: N }, (_, i) => `student${i + 1}@test.local`);
  const students: { id: string; email: string }[] = [];
  for (let i = 0; i < studentEmails.length; i++) {
    const email = studentEmails[i];
    const name = `Студент ${i + 1}`;
    const u = await prisma.user.upsert({
      where: { email },
      create: { email, passwordHash: pw, displayName: name },
      update: {},
    });
    await prisma.profile.upsert({
      where: { userId: u.id },
      create: { id: `p-${u.id}`, userId: u.id, role: 'user', status: i < 3 ? 'archived' : 'active', displayName: name, email: u.email },
      update: {},
    });
    students.push({ id: u.id, email: u.email });
  }

  const allUsers = [admin, manager1, manager2, ...students.map((s) => ({ id: s.id, email: s.email }))];

  // ——— Курсы: 50+ ———
  const statuses = ['published', 'published', 'published', 'draft', 'archived'] as const;
  const courses: { id: string; title: string }[] = [];
  for (let i = 0; i < N; i++) {
    const c = await prisma.course.upsert({
      where: { id: `course-seed-${i + 1}` },
      create: {
        id: `course-seed-${i + 1}`,
        title: `Курс «${['Тело не врет', 'Вводный модуль', 'Практикум', 'Продвинутый уровень', 'Интенсив'][i % 5]}» — поток ${i + 1}`,
        description: `Описание курса ${i + 1}. Phygital школа мышечного тестирования AVATERRA.`,
        status: statuses[i % statuses.length],
        price: [25000, 5000, 15000, 8000, 32000][i % 5],
        sortOrder: i + 1,
      },
      update: {},
    });
    courses.push({ id: c.id, title: c.title });
  }

  // ——— Группы (курсы, медиа, пользователи): по 20+ с иерархией ———
  let courseGroups: { id: string; name: string; parentId: string | null }[] = await prisma.group.findMany({ where: { moduleType: 'course' }, orderBy: { displayOrder: 'asc' } }).then((g) => g.map((x) => ({ id: x.id, name: x.name, parentId: x.parentId })));
  if (courseGroups.length < 22) {
    courseGroups = [];
    for (let i = 0; i < 22; i++) {
    const parentId = i >= 5 ? courseGroups[i - 5]?.id ?? null : null;
      const g = await prisma.group.create({
        data: {
          name: `Группа курсов ${i + 1}`,
          description: i % 3 === 0 ? `Подборка курсов по тематике ${i + 1}` : null,
          moduleType: 'course',
          parentId,
          displayOrder: i,
        },
      });
      courseGroups.push({ id: g.id, name: g.name, parentId: g.parentId });
    }
  }

  let mediaGroups: { id: string; name: string }[] = await prisma.group.findMany({ where: { moduleType: 'media' } }).then((g) => g.map((x) => ({ id: x.id, name: x.name })));
  if (mediaGroups.length < 20) {
    mediaGroups = [];
    for (let i = 0; i < 20; i++) {
      const g = await prisma.group.create({
        data: {
          name: `Медиатека: ${['Видео', 'Документы', 'Презентации', 'Аудио', 'Справочники'][i % 5]} ${Math.floor(i / 5) + 1}`,
          moduleType: 'media',
          displayOrder: i,
        },
      });
      mediaGroups.push({ id: g.id, name: g.name });
    }
  }

  let userGroups: { id: string; name: string }[] = await prisma.group.findMany({ where: { moduleType: 'user' } }).then((g) => g.map((x) => ({ id: x.id, name: x.name })));
  if (userGroups.length < 20) {
    userGroups = [];
    for (let i = 0; i < 20; i++) {
      const g = await prisma.group.create({
        data: {
          name: `Участники: ${['Новички', 'Практики', 'Выпускники', 'Корпоративные', 'VIP'][i % 5]} ${Math.floor(i / 5) + 1}`,
          moduleType: 'user',
          displayOrder: i,
        },
      });
      userGroups.push({ id: g.id, name: g.name });
    }
  }

  // ——— Для первых курсов: scormManifest и scormPath (для проверки прогресса и плеера) ———
  const scormLessonIds = ['lesson-1', 'lesson-2', 'lesson-3'];
  const scormManifestJson = JSON.stringify({
    version: '1.2',
    title: 'Тестовый курс',
    items: [
      { identifier: 'lesson-1', title: 'Урок 1. Введение', href: 'lesson1.html' },
      { identifier: 'lesson-2', title: 'Урок 2. Практика', href: 'lesson2.html' },
      { identifier: 'lesson-3', title: 'Урок 3. Итоги', href: 'lesson3.html' },
    ],
  });
  const publishedCourses = courses.filter((_, i) => statuses[i % statuses.length] === 'published');
  for (let i = 0; i < Math.min(5, publishedCourses.length); i++) {
    const c = publishedCourses[i];
    if (!c) continue;
    await prisma.course.update({
      where: { id: c.id },
      data: {
        scormPath: `courses-${c.id}/index.html`,
        scormVersion: '1.2',
        scormManifest: scormManifestJson,
      },
    }).catch(() => {});
  }

  // Связка курсов с группами курсов
  for (let i = 0; i < courses.length; i++) {
    const group = courseGroups[i % courseGroups.length];
    await prisma.courseGroup.upsert({
      where: { courseId_groupId: { courseId: courses[i].id, groupId: group.id } },
      create: { courseId: courses[i].id, groupId: group.id },
      update: {},
    });
  }

  // ——— Записи на курсы (enrollments): осмысленно распределяем студентов по курсам ———
  for (let ui = 0; ui < students.length; ui++) {
    const numEnrollments = 2 + (ui % 8); // от 2 до 9 курсов на студента
    const used = new Set<number>();
    for (let e = 0; e < numEnrollments; e++) {
      let ci = Math.floor(Math.random() * courses.length);
      while (used.has(ci)) ci = (ci + 1) % courses.length;
      used.add(ci);
      const course = courses[ci];
      if (course && courses[ci] && (await prisma.course.findUnique({ where: { id: course.id } }))?.status === 'published') {
        await prisma.enrollment.upsert({
          where: { userId_courseId: { userId: students[ui].id, courseId: course.id } },
          create: {
            userId: students[ui].id,
            courseId: course.id,
            accessClosed: e % 5 === 0,
            completedAt: e % 4 === 0 ? new Date() : null,
          },
          update: {},
        }).catch(() => {});
      }
    }
  }

  // ——— Медиа: 50+, часть привязана к курсам ———
  const mediaCountBefore = await prisma.media.count();
  const mediaCategories = ['video', 'pdf', 'image', 'document', 'audio'] as const;
  const mediaList: { id: string; title: string; courseId: string | null }[] = await prisma.media.findMany({ select: { id: true, title: true, courseId: true } });
  for (let i = mediaList.length; i < N; i++) {
    const courseId = i % 3 === 0 ? courses[i % courses.length]?.id ?? null : null;
    const m = await prisma.media.create({
      data: {
        title: `Ресурс «${['Введение', 'Методичка', 'Практика', 'Тест', 'Доп. материал'][i % 5]}» ${i + 1}`,
        fileUrl: i % 4 === 0 ? `https://example.com/media/${i + 1}` : `/uploads/media/item-${i + 1}.${i % 3 === 0 ? 'mp4' : 'pdf'}`,
        mimeType: i % 3 === 0 ? 'video/mp4' : 'application/pdf',
        category: mediaCategories[i % mediaCategories.length],
        type: i % 4 === 0 ? 'link' : 'file',
        viewsCount: Math.floor(Math.random() * 500),
        ratingSum: (i % 5) * 10,
        ratingCount: i % 5,
        courseId,
        sortOrder: i,
      },
    });
    mediaList.push({ id: m.id, title: m.title, courseId: m.courseId });
  }

  // Связка медиа с группами медиатеки
  for (let i = 0; i < mediaList.length; i++) {
    const group = mediaGroups[i % mediaGroups.length];
    await prisma.mediaGroup.create({
      data: { mediaId: mediaList[i].id, groupId: group.id, sortOrder: i },
    }).catch(() => {});
  }

  // Связка пользователей с группами пользователей
  for (let ui = 0; ui < students.length; ui++) {
    const group = userGroups[ui % userGroups.length];
    await prisma.userGroup.create({
      data: { userId: students[ui].id, groupId: group.id, role: ui % 7 === 0 ? 'moderator' : 'member' },
    }).catch(() => {});
  }

  // ——— Лиды: 50+; у части — lastOrderNumber (связь с оплаченным заказом) ———
  const leadCount = await prisma.lead.count();
  const firstNames = ['Анна', 'Петр', 'Мария', 'Иван', 'Елена', 'Сергей', 'Ольга', 'Дмитрий', 'Наталья', 'Алексей'];
  const lastNames = ['Иванова', 'Сидоров', 'Козлова', 'Петров', 'Смирнова', 'Кузнецов', 'Попова', 'Васильева', 'Михайлова', 'Новикова'];
  const leadStatuses = ['new', 'contacted', 'qualified', 'converted', 'lost'];
  const leadSources = ['form', 'landing', 'manual'];
  for (let i = leadCount; i < N; i++) {
    await prisma.lead.create({
      data: {
        name: `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`,
        phone: `+7900${String(1000000 + i).slice(-7)}`,
        email: `lead${i + 1}@example.com`,
        message: i % 2 === 0 ? `Заявка на курс ${(i % 5) + 1}` : null,
        notes: i % 3 === 0 ? `Заметка по лиду ${i + 1}` : null,
        status: leadStatuses[i % leadStatuses.length],
        source: leadSources[i % leadSources.length],
        convertedToUserId: leadStatuses[i % leadStatuses.length] === 'converted' && students[i % students.length] ? students[i % students.length].id : null,
      },
    }).catch(() => {});
  }

  // ——— Услуги (Service): привязка к курсам ———
  const existingService = await prisma.service.findFirst();
  if (!existingService) {
    for (let i = 0; i < Math.min(15, courses.length); i++) {
      await prisma.service.create({
        data: {
          slug: `course-${i + 1}`,
          name: `Тариф «${courses[i].title.slice(0, 30)}»`,
          price: 5000 + i * 1000,
          paykeeperTariffId: `tariff-${i + 1}`,
          courseId: courses[i].id,
          isActive: i < 12,
        },
      }).catch(() => {});
    }
  }

  // ——— Заказы: 50+, связка с пользователями и тарифами ———
  const services = await prisma.service.findMany({ take: 15 });
  const orderStatuses = ['pending', 'paid', 'cancelled', 'refunded'] as const;
  for (let i = 0; i < N; i++) {
    const existing = await prisma.order.findUnique({ where: { orderNumber: orderNumber('SEED', i + 1) } });
    if (existing) continue;
    const status = orderStatuses[i % orderStatuses.length];
    const userId = status === 'paid' || status === 'refunded' ? students[i % students.length]?.id : null;
    const svc = services[i % services.length] ?? services[0];
    await prisma.order.create({
      data: {
        orderNumber: orderNumber('SEED', i + 1),
        tariffId: svc?.slug ?? 'course',
        amount: svc?.price ?? 10000,
        clientEmail: userId ? students.find((s) => s.id === userId)?.email ?? `client${i + 1}@test.local` : `client${i + 1}@test.local`,
        clientPhone: i % 2 === 0 ? `+7900${1000000 + i}` : null,
        status,
        paidAt: status === 'paid' || status === 'refunded' ? new Date(Date.now() - i * 86400000) : null,
        userId: userId ?? null,
      },
    }).catch(() => {});
  }

  // Привязка lastOrderNumber к части лидов (по оплаченным заказам)
  const paidOrdersForLeads = await prisma.order.findMany({ where: { status: 'paid' }, select: { orderNumber: true }, take: 10 });
  const leadsToLink = await prisma.lead.findMany({ orderBy: { id: 'asc' }, take: 10 });
  for (let i = 0; i < Math.min(paidOrdersForLeads.length, leadsToLink.length); i++) {
    await prisma.lead.update({
      where: { id: leadsToLink[i].id },
      data: { lastOrderNumber: paidOrdersForLeads[i].orderNumber },
    }).catch(() => {});
  }

  // ——— Рассылки и отписавшиеся ———
  const mailings: { id: string }[] = [];
  for (let i = 0; i < 15; i++) {
    const m = await prisma.mailing.create({
      data: {
        internalTitle: `Рассылка ${i + 1}`,
        emailSubject: `Тема рассылки ${i + 1}`,
        emailBody: `<p>Текст рассылки ${i + 1}. Здравствуйте, %FirstName%!</p>`,
        status: ['planned', 'completed', 'processing'][i % 3] as 'planned' | 'completed' | 'processing',
        scheduleMode: 'manual',
        createdById: admin.id,
        recipientConfig: JSON.stringify({ type: 'all' }),
      },
    });
    mailings.push({ id: m.id });
  }

  for (let i = 0; i < N; i++) {
    await prisma.mailingLog.create({
      data: {
        mailingId: mailings[i % mailings.length].id,
        userId: students[i % students.length]?.id ?? null,
        recipientEmail: `student${(i % N) + 1}@test.local`,
        recipientName: `Студент ${(i % N) + 1}`,
        status: i % 10 === 0 ? 'failed' : 'sent',
        errorMessage: i % 10 === 0 ? 'Timeout' : null,
        sentAt: new Date(Date.now() - i * 3600000),
      },
    }).catch(() => {});
  }

  for (let i = 0; i < N; i++) {
    await prisma.mailingUnsubscribe.upsert({
      where: { email: `unsub${i + 1}@example.com` },
      create: { email: `unsub${i + 1}@example.com` },
      update: {},
    }).catch(() => {});
  }

  // ——— Публикации: 50+ и комментарии ———
  const pubTypes = ['news', 'announcement'] as const;
  for (let i = 0; i < N; i++) {
    const pub = await prisma.publication.create({
      data: {
        title: `Публикация «${['Новость', 'Анонс', 'Итоги', 'Приглашение', 'Обновление'][i % 5]}» ${i + 1}`,
        type: pubTypes[i % 2],
        status: i % 5 === 0 ? 'closed' : 'active',
        publishAt: new Date(Date.now() - i * 86400000),
        teaser: `Краткое описание публикации ${i + 1}.`,
        content: `<p>Полный текст публикации ${i + 1}. AVATERRA — Phygital школа мышечного тестирования.</p>`,
        allowComments: i % 3 !== 0,
        allowRating: true,
        viewsCount: Math.floor(Math.random() * 200),
      },
    });
    for (let c = 0; c < (i % 4); c++) {
      await prisma.publicationComment.create({
        data: {
          publicationId: pub.id,
          userId: students[(i + c) % students.length]?.id ?? null,
          authorName: `Участник ${(i + c) % N + 1}`,
          content: `Комментарий ${c + 1} к публикации ${i + 1}.`,
        },
      }).catch(() => {});
    }
  }

  // ——— Уведомления пользователям и журнал ———
  for (let i = 0; i < N; i++) {
    const uid = students[i % students.length]?.id;
    if (!uid) continue;
    await prisma.notification.create({
      data: {
        userId: uid,
        type: ['enrollment', 'certificate_issued', 'system', 'mailing'][i % 4],
        content: JSON.stringify({ title: `Уведомление ${i + 1}`, ref: `ref-${i}` }),
        isRead: i % 3 === 0,
      },
    }).catch(() => {});
  }

  const eventTypes = ['enrollment', 'certificate_issued', 'access_opened', 'access_closed', 'mailing'];
  for (let i = 0; i < N; i++) {
    await prisma.notificationLog.create({
      data: {
        userId: students[i % students.length]?.id ?? null,
        eventType: eventTypes[i % eventTypes.length],
        subject: `Тема уведомления ${i + 1}`,
        content: `Текст уведомления ${i + 1} для журнала.`,
        channel: i % 2 === 0 ? 'email' : 'internal',
      },
    }).catch(() => {});
  }

  // ——— Тикеты: 50+, связка студент + менеджер; у части — привязка заказа (orderNumber) ———
  const ticketStatuses = ['open', 'in_progress', 'resolved', 'closed'] as const;
  const ticketSubjects = ['Доступ к уроку', 'Сертификат', 'Оплата', 'Технический вопрос', 'Перенос срока', 'Не приходит доступ', 'Проблема с прохождением курса'];
  const paidOrderNumbers = await prisma.order.findMany({ where: { status: 'paid' }, select: { orderNumber: true }, take: 15 });
  for (let i = 0; i < N; i++) {
    const managerId = i % 2 === 0 ? manager1.id : manager2.id;
    const subjectIdx = i % ticketSubjects.length;
    const subject = subjectIdx === 5 && paidOrderNumbers[i % paidOrderNumbers.length]
      ? `Не приходит доступ — заказ ${paidOrderNumbers[i % paidOrderNumbers.length].orderNumber}`
      : `${ticketSubjects[subjectIdx]} — тикет ${i + 1}`;
    await prisma.ticket.create({
      data: {
        userId: students[i % students.length].id,
        managerId: i % 3 !== 0 ? managerId : null,
        subject,
        status: ticketStatuses[i % ticketStatuses.length],
        orderNumber: i < 15 && paidOrderNumbers[i % paidOrderNumbers.length] ? paidOrderNumbers[i % paidOrderNumbers.length].orderNumber : null,
        messages: JSON.stringify([
          { role: 'user', content: `Сообщение пользователя ${i + 1}`, at: new Date().toISOString() },
          ...(i % 3 !== 0 ? [{ role: 'manager', content: `Ответ поддержки ${i + 1}`, at: new Date().toISOString() }] : []),
        ]),
      },
    }).catch(() => {});
  }

  // ——— Шаблоны сертификатов (если нет) ———
  let certTemplates = await prisma.certificateTemplate.findMany({ take: 5 });
  if (certTemplates.length === 0) {
    for (let i = 0; i < 3; i++) {
      const t = await prisma.certificateTemplate.create({
        data: {
          name: `Шаблон сертификата ${i + 1}`,
          minScore: i === 0 ? 70 : null,
          requiredStatus: 'completed',
          validityDays: 365,
          numberingFormat: 'CERT-YYYY-NNNN',
          allowUserDownload: true,
          courseId: courses[i % courses.length]?.id ?? null,
        },
      });
      certTemplates.push(t);
    }
  }

  // ——— Сертификаты: 50+ записей, формат ALT-XXXXXXXX, привязка к шаблонам ———
  const certPairs = new Set<string>();
  for (let i = 0; i < Math.min(55, students.length); i++) {
    for (let j = 0; j < 3; j++) {
      const course = courses[(i * 3 + j * 11) % courses.length];
      if (!course) continue;
      const key = `${students[i].id}:${course.id}`;
      if (certPairs.has(key)) continue;
      certPairs.add(key);
      const template = certTemplates[j % certTemplates.length] ?? certTemplates[0];
      await prisma.certificate.create({
        data: {
          userId: students[i].id,
          courseId: course.id,
          templateId: template?.id ?? null,
          certNumber: `ALT-${nanoid(8).toUpperCase()}`,
          issuedAt: new Date(Date.now() - (i + j) * 86400 * 1000),
          expiryDate: j % 4 === 0 ? new Date(Date.now() - 86400000) : new Date(Date.now() + 365 * 86400000),
        },
      }).catch(() => {});
    }
  }

  // ——— ScormProgress: прогресс по урокам (lesson-1, lesson-2, lesson-3) для проверки прохождения и сертификатов ———
  const enrollments = await prisma.enrollment.findMany({
    where: { course: { status: 'published' } },
    take: 120,
  });
  const publishedCourseIds = new Set(publishedCourses.map((c) => c.id));
  for (let e = 0; e < enrollments.length; e++) {
    const en = enrollments[e];
    if (!publishedCourseIds.has(en.courseId)) continue;
    const allCompleted = e < 35; // первые 35 записей — все уроки пройдены (для теста сертификатов)
    for (let l = 0; l < scormLessonIds.length; l++) {
      const lessonId = scormLessonIds[l];
      const completed = allCompleted || l < 2 || (e + l) % 3 === 0;
      await prisma.scormProgress.upsert({
        where: {
          userId_courseId_lessonId: { userId: en.userId, courseId: en.courseId, lessonId },
        },
        create: {
          userId: en.userId,
          courseId: en.courseId,
          lessonId,
          cmiData: '{}',
          completionStatus: completed ? (l % 2 === 0 ? 'completed' : 'passed') : 'incomplete',
          score: 60 + Math.floor(Math.random() * 40),
          timeSpent: 120 + l * 300 + Math.floor(Math.random() * 200),
        },
        update: {},
      }).catch(() => {});
    }
  }
  // Доп. прогресс для курсов без manifest (main / intro) — чтобы не ломать существующие данные
  const lessonIdsLegacy = ['main', 'lesson-1', 'lesson-2', 'intro'];
  for (let e = enrollments.length - 40; e < enrollments.length; e++) {
    if (e < 0) continue;
    const en = enrollments[e];
    if (publishedCourseIds.has(en.courseId)) continue;
    for (let l = 0; l < 2; l++) {
      await prisma.scormProgress.upsert({
        where: {
          userId_courseId_lessonId: { userId: en.userId, courseId: en.courseId, lessonId: lessonIdsLegacy[l] },
        },
        create: {
          userId: en.userId,
          courseId: en.courseId,
          lessonId: lessonIdsLegacy[l],
          completionStatus: l === 0 ? 'completed' : 'incomplete',
          score: 75,
          timeSpent: 600,
        },
        update: {},
      }).catch(() => {});
    }
  }

  // ——— Завершённые записи (completedAt) для записей с полным прогрессом ———
  const fullProgressEnrollments = enrollments.slice(0, 35);
  for (const en of fullProgressEnrollments) {
    await prisma.enrollment.updateMany({
      where: { userId: en.userId, courseId: en.courseId },
      data: { completedAt: new Date(Date.now() - 7 * 86400000) },
    }).catch(() => {});
  }

  // ——— PhygitalVerification: часть пользователей по курсам ———
  for (let i = 0; i < 25; i++) {
    await prisma.phygitalVerification.create({
      data: {
        userId: students[i % students.length].id,
        courseId: courses[i % courses.length].id,
        lessonId: `lesson-${(i % 3) + 1}`,
        videoUrl: `/portal/manager/verifications#video-${i + 1}`,
        status: ['pending', 'approved', 'rejected'][i % 3],
        reviewedBy: i % 3 !== 0 ? manager1.id : null,
        reviewedAt: i % 3 !== 0 ? new Date() : null,
        comment: i % 3 === 2 ? 'Требуется доработка' : null,
      },
    }).catch(() => {});
  }

  // ——— VisitLog: сессии пользователей ———
  for (let i = 0; i < N; i++) {
    const uid = allUsers[i % allUsers.length]?.id;
    if (!uid) continue;
    await prisma.visitLog.create({
      data: {
        userId: uid,
        loginAt: new Date(Date.now() - (i + 1) * 3600000),
        lastActivityAt: new Date(Date.now() - i * 60000),
        logoutAt: i % 4 === 0 ? new Date(Date.now() - (i + 1) * 3600000 + 1800000) : null,
        ipAddress: `192.168.1.${(i % 250) + 1}`,
        userAgent: i % 2 === 0 ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0' : 'Mozilla/5.0 (iPhone) Safari/605.1',
      },
    }).catch(() => {});
  }

  // ——— AuditLog: 50+ записей ———
  const actions = ['create', 'update', 'delete', 'login', 'export'];
  const entities = ['User', 'Course', 'Order', 'Enrollment', 'Mailing', 'Lead', 'Certificate'];
  for (let i = 0; i < N; i++) {
    await prisma.auditLog.create({
      data: {
        actorId: [admin.id, manager1.id, manager2.id][i % 3],
        action: actions[i % actions.length],
        entity: entities[i % entities.length],
        entityId: `entity-${i + 1}`,
        diff: i % 2 === 0 ? JSON.stringify({ field: 'status', old: 'draft', new: 'published' }) : null,
      },
    }).catch(() => {});
  }

  // ——— CommsSend: 50+ ———
  const commsTemplates = await prisma.commsTemplate.findMany({ take: 5 });
  for (let i = 0; i < N; i++) {
    await prisma.commsSend.create({
      data: {
        templateId: commsTemplates[i % commsTemplates.length]?.id ?? null,
        channel: 'email',
        recipient: students[i % students.length]?.email ?? `recipient${i + 1}@test.local`,
        subject: `Сообщение ${i + 1}`,
        status: 'sent',
        sentBy: admin.id,
      },
    }).catch(() => {});
  }

  // ——— UserEnergy: на каждого студента ———
  for (let i = 0; i < students.length; i++) {
    await prisma.userEnergy.upsert({
      where: { userId: students[i].id },
      create: {
        userId: students[i].id,
        xp: 100 + i * 20 + Math.floor(Math.random() * 200),
        level: 1 + Math.floor((i * 20) / 500),
        lastPracticeAt: new Date(Date.now() - i * 86400000),
      },
      update: {},
    }).catch(() => {});
  }

  // ——— NotificationSet и шаблоны (если пусто) ———
  const notifSetCount = await prisma.notificationSet.count();
  if (notifSetCount === 0) {
    await prisma.notificationSet.createMany({
      data: [
        { eventType: 'enrollment_excluded', name: 'Отчисление слушателя с мероприятия', isDefault: true },
        { eventType: 'access_opened', name: 'Открытие доступа', isDefault: true },
        { eventType: 'access_closed', name: 'Закрытие доступа', isDefault: true },
        { eventType: 'certificate_issued', name: 'Выдача сертификата', isDefault: true },
      ],
    });
  }

  const notifTplCount = await prisma.notificationTemplate.count();
  if (notifTplCount === 0) {
    await prisma.notificationTemplate.createMany({
      data: [
        { name: 'Запись на курс', subject: 'Вы записаны', body: 'Здравствуйте, %recfirstname%! Вы записаны на курс.', type: 'both' },
        { name: 'Сертификат', subject: 'Сертификат выдан', body: 'Поздравляем с получением сертификата.', type: 'both' },
      ],
    });
  }

  const tplCount = await prisma.commsTemplate.count();
  if (tplCount === 0) {
    await prisma.commsTemplate.createMany({
      data: [
        { name: 'Приветствие', channel: 'email', subject: 'Добро пожаловать', htmlBody: '<p>Здравствуйте!</p>', variables: '[]' },
        { name: 'Запись на курс', channel: 'email', subject: 'Вы записаны', htmlBody: '<p>Вы записаны на курс.</p>', variables: '[]' },
      ],
    });
  }

  await prisma.llmSetting.upsert({
    where: { key: 'chatbot' },
    create: { key: 'chatbot', provider: 'deepseek', model: 'deepseek-chat', systemPrompt: 'You are a helpful assistant for AVATERRA.', temperature: 0.7, maxTokens: 2000 },
    update: {},
  });
  await prisma.llmSetting.upsert({
    where: { key: 'course-tutor' },
    create: { key: 'course-tutor', provider: 'deepseek', model: 'deepseek-chat', temperature: 0.5, maxTokens: 1500 },
    update: {},
  });

  // ——— PasswordToken: тестовые токены для проверки /set-password (валидный и истёкший) ———
  const student1 = students[0];
  if (student1) {
    const validExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const expiredExpiry = new Date(Date.now() - 60 * 60 * 1000);
    await prisma.passwordToken.upsert({
      where: { token: 'seedvalidtoken1234567890123456789012' },
      create: { userId: student1.id, token: 'seedvalidtoken1234567890123456789012', expiresAt: validExpiry },
      update: { expiresAt: validExpiry },
    }).catch(() => {});
    await prisma.passwordToken.upsert({
      where: { token: 'seedexpiredtoken12345678901234567890' },
      create: { userId: student1.id, token: 'seedexpiredtoken12345678901234567890', expiresAt: expiredExpiry },
      update: { expiresAt: expiredExpiry },
    }).catch(() => {});
  }

  // ——— SystemSetting: базовые настройки для локальной разработки ———
  const systemSettings: { key: string; value: string; category: string | null }[] = [
    { key: 'site_url', value: 'http://localhost:3000', category: 'general' },
    { key: 'portal_title', value: 'AVATERRA', category: 'general' },
    { key: 'contact_phone', value: '+7 (999) 123-45-67', category: 'general' },
    { key: 'scorm_max_size_mb', value: '200', category: 'general' },
    { key: 'resend_from', value: 'notifications@avaterra.pro', category: 'email' },
    { key: 'resend_notify_email', value: 'admin@test.local', category: 'email' },
  ];
  for (const s of systemSettings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      create: s,
      update: { value: s.value, category: s.category },
    }).catch(() => {});
  }

  console.log('Seed done: 50+ users, courses (первые 5 с scormManifest/scormPath), enrollments (часть completedAt), groups, media, leads, orders, mailings, tickets, 50+ certificates (ALT-xxx, шаблоны), scorm progress (lesson-1/2/3, часть полное прохождение), phygital, visit/audit logs, user energy, password tokens, system settings (в т.ч. scorm_max_size_mb).');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
