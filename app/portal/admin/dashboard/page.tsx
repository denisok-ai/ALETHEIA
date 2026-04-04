/**
 * Admin dashboard: real metrics from DB, revenue and activity charts, quick actions, recent events.
 */
import type { Metadata } from 'next';
import nextDynamic from 'next/dynamic';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { RecentEvents, type EventItem } from './RecentEvents';
import { QuickAccessSection } from './QuickAccessSection';

export const metadata: Metadata = { title: 'Дашборд' };

/** Не кешировать как статику: иначе возможен пустой/устаревший RSC при смене сессии. */
export const dynamic = 'force-dynamic';

const PERIODS = [7, 30, 90] as const;

type SearchParamsInput = Promise<{ period?: string }> | { period?: string };

async function resolveSearchParams(sp: SearchParamsInput | undefined): Promise<{ period?: string }> {
  if (sp == null) return {};
  if (typeof sp === 'object' && sp !== null && 'then' in sp && typeof (sp as Promise<unknown>).then === 'function') {
    return (await sp) ?? {};
  }
  return sp as { period?: string };
}

function DashboardChartsFallback() {
  return (
    <div className="mt-6 space-y-6" aria-busy="true" aria-label="Загрузка графиков">
      <div className="h-10 w-full max-w-xl animate-pulse rounded-lg bg-[#E2E8F0]" />
      <div className="portal-card h-72 animate-pulse rounded-xl bg-[#F1F5F9] md:h-80" />
      <div className="portal-card h-72 animate-pulse rounded-xl bg-[#F1F5F9] md:h-80" />
    </div>
  );
}

/** Recharts + useSearchParams без SSR — иначе возможен 500 на проде при потоковом рендере RSC. */
const DashboardCharts = nextDynamic(
  () => import('./DashboardCharts').then((m) => ({ default: m.DashboardCharts })),
  { ssr: false, loading: () => <DashboardChartsFallback /> }
);

async function loadDashboardMetrics(period: 7 | 30 | 90) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - period);

  // Уникальные слушатели SCORM: groupBy по userId стабильнее на PostgreSQL, чем findMany+distinct.
  const scormUserGroups = await prisma.scormProgress.groupBy({
    by: ['userId'],
    _count: { _all: true },
  });
  const scormStarted = scormUserGroups.length;

  const [
    usersCount,
    coursesCount,
    paidOrders,
    paidOrdersByDay,
    ticketsCount,
    leadsCount,
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

  return {
    now,
    period,
    monthStart,
    periodStart,
    scormStarted,
    usersCount,
    coursesCount,
    paidOrders,
    paidOrdersByDay,
    ticketsCount,
    leadsCount,
    scormCertificates,
    scormAvgScore,
    scormProgressCount,
    enrollmentsInPeriod,
    certificatesInPeriod,
    recentPaidOrders,
    recentLeads,
    recentUsers,
  };
}

