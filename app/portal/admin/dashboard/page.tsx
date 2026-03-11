/**
 * Admin dashboard: real metrics from DB, revenue and activity charts, quick actions, recent events.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/portal/Card';
import { DashboardCharts } from './DashboardCharts';
import { RecentEvents, type EventItem } from './RecentEvents';
import { QuickAccessSection } from './QuickAccessSection';

const PERIODS = [7, 30, 90] as const;

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Дашборд администратора</h1>
        <p className="mt-2 text-text-muted">База данных недоступна.</p>
      </div>
    );
  }

  const { period: periodStr } = await searchParams;
  const periodNum = Math.min(90, Math.max(7, Number(periodStr) || 30));
  const period = (PERIODS.includes(periodNum as 7 | 30 | 90) ? periodNum : 30) as 7 | 30 | 90;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - period);

  const [
    usersCount,
    coursesCount,
    paidOrders,
    paidOrdersByDay,
    ticketsCount,
    leadsCount,
    scormStarted,
    scormCertificates,
    scormAvgScore,
    scormProgressCount,
    enrollmentsInPeriod,
    certificatesInPeriod,
    recentPaidOrders,
    recentLeads,
    recentUsers,
  ] = await Promise.all([
    prisma.profile.count({ where: { status: 'active' } }),
    prisma.course.count(),
    prisma.order.findMany({
      where: { status: 'paid', paidAt: { gte: monthStart } },
      select: { amount: true },
    }),
    prisma.order.findMany({
      where: { status: 'paid', paidAt: { gte: periodStart } },
      select: { amount: true, paidAt: true, orderNumber: true, clientEmail: true },
    }),
    prisma.ticket.count({ where: { status: { in: ['open', 'in_progress'] } } }),
    prisma.lead.count({ where: { status: 'new' } }),
    prisma.scormProgress.groupBy({ by: ['userId'], where: {} }).then((r) => r.length),
    prisma.certificate.count(),
    prisma.scormProgress.aggregate({ _avg: { score: true }, where: { score: { not: null } } }),
    prisma.scormProgress.count(),
    prisma.enrollment.findMany({
      where: { enrolledAt: { gte: periodStart } },
      select: { enrolledAt: true },
    }),
    prisma.certificate.findMany({
      where: { issuedAt: { gte: periodStart } },
      select: { issuedAt: true },
    }),
    prisma.order.findMany({
      where: { status: 'paid' },
      orderBy: { paidAt: 'desc' },
      take: 10,
      select: { id: true, orderNumber: true, amount: true, clientEmail: true, paidAt: true },
    }),
    prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, name: true, phone: true, createdAt: true },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, email: true, createdAt: true },
    }),
  ]);

  const revenueMonth = paidOrders.reduce((s, o) => s + o.amount, 0);

  const byDay = paidOrdersByDay.reduce(
    (acc, o) => {
      const d = o.paidAt?.toISOString().slice(0, 10) ?? '';
      if (!d) return acc;
      if (!acc[d]) acc[d] = { revenue: 0, count: 0 };
      acc[d].revenue += o.amount;
      acc[d].count += 1;
      return acc;
    },
    {} as Record<string, { revenue: number; count: number }>
  );

  const enrollmentsByDay: Record<string, number> = {};
  const certificatesByDay: Record<string, number> = {};
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    enrollmentsByDay[key] = 0;
    certificatesByDay[key] = 0;
  }
  enrollmentsInPeriod.forEach((e) => {
    const key = e.enrolledAt.toISOString().slice(0, 10);
    if (enrollmentsByDay[key] !== undefined) enrollmentsByDay[key]++;
  });
  certificatesInPeriod.forEach((c) => {
    const key = c.issuedAt.toISOString().slice(0, 10);
    if (certificatesByDay[key] !== undefined) certificatesByDay[key]++;
  });

  const chartData: { date: string; revenue: number; count: number }[] = [];
  const activityData: { date: string; enrollments: number; certificates: number }[] = [];
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    chartData.push({
      date: key,
      revenue: byDay[key]?.revenue ?? 0,
      count: byDay[key]?.count ?? 0,
    });
    activityData.push({
      date: key,
      enrollments: enrollmentsByDay[key] ?? 0,
      certificates: certificatesByDay[key] ?? 0,
    });
  }

  const events: EventItem[] = [
    ...recentPaidOrders
      .filter((o) => o.paidAt)
      .map((o) => ({
        type: 'payment' as const,
        id: o.id,
        orderNumber: o.orderNumber ?? String(o.id),
        amount: o.amount,
        email: o.clientEmail ?? '',
        at: o.paidAt!.toISOString(),
      })),
    ...recentLeads.map((l) => ({
      type: 'lead' as const,
      id: l.id,
      name: l.name,
      phone: l.phone,
      at: l.createdAt.toISOString(),
    })),
    ...recentUsers.map((u) => ({
      type: 'user' as const,
      id: u.id,
      email: u.email,
      at: u.createdAt.toISOString(),
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        items={[{ label: 'Дашборд' }]}
        title="Дашборд администратора"
        description="Метрики и последние события"
      />
      <QuickAccessSection />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <p className="text-sm text-text-muted">Активных пользователей</p>
          <p className="text-2xl font-bold text-dark">{usersCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-muted">Курсов</p>
          <p className="text-2xl font-bold text-dark">{coursesCount}</p>
        </Card>
        <Card className="border-2 border-primary/30 bg-primary/5 shadow-sm">
          <p className="text-sm font-medium text-primary">Выручка (мес.)</p>
          <p className="text-3xl font-bold text-dark">{revenueMonth.toLocaleString('ru')} ₽</p>
        </Card>
        <Card>
          <p className="text-sm text-text-muted">Открытых тикетов</p>
          <p className="text-2xl font-bold text-dark">{ticketsCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-muted">Новых лидов</p>
          <p className="text-2xl font-bold text-dark">{leadsCount}</p>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-text-muted">SCORM: начали прохождение</p>
          <p className="text-2xl font-bold text-dark">{scormStarted}</p>
          <p className="text-xs text-text-muted">уникальных пользователей</p>
        </Card>
        <Card>
          <p className="text-sm text-text-muted">Сертификатов выдано</p>
          <p className="text-2xl font-bold text-dark">{scormCertificates}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-muted">Средний балл (SCORM)</p>
          <p className="text-2xl font-bold text-dark">
            {scormAvgScore._avg.score != null ? Math.round(scormAvgScore._avg.score) : '—'}%
          </p>
        </Card>
        <Card>
          <p className="text-sm text-text-muted">Записей прогресса</p>
          <p className="text-2xl font-bold text-dark">{scormProgressCount}</p>
        </Card>
      </div>

      <DashboardCharts revenueData={chartData} activityData={activityData} />
      <RecentEvents events={events} />
    </div>
  );
}
