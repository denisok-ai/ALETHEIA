'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchInput } from '@/components/ui/SearchInput';
import { Download, FileText, Ban, ExternalLink, Award, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { CERTIFICATE_TEMPLATE_LABELS, type CertificateTemplateId } from '@/lib/certificates-constants';

export interface CertRow {
  id: string;
  certNumber: string;
  courseId: string;
  courseTitle: string | null;
  userId: string;
  userEmail: string | null;
  displayName: string | null;
  issuedAt: string;
  revokedAt: string | null;
}

export function CertificatesAdminClient({
  initialCertificates,
  courses,
}: {
  initialCertificates: CertRow[];
  courses: { id: string; title: string }[];
}) {
  const [certs, setCerts] = useState(initialCertificates.map((c) => ({ ...c, revokedAt: c.revokedAt ?? null })));
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [generating, setGenerating] = useState(false);
  const [generateCourseId, setGenerateCourseId] = useState('');
  const [detailCert, setDetailCert] = useState<CertRow | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<CertRow | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);

  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [issueUserSearch, setIssueUserSearch] = useState('');
  const [issueUserResults, setIssueUserResults] = useState<{ id: string; display_name: string | null; email: string }[]>([]);
  const [issueSelectedUser, setIssueSelectedUser] = useState<{ id: string; display_name: string | null; email: string } | null>(null);
  const [issueCourseId, setIssueCourseId] = useState('');
  const [issueValidityDays, setIssueValidityDays] = useState<number | ''>('');
  const [issueSubmitting, setIssueSubmitting] = useState(false);

  useEffect(() => {
    if (!issueModalOpen || !issueUserSearch.trim()) {
      setIssueUserResults([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/portal/manager/users/search?q=${encodeURIComponent(issueUserSearch.trim())}`)
        .then((r) => r.json())
        .then((d) => setIssueUserResults(d.profiles ?? []))
        .catch(() => setIssueUserResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [issueModalOpen, issueUserSearch]);

  const handleIssueSubmit = useCallback(async () => {
    if (!issueSelectedUser || !issueCourseId) {
      toast.error('Выберите пользователя и курс');
      return;
    }
    setIssueSubmitting(true);
    try {
      const r = await fetch('/api/portal/admin/certificates/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: issueSelectedUser.id,
          courseId: issueCourseId,
          validityDays: issueValidityDays === '' ? undefined : Number(issueValidityDays),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Ошибка');
      toast.success('Сертификат выдан');
      setIssueModalOpen(false);
      setIssueSelectedUser(null);
      setIssueCourseId('');
      setIssueValidityDays('');
      setIssueUserSearch('');
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
    setIssueSubmitting(false);
  }, [issueSelectedUser, issueCourseId, issueValidityDays]);

  const filtered = useMemo(() => {
    let list = certs;
    if (courseFilter !== 'all') list = list.filter((c) => c.courseId === courseFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.certNumber.toLowerCase().includes(q) ||
          (c.courseTitle?.toLowerCase().includes(q)) ||
          (c.displayName?.toLowerCase().includes(q)) ||
          (c.userEmail?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [certs, courseFilter, search]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageCerts = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const PAGE_SIZES = [5, 10, 50] as const;

  async function refetch() {
    const r = await fetch('/api/portal/admin/certificates');
    if (r.ok) {
      const d = await r.json();
      setCerts(d.certificates ?? []);
    }
  }

  async function handleGenerate() {
    if (!generateCourseId) {
      toast.error('Выберите курс');
      return;
    }
    setGenerating(true);
    try {
      const r = await fetch('/api/portal/admin/certificates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: generateCourseId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Ошибка');
      toast.success(`Выдано сертификатов: ${data.created}`);
      setGenerateCourseId('');
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
    setGenerating(false);
  }

  const downloadUrl = (certId: string, template?: CertificateTemplateId) =>
    `/api/portal/admin/certificates/${certId}/download${template && template !== 'default' ? `?template=${template}` : ''}`;

  async function handleRevoke(c: CertRow) {
    setRevokeTarget(null);
    setRevoking(true);
    try {
      const r = await fetch(`/api/portal/admin/certificates/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revoked: true }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? 'Ошибка');
      }
      setCerts((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, revokedAt: new Date().toISOString() } : x))
      );
      setDetailCert((prev) => (prev?.id === c.id ? { ...prev, revokedAt: new Date().toISOString() } : prev));
      toast.success('Сертификат аннулирован');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
    setRevoking(false);
  }

  function handleExportCsv() {
    const headers = ['certNumber', 'courseTitle', 'userEmail', 'displayName', 'issuedAt', 'revokedAt'];
    const escape = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const rows = filtered.map((c) =>
      [
        c.certNumber,
        c.courseTitle ?? '',
        c.userEmail ?? '',
        c.displayName ?? '',
        format(new Date(c.issuedAt), 'yyyy-MM-dd'),
        c.revokedAt ? format(new Date(c.revokedAt), 'yyyy-MM-dd') : '',
      ].map(escape)
    );
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `certificates-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Экспорт выполнен');
  }

  const firstCertForPreview = generateCourseId ? filtered.find((c) => c.courseId === generateCourseId && !c.revokedAt) : null;

  return (
    <div className="mt-6 space-y-6">
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <SearchInput
            onSearch={setSearch}
            placeholder="Поиск по №, курсу, имени, email..."
            wrapperClassName="max-w-xs"
          />
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
          >
            <option value="all">Все курсы</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <Button variant="secondary" size="sm" onClick={handleExportCsv} disabled={filtered.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Экспорт CSV
          </Button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">№</TableHead>
                <TableHead>Номер сертификата</TableHead>
                <TableHead>Курс</TableHead>
                <TableHead>Пользователь</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="w-24">Скачать</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageCerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="p-0">
                    <EmptyState
                      title="Нет сертификатов"
                      description="Сгенерируйте сертификаты по курсу выше или измените фильтры"
                      icon={<Award className="h-10 w-10" />}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                pageCerts.map((c, idx) => (
                  <TableRow key={c.id} className={c.revokedAt ? 'opacity-60' : ''}>
                    <TableCell className="text-text-muted">{currentPage * pageSize + idx + 1}</TableCell>
                    <TableCell className="font-mono text-dark">{c.certNumber}</TableCell>
                    <TableCell className="text-text-muted">{c.courseTitle ?? '—'}</TableCell>
                    <TableCell className="text-text-muted">
                      {c.displayName ?? c.userEmail ?? c.userId.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-text-muted">{format(new Date(c.issuedAt), 'dd.MM.yyyy')}</TableCell>
                    <TableCell>
                      {c.revokedAt ? (
                        <span className="text-red-600 font-medium">Аннулирован</span>
                      ) : (
                        <span className="text-green-600">Действителен</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {!c.revokedAt && (
                        <a
                          href={downloadUrl(c.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <Download className="h-4 w-4" />
                          PDF
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setDetailCert(c)} title="Подробнее" aria-label="Подробнее о сертификате">
                        <FileText className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {total > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {PAGE_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => { setPageSize(size); setPage(0); }}
                  className={`rounded px-2 py-1 text-sm ${pageSize === size ? 'bg-primary/10 text-primary font-medium' : 'text-text-muted hover:bg-bg-cream'}`}
                >
                  +{size}
                </button>
              ))}
              <span className="ml-2 text-sm text-text-muted">
                Записи {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, total)} из {total}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="rounded border border-border bg-white px-2 py-1 text-sm disabled:opacity-50"
                aria-label="Предыдущая страница"
              >
                ←
              </button>
              <span className="text-sm text-text-muted">
                Страница {currentPage + 1} из {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="rounded border border-border bg-white px-2 py-1 text-sm disabled:opacity-50"
                aria-label="Следующая страница"
              >
                →
              </button>
            </div>
          </div>
        )}
      </section>

      {detailCert && (
        <Dialog open={!!detailCert} onOpenChange={(open) => !open && setDetailCert(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Сертификат {detailCert.certNumber}</DialogTitle>
            </DialogHeader>
            <dl className="mt-2 space-y-1 text-sm">
              <div><dt className="text-text-muted inline">Курс: </dt><dd className="inline">{detailCert.courseTitle ?? '—'}</dd></div>
              <div><dt className="text-text-muted inline">Пользователь: </dt><dd className="inline">{detailCert.displayName ?? detailCert.userEmail ?? detailCert.userId}</dd></div>
              <div><dt className="text-text-muted inline">Дата выдачи: </dt><dd className="inline">{format(new Date(detailCert.issuedAt), 'dd.MM.yyyy')}</dd></div>
              {detailCert.revokedAt && (
                <div><dt className="text-text-muted inline">Аннулирован: </dt><dd className="inline text-red-600">{format(new Date(detailCert.revokedAt), 'dd.MM.yyyy')}</dd></div>
              )}
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {!detailCert.revokedAt && (
                <>
                  <span className="text-sm text-text-muted mr-1 self-center">Шаблон PDF:</span>
                  {(['default', 'minimal', 'elegant'] as const).map((tpl) => (
                    <a key={tpl} href={downloadUrl(detailCert.id, tpl)} target="_blank" rel="noopener noreferrer">
                      <Button variant="secondary" size="sm"><Download className="mr-1 h-4 w-4" /> {CERTIFICATE_TEMPLATE_LABELS[tpl]}</Button>
                    </a>
                  ))}
                  <Button variant="secondary" size="sm" className="text-red-600" onClick={() => setRevokeTarget(detailCert)} disabled={revoking}>
                    <Ban className="mr-1 h-4 w-4" /> Аннулировать
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Аннулировать сертификат?"
        description={revokeTarget ? `Сертификат ${revokeTarget.certNumber} будет аннулирован. Скачивание станет недоступно.` : ''}
        confirmLabel="Аннулировать"
        variant="danger"
        onConfirm={() => { if (revokeTarget) void handleRevoke(revokeTarget); }}
      />

      {issueModalOpen && (
        <Dialog open={issueModalOpen} onOpenChange={(open) => !open && setIssueModalOpen(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Выдать сертификат</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-sm font-medium text-dark">Пользователь</label>
                <input
                  type="text"
                  value={issueSelectedUser ? (issueSelectedUser.display_name || issueSelectedUser.email) : issueUserSearch}
                  onChange={(e) => {
                    setIssueUserSearch(e.target.value);
                    if (issueSelectedUser) setIssueSelectedUser(null);
                  }}
                  placeholder="Поиск по имени или email…"
                  className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                />
                {issueUserSearch && !issueSelectedUser && issueUserResults.length > 0 && (
                  <ul className="mt-1 max-h-40 overflow-y-auto rounded border border-border bg-white">
                    {issueUserResults.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-bg-cream"
                          onClick={() => {
                            setIssueSelectedUser(u);
                            setIssueUserSearch('');
                            setIssueUserResults([]);
                          }}
                        >
                          {u.display_name || u.email} {u.email && u.display_name ? `(${u.email})` : ''}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {issueSelectedUser && (
                  <button
                    type="button"
                    onClick={() => setIssueSelectedUser(null)}
                    className="mt-1 text-xs text-primary hover:underline"
                  >
                    Сбросить выбор
                  </button>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-dark">Курс</label>
                <select
                  value={issueCourseId}
                  onChange={(e) => setIssueCourseId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                >
                  <option value="">— Выберите курс —</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark">Срок действия (дней, необязательно)</label>
                <input
                  type="number"
                  min={1}
                  value={issueValidityDays}
                  onChange={(e) => setIssueValidityDays(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  placeholder="Без срока"
                  className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={() => void handleIssueSubmit()} disabled={issueSubmitting || !issueSelectedUser || !issueCourseId}>
                  {issueSubmitting ? 'Выдача…' : 'Выдать'}
                </Button>
                <Button variant="secondary" onClick={() => setIssueModalOpen(false)}>
                  Отмена
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <section className="rounded-xl border border-border bg-white p-4">
        <h2 className="text-lg font-semibold text-dark">Ручная и массовая выдача</h2>
        <p className="mt-1 text-sm text-text-muted">
          Выдать один сертификат вручную (пользователь + курс) или массово — всем, кто завершил курс.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => setIssueModalOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Выдать вручную
          </Button>
          <select
            value={generateCourseId}
            onChange={(e) => setGenerateCourseId(e.target.value)}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm min-w-[200px]"
          >
            <option value="">Выберите курс</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <Button onClick={handleGenerate} disabled={generating || !generateCourseId}>
            {generating ? 'Выдача…' : 'Выдать недостающие'}
          </Button>
          {generateCourseId && firstCertForPreview && (
            <a
              href={downloadUrl(firstCertForPreview.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Предпросмотр PDF
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
