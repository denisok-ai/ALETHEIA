'use client';

/**
 * Admin: mailings table, create/edit form (main + recipients), send, copy, delete.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/SortableTableHead';
import { sortTableBy, type SortDir } from '@/lib/table-sort';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { TablePagination, STANDARD_PAGE_SIZES, type ColumnConfigItem } from '@/components/ui/TablePagination';
import { downloadXlsxFromArrays } from '@/lib/export-xlsx';
import { Plus, Pencil, Trash2, Send, Copy, FileText, Paperclip, Loader2, Sparkles } from 'lucide-react';

const MAILINGS_TABLE_COLUMNS: ColumnConfigItem[] = [
  { id: 'internalTitle', label: 'Название' },
  { id: 'emailSubject', label: 'Тема' },
  { id: 'status', label: 'Статус' },
  { id: 'scheduleMode', label: 'Режим' },
  { id: 'createdAt', label: 'Создано' },
];
import { format } from 'date-fns';

export interface MailingRow {
  id: string;
  internalTitle: string;
  emailSubject: string;
  status: string;
  scheduleMode: string;
  scheduledAt: string | null;
  createdByEmail: string | null;
  createdByDisplayName: string | null;
  createdAt: string;
  logsCount: number;
}

interface UserOption {
  id: string;
  email: string | null;
  displayName: string;
}

interface GroupOption {
  id: string;
  name: string;
}

export function MailingsAdminClient({ initialMailings }: { initialMailings: MailingRow[] }) {
  const [items, setItems] = useState(initialMailings);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MailingRow | null>(null);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [formTitle, setFormTitle] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formAiGenerating, setFormAiGenerating] = useState(false);
  const [formSenderName, setFormSenderName] = useState('');
  const [formSenderEmail, setFormSenderEmail] = useState('');
  const [formScheduleMode, setFormScheduleMode] = useState<'manual' | 'scheduled'>('manual');
  const [formScheduledAt, setFormScheduledAt] = useState('');
  const [formRecipientType, setFormRecipientType] = useState<'all' | 'role' | 'list' | 'groups'>('all');
  const [formRole, setFormRole] = useState('user');
  const [formUserIds, setFormUserIds] = useState<string[]>([]);
  const [formGroupIds, setFormGroupIds] = useState<string[]>([]);
  const [formExcludeGroupIds, setFormExcludeGroupIds] = useState<string[]>([]);
  const [userGroups, setUserGroups] = useState<GroupOption[]>([]);
  const [formAttachments, setFormAttachments] = useState<{ name: string; pathOrKey: string; size: number }[]>([]);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [attachmentRemoving, setAttachmentRemoving] = useState<string | null>(null);
  const attachmentFileInputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() => MAILINGS_TABLE_COLUMNS.map((c) => c.id));
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const handleSort = (columnId: string) => {
    setPage(0);
    if (sortKey === columnId) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(columnId); setSortDir('asc'); }
  };

  const mailingsSortGetters: Record<string, (m: MailingRow) => unknown> = {
    title: (m) => m.internalTitle,
    subject: (m) => m.emailSubject,
    status: (m) => m.status,
    createdAt: (m) => m.createdAt,
    recipients: (m) => m.logsCount,
  };
  const sortedItems = useMemo(() => {
    if (!sortKey || !mailingsSortGetters[sortKey]) return items;
    return sortTableBy(items, mailingsSortGetters[sortKey], sortDir);
  }, [items, sortKey, sortDir]);

  useEffect(() => {
    fetch('/api/portal/admin/comms/recipients')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUsers(d?.users ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/portal/admin/groups?moduleType=user')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUserGroups((d?.groups ?? []).map((g: GroupOption) => ({ id: g.id, name: g.name }))))
      .catch(() => {});
  }, []);

  const mailingsTotal = sortedItems.length;
  const mailingsTotalPages = Math.max(1, Math.ceil(mailingsTotal / pageSize));
  const mailingsCurrentPage = Math.min(page, mailingsTotalPages - 1);
  const mailingsStart = mailingsCurrentPage * pageSize;
  const mailingsPageRows = sortedItems.slice(mailingsStart, mailingsStart + pageSize);

  const handleExportExcel = () => {
    const headers = ['Название', 'Тема', 'Статус', 'Режим', 'Создано', 'Отправлено'];
    const rows = sortedItems.map((m) => [
      m.internalTitle,
      m.emailSubject,
      m.status === 'planned' ? 'Запланирована' : m.status === 'processing' ? 'Идёт' : 'Завершена',
      m.scheduleMode === 'scheduled' ? 'По расписанию' : 'Вручную',
      format(new Date(m.createdAt), 'dd.MM.yyyy HH:mm'),
      String(m.logsCount),
    ]);
    downloadXlsxFromArrays(headers, rows, `mailings-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  async function loadList() {
    const r = await fetch('/api/portal/admin/mailings');
    if (r.ok) {
      const d = await r.json();
      setItems(d.mailings ?? []);
    }
  }

  function openCreate() {
    setEditingId(null);
    setFormTitle('');
    setFormSubject('');
    setFormBody('');
    setFormSenderName('');
    setFormSenderEmail('');
    setFormScheduleMode('manual');
    setFormScheduledAt('');
    setFormRecipientType('all');
    setFormRole('user');
    setFormUserIds([]);
    setFormGroupIds([]);
    setFormExcludeGroupIds([]);
    setFormAttachments([]);
    setFormOpen(true);
  }

  function openEdit(m: MailingRow) {
    if (m.status !== 'planned') return;
    setEditingId(m.id);
    setFormOpen(true);
    fetch(`/api/portal/admin/mailings/${m.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.mailing) {
          setFormTitle(d.mailing.internalTitle);
          setFormSubject(d.mailing.emailSubject);
          setFormBody(d.mailing.emailBody);
          setFormSenderName(d.mailing.senderName ?? '');
          setFormSenderEmail(d.mailing.senderEmail ?? '');
          setFormScheduleMode((d.mailing.scheduleMode === 'scheduled' ? 'scheduled' : 'manual') as 'manual' | 'scheduled');
          setFormScheduledAt(d.mailing.scheduledAt ? format(new Date(d.mailing.scheduledAt), "yyyy-MM-dd'T'HH:mm") : '');
          try {
            const rc = d.mailing.recipientConfig ? JSON.parse(d.mailing.recipientConfig) : { type: 'all' };
            setFormRecipientType(rc.type ?? 'all');
            setFormRole(rc.role ?? 'user');
            setFormUserIds(Array.isArray(rc.userIds) ? rc.userIds : []);
            setFormGroupIds(Array.isArray(rc.groupIds) ? rc.groupIds : []);
            setFormExcludeGroupIds(Array.isArray(rc.excludeGroupIds) ? rc.excludeGroupIds : []);
          } catch {
            setFormRecipientType('all');
            setFormRole('user');
            setFormUserIds([]);
            setFormGroupIds([]);
            setFormExcludeGroupIds([]);
          }
          try {
            const att = d.mailing.attachments ? JSON.parse(d.mailing.attachments) : [];
            setFormAttachments(Array.isArray(att) ? att : []);
          } catch {
            setFormAttachments([]);
          }
        }
      });
  }

  async function handleAttachmentUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editingId) return;
    e.target.value = '';
    setAttachmentUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`/api/portal/admin/mailings/${editingId}/attachments`, { method: 'POST', body: fd });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? 'Ошибка загрузки');
      setFormAttachments(data.attachments ?? []);
      toast.success('Файл добавлен');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
    setAttachmentUploading(false);
  }

  async function handleAttachmentRemove(pathOrKey: string) {
    if (!editingId) return;
    setAttachmentRemoving(pathOrKey);
    try {
      const r = await fetch(`/api/portal/admin/mailings/${editingId}/attachments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pathOrKey }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? 'Ошибка удаления');
      setFormAttachments(data.attachments ?? []);
      toast.success('Вложение удалено');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
    setAttachmentRemoving(null);
  }

  function formatBytes(n: number) {
    if (n < 1024) return `${n} Б`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
    return `${(n / 1024 / 1024).toFixed(2)} МБ`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim() || !formSubject.trim() || !formBody.trim()) {
      toast.error('Заполните название, тему и текст');
      return;
    }
    setSaving(true);
    try {
      const body = {
        internalTitle: formTitle.trim(),
        emailSubject: formSubject.trim(),
        emailBody: formBody,
        senderName: formSenderName.trim() || null,
        senderEmail: formSenderEmail.trim() || null,
        scheduleMode: formScheduleMode,
        scheduledAt: formScheduleMode === 'scheduled' && formScheduledAt ? new Date(formScheduledAt).toISOString() : null,
        recipientConfig: {
          type: formRecipientType,
          ...(formRecipientType === 'role' && { role: formRole }),
          ...(formRecipientType === 'list' && { userIds: formUserIds }),
          ...(formRecipientType === 'groups' && { groupIds: formGroupIds }),
          ...(formExcludeGroupIds.length > 0 && { excludeGroupIds: formExcludeGroupIds }),
        },
      };
      if (editingId) {
        const r = await fetch(`/api/portal/admin/mailings/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error((d as { error?: string }).error ?? 'Ошибка');
        }
        toast.success('Рассылка обновлена');
      } else {
        const r = await fetch('/api/portal/admin/mailings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error((d as { error?: string }).error ?? 'Ошибка');
        }
        toast.success('Рассылка создана');
      }
      setFormOpen(false);
      await loadList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
    setSaving(false);
  }

  async function handleSend(m: MailingRow) {
    if (m.status !== 'planned') return;
    setSending(true);
    try {
      const r = await fetch(`/api/portal/admin/mailings/${m.id}/send`, { method: 'POST' });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? 'Ошибка');
      if (r.status === 202) {
        toast.success(data.message ?? 'Рассылка запущена. Обновите страницу для просмотра статуса.');
        await loadList();
        const poll = setInterval(loadList, 5000);
        setTimeout(() => clearInterval(poll), 60000);
      } else {
        toast.success(`Отправлено: ${data.sent}, ошибок: ${data.failed}`);
        await loadList();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
    setSending(false);
  }

  async function handleCopy(m: MailingRow) {
    try {
      const r = await fetch(`/api/portal/admin/mailings/${m.id}/copy`, { method: 'POST' });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? 'Ошибка');
      toast.success('Копия создана');
      await loadList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function handleDelete(m: MailingRow) {
    setDeleteTarget(null);
    try {
      const r = await fetch(`/api/portal/admin/mailings/${m.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Ошибка удаления');
      toast.success('Рассылка удалена');
      await loadList();
    } catch {
      toast.error('Не удалось удалить');
    }
  }

  async function handleAiSuggestMailing() {
    const title = formTitle.trim() || 'Рассылка';
    setFormAiGenerating(true);
    try {
      const r = await fetch('/api/portal/admin/ai-settings/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: `Сгенерируй тему письма и HTML-текст рассылки по названию «${title}». Используй подстановки %FirstName%, %LastName%, %date%, %unsubscribe% где уместно. Ответь строго в формате:\nТема:\n...\n\nТекст:\n...`,
          systemPrompt: 'Ты помогаешь писать рассылки для школы AVATERRA. Отвечай только в формате: блок Тема, затем блок Текст (HTML). Без пояснений.',
          maxTokens: 1024,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Ошибка');
      const content = data.content ?? '';
      const themeMatch = content.match(/Тема:\s*\n?([\s\S]*?)(?=\n\nТекст:|$)/i);
      const bodyMatch = content.match(/Текст:\s*\n?([\s\S]*)/i);
      if (themeMatch?.[1]) setFormSubject(themeMatch[1].trim());
      if (bodyMatch?.[1]) setFormBody(bodyMatch[1].trim());
      if (content && !themeMatch?.[1] && !bodyMatch?.[1]) setFormBody(content);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка генерации');
    } finally {
      setFormAiGenerating(false);
    }
  }

  function toggleUserId(id: string) {
    setFormUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleGroupId(id: string, isExclude: boolean) {
    if (isExclude) {
      setFormExcludeGroupIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    } else {
      setFormGroupIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Создать рассылку
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">№</TableHead>
              <SortableTableHead sortKey="title" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Название</SortableTableHead>
              <SortableTableHead sortKey="subject" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Тема</SortableTableHead>
              <SortableTableHead sortKey="status" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Статус</SortableTableHead>
              <SortableTableHead sortKey="createdAt" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Создана</SortableTableHead>
              <SortableTableHead sortKey="recipients" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} className="text-right">Получателей</SortableTableHead>
              <TableHead className="w-40"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <EmptyState
                    title="Нет рассылок"
                    description="Создайте рассылку для массовой отправки писем"
                    icon={<FileText className="h-10 w-10" />}
                  />
                </TableCell>
              </TableRow>
            ) : (
              mailingsPageRows.map((m, idx) => (
                <TableRow key={m.id}>
                  <TableCell className="text-[var(--portal-text-muted)]">{mailingsStart + idx + 1}</TableCell>
                  <TableCell className="font-medium text-[var(--portal-text)]">{m.internalTitle}</TableCell>
                  <TableCell className="text-[var(--portal-text-muted)] line-clamp-1 max-w-[200px]">{m.emailSubject}</TableCell>
                  <TableCell>
                    {m.status === 'planned' && <span className="text-amber-600">Запланирована</span>}
                    {m.status === 'processing' && <span className="text-blue-600">Идёт</span>}
                    {m.status === 'completed' && <span className="text-green-600">Завершена</span>}
                  </TableCell>
                  <TableCell className="text-[var(--portal-text-muted)]">{format(new Date(m.createdAt), 'dd.MM.yyyy HH:mm')}</TableCell>
                  <TableCell className="text-right text-[var(--portal-text-muted)]">{m.logsCount}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/portal/admin/mailings/${m.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded text-[var(--portal-text-muted)] hover:text-[var(--portal-accent)]"
                        title="Подробнее / Результаты"
                      >
                        <FileText className="h-4 w-4" />
                      </Link>
                      {m.status === 'planned' && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEdit(m)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded text-[var(--portal-text-muted)] hover:text-[var(--portal-accent)]"
                            title="Редактировать"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSend(m)}
                            disabled={sending}
                            className="inline-flex h-8 w-8 items-center justify-center rounded text-[var(--portal-text-muted)] hover:text-green-600"
                            title="Отправить сейчас"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(m)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded text-[var(--portal-text-muted)] hover:text-red-600"
                            title="Удалить"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {m.status === 'completed' && (
                        <button
                          type="button"
                          onClick={() => handleCopy(m)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded text-[var(--portal-text-muted)] hover:text-[var(--portal-accent)]"
                          title="Копировать"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {items.length > 0 && (
        <TablePagination
          currentPage={Math.min(page, Math.max(0, Math.ceil(items.length / pageSize) - 1))}
          totalPages={Math.max(1, Math.ceil(items.length / pageSize))}
          total={items.length}
          pageSize={pageSize}
          pageSizeOptions={STANDARD_PAGE_SIZES}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
          columnConfig={MAILINGS_TABLE_COLUMNS}
          visibleColumnIds={visibleColumnIds}
          onVisibleColumnIdsChange={setVisibleColumnIds}
          onExportExcel={handleExportExcel}
          exportLabel="Excel"
        />
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Редактировать рассылку' : 'Новая рассылка'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[var(--portal-text)]">Основное</h3>
              <div>
                <Label htmlFor="mail-title">Внутреннее название</Label>
                <Input
                  id="mail-title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Название для каталога"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="mail-subject" className="mb-0">Тема письма</Label>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={handleAiSuggestMailing} disabled={formAiGenerating}>
                    {formAiGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    <span className="ml-1">{formAiGenerating ? 'Генерация…' : 'AI предложить тему и текст'}</span>
                  </Button>
                </div>
                <Input
                  id="mail-subject"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="Subject"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="mail-body">Текст (HTML). Ключевые слова: %FirstName%, %LastName%, %date%, %unsubscribe%</Label>
                <textarea
                  id="mail-body"
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  rows={6}
                  required
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="mail-sender-name">Имя отправителя</Label>
                  <Input
                    id="mail-sender-name"
                    value={formSenderName}
                    onChange={(e) => setFormSenderName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="mail-sender-email">Email отправителя</Label>
                  <Input
                    id="mail-sender-email"
                    type="email"
                    value={formSenderEmail}
                    onChange={(e) => setFormSenderEmail(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Режим отправки</Label>
                  <select
                    value={formScheduleMode}
                    onChange={(e) => setFormScheduleMode(e.target.value as 'manual' | 'scheduled')}
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
                  >
                    <option value="manual">Вручную (по кнопке)</option>
                    <option value="scheduled">По расписанию</option>
                  </select>
                </div>
                {formScheduleMode === 'scheduled' && (
                  <div>
                    <Label htmlFor="mail-scheduled">Запланировано на</Label>
                    <Input
                      id="mail-scheduled"
                      type="datetime-local"
                      value={formScheduledAt}
                      onChange={(e) => setFormScheduledAt(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            </div>

            {editingId && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[var(--portal-text)] flex items-center gap-2">
                  <Paperclip className="h-4 w-4" /> Вложения (макс. 10 МБ)
                </h3>
                {formAttachments.length > 0 && (
                  <ul className="rounded-lg border border-[#E2E8F0] divide-y divide-[#E2E8F0] bg-[#F8FAFC]">
                    {formAttachments.map((a) => (
                      <li key={a.pathOrKey} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="truncate text-[var(--portal-text)]">{a.name}</span>
                        <span className="text-[var(--portal-text-muted)] shrink-0 ml-2">{formatBytes(a.size)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-red-600 hover:text-red-700"
                          disabled={attachmentRemoving !== null}
                          onClick={() => handleAttachmentRemove(a.pathOrKey)}
                        >
                          {attachmentRemoving === a.pathOrKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center gap-2">
                  <input
                    ref={attachmentFileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleAttachmentUpload}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={attachmentUploading}
                    onClick={() => attachmentFileInputRef.current?.click()}
                  >
                    {attachmentUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Paperclip className="h-4 w-4 mr-2" />}
                    Добавить файл
                  </Button>
                  {formAttachments.length > 0 && (
                    <span className="text-[var(--portal-text-muted)] text-sm">
                      Всего: {formatBytes(formAttachments.reduce((s, a) => s + a.size, 0))}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[var(--portal-text)]">Адресаты</h3>
              <div>
                <Label>Кому</Label>
                <select
                  value={formRecipientType}
                  onChange={(e) => setFormRecipientType(e.target.value as 'all' | 'role' | 'list' | 'groups')}
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
                >
                  <option value="all">Все активные пользователи</option>
                  <option value="role">По роли</option>
                  <option value="list">Выбранные пользователи</option>
                  <option value="groups">По группам пользователей</option>
                </select>
              </div>
              {formRecipientType === 'role' && (
                <div>
                  <Label>Роль</Label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
                  >
                    <option value="user">Студент</option>
                    <option value="manager">Менеджер</option>
                    <option value="admin">Администратор</option>
                  </select>
                </div>
              )}
              {formRecipientType === 'list' && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-[#E2E8F0] p-2">
                  {users.filter((u) => u.email).map((u) => (
                    <label key={u.id} className="flex items-center gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={formUserIds.includes(u.id)}
                        onChange={() => toggleUserId(u.id)}
                      />
                      <span>{u.displayName}</span>
                      <span className="text-[var(--portal-text-muted)]">({u.email})</span>
                    </label>
                  ))}
                </div>
              )}
              {formRecipientType === 'groups' && (
                <div>
                  <Label>Включить группы (получатели — участники выбранных групп)</Label>
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-[#E2E8F0] p-2">
                    {userGroups.length === 0 ? (
                      <p className="text-sm text-[var(--portal-text-muted)]">Нет групп. Создайте группы в разделе «Пользователи».</p>
                    ) : (
                      userGroups.map((g) => (
                        <label key={g.id} className="flex items-center gap-2 py-1 text-sm">
                          <input
                            type="checkbox"
                            checked={formGroupIds.includes(g.id)}
                            onChange={() => toggleGroupId(g.id, false)}
                          />
                          <span>{g.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
              <div>
                <Label>Исключить группы (убрать из списка получателей участников выбранных групп)</Label>
                <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-[#E2E8F0] border-amber-200 bg-amber-50/50 p-2">
                  {userGroups.length === 0 ? (
                    <p className="text-sm text-[var(--portal-text-muted)]">Нет групп</p>
                  ) : (
                    userGroups.map((g) => (
                      <label key={g.id} className="flex items-center gap-2 py-1 text-sm">
                        <input
                          type="checkbox"
                          checked={formExcludeGroupIds.includes(g.id)}
                          onChange={() => toggleGroupId(g.id, true)}
                        />
                        <span>{g.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Сохранение…' : editingId ? 'Сохранить' : 'Создать'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Удалить рассылку?"
        description={deleteTarget ? `«${deleteTarget.internalTitle}» будет удалена.` : ''}
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); }}
      />
    </div>
  );
}
