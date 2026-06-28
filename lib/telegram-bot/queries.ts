/**
 * Общие запросы к БД для Telegram-бота (сводки, заказы, тикеты, прогресс).
 */
import { prisma } from '@/lib/db';

export type AdminStats = {
  usersActive: number;
  ordersPaidToday: number;
  openTickets: number;
  unpaidLeads: number;
};

export async function fetchAdminStats(): Promise<AdminStats> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [usersActive, ordersPaidToday, openTickets, unpaidLeads] = await Promise.all([
    prisma.profile.count({ where: { status: 'active', role: { not: 'admin' } } }),
    prisma.order.count({ where: { status: 'paid', paidAt: { gte: startOfDay } } }),
    prisma.ticket.count({ where: { status: { in: ['open', 'in_progress'] } } }),
    prisma.lead.count({ where: { status: { in: ['new', 'contacted'] } } }),
  ]);

  return { usersActive, ordersPaidToday, openTickets, unpaidLeads };
}

export type RecentOrderRow = {
  orderNumber: string;
  amount: number;
  clientEmail: string;
  paidAt: Date | null;
};

export async function fetchRecentPaidOrders(limit = 5, skip = 0): Promise<RecentOrderRow[]> {
  return prisma.order.findMany({
    where: { status: 'paid' },
    orderBy: { paidAt: 'desc' },
    skip,
    take: limit,
    select: { orderNumber: true, amount: true, clientEmail: true, paidAt: true },
  });
}

export async function countPaidOrders(): Promise<number> {
  return prisma.order.count({ where: { status: 'paid' } });
}

export type OpenTicketRow = {
  id: string;
  subject: string;
  status: string;
  createdAt: Date;
  userEmail: string;
};

export async function fetchOpenTickets(limit = 10, skip = 0): Promise<OpenTicketRow[]> {
  const rows = await prisma.ticket.findMany({
    where: { status: { in: ['open', 'in_progress'] } },
    orderBy: { updatedAt: 'desc' },
    skip,
    take: limit,
    select: {
      id: true,
      subject: true,
      status: true,
      createdAt: true,
      user: { select: { email: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    subject: r.subject,
    status: r.status,
    createdAt: r.createdAt,
    userEmail: r.user.email,
  }));
}

export async function countOpenTickets(): Promise<number> {
  return prisma.ticket.count({ where: { status: { in: ['open', 'in_progress'] } } });
}

export async function fetchTicketById(id: string) {
  return prisma.ticket.findUnique({
    where: { id },
    select: {
      id: true,
      subject: true,
      status: true,
      messages: true,
      userId: true,
      user: { select: { email: true } },
    },
  });
}

type TicketMessageItem = { role: 'user' | 'manager'; content: string; at: string };

function parseTicketMessages(raw: string): TicketMessageItem[] {
  try {
    const arr = JSON.parse(raw) as unknown[];
    return Array.isArray(arr)
      ? arr.filter(
          (m): m is TicketMessageItem =>
            typeof m === 'object' && m !== null && typeof (m as TicketMessageItem).content === 'string'
        )
      : [];
  } catch {
    return [];
  }
}

/** Добавить ответ менеджера к тикету (из портала или Telegram-бота). */
export async function postManagerTicketReply(
  ticketId: string,
  content: string
): Promise<{ ok: true; messages: TicketMessageItem[] } | { ok: false; error: string }> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { ok: false, error: 'Тикет не найден' };

  const messages = parseTicketMessages(ticket.messages);
  messages.push({ role: 'manager', content: content.trim(), at: new Date().toISOString() });

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      messages: JSON.stringify(messages),
      updatedAt: new Date(),
      status: ticket.status === 'open' ? 'in_progress' : ticket.status,
    },
  });

  return { ok: true, messages };
}

export type UserSearchRow = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  status: string;
  enrollments: number;
};

export type UserCardRow = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  status: string;
  telegramId: number | null;
  enrollments: { courseTitle: string; percent: number }[];
  lastOrder: { orderNumber: string; amount: number; status: string; paidAt: Date | null } | null;
};

