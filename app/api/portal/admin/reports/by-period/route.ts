/**
 * Admin: отчёт по периоду — динамика по дням (зачисления, завершения, сертификаты, оплаты).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { parseReportPeriod } from '@/lib/reports';

function getDaysInRange(from: Date, to: Date): string[] {
  const days: string[] = [];
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { dateFrom, dateTo } = parseReportPeriod(request.nextUrl.searchParams);
  const from = new Date(dateFrom);
  from.setHours(0, 0, 0, 0);
  const to = new Date(dateTo);
  to.setHours(23, 59, 59, 999);

  const days = getDaysInRange(from, to);

  const [enrollments, completions, certificates, orders] = await Promise.all([
    prisma.enrollment.findMany({
      where: { enrolledAt: { gte: from, lte: to } },
      select: { enrolledAt: true },
    }),
    prisma.enrollment.findMany({
      where: { completedAt: { gte: from, lte: to } },
      select: { completedAt: true },
    }),
    prisma.certificate.findMany({
      where: { revokedAt: null, issuedAt: { gte: from, lte: to } },
      select: { issuedAt: true },
    }),
    prisma.order.findMany({
      where: { status: 'paid', paidAt: { gte: from, lte: to } },
      select: { paidAt: true, amount: true },
    }),
  ]);

  const enrollByDay = new Map<string, number>();
  const completeByDay = new Map<string, number>();
  const certByDay = new Map<string, number>();
  const ordersByDay = new Map<string, { count: number; sum: number }>();

  days.forEach((d) => {
    enrollByDay.set(d, 0);
    completeByDay.set(d, 0);
    certByDay.set(d, 0);
    ordersByDay.set(d, { count: 0, sum: 0 });
  });

  enrollments.forEach((e) => {
    const key = new Date(e.enrolledAt).toISOString().slice(0, 10);
    if (enrollByDay.has(key)) enrollByDay.set(key, (enrollByDay.get(key) ?? 0) + 1);
  });
  completions.forEach((c) => {
    const key = new Date(c.completedAt!).toISOString().slice(0, 10);
    if (completeByDay.has(key)) completeByDay.set(key, (completeByDay.get(key) ?? 0) + 1);
  });
  certificates.forEach((cert) => {
    const key = new Date(cert.issuedAt).toISOString().slice(0, 10);
    if (certByDay.has(key)) certByDay.set(key, (certByDay.get(key) ?? 0) + 1);
  });
  orders.forEach((o) => {
    const key = o.paidAt ? new Date(o.paidAt).toISOString().slice(0, 10) : '';
    if (ordersByDay.has(key)) {
      const v = ordersByDay.get(key)!;
      v.count += 1;
      v.sum += o.amount ?? 0;
      ordersByDay.set(key, v);
    }
  });

  const rows = days.map((dateStr) => ({
    date: dateStr,
    enrollments: enrollByDay.get(dateStr) ?? 0,
    completions: completeByDay.get(dateStr) ?? 0,
    certificates: certByDay.get(dateStr) ?? 0,
    ordersCount: ordersByDay.get(dateStr)?.count ?? 0,
    revenue: ordersByDay.get(dateStr)?.sum ?? 0,
  }));

  const totals = {
    enrollments: rows.reduce((s, r) => s + r.enrollments, 0),
    completions: rows.reduce((s, r) => s + r.completions, 0),
    certificates: rows.reduce((s, r) => s + r.certificates, 0),
    ordersCount: rows.reduce((s, r) => s + r.ordersCount, 0),
    revenue: rows.reduce((s, r) => s + r.revenue, 0),
  };

  return NextResponse.json({
    period: { dateFrom: from.toISOString(), dateTo: to.toISOString() },
    rows,
    totals,
  });
}