export default async function AdminDashboardPage({ searchParams }: { searchParams: SearchParamsInput }) {
  const sp = await resolveSearchParams(searchParams);
  const periodStr = sp.period;
  const periodNum = Math.min(90, Math.max(7, Number(periodStr) || 30));
  const period = (PERIODS.includes(periodNum as 7 | 30 | 90) ? periodNum : 30) as 7 | 30 | 90;

  let data: Awaited<ReturnType<typeof loadDashboardMetrics>>;
  try {
    data = await loadDashboardMetrics(period);
  } catch (err) {
    const digest = err instanceof Error && 'digest' in err ? String((err as Error & { digest?: string }).digest) : '';
    console.error('[portal/admin/dashboard] loadDashboardMetrics failed', err);
    return (
      <div className="max-w-2xl space-y-4 p-6">
        <PageHeader items={[{ label: 'Дашборд' }]} title="Дашборд" description="Ошибка загрузки данных" />
        <div className="portal-card border border-red-200 bg-red-50/80 p-5 text-sm text-red-900">
          <p className="font-semibold">Не удалось загрузить метрики</p>
          <p className="mt-2 text-red-800/90">
            Проверьте подключение к БД, миграции Prisma и логи процесса Node (journalctl / pm2 logs). После исправления
            обновите страницу.
          </p>
          {digest ? <p className="mt-2 font-mono text-xs opacity-80">digest: {digest}</p> : null}
        </div>
      </div>
    );
  }

  const {
    now,
    paidOrders,
    paidOrdersByDay,
    usersCount,
    coursesCount,
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
  } = data;

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
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        items={[{ label: 'Дашборд' }]}
        title="Дашборд"
        description="Сводная аналитика и последние события"
      />

      <QuickAccessSection />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <div
          className="portal-card p-5 col-span-2 lg:col-span-1 flex items-center gap-4"
          style={{
            background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
            borderColor: '#C7D2FE',
          }}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#6366F1] text-white shadow-sm">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M10.75 10.818v2.614A3.13 3.13 0 0011.888 13c.482-.315.612-.648.612-.875 0-.227-.13-.56-.612-.875a3.13 3.13 0 00-1.138-.432zM8.33 8.62c.053.055.115.11.182.160.198.144.447.257.706.358V7.249a2.032 2.032 0 00-.892.5zM10 1a9 9 0 100 18A9 9 0 0010 1zm.75 4.495v.73a3.54 3.54 0 011.516.559c.481.304 1.234.94 1.234 2.216 0 1.275-.753 1.912-1.234 2.216a3.54 3.54 0 01-1.516.559v.73a.75.75 0 01-1.5 0v-.73a3.54 3.54 0 01-1.516-.56C7.253 11.912 6.5 11.275 6.5 10c0-1.275.753-1.912 1.234-2.215a3.54 3.54 0 011.516-.56v-.73a.75.75 0 011.5 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#4338CA] mb-0.5">Выручка (мес.)</p>
            <p className="text-2xl font-bold text-[var(--portal-text)]">{revenueMonth.toLocaleString('ru')} ₽</p>
          </div>
        </div>

        <div className="portal-metric">
          <p className="text-xs text-[var(--portal-text-muted)] mb-1">Пользователей</p>
          <p className="text-2xl font-bold text-[var(--portal-text)]">{usersCount}</p>
        </div>
        <div className="portal-metric">
          <p className="text-xs text-[var(--portal-text-muted)] mb-1">Курсов</p>
          <p className="text-2xl font-bold text-[var(--portal-text)]">{coursesCount}</p>
        </div>
        <div className="portal-metric">
          <p className="text-xs text-[var(--portal-text-muted)] mb-1">Открытых тикетов</p>
          <p className="text-2xl font-bold text-[var(--portal-text)]">{ticketsCount}</p>
          {ticketsCount > 0 && (
            <span className="mt-1 status-badge badge-warn">{ticketsCount} требуют ответа</span>
          )}
        </div>
        <div className="portal-metric">
          <p className="text-xs text-[var(--portal-text-muted)] mb-1">Новых лидов</p>
          <p className="text-2xl font-bold text-[var(--portal-text)]">{leadsCount}</p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="portal-metric">
          <p className="text-xs text-[var(--portal-text-muted)] mb-1">Начали обучение</p>
          <p className="text-2xl font-bold text-[var(--portal-text)]">{scormStarted}</p>
          <p className="text-xs text-[var(--portal-text-soft)]">уникальных слушателей</p>
        </div>
        <div className="portal-metric">
          <p className="text-xs text-[var(--portal-text-muted)] mb-1">Сертификатов</p>
          <p className="text-2xl font-bold text-[var(--portal-text)]">{scormCertificates}</p>
        </div>
        <div className="portal-metric">
          <p className="text-xs text-[var(--portal-text-muted)] mb-1">Средний балл</p>
          <p className="text-2xl font-bold text-[var(--portal-text)]">
            {scormAvgScore._avg.score != null ? `${Math.round(scormAvgScore._avg.score)}%` : '—'}
          </p>
        </div>
        <div className="portal-metric">
          <p className="text-xs text-[var(--portal-text-muted)] mb-1">Записей прогресса</p>
          <p className="text-2xl font-bold text-[var(--portal-text)]">{scormProgressCount}</p>
        </div>
      </div>

      <DashboardCharts revenueData={chartData} activityData={activityData} />
      <RecentEvents events={events} />
    </div>
  );
}