export async function fetchUserCardByEmail(email: string): Promise<UserCardRow | null> {
  const emailNorm = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: emailNorm },
    select: {
      id: true,
      email: true,
      profile: { select: { displayName: true, role: true, status: true, telegramId: true } },
      enrollments: {
        where: { accessClosed: false },
        take: 5,
        orderBy: { enrolledAt: 'desc' },
        select: { course: { select: { title: true, scormManifest: true } }, completedAt: true, courseId: true },
      },
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { orderNumber: true, amount: true, status: true, paidAt: true },
      },
    },
  });
  if (!user) return null;

  const enrollmentRows: { courseTitle: string; percent: number }[] = [];
  for (const e of user.enrollments) {
    const totalLessons = parseScormLessonCount(e.course.scormManifest);
    const progress = await prisma.scormProgress.count({
      where: {
        userId: user.id,
        courseId: e.courseId,
        completionStatus: { in: ['completed', 'passed'] },
      },
    });
    const percent = totalLessons > 0 ? Math.min(100, Math.round((progress / totalLessons) * 100)) : 0;
    enrollmentRows.push({ courseTitle: e.course.title, percent });
  }

  const last = user.orders[0];
  return {
    id: user.id,
    email: user.email,
    displayName: user.profile?.displayName ?? null,
    role: user.profile?.role ?? 'user',
    status: user.profile?.status ?? 'active',
    telegramId: user.profile?.telegramId ?? null,
    enrollments: enrollmentRows,
    lastOrder: last
      ? { orderNumber: last.orderNumber, amount: last.amount, status: last.status, paidAt: last.paidAt }
      : null,
  };
}

export type DigestStats = AdminStats & {
  newUsersToday: number;
  ticketsCreatedToday: number;
  revenueToday: number;
  registrationsWeek: number;
};

export async function fetchDigestStats(): Promise<DigestStats> {
  const base = await fetchAdminStats();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const weekAgo = new Date(startOfDay);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [newUsersToday, ticketsCreatedToday, paidToday, registrationsWeek] = await Promise.all([
    prisma.profile.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.ticket.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.order.findMany({
      where: { status: 'paid', paidAt: { gte: startOfDay } },
      select: { amount: true },
    }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
  ]);

  const revenueToday = paidToday.reduce((s, o) => s + o.amount, 0);
  return {
    ...base,
    newUsersToday,
    ticketsCreatedToday,
    revenueToday,
    registrationsWeek,
  };
}

export async function searchUsersByEmail(query: string, limit = 5): Promise<UserSearchRow[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const users = await prisma.user.findMany({
    where: { email: { contains: q } },
    take: limit,
    select: {
      id: true,
      email: true,
      profile: { select: { displayName: true, role: true, status: true } },
      _count: { select: { enrollments: true } },
    },
  });
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    displayName: u.profile?.displayName ?? null,
    role: u.profile?.role ?? 'user',
    status: u.profile?.status ?? 'active',
    enrollments: u._count.enrollments,
  }));
}

export type CourseProgressRow = {
  courseTitle: string;
  completedLessons: number;
  totalLessons: number;
  percent: number;
  completedAt: Date | null;
};

function parseScormLessonCount(manifest: string | null): number {
  if (!manifest) return 0;
  try {
    const m = JSON.parse(manifest) as { items?: unknown[] };
    return Array.isArray(m.items) ? m.items.length : 0;
  } catch {
    return 0;
  }
}

