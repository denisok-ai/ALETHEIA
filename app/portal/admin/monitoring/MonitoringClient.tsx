'use client';

/**
 * Вкладки: Пользователи Online | Посещения (статистика + график).
 */
import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
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
import { EmptyState } from '@/components/ui/EmptyState';
import { Activity, Users, Calendar, BarChart3, Search, RefreshCw, Trash2, ListTodo, StopCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

type TabId = 'online' | 'visits' | 'tasks';
type VisitsSubTab = 'stats' | 'chart';

interface TaskItem {
  id: string;
  name: string;
  initiatorId: string;
  initiatorName: string;
  progress: number;
  startedAt: string;
}

interface OnlineSummaryItem {
  role: string;
  label: string;
  count: number;
}

interface OnlineItem {
  id: string;
  userId: string;
  displayName: string | null;
  email: string;
  role: string;
  loginAt: string;
  lastActivityAt: string;
  ipAddress: string | null;
}

interface VisitsItem {
  userId: string;
  displayName: string | null;
  email: string;
  visitsCount: number;
}

interface ChartDay {
  day: number;
  uniqueVisitors: number;
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Администратор',
  manager: 'Менеджер',
  user: 'Слушатель',
};

function dateToParam(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function MonitoringClient() {
  const [tab, setTab] = useState<TabId>('online');
  const [visitsSubTab, setVisitsSubTab] = useState<VisitsSubTab>('stats');

  const [onlineSummary, setOnlineSummary] = useState<OnlineSummaryItem[]>([]);
  const [onlineItems, setOnlineItems] = useState<OnlineItem[]>([]);
  const [onlinePagination, setOnlinePagination] = useState({ page: 1, limit: 20, total: 0 });
  const [onlineSearch, setOnlineSearch] = useState('');
  const [onlineRoleFilter, setOnlineRoleFilter] = useState('');
  const [onlineLoading, setOnlineLoading] = useState(false);

  const [visitsDateFrom, setVisitsDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return dateToParam(d);
  });
  const [visitsDateTo, setVisitsDateTo] = useState(() => dateToParam(new Date()));
  const [visitsSearch, setVisitsSearch] = useState('');
  const [visitsItems, setVisitsItems] = useState<VisitsItem[]>([]);
  const [visitsPagination, setVisitsPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [visitsLoading, setVisitsLoading] = useState(false);

  const [chartYear, setChartYear] = useState(new Date().getFullYear());
  const [chartMonth, setChartMonth] = useState(new Date().getMonth() + 1);
  const [chartData, setChartData] = useState<ChartDay[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  const [tasksItems, setTasksItems] = useState<TaskItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  const [clearLoading, setClearLoading] = useState(false);
  const [clearOlderThanDays, setClearOlderThanDays] = useState<number | ''>('');

  const fetchOnline = useCallback(async () => {
    setOnlineLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(onlinePagination.page));
      params.set('limit', String(onlinePagination.limit));
      if (onlineSearch.trim()) params.set('search', onlineSearch.trim());
      if (onlineRoleFilter) params.set('role', onlineRoleFilter);
      const r = await fetch(`/api/portal/admin/monitoring/online?${params}`);
      const data = await r.json();
      if (r.ok) {
        setOnlineSummary(data.summary ?? []);
        setOnlineItems(data.items ?? []);
        setOnlinePagination((prev) => ({ ...prev, ...data.pagination }));
      }
    } finally {
      setOnlineLoading(false);
    }
  }, [onlinePagination.page, onlinePagination.limit, onlineSearch, onlineRoleFilter]);

  const fetchVisits = useCallback(async () => {
    setVisitsLoading(true);
    try {
      const params = new URLSearchParams({
        dateFrom: visitsDateFrom,
        dateTo: visitsDateTo,
        page: String(visitsPagination.page),
        limit: String(visitsPagination.limit),
      });
      if (visitsSearch.trim()) params.set('search', visitsSearch.trim());
      const r = await fetch(`/api/portal/admin/monitoring/visits?${params}`);
      const data = await r.json();
      if (r.ok) {
        setVisitsItems(data.items ?? []);
        setVisitsPagination((prev) => ({ ...prev, ...data.pagination }));
      }
    } finally {
      setVisitsLoading(false);
    }
  }, [visitsDateFrom, visitsDateTo, visitsPagination.page, visitsPagination.limit, visitsSearch]);

  const fetchChart = useCallback(async () => {
    setChartLoading(true);
    try {
      const r = await fetch(
        `/api/portal/admin/monitoring/visits/chart?year=${chartYear}&month=${chartMonth}`
      );
      const data = await r.json();
      if (r.ok) setChartData(data.data ?? []);
      else setChartData([]);
    } finally {
      setChartLoading(false);
    }
  }, [chartYear, chartMonth]);

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const r = await fetch('/api/portal/admin/monitoring/tasks');
      const data = await r.json();
      if (r.ok) setTasksItems(data.items ?? []);
      else setTasksItems([]);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'online') fetchOnline();
  }, [tab, fetchOnline]);

  useEffect(() => {
    setOnlinePagination((p) => ({ ...p, page: 1 }));
  }, [onlineSearch, onlineRoleFilter]);

  useEffect(() => {
    if (tab === 'visits' && visitsSubTab === 'stats') fetchVisits();
  }, [tab, visitsSubTab, fetchVisits]);

  useEffect(() => {
    if (tab === 'tasks') fetchTasks();
  }, [tab, fetchTasks]);

  useEffect(() => {
    if (tab !== 'online') return;
    const t = setInterval(() => fetchOnline(), 60 * 1000);
    return () => clearInterval(t);
  }, [tab, fetchOnline]);

  const handleClearVisits = useCallback(async () => {
    const days = clearOlderThanDays === '' ? undefined : Number(clearOlderThanDays);
    const msg = days != null ? `Удалить записи старше ${days} дней?` : 'Удалить все записи посещений?';
    if (!confirm(msg)) return;
    setClearLoading(true);
    try {
      const r = await fetch('/api/portal/admin/monitoring/visits/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(days != null ? { olderThanDays: days } : {}),
      });
      const data = await r.json();
      if (r.ok && data.deleted != null) {
        alert(`Удалено записей: ${data.deleted}`);
        if (tab === 'visits') fetchVisits();
      }
    } finally {
      setClearLoading(false);
    }
  }, [tab, clearOlderThanDays, fetchVisits]);

  const handleInterruptTask = useCallback(async (taskId: string) => {
    if (!confirm('Прервать выполнение задачи?')) return;
    const r = await fetch(`/api/portal/admin/monitoring/tasks/${taskId}/interrupt`, { method: 'POST' });
    if (r.ok) fetchTasks();
  }, [fetchTasks]);

  const maxChart = Math.max(1, ...chartData.map((d) => d.uniqueVisitors));

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('online')}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              tab === 'online' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-white text-text-muted hover:bg-bg-soft'
            }`}
          >
            <Activity className="h-4 w-4" />
            Пользователи Online
          </button>
          <button
            type="button"
            onClick={() => setTab('visits')}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              tab === 'visits' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-white text-text-muted hover:bg-bg-soft'
            }`}
          >
            <Users className="h-4 w-4" />
            Посещения
          </button>
          <button
            type="button"
            onClick={() => setTab('tasks')}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              tab === 'tasks' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-white text-text-muted hover:bg-bg-soft'
            }`}
          >
            <ListTodo className="h-4 w-4" />
            Выполняемые задачи
          </button>
        </div>
      </Card>

      {tab === 'online' && (
        <>
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-dark">В системе по ролям</h3>
            <div className="flex flex-wrap gap-4">
              {onlineSummary.map((s) => (
                <div key={s.role} className="rounded-lg border border-border bg-bg-cream/50 px-4 py-2">
                  <span className="text-sm text-text-muted">{s.label}</span>
                  <span className="ml-2 font-semibold text-dark">{s.count}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Поиск по имени или email..."
                  value={onlineSearch}
                  onChange={(e) => setOnlineSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchOnline()}
                  className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm"
                />
              </div>
              <select
                value={onlineRoleFilter}
                onChange={(e) => setOnlineRoleFilter(e.target.value)}
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
              >
                <option value="">Все роли</option>
                <option value="admin">Администратор</option>
                <option value="manager">Менеджер</option>
                <option value="user">Слушатель</option>
              </select>
              <Button variant="secondary" size="sm" onClick={fetchOnline} disabled={onlineLoading}>
                <RefreshCw className={`h-4 w-4 ${onlineLoading ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
            </div>
            {onlineLoading && onlineItems.length === 0 ? (
              <div className="py-8 text-center text-sm text-text-muted">Загрузка...</div>
            ) : onlineItems.length === 0 ? (
              <EmptyState title="Нет активных сессий" description="Пользователи с активностью за последние 15 минут не найдены." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Пользователь</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead>Время входа</TableHead>
                    <TableHead>Последний запрос</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {onlineItems.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link
                          href={`/portal/admin/users/${row.userId}`}
                          className="text-primary hover:underline"
                        >
                          {row.displayName || row.email || row.userId}
                        </Link>
                      </TableCell>
                      <TableCell>{ROLE_LABEL[row.role] ?? row.role}</TableCell>
                      <TableCell>{format(new Date(row.loginAt), 'dd.MM.yyyy HH:mm', { locale: ru })}</TableCell>
                      <TableCell>{format(new Date(row.lastActivityAt), 'dd.MM.yyyy HH:mm', { locale: ru })}</TableCell>
                      <TableCell className="font-mono text-xs">{row.ipAddress ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {onlinePagination.total > onlinePagination.limit && (
              <div className="mt-3 flex items-center justify-between text-sm text-text-muted">
                <span>
                  Показано {onlineItems.length} из {onlinePagination.total}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={onlinePagination.page <= 1}
                    onClick={() => setOnlinePagination((p) => ({ ...p, page: p.page - 1 }))}
                  >
                    Назад
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={onlinePagination.page * onlinePagination.limit >= onlinePagination.total}
                    onClick={() => setOnlinePagination((p) => ({ ...p, page: p.page + 1 }))}
                  >
                    Вперёд
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {tab === 'visits' && (
        <>
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setVisitsSubTab('stats')}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                  visitsSubTab === 'stats' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-white'
                }`}
              >
                <Calendar className="h-4 w-4" />
                Статистика
              </button>
              <button
                type="button"
                onClick={() => setVisitsSubTab('chart')}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                  visitsSubTab === 'chart' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-white'
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                График
              </button>
            </div>
          </Card>

          {visitsSubTab === 'stats' && (
            <Card className="p-4">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  С
                  <input
                    type="date"
                    value={visitsDateFrom}
                    onChange={(e) => setVisitsDateFrom(e.target.value)}
                    className="rounded border border-border bg-white px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  По
                  <input
                    type="date"
                    value={visitsDateTo}
                    onChange={(e) => setVisitsDateTo(e.target.value)}
                    className="rounded border border-border bg-white px-2 py-1.5 text-sm"
                  />
                </label>
                <div className="relative max-w-[240px]">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Поиск по имени..."
                    value={visitsSearch}
                    onChange={(e) => setVisitsSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchVisits()}
                    className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm"
                  />
                </div>
                <Button variant="secondary" size="sm" onClick={fetchVisits} disabled={visitsLoading}>
                  <RefreshCw className={`h-4 w-4 ${visitsLoading ? 'animate-spin' : ''}`} />
                  Обновить
                </Button>
                <select
                  value={clearOlderThanDays === '' ? 'all' : String(clearOlderThanDays)}
                  onChange={(e) => setClearOlderThanDays(e.target.value === 'all' ? '' : Number(e.target.value))}
                  className="rounded-lg border border-border bg-white px-2 py-1.5 text-sm"
                >
                  <option value="all">Очистить всё</option>
                  <option value="30">Старше 30 дней</option>
                  <option value="90">Старше 90 дней</option>
                </select>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleClearVisits}
                  disabled={clearLoading}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Очистить
                </Button>
              </div>
              {visitsLoading && visitsItems.length === 0 ? (
                <div className="py-8 text-center text-sm text-text-muted">Загрузка...</div>
              ) : visitsItems.length === 0 ? (
                <EmptyState title="Нет данных за период" description="Выберите другой период или обновите страницу." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Пользователь</TableHead>
                      <TableHead>Количество посещений</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visitsItems.map((row) => (
                      <TableRow key={row.userId}>
                        <TableCell>
                          <Link
                            href={`/portal/admin/users/${row.userId}`}
                            className="text-primary hover:underline"
                          >
                            {row.displayName || row.email || row.userId}
                          </Link>
                        </TableCell>
                        <TableCell>{row.visitsCount}</TableCell>
                        <TableCell>
                          <Link
                            href={`/portal/admin/monitoring/visits/user/${row.userId}`}
                            className="text-sm text-primary hover:underline"
                          >
                            Детализация
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {visitsPagination.total > visitsPagination.limit && (
                <div className="mt-3 flex justify-between text-sm text-text-muted">
                  <span>Показано {visitsItems.length} из {visitsPagination.total}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={visitsPagination.page <= 1}
                      onClick={() => setVisitsPagination((p) => ({ ...p, page: p.page - 1 }))}
                    >
                      Назад
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={visitsPagination.page * visitsPagination.limit >= visitsPagination.total}
                      onClick={() => setVisitsPagination((p) => ({ ...p, page: p.page + 1 }))}
                    >
                      Вперёд
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {visitsSubTab === 'chart' && (
            <Card className="p-4">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  Год
                  <input
                    type="number"
                    min={2020}
                    max={2030}
                    value={chartYear}
                    onChange={(e) => setChartYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
                    className="w-20 rounded border border-border bg-white px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  Месяц
                  <select
                    value={chartMonth}
                    onChange={(e) => setChartMonth(parseInt(e.target.value, 10))}
                    className="rounded border border-border bg-white px-2 py-1.5 text-sm"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <option key={m} value={m}>
                        {format(new Date(2000, m - 1), 'LLLL', { locale: ru })}
                      </option>
                    ))}
                  </select>
                </label>
                <Button variant="secondary" size="sm" onClick={fetchChart} disabled={chartLoading}>
                  Построить
                </Button>
              </div>
              {chartLoading ? (
                <div className="py-12 text-center text-sm text-text-muted">Загрузка...</div>
              ) : chartData.length === 0 ? (
                <EmptyState title="Нет данных" description="Выберите год и месяц и нажмите «Построить»." />
              ) : (
                <div className="flex items-end gap-1 overflow-x-auto py-4">
                  {chartData.map((d) => (
                    <div key={d.day} className="flex min-w-[24px] flex-1 flex-col items-center">
                      <span className="mb-1 text-xs text-text-muted">{d.uniqueVisitors}</span>
                      <div
                        className="w-full min-w-[8px] rounded-t bg-primary/70 transition-all"
                        style={{ height: `${(d.uniqueVisitors / maxChart) * 120}px` }}
                        title={`${d.day}: ${d.uniqueVisitors} уникальных посетителей`}
                      />
                      <span className="mt-1 text-xs text-text-muted">{d.day}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {tab === 'tasks' && (
        <Card className="p-4">
          <div className="mb-4 flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={fetchTasks} disabled={tasksLoading}>
              <RefreshCw className={`h-4 w-4 ${tasksLoading ? 'animate-spin' : ''}`} />
              Обновить
            </Button>
          </div>
          {tasksLoading && tasksItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-text-muted">Загрузка...</div>
          ) : tasksItems.length === 0 ? (
            <EmptyState
              title="Нет активных задач"
              description="Фоновые задачи (массовая выдача сертификатов, рассылки и т.п.) появятся здесь при запуске."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Инициатор</TableHead>
                  <TableHead>Прогресс</TableHead>
                  <TableHead>Время старта</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasksItems.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.initiatorName}</TableCell>
                    <TableCell>{row.progress}%</TableCell>
                    <TableCell>{format(new Date(row.startedAt), 'dd.MM.yyyy HH:mm', { locale: ru })}</TableCell>
                    <TableCell>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleInterruptTask(row.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <StopCircle className="h-4 w-4" />
                        Прервать
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}
