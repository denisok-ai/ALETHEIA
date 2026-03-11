'use client';

/**
 * Формы отчётов: выбор типа, период, таблицы, экспорт CSV.
 */
import { useState, useCallback, useEffect } from 'react';
import { Card } from '@/components/portal/Card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { BarChart3, BookOpen, Users, Calendar, Download, List } from 'lucide-react';
import { format } from 'date-fns';

type ReportType = 'summary' | 'by-course' | 'by-learner' | 'by-period' | 'course-learners';

interface CourseOption {
  courseId: string;
  title: string;
}

interface CourseLearnerRow {
  userId: string;
  displayName: string;
  email: string;
  enrolledAt: string;
  accessClosed: boolean;
  completedAt: string | null;
  progressPercent: number;
  avgScore: number | null;
  timeSpentMinutes: number;
  hasCertificate: boolean;
}

function dateToParam(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function csvEscape(value: unknown): string {
  const s = String(value ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ReportsClient() {
  const [reportType, setReportType] = useState<ReportType>('summary');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return dateToParam(d);
  });
  const [dateTo, setDateTo] = useState(() => dateToParam(new Date()));
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [byCourse, setByCourse] = useState<{ rows: Record<string, unknown>[] } | null>(null);
  const [byLearner, setByLearner] = useState<{ rows: Record<string, unknown>[] } | null>(null);
  const [byPeriod, setByPeriod] = useState<{ rows: Record<string, unknown>[]; totals: Record<string, number> } | null>(null);
  const [courseLearners, setCourseLearners] = useState<{
    courseId: string;
    courseTitle: string;
    rows: CourseLearnerRow[];
  } | null>(null);
  const [courseList, setCourseList] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');

  useEffect(() => {
    if (reportType !== 'course-learners') return;
    let cancelled = false;
    const load = async () => {
      const params = new URLSearchParams({
        dateFrom: '2000-01-01',
        dateTo: new Date().toISOString().slice(0, 10),
      });
      const r = await fetch(`/api/portal/admin/reports/by-course?${params}`);
      const data = await r.json();
      if (cancelled) return;
      if (data.rows?.length) {
        setCourseList(data.rows.map((row: Record<string, unknown>) => ({ courseId: row.courseId as string, title: row.title as string })));
        setSelectedCourseId((prev) => (prev ? prev : (data.rows[0] as Record<string, unknown>).courseId as string));
      } else {
        setCourseList([]);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [reportType]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ dateFrom, dateTo });
      if (reportType === 'by-course' && statusFilter !== 'all') params.set('status', statusFilter);
      if (reportType === 'by-learner' && roleFilter !== 'all') params.set('role', roleFilter);

      if (reportType === 'summary') {
        const r = await fetch(`/api/portal/admin/reports/summary?${params}`);
        const data = await r.json();
        setSummary(data);
        setByCourse(null);
        setByLearner(null);
        setByPeriod(null);
        setCourseLearners(null);
      } else if (reportType === 'course-learners' && selectedCourseId) {
        const r = await fetch(`/api/portal/admin/reports/course/${selectedCourseId}/learners`);
        const data = await r.json();
        if (r.ok) setCourseLearners({ courseId: data.courseId, courseTitle: data.courseTitle, rows: data.rows ?? [] });
        else setCourseLearners(null);
        setSummary(null);
        setByCourse(null);
        setByLearner(null);
        setByPeriod(null);
      } else if (reportType === 'by-course') {
        const r = await fetch(`/api/portal/admin/reports/by-course?${params}`);
        const data = await r.json();
        setByCourse(data);
        setSummary(null);
        setByLearner(null);
        setByPeriod(null);
        setCourseLearners(null);
      } else if (reportType === 'by-learner') {
        const r = await fetch(`/api/portal/admin/reports/by-learner?${params}`);
        const data = await r.json();
        setByLearner(data);
        setSummary(null);
        setByCourse(null);
        setByPeriod(null);
        setCourseLearners(null);
      } else {
        const r = await fetch(`/api/portal/admin/reports/by-period?${params}`);
        const data = await r.json();
        setByPeriod(data);
        setSummary(null);
        setByCourse(null);
        setByLearner(null);
        setCourseLearners(null);
      }
    } finally {
      setLoading(false);
    }
  }, [reportType, dateFrom, dateTo, statusFilter, roleFilter, selectedCourseId]);

  const exportCsv = useCallback(() => {
    if (reportType === 'by-course' && byCourse?.rows?.length) {
      const cols = ['title', 'status', 'enrolled', 'accessOpen', 'completed', 'completionRatePercent', 'certificates', 'avgScore', 'timeSpentMinutes'];
      const header = ['Курс', 'Статус', 'Зачислено', 'Доступ открыт', 'Завершило', '% завершения', 'Сертификатов', 'Средний балл', 'Время (мин)'];
      const rows = byCourse.rows.map((row) => cols.map((c) => (row as Record<string, unknown>)[c]));
      const csv = '\uFEFF' + header.map(csvEscape).join(',') + '\n' + rows.map((r) => r.map(csvEscape).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `report-by-course-${dateFrom}-${dateTo}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } else if (reportType === 'by-learner' && byLearner?.rows?.length) {
      const cols = ['displayName', 'email', 'role', 'enrolled', 'inProgress', 'completed', 'certificates', 'lastActivity', 'timeSpentMinutes'];
      const header = ['Слушатель', 'Email', 'Роль', 'Зачислено', 'В процессе', 'Завершено', 'Сертификатов', 'Последняя активность', 'Время (мин)'];
      const rows = byLearner.rows.map((row) => cols.map((c) => (row as Record<string, unknown>)[c]));
      const csv = '\uFEFF' + header.map(csvEscape).join(',') + '\n' + rows.map((r) => r.map(csvEscape).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `report-by-learner-${dateFrom}-${dateTo}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } else if (reportType === 'by-period' && byPeriod?.rows?.length) {
      const header = ['Дата', 'Зачислений', 'Завершений', 'Сертификатов', 'Оплат', 'Сумма (₽)'];
      const rows = byPeriod.rows.map((r) => [
        (r as Record<string, unknown>).date,
        (r as Record<string, unknown>).enrollments,
        (r as Record<string, unknown>).completions,
        (r as Record<string, unknown>).certificates,
        (r as Record<string, unknown>).ordersCount,
        (r as Record<string, unknown>).revenue,
      ]);
      const csv = '\uFEFF' + header.map(csvEscape).join(',') + '\n' + rows.map((r) => r.map(csvEscape).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `report-by-period-${dateFrom}-${dateTo}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } else if (reportType === 'summary' && summary?.summary) {
      const s = summary.summary as Record<string, unknown>;
      const header = ['Показатель', 'Значение'];
      const rowNames = [
        'usersActive', 'coursesTotal', 'coursesPublished', 'enrollmentsTotal', 'enrollmentsCompletedTotal',
        'completionRatePercent', 'certificatesTotal', 'enrollmentsInPeriod', 'completedInPeriod', 'revenueInPeriod',
      ];
      const labels: Record<string, string> = {
        usersActive: 'Активных пользователей',
        coursesTotal: 'Курсов всего',
        coursesPublished: 'Курсов опубликовано',
        enrollmentsTotal: 'Зачислений всего',
        enrollmentsCompletedTotal: 'Завершило обучение',
        completionRatePercent: '% завершения',
        certificatesTotal: 'Сертификатов выдано',
        enrollmentsInPeriod: 'За период: зачислений',
        completedInPeriod: 'За период: завершений',
        revenueInPeriod: 'За период: выручка (₽)',
      };
      const rows = rowNames.map((k) => [labels[k] ?? k, String(s[k] ?? '')]);
      const csv = '\uFEFF' + header.map(csvEscape).join(',') + '\n' + rows.map((r) => r.map(csvEscape).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `report-summary-${dateFrom}-${dateTo}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } else if (reportType === 'course-learners' && courseLearners?.rows?.length) {
      const header = ['Слушатель', 'Email', 'Зачислен', 'Доступ', 'Завершён', 'Прогресс %', 'Балл', 'Время (мин)', 'Сертификат'];
      const rows = courseLearners.rows.map((r) => [
        r.displayName,
        r.email,
        r.enrolledAt.slice(0, 10),
        r.accessClosed ? 'Закрыт' : 'Открыт',
        r.completedAt ? r.completedAt.slice(0, 10) : '—',
        r.progressPercent,
        r.avgScore ?? '—',
        r.timeSpentMinutes,
        r.hasCertificate ? 'Да' : 'Нет',
      ]);
      const csv = '\uFEFF' + header.map(csvEscape).join(',') + '\n' + rows.map((r) => r.map(csvEscape).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `report-course-learners-${courseLearners.courseId}-${dateToParam(new Date())}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  }, [reportType, byCourse, byLearner, byPeriod, summary, courseLearners, dateFrom, dateTo]);

  const tabs = [
    { id: 'summary' as const, label: 'Сводка', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'by-course' as const, label: 'По курсам', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'by-learner' as const, label: 'По слушателям', icon: <Users className="h-4 w-4" /> },
    { id: 'by-period' as const, label: 'По периоду', icon: <Calendar className="h-4 w-4" /> },
    { id: 'course-learners' as const, label: 'Слушатели курса', icon: <List className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex gap-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setReportType(t.id)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  reportType === t.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-white text-text-muted hover:bg-bg-soft'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-text-muted">
              С
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded border border-border bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-text-muted">
              По
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded border border-border bg-white px-2 py-1.5 text-sm"
              />
            </label>
            {reportType === 'by-course' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded border border-border bg-white px-2 py-1.5 text-sm"
              >
                <option value="all">Все курсы</option>
                <option value="published">Опубликованные</option>
                <option value="draft">В разработке</option>
                <option value="archived">В архиве</option>
              </select>
            )}
            {reportType === 'by-learner' && (
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded border border-border bg-white px-2 py-1.5 text-sm"
              >
                <option value="all">Все роли</option>
                <option value="user">Слушатели</option>
                <option value="manager">Менеджеры</option>
                <option value="admin">Администраторы</option>
              </select>
            )}
            {reportType === 'course-learners' && (
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="rounded border border-border bg-white px-2 py-1.5 text-sm min-w-[200px]"
              >
                <option value="">— Выберите курс —</option>
                {courseList.map((c) => (
                  <option key={c.courseId} value={c.courseId}>{c.title}</option>
                ))}
              </select>
            )}
            <Button onClick={fetchReport} disabled={loading || (reportType === 'course-learners' && !selectedCourseId)}>
              {loading ? 'Загрузка…' : 'Сформировать'}
            </Button>
            {((reportType === 'summary' && summary?.summary) ||
              (reportType === 'by-course' && byCourse?.rows?.length) ||
              (reportType === 'by-learner' && byLearner?.rows?.length) ||
              (reportType === 'by-period' && byPeriod?.rows?.length) ||
              (reportType === 'course-learners' && courseLearners?.rows?.length)) && (
              <Button variant="secondary" onClick={exportCsv}>
                <Download className="mr-2 h-4 w-4" />
                Экспорт CSV
              </Button>
            )}
          </div>
        </div>
      </Card>

      {summary && summary.summary != null && (() => {
        const s = summary.summary as Record<string, unknown>;
        return (
          <Card className="p-6">
            <h3 className="mb-4 font-heading text-lg font-semibold text-dark">Сводные показатели</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-bg-soft p-4">
                <p className="text-xs font-medium uppercase text-text-muted">Активных пользователей</p>
                <p className="mt-1 text-2xl font-bold text-dark">{s.usersActive as number}</p>
              </div>
              <div className="rounded-lg border border-border bg-bg-soft p-4">
                <p className="text-xs font-medium uppercase text-text-muted">Курсов (всего / опубл.)</p>
                <p className="mt-1 text-2xl font-bold text-dark">{s.coursesTotal as number} / {s.coursesPublished as number}</p>
              </div>
              <div className="rounded-lg border border-border bg-bg-soft p-4">
                <p className="text-xs font-medium uppercase text-text-muted">Зачислений всего</p>
                <p className="mt-1 text-2xl font-bold text-dark">{s.enrollmentsTotal as number}</p>
              </div>
              <div className="rounded-lg border border-border bg-bg-soft p-4">
                <p className="text-xs font-medium uppercase text-text-muted">Завершило обучение</p>
                <p className="mt-1 text-2xl font-bold text-dark">{s.enrollmentsCompletedTotal as number}</p>
              </div>
              <div className="rounded-lg border border-border bg-bg-soft p-4">
                <p className="text-xs font-medium uppercase text-text-muted">% завершения</p>
                <p className="mt-1 text-2xl font-bold text-dark">{s.completionRatePercent as number}%</p>
              </div>
              <div className="rounded-lg border border-border bg-bg-soft p-4">
                <p className="text-xs font-medium uppercase text-text-muted">Сертификатов выдано</p>
                <p className="mt-1 text-2xl font-bold text-dark">{s.certificatesTotal as number}</p>
              </div>
              <div className="rounded-lg border border-border bg-bg-soft p-4">
                <p className="text-xs font-medium uppercase text-text-muted">За период: зачислений</p>
                <p className="mt-1 text-2xl font-bold text-dark">{s.enrollmentsInPeriod as number}</p>
              </div>
              <div className="rounded-lg border border-border bg-bg-soft p-4">
                <p className="text-xs font-medium uppercase text-text-muted">За период: завершений</p>
                <p className="mt-1 text-2xl font-bold text-dark">{s.completedInPeriod as number}</p>
              </div>
              <div className="rounded-lg border border-border bg-bg-soft p-4">
                <p className="text-xs font-medium uppercase text-text-muted">За период: выручка (₽)</p>
                <p className="mt-1 text-2xl font-bold text-dark">{s.revenueInPeriod as number}</p>
              </div>
            </div>
          </Card>
        );
      })()}

      {byCourse?.rows && byCourse.rows.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Курс</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Зачислено</TableHead>
                  <TableHead className="text-right">Доступ открыт</TableHead>
                  <TableHead className="text-right">Завершило</TableHead>
                  <TableHead className="text-right">% завершения</TableHead>
                  <TableHead className="text-right">Сертификатов</TableHead>
                  <TableHead className="text-right">Средний балл</TableHead>
                  <TableHead className="text-right">Время (мин)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byCourse.rows.map((row) => (
                  <TableRow key={String((row as Record<string, unknown>).courseId)}>
                    <TableCell className="font-medium">{(row as Record<string, unknown>).title as string}</TableCell>
                    <TableCell className="text-text-muted">{(row as Record<string, unknown>).status as string}</TableCell>
                    <TableCell className="text-right">{(row as Record<string, unknown>).enrolled as number}</TableCell>
                    <TableCell className="text-right">{(row as Record<string, unknown>).accessOpen as number}</TableCell>
                    <TableCell className="text-right">{(row as Record<string, unknown>).completed as number}</TableCell>
                    <TableCell className="text-right">{(row as Record<string, unknown>).completionRatePercent as number}%</TableCell>
                    <TableCell className="text-right">{(row as Record<string, unknown>).certificates as number}</TableCell>
                    <TableCell className="text-right">{String((row as Record<string, unknown>).avgScore ?? '—')}</TableCell>
                    <TableCell className="text-right">{(row as Record<string, unknown>).timeSpentMinutes as number}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {byLearner?.rows && byLearner.rows.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Слушатель</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead className="text-right">Зачислено</TableHead>
                  <TableHead className="text-right">В процессе</TableHead>
                  <TableHead className="text-right">Завершено</TableHead>
                  <TableHead className="text-right">Сертификатов</TableHead>
                  <TableHead>Последняя активность</TableHead>
                  <TableHead className="text-right">Время (мин)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byLearner.rows.map((row) => (
                  <TableRow key={String((row as Record<string, unknown>).userId)}>
                    <TableCell className="font-medium">{(row as Record<string, unknown>).displayName as string}</TableCell>
                    <TableCell className="text-text-muted">{(row as Record<string, unknown>).email as string}</TableCell>
                    <TableCell className="text-text-muted">{(row as Record<string, unknown>).role as string}</TableCell>
                    <TableCell className="text-right">{(row as Record<string, unknown>).enrolled as number}</TableCell>
                    <TableCell className="text-right">{(row as Record<string, unknown>).inProgress as number}</TableCell>
                    <TableCell className="text-right">{(row as Record<string, unknown>).completed as number}</TableCell>
                    <TableCell className="text-right">{(row as Record<string, unknown>).certificates as number}</TableCell>
                    <TableCell className="text-text-muted text-sm">
                      {(row as Record<string, unknown>).lastActivity
                        ? format(new Date((row as Record<string, unknown>).lastActivity as string), 'dd.MM.yyyy HH:mm')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">{(row as Record<string, unknown>).timeSpentMinutes as number}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {byPeriod?.rows && byPeriod.rows.length > 0 && (
        <Card className="overflow-hidden p-0">
          {byPeriod.totals && (
            <div className="border-b border-border bg-bg-soft px-4 py-2 text-sm font-medium text-dark">
              Итого за период: зачислений {byPeriod.totals.enrollments}, завершений {byPeriod.totals.completions}, сертификатов {byPeriod.totals.certificates}, оплат {byPeriod.totals.ordersCount}, выручка {byPeriod.totals.revenue} ₽
            </div>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead className="text-right">Зачислений</TableHead>
                  <TableHead className="text-right">Завершений</TableHead>
                  <TableHead className="text-right">Сертификатов</TableHead>
                  <TableHead className="text-right">Оплат</TableHead>
                  <TableHead className="text-right">Сумма (₽)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byPeriod.rows.map((row) => (
                  <TableRow key={String((row as Record<string, unknown>).date)}>
                    <TableCell className="font-medium">{(row as Record<string, unknown>).date as string}</TableCell>
                    <TableCell className="text-right">{(row as Record<string, unknown>).enrollments as number}</TableCell>
                    <TableCell className="text-right">{(row as Record<string, unknown>).completions as number}</TableCell>
                    <TableCell className="text-right">{(row as Record<string, unknown>).certificates as number}</TableCell>
                    <TableCell className="text-right">{(row as Record<string, unknown>).ordersCount as number}</TableCell>
                    <TableCell className="text-right">{(row as Record<string, unknown>).revenue as number}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {courseLearners && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border bg-bg-soft px-4 py-2 text-sm font-medium text-dark">
            Курс: {courseLearners.courseTitle}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Слушатель</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Зачислен</TableHead>
                  <TableHead>Доступ</TableHead>
                  <TableHead>Завершён</TableHead>
                  <TableHead className="text-right">Прогресс %</TableHead>
                  <TableHead className="text-right">Балл</TableHead>
                  <TableHead className="text-right">Время (мин)</TableHead>
                  <TableHead>Сертификат</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courseLearners.rows.map((r) => (
                  <TableRow key={r.userId}>
                    <TableCell className="font-medium">{r.displayName}</TableCell>
                    <TableCell className="text-text-muted">{r.email}</TableCell>
                    <TableCell className="text-sm">{r.enrolledAt.slice(0, 10)}</TableCell>
                    <TableCell>{r.accessClosed ? 'Закрыт' : 'Открыт'}</TableCell>
                    <TableCell className="text-sm">{r.completedAt ? r.completedAt.slice(0, 10) : '—'}</TableCell>
                    <TableCell className="text-right">{r.progressPercent}%</TableCell>
                    <TableCell className="text-right">{r.avgScore ?? '—'}</TableCell>
                    <TableCell className="text-right">{r.timeSpentMinutes}</TableCell>
                    <TableCell>{r.hasCertificate ? 'Да' : 'Нет'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {!loading && !summary?.summary && !byCourse?.rows?.length && !byLearner?.rows?.length && !byPeriod?.rows?.length && !courseLearners?.rows?.length && (
        <p className="text-center text-text-muted">Выберите тип отчёта и нажмите «Сформировать».</p>
      )}
    </div>
  );
}