export async function fetchUserCourseProgress(userId: string): Promise<CourseProgressRow[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId, accessClosed: false },
    include: { course: { select: { title: true, scormManifest: true } } },
    orderBy: { enrolledAt: 'desc' },
  });

  const result: CourseProgressRow[] = [];
  for (const e of enrollments) {
    const totalLessons = parseScormLessonCount(e.course.scormManifest);
    const progress = await prisma.scormProgress.findMany({
      where: {
        userId,
        courseId: e.courseId,
        completionStatus: { in: ['completed', 'passed'] },
      },
      select: { lessonId: true },
    });
    const completedLessons = progress.length;
    const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    result.push({
      courseTitle: e.course.title,
      completedLessons,
      totalLessons: totalLessons || completedLessons,
      percent: Math.min(100, percent),
      completedAt: e.completedAt,
    });
  }
  return result;
}

export type UserCertificateRow = {
  certNumber: string;
  courseTitle: string;
  issuedAt: Date;
  revokedAt: Date | null;
};

export async function fetchUserCertificates(userId: string): Promise<UserCertificateRow[]> {
  const rows = await prisma.certificate.findMany({
    where: { userId },
    orderBy: { issuedAt: 'desc' },
    take: 10,
    select: {
      certNumber: true,
      issuedAt: true,
      revokedAt: true,
      course: { select: { title: true } },
    },
  });
  return rows.map((r) => ({
    certNumber: r.certNumber,
    courseTitle: r.course.title,
    issuedAt: r.issuedAt,
    revokedAt: r.revokedAt,
  }));
}

export type UserTicketRow = {
  id: string;
  subject: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function fetchUserOpenTickets(userId: string): Promise<UserTicketRow[]> {
  return prisma.ticket.findMany({
    where: { userId, status: { in: ['open', 'in_progress'] } },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: { id: true, subject: true, status: true, createdAt: true, updatedAt: true },
  });
}

export async function fetchGuestTicketsByTelegramMeta(
  guestUserId: string,
  telegramChatId: number
): Promise<UserTicketRow[]> {
  const tag = `"telegramChatId":${telegramChatId}`;
  const tickets = await prisma.ticket.findMany({
    where: {
      userId: guestUserId,
      status: { in: ['open', 'in_progress'] },
      messages: { contains: tag },
    },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: { id: true, subject: true, status: true, createdAt: true, updatedAt: true },
  });
  return tickets;
}

export type PublishedCourseRow = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
};

export async function fetchPublishedCourses(): Promise<PublishedCourseRow[]> {
  return prisma.course.findMany({
    where: { status: 'published' },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, title: true, description: true, price: true },
  });
}

export type UserNotificationRow = {
  id: string;
  type: string;
  content: string;
  createdAt: Date;
  isRead: boolean;
};

export async function fetchUserNotifications(userId: string, limit = 5): Promise<UserNotificationRow[]> {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, type: true, content: true, createdAt: true, isRead: true },
  });
}

export type InstallmentScheduleRow = {
  orderNumber: string;
  partNumber: number;
  amountRub: number;
  status: string;
  scheduledAt: Date;
};

export async function fetchUserInstallmentSchedule(userId: string): Promise<InstallmentScheduleRow[]> {
  const plans = await prisma.installmentPlan.findMany({
    where: { order: { userId } },
    include: {
      order: { select: { orderNumber: true } },
      payments: { orderBy: { partNumber: 'asc' } },
    },
  });
  const rows: InstallmentScheduleRow[] = [];
  for (const plan of plans) {
    for (const p of plan.payments) {
      rows.push({
        orderNumber: plan.order.orderNumber,
        partNumber: p.partNumber,
        amountRub: p.amountRub,
        status: p.status,
        scheduledAt: p.scheduledAt,
      });
    }
  }
  return rows.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}

export type LatestTicketRow = {
  id: string;
  subject: string;
  userEmail: string;
  createdAt: Date;
};

export async function fetchLatestOpenTicket(): Promise<LatestTicketRow | null> {
  const ticket = await prisma.ticket.findFirst({
    where: { status: { in: ['open', 'in_progress'] } },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      subject: true,
      createdAt: true,
      user: { select: { email: true } },
    },
  });
  if (!ticket) return null;
  return {
    id: ticket.id,
    subject: ticket.subject,
    userEmail: ticket.user.email,
    createdAt: ticket.createdAt,
  };
}
