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
import { BarChart3, BookOpen, Users, Calendar, Download, List, FileSpreadsheet, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { formatRub, formatIsoDateRu, formatIsoDayMonth } from '@/lib/format-ru';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { downloadXlsxFromArrays } from '@/lib/export-xlsx';
import { toast } from 'sonner';

type ReportType =
  | 'summary'
  | 'by-course'
  | 'by-learner'
  | 'by-period'
  | 'course-learners'
  | 'group-intersection';

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

interface GroupOption {
  id: string;
  name: string;
}

interface GroupIntersectionRow {
  userId: string;
  displayName: string;
  email: string;
  courseId: string;
  courseTitle: string;
  enrolledAt: string;
  completedAt: string | null;
  accessClosed: boolean;
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
  const [userGroups, setUserGroups] = useState<GroupOption[]>([]);
  const [courseGroups, setCourseGroups] = useState<GroupOption[]>([]);
  const [userGroupId, setUserGroupId] = useState('');
  const [courseGroupId, setCourseGroupId] = useState('');
  const [groupIntersection, setGroupIntersection] = useState<{ rows: GroupIntersectionRow[] } | null>(null);

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

  useEffect(() => {
    if (reportType !== 'group-intersection') return;
    let cancelled = false;
    Promise.all([
      fetch('/api/portal/admin/groups?moduleType=user').then((r) => r.json()),
      fetch('/api/portal/admin/groups?moduleType=course').then((r) => r.json()),
    ])
      .then(([ud, cd]) => {
        if (cancelled) return;
        setUserGroups((ud.groups ?? []).map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })));
        setCourseGroups((cd.groups ?? []).map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })));
      })
      .catch(() => {
        if (!cancelled) {
          setUserGroups([]);
          setCourseGroups([]);
        }
      });
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
        if (!r.ok) {
          toast.error(typeof data.error === 'string' ? data.error : 'Ошибка отчёта');
          setSummary(null);
        } else {
          setSummary(data);
        }
        setByCourse(null);
        setByLearner(null);
        setByPeriod(null);
        setCourseLearners(null);
        setGroupIntersection(null);
      } else if (reportType === 'course-learners' && selectedCourseId) {
        const r = await fetch(`/api/portal/admin/reports/course/${selectedCourseId}/learners`);
        const data = await r.json();
        if (r.ok) setCourseLearners({ courseId: data.courseId, courseTitle: data.courseTitle, rows: data.rows ?? [] });
        else {
          toast.error(data.error === 'Course not found' ? 'Курс не найден' : 'Ошибка отчёта');
          setCourseLearners(null);
        }
        setSummary(null);
        setByCourse(null);
        setByLearner(null);
        setByPeriod(null);
        setGroupIntersection(null);
      } else if (reportType === 'by-course') {
        const r = await fetch(`/api/portal/admin/reports/by-course?${params}`);
        const data = await r.json();
        if (!r.ok) {
          toast.error('Ошибка отчёта');
          setByCourse(null);
        } else {
          setByCourse(data);
        }
        setSummary(null);
        setByLearner(null);
        setByPeriod(null);
        setCourseLearners(null);
        setGroupIntersection(null);
      } else if (reportType === 'by-learner') {
        const r = await fetch(`/api/portal/admin/reports/by-learner?${params}`);
        const data = await r.json();
        if (!r.ok) {
          toast.error('Ошибка отчёта');
          setByLearner(null);
        } else {
          setByLearner(data);
        }
        setSummary(null);
        setByCourse(null);
        setByPeriod(null);
        setCourseLearners(null);
        setGroupIntersection(null);
      } else if (reportType === 'group-intersection') {
        if (!userGroupId || !courseGroupId) {
          toast.error('Выберите группу пользователей и группу курсов');
          setGroupIntersection(null);
          return;
        }
        const gp = new URLSearchParams({ dateFrom, dateTo, userGroupId, courseGroupId });
        const r = await fetch(`/api/portal/admin/reports/group-intersection?${gp}`);
        const data = await r.json();
        if (!r.ok) {
          toast.error(typeof data.error === 'string' ? data.error : 'Ошибка отчёта');
          setGroupIntersection(null);
        } else {
          setGroupIntersection({ rows: data.rows ?? [] });
        }
        setSummary(null);
        setByCourse(null);
        setByLearner(null);
        setByPeriod(null);
        setCourseLearners(null);
      } else {
        const r = await fetch(`/api/portal/admin/reports/by-period?${params}`);
        const data = await r.json();
        if (!r.ok) {
          toast.error('Ошибка отчёта');
          setByPeriod(null);
        } else {
          setByPeriod(data);
        }
        setSummary(null);
        setByCourse(null);
        setByLearner(null);
        setCourseLearners(null);
        setGroupIntersection(null);
      }
    } finally {
      setLoading(false);
    }
  }, [reportType, dateFrom, dateTo, statusFilter, roleFilter, selectedCourseId, userGroupId, courseGroupId]);

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
    } else if (reportType === 'group-intersection' && groupIntersection?.rows?.length) {
      const header = ['Слушатель', 'Email', 'Курс', 'Зачислен', 'Завершён', 'Доступ'];
      const rows = groupIntersection.rows.map((r) => [
        r.displayName,
        r.email,
        r.courseTitle,
        r.enrolledAt.slice(0, 10),
        r.completedAt ? r.completedAt.slice(0, 10) : '—',
        r.accessClosed ? 'Закрыт' : 'Открыт',
      ]);
      const csv = '\uFEFF' + header.map(csvEscape).join(',') + '\n' + rows.map((r) => r.map(csvEscape).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `report-groups-${dateFrom}-${dateTo}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } else if (reportType === 'summary' && summary?.summary) {
      const s = summary.summary as Record<string, unknown>;
      const header = ['Показатель', 'Значение'];
      const rowNames = [
        'usersActive', 'coursesTotal', 'coursesPublished', 'enrollmentsTotal', 'enrollmentsCompletedTotal',
        'completionRatePercent', 'certificatesTotal', 'enrollmentsInPeriod', 'completedInPeriod',
        'certificatesInPeriod', 'ordersCountInPeriod', 'revenueInPeriod',
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
        certificatesInPeriod: 'За период: сертификатов',
        ordersCountInPeriod: 'За период: оплат (шт.)',
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
  }, [reportType, byCourse, byLearner, byPeriod, summary, courseLearners, groupIntersection, dateFrom, dateTo]);

  const exportXlsx = useCallback(() => {
    if (reportType === 'by-course' && byCourse?.rows?.length) {
      const header = ['Курс', 'Статус', 'Зачислено', 'Доступ открыт', 'Завершило', '% завершения', 'Сертификатов', 'Средний балл', 'Время (мин)'];
      const cols = ['title', 'status', 'enrolled', 'accessOpen', 'completed', 'completionRatePercent', 'certificates', 'avgScore', 'timeSpentMinutes'];
      const rows: (string | number | null | undefined)[][] = byCourse.rows.map((row) =>
        cols.map((c) => {
          const v = (row as Record<string, unknown>)[c];
          return v == null ? '' : (typeof v === 'number' ? v : String(v));
        })
      );
      downloadXlsxFromArrays(header, rows, `report-by-course-${dateFrom}-${dateTo}.xlsx`);
    } else if (reportType === 'by-learner' && byLearner?.rows?.length) {
      const header = ['Слушатель', 'Email', 'Роль', 'Зачислено', 'В процессе', 'Завершено', 'Сертификатов', 'Последняя активность', 'Время (мин)'];
      const cols = ['displayName', 'email', 'role', 'enrolled', 'inProgress', 'completed', 'certificates', 'lastActivity', 'timeSpentMinutes'];
      const rows: (string | number | null | undefined)[][] = byLearner.rows.map((row) =>
        cols.map((c) => {
          const v = (row as Record<string, unknown>)[c];
          return v == null ? '' : (typeof v === 'number' ? v : String(v));
        })
      );
      downloadXlsxFromArrays(header, rows, `report-by-learner-${dateFrom}-${dateTo}.xlsx`);
    } else if (reportType === 'by-period' && byPeriod?.rows?.length) {
      const header = ['Дата', 'Зачислений', 'Завершений', 'Сертификатов', 'Оплат', 'Сумма (₽)'];
      const rows: (string | number | null | undefined)[][] = byPeriod.rows.map((r) => {
        const row = r as Record<string, unknown>;
        return [
          String(row.date ?? ''),
          Number(row.enrollments ?? 0),
          Number(row.completions ?? 0),
          Number(row.certificates ?? 0),
          Number(row.ordersCount ?? 0),
          Number(row.revenue ?? 0),
        ];
      });
      downloadXlsxFromArrays(header, rows, `report-by-period-${dateFrom}-${dateTo}.xlsx`);
    } else if (reportType === 'group-intersection' && groupIntersection?.rows?.length) {
      const header = ['Слушатель', 'Email', 'Курс', 'Зачислен', 'Завершён', 'Доступ'];
      const rows: (string | number | null | undefined)[][] = groupIntersection.rows.map((r) => [
        r.displayName,
        r.email,
        r.courseTitle,
        r.enrolledAt.slice(0, 10),
        r.completedAt ? r.completedAt.slice(0, 10) : '—',
        r.accessClosed ? 'Закрыт' : 'Открыт',
      ]);
      downloadXlsxFromArrays(header, rows, `report-groups-${dateFrom}-${dateTo}.xlsx`);
    } else if (reportType === 'summary' && summary?.summary) {
      const s = summary.summary as Record<string, unknown>;
      const header = ['Показатель', 'Значение'];
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
        certificatesInPeriod: 'За период: сертификатов',
        ordersCountInPeriod: 'За период: оплат (шт.)',
        revenueInPeriod: 'За период: выручка (₽)',
      };
      const rowNames = [
        'usersActive', 'coursesTotal', 'coursesPublished', 'enrollmentsTotal', 'enrollmentsCompletedTotal',
        'completionRatePercent', 'certificatesTotal', 'enrollmentsInPeriod', 'completedInPeriod',
        'certificatesInPeriod', 'ordersCountInPeriod', 'revenueInPeriod',
      ];
      const rows = rowNames.map((k) => [labels[k] ?? k, String(s[k] ?? '')]);
      downloadXlsxFromArrays(header, rows, `report-summary-${dateFrom}-${dateTo}.xlsx`);
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
      downloadXlsxFromArrays(header, rows, `report-course-learners-${courseLearners.courseId}-${dateToParam(new Date())}.xlsx`);
    }
  }, [reportType, byCourse, byLearner, byPeriod, summary, courseLearners, groupIntersection, dateFrom, dateTo]);

  const tabs = [
    { id: 'summary' as const, label: 'Сводка', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'by-course' as const, label: 'По курсам', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'by-learner' as const, label: 'По слушателям', icon: <Users className="h-4 w-4" /> },
    { id: 'by-period' as const, label: 'По периоду', icon: <Calendar className="h-4 w-4" /> },
    { id: 'group-intersection' as const, label: 'Группы × курсы', icon: <Layers className="h-4 w-4" /> },
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
                    ? 'border-[var(--portal-accent)] bg-[var(--portal-accent-soft)] text-[var(--portal-accent-dark)]'
                    : 'border-[#E2E8F0] bg-white text-[var(--portal-text-muted)] hover:bg-[#F8FAFC]'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-[var(--portal-text-muted)]">
              С
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded border border-[#E2E8F0] bg-white px-2 py-1.5 text-sm text-[var(--portal-text)]"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--portal-text-muted)]">
              По
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded border border-[#E2E8F0] bg-white px-2 py-1.5 text-sm text-[var(--portal-text)]"
              />
            </label>
            {reportType === 'by-course' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded border border-[#E2E8F0] bg-white px-2 py-1.5 text-sm text-[var(--portal-text)]"
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
                className="rounded border border-[#E2E8F0] bg-white px-2 py-1.5 text-sm text-[var(--portal-text)]"
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
                className="rounded border border-[#E2E8F0] bg-white px-2 py-1.5 text-sm text-[var(--portal-text)] min-w-[200px]"
              >
                <option value="">— Выберите курс —</option>
                {courseList.map((c) => (
                  <option key={c.courseId} value={c.courseId}>{c.title}</option>
                ))}
              </select>
            )}
            {reportType === 'group-intersection' && (
              <>
                <select
                  value={userGroupId}
                  onChange={(e) => setUserGroupId(e.target.value)}
                  className="rounded border border-[#E2E8F0] bg-white px-2 py-1.5 text-sm text-[var(--portal-text)] min-w-[180px] max-w-[240px]"
                  aria-label="Группа пользователей"
                >
                  <option value="">— Группа пользователей —</option>
                  {userGroups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                <select
                  value={courseGroupId}
                  onChange={(e) => setCourseGroupId(e.target.value)}
                  className="rounded border border-[#E2E8F0] bg-white px-2 py-1.5 text-sm text-[var(--portal-text)] min-w-[180px] max-w-[240px]"
                  aria-label="Группа курсов"
                >
                  <option value="">— Группа курсов —</option>
                  {courseGroups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </>
            )}
            <Button
              onClick={fetchReport}
              disabled={
                loading ||
                (reportType === 'course-learners' && !selectedCourseId) ||
                (reportType === 'group-intersection' && (!userGroupId || !courseGroupId))
              }
            >
              {loading ? 'Загрузка…' : 'Сформировать'}
            </Button>
            {((reportType === 'summary' && summary?.summary) ||
              (reportType === 'by-course' && byCourse?.rows?.length) ||
              (reportType === 'by-learner' && byLearner?.rows?.length) ||
              (reportType === 'by-period' && byPeriod?.rows?.length) ||
              (reportType === 'group-intersection' && groupIntersection?.rows?.length) ||
              (reportType === 'course-learners' && courseLearners?.rows?.length)) && (
              <>
                <Button variant="secondary" onClick={exportCsv}>
                  <Download className="mr-2 h-4 w-4" />
                  CSV
                </Button>
                <Button variant="secondary" onClick={exportXlsx}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  XLSX
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {summary && summary.summary != null && (() => {
        const s = summary.summary as Record<string, unknown>;
        return (
          <Card className="p-6">
            <h3 className="mb-4 font-heading text-lg font-semibold text-[var(--portal-text)]">Сводные показатели</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              <div className="portal-card p-4">
                <p className="text-xs font-medium uppercase text-[var(--portal-text-muted)]">Активных пользователей</p>
                <p className="mt-1 text-2xl font-bold text-[var(--portal-text)]">{s.usersActive as number}</p>
              </div>
              <div className="portal-card p-4">
                <p className="text-xs font-medium uppercase text-[var(--portal-text-muted)]">Курсов (всего / опубл.)</p>
                <p className="mt-1 text-2xl font-bold text-[var(--portal-text)]">{s.coursesTotal as number} / {s.coursesPublished as number}</p>
              </div>
              <div className="portal-card p-4">
                <p className="text-xs font-medium uppercase text-[var(--portal-text-muted)]">Зачислений всего</p>
                <p className="mt-1 text-2xl font-bold text-[var(--portal-text)]">{s.enrollmentsTotal as number}</p>
              </div>
              <div className="portal-card p-4">
                <p className="text-xs font-medium uppercase text-[var(--portal-text-muted)]">Завершило обучение</p>
                <p className="mt-1 text-2xl font-bold text-[var(--portal-text)]">{s.enrollmentsCompletedTotal as number}</p>
              </div>
              <div className="portal-card p-4">
                <p className="text-xs font-medium uppercase text-[var(--portal-text-muted)]">% завершения</p>
                <p className="mt-1 text-2xl font-bold text-[var(--portal-text)]">{s.completionRatePercent as number}%</p>
              </div>
              <div className="portal-card p-4">
                <p className="text-xs font-medium uppercase text-[var(--portal-text-muted)]">Сертификатов выдано</p>
                <p className="mt-1 text-2xl font-bold text-[var(--portal-text)]">{s.certificatesTotal as number}</p>
              </div>
              <div className="portal-card p-4">
                <p className="text-xs font-medium uppercase text-[var(--portal-text-muted)]">За период: зачислений</p>
                <p className="mt-1 text-2xl font-bold text-[var(--portal-text)]">{s.enrollmentsInPeriod as number}</p>
              </div>
              <div className="portal-card p-4">
                <p className="text-xs font-medium uppercase text-[var(--portal-text-muted)]">За период: завершений</p>
                <p className="mt-1 text-2xl font-bold text-[var(--portal-text)]">{s.completedInPeriod as number}</p>
              </div>
              <div className="portal-card p-4">
                <p className="text-xs font-medium uppercase text-[var(--portal-text-muted)]">За период: сертификатов</p>
                <p className="mt-1 text-2xl font-bold text-[var(--portal-text)]">{s.certificatesInPeriod as number}</p>
              </div>
              <div className="portal-card p-4">
                <p className="text-xs font-medium uppercase text-[var(--portal-text-muted)]">За период: оплат (шт.)</p>
                <p className="mt-1 text-2xl font-bold text-[var(--portal-text)]">{s.ordersCountInPeriod as number}</p>
              </div>
              <div className="portal-card p-4">
                <p className="text-xs font-medium uppercase text-[var(--portal-text-muted)]">За период: выручка (₽)</p>
                <p className="mt-1 text-2xl font-bold text-[var(--portal-text)]">{s.revenueInPeriod as number}</p>
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
                    <TableCell className="text-[var(--portal-text-muted)]">{(row as Record<string, unknown>).status as string}</TableCell>
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
                    <TableCell className="text-[var(--portal-text-muted)]">{(row as Record<string, unknown>).email as string}</TableCell>
                    <TableCell className="text-[var(--portal-text-muted)]">{(row as Record<string, unknown>).role as string}</TableCell>
                    <TableCell className="text-right">{(row as Record<string, unknown>).enrolled as number}</TableCell>
                    <TableCell className="text-right">{(row as Record<string, unknown>).inProgress as number}</TableCell>
                    <TableCell className="text-right">{(row as Record<string, unknown>).completed as number}</TableCell>
                    <TableCell className="text-right">{(row as Record<string, unknown>).certificates as number}</TableCell>
                    <TableCell className="text-[var(--portal-text-muted)] text-sm">
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
        <>
          <Card className="p-6">
            <h3 className="mb-4 font-heading text-lg font-semibold text-[var(--portal-text)]">Динамика по дням</h3>
            <div className="h-64 w-full min-h-[256px] min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={100}>
                <LineChart data={byPeriod.rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => formatIsoDayMonth(String(v))} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${formatRub(Number(v ?? 0))} ₽`}
                  />
                  <Tooltip
                    labelFormatter={(label) => formatIsoDateRu(String(label))}
                    formatter={(value, name) => [
                      name === 'revenue' ? `${formatRub(Number(value ?? 0))} ₽` : (value ?? 0),
                      name === 'enrollments' ? 'Зачислений' : name === 'completions' ? 'Завершений' : name === 'certificates' ? 'Сертификатов' : name === 'ordersCount' ? 'Оплат' : 'Выручка (₽)',
                    ]}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="enrollments" stroke="#2D1B4E" name="Зачислений" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="left" type="monotone" dataKey="completions" stroke="#856B92" name="Завершений" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="left" type="monotone" dataKey="certificates" stroke="#D4AF37" name="Сертификатов" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="left" type="monotone" dataKey="ordersCount" stroke="#10B981" name="Оплат" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#F59E0B" name="Выручка (₽)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="overflow-hidden p-0">
            {byPeriod.totals && (
              <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 text-sm font-medium text-[var(--portal-text)]">
                Итого за период: зачислений {byPeriod.totals.enrollments}, завершений {byPeriod.totals.completions}, сертификатов {byPeriod.totals.certificates}, оплат {byPeriod.totals.ordersCount}, выручка {formatRub(byPeriod.totals.revenue)} ₽
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
                {byPeriod.rows.map((row) => {
                  const r = row as Record<string, unknown>;
                  const dateStr = String(r.date ?? '');
                  return (
                  <TableRow key={dateStr}>
                    <TableCell className="font-medium">{formatIsoDateRu(dateStr)}</TableCell>
                    <TableCell className="text-right">{r.enrollments as number}</TableCell>
                    <TableCell className="text-right">{r.completions as number}</TableCell>
                    <TableCell className="text-right">{r.certificates as number}</TableCell>
                    <TableCell className="text-right">{r.ordersCount as number}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRub(r.revenue as number)}</TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
        </>
      )}

      {groupIntersection?.rows && groupIntersection.rows.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 text-sm text-[var(--portal-text-muted)]">
            Зачисления: слушатели из выбранной группы пользователей на курсы из выбранной группы курсов за период.
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Слушатель</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Курс</TableHead>
                  <TableHead>Зачислен</TableHead>
                  <TableHead>Завершён</TableHead>
                  <TableHead>Доступ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupIntersection.rows.map((r) => (
                  <TableRow key={`${r.userId}-${r.courseId}-${r.enrolledAt}`}>
                    <TableCell className="font-medium">{r.displayName}</TableCell>
                    <TableCell className="text-[var(--portal-text-muted)]">{r.email}</TableCell>
                    <TableCell>{r.courseTitle}</TableCell>
                    <TableCell className="text-sm">{r.enrolledAt.slice(0, 10)}</TableCell>
                    <TableCell className="text-sm">{r.completedAt ? r.completedAt.slice(0, 10) : '—'}</TableCell>
                    <TableCell>{r.accessClosed ? 'Закрыт' : 'Открыт'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {courseLearners && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 text-sm font-medium text-[var(--portal-text)]">
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
                    <TableCell className="text-[var(--portal-text-muted)]">{r.email}</TableCell>
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

      {!loading &&
        !summary?.summary &&
        !byCourse?.rows?.length &&
        !byLearner?.rows?.length &&
        !byPeriod?.rows?.length &&
        !groupIntersection?.rows?.length &&
        !courseLearners?.rows?.length && (
        <p className="text-center text-[var(--portal-text-muted)]">Выберите тип отчёта и нажмите «Сформировать».</p>
      )}
    </div>
  );
}
