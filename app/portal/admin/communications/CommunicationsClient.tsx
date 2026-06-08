'use client';

/**
 * Admin Communications: CRUD templates, send form (Resend/Telegram), recent sends.
 */
import { useState, useEffect, useMemo, useCallback, type ChangeEvent } from 'react';
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
import { Plus, Pencil, Trash2, Send, Search, Mail, Sparkles, Loader2, Eye, Paperclip, X } from 'lucide-react';

const TEMPLATES_TABLE_COLUMNS: ColumnConfigItem[] = [
  { id: 'name', label: 'Название' },
  { id: 'channel', label: 'Канал' },
  { id: 'subject', label: 'Тема' },
];
const SENDS_TABLE_COLUMNS: ColumnConfigItem[] = [
  { id: 'date', label: 'Дата' },
  { id: 'channel', label: 'Канал' },
  { id: 'recipient', label: 'Получатель' },
  { id: 'status', label: 'Статус' },
];
import { format } from 'date-fns';


interface Template {
  id: string;
  name: string;
  channel: string;
  subject: string | null;
  htmlBody: string | null;
  variables: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CommsSendRow {
  id: string;
  channel: string;
  recipient: string;
  subject: string | null;
  status: string;
  sentAt: string;
  errorMessage?: string | null;
  isTest?: boolean;
}

const TEMPLATE_SORT_GETTERS: Record<string, (t: Template) => unknown> = {
  name: (t) => t.name,
  channel: (t) => t.channel,
  subject: (t) => t.subject ?? '',
};

const COMMS_SEND_SORT_GETTERS: Record<string, (s: CommsSendRow) => unknown> = {
  date: (s) => s.sentAt,
  channel: (s) => s.channel,
  recipient: (s) => s.recipient,
  status: (s) => s.status,
};

interface RecipientUser {
  id: string;
  email: string | null;
  displayName: string;
  telegramId: number | null;
}

const CHANNELS = ['email', 'telegram'] as const;
const ROLES = ['user', 'manager', 'admin'] as const;

const PREVIEW_SAMPLE = { name: 'Иван Иванов', email: 'student@example.com', displayName: 'Иван Иванов', userId: 'clxxxxxxxx' };

function buildPreviewHtml(html: string) {
  return html
    .replace(/\{\{name\}\}/g, PREVIEW_SAMPLE.name)
    .replace(/\{\{email\}\}/g, PREVIEW_SAMPLE.email)
    .replace(/\{\{displayName\}\}/g, PREVIEW_SAMPLE.displayName)
    .replace(/\{\{userId\}\}/g, PREVIEW_SAMPLE.userId);
}

export function CommunicationsClient({
  initialTemplates,
  initialSends,
  prefillUserId,
}: {
  initialTemplates: Template[];
  initialSends: CommsSendRow[];
  prefillUserId?: string | null;
}) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [sends, setSends] = useState<CommsSendRow[]>(initialSends);
  const [sendsTotal, setSendsTotal] = useState(initialSends.length);
  const [sendMode, setSendMode] = useState<'template' | 'custom'>('template');
  const [customChannel, setCustomChannel] = useState<'email' | 'telegram'>('email');
  const [customSubject, setCustomSubject] = useState('');
  const [customHtmlBody, setCustomHtmlBody] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [attachmentPaths, setAttachmentPaths] = useState<{ path: string; name: string }[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [filterIsTest, setFilterIsTest] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [sendTemplateId, setSendTemplateId] = useState('');
  const [recipientType, setRecipientType] = useState<'all' | 'role' | 'list' | 'groups'>('all');
  const [sendRole, setSendRole] = useState('user');
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [sendGroupIds, setSendGroupIds] = useState<string[]>([]);
  const [sendExcludeGroupIds, setSendExcludeGroupIds] = useState<string[]>([]);
  const [userGroups, setUserGroups] = useState<{ id: string; name: string }[]>([]);
  const [recipients, setRecipients] = useState<RecipientUser[]>([]);
  const [sending, setSending] = useState(false);
  const [detailSend, setDetailSend] = useState<CommsSendRow | null>(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templatesPage, setTemplatesPage] = useState(0);
  const [templatesPageSize, setTemplatesPageSize] = useState(10);
  const [sendsPage, setSendsPage] = useState(0);
  const [sendsPageSize, setSendsPageSize] = useState(10);
  const [templatesVisibleColumnIds, setTemplatesVisibleColumnIds] = useState<string[]>(() => TEMPLATES_TABLE_COLUMNS.map((c) => c.id));
  const [sendsVisibleColumnIds, setSendsVisibleColumnIds] = useState<string[]>(() => SENDS_TABLE_COLUMNS.map((c) => c.id));
  const [templatesSortKey, setTemplatesSortKey] = useState<string | null>(null);
  const [templatesSortDir, setTemplatesSortDir] = useState<SortDir>('asc');
  const [sendsSortKey, setSendsSortKey] = useState<string | null>(null);
  const [sendsSortDir, setSendsSortDir] = useState<SortDir>('asc');
  const handleTemplatesSort = (columnId: string) => {
    setTemplatesPage(0);
    if (templatesSortKey === columnId) setTemplatesSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setTemplatesSortKey(columnId); setTemplatesSortDir('asc'); }
  };
  const handleSendsSort = (columnId: string) => {
    setSendsPage(0);
    if (sendsSortKey === columnId) setSendsSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSendsSortKey(columnId); setSendsSortDir('asc'); }
  };

  const handleTemplatesExportExcel = () => {
    const headers = ['Название', 'Канал', 'Тема'];
    const rows = sortedTemplates.map((t) => [t.name, t.channel, t.subject ?? '—']);
    downloadXlsxFromArrays(headers, rows, `comms-templates-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };
  const handleSendsExportExcel = () => {
    const headers = ['Дата', 'Канал', 'Получатель', 'Статус', 'Тест', 'Ошибка'];
    const rows = sortedSends.map((s) => [
      format(new Date(s.sentAt), 'dd.MM.yyyy HH:mm'),
      s.channel,
      s.recipient,
      s.status,
      s.isTest ? 'да' : 'нет',
      s.errorMessage ?? '—',
    ]);
    downloadXlsxFromArrays(headers, rows, `comms-sends-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  useEffect(() => {
    fetch('/api/portal/admin/comms/recipients')
      .then((r) => r.json())
      .then((d) => setRecipients(d.users ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (prefillUserId?.trim()) {
      setRecipientType('list');
      setRecipientIds([prefillUserId.trim()]);
    }
  }, [prefillUserId]);

  useEffect(() => {
    fetch('/api/portal/admin/groups?moduleType=user')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUserGroups((d?.groups ?? []).map((g: { id: string; name: string }) => ({ id: g.id, name: g.name }))))
      .catch(() => {});
  }, []);

  async function loadTemplates() {
    const r = await fetch('/api/portal/admin/comms/templates');
    if (r.ok) {
      const d = await r.json();
      setTemplates(d.templates ?? []);
    }
  }

  const loadSends = useCallback(async () => {
    const params = new URLSearchParams();
    params.set('page', String(sendsPage));
    params.set('pageSize', String(sendsPageSize));
    if (filterStatus.trim()) params.set('status', filterStatus.trim());
    if (filterChannel.trim()) params.set('channel', filterChannel.trim());
    if (filterIsTest === 'true' || filterIsTest === 'false') params.set('isTest', filterIsTest);
    if (filterDateFrom.trim()) params.set('dateFrom', filterDateFrom.trim());
    if (filterDateTo.trim()) params.set('dateTo', filterDateTo.trim());
    const r = await fetch(`/api/portal/admin/comms/sends?${params.toString()}`);
    if (r.ok) {
      const d = await r.json();
      setSends(d.sends ?? []);
      setSendsTotal(typeof d.total === 'number' ? d.total : d.sends?.length ?? 0);
    }
  }, [sendsPage, sendsPageSize, filterStatus, filterChannel, filterIsTest, filterDateFrom, filterDateTo]);

  useEffect(() => {
    void loadSends();
  }, [loadSends]);

  useEffect(() => {
    setSendsPage(0);
  }, [filterStatus, filterChannel, filterIsTest, filterDateFrom, filterDateTo]);

  async function handleCreate(data: { name: string; channel: string; subject?: string; htmlBody?: string; variables?: string }) {
    const r = await fetch('/api/portal/admin/comms/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        channel: data.channel,
        subject: data.subject || null,
        htmlBody: data.htmlBody || null,
        variables: data.variables || '[]',
      }),
    });
    if (!r.ok) {
      const e = await r.json();
      throw new Error(e.error ?? 'Ошибка');
    }
    const json = await r.json();
    setTemplates((prev) => [...prev, json.template]);
    setCreating(false);
    toast.success('Шаблон создан');
  }

  async function handleUpdate(id: string, data: Partial<{ name: string; channel: string; subject: string; htmlBody: string; variables: string }>) {
    const r = await fetch(`/api/portal/admin/comms/templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error('Ошибка');
    const json = await r.json();
    setTemplates((prev) => prev.map((t) => (t.id === id ? json.template : t)));
    setEditing(null);
    toast.success('Шаблон обновлён');
  }

  async function handleDelete(t: Template) {
    setDeleteTarget(null);
    const r = await fetch(`/api/portal/admin/comms/templates/${t.id}`, { method: 'DELETE' });
    if (!r.ok) throw new Error('Ошибка');
    setTemplates((prev) => prev.filter((x) => x.id !== t.id));
    toast.success('Шаблон удалён');
  }

  async function handleTestSend() {
    if (!sendTemplateId) {
      toast.error('Выберите шаблон для теста');
      return;
    }
    const tpl = templates.find((t) => t.id === sendTemplateId);
    if (tpl?.channel !== 'email') {
      toast.error('Тестовая отправка только для шаблонов email');
      return;
    }
    if (!testEmail.trim()) {
      toast.error('Укажите email для теста');
      return;
    }
    setTesting(true);
    try {
      const r = await fetch('/api/portal/admin/comms/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: sendTemplateId, testEmail: testEmail.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Ошибка');
      toast.success(data.message ?? 'Тестовое письмо отправлено');
      await loadSends();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
    setTesting(false);
  }

  async function handleAttachmentPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const isEmailChannel =
      sendMode === 'template'
        ? templates.find((t) => t.id === sendTemplateId)?.channel === 'email'
        : customChannel === 'email';
    if (!isEmailChannel) {
      toast.error('Вложения только для канала email');
      return;
    }
    if (attachmentPaths.length >= 5) {
      toast.error('Не больше 5 файлов');
      return;
    }
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.set('file', file);
      const r = await fetch('/api/portal/admin/comms/upload', { method: 'POST', body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Ошибка загрузки');
      setAttachmentPaths((prev) => [...prev, { path: data.path, name: data.name ?? file.name }]);
      toast.success('Файл добавлен');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
    setUploadingFile(false);
  }

  async function handleSend() {
    if (sendMode === 'template' && !sendTemplateId) {
      toast.error('Выберите шаблон');
      return;
    }
    if (sendMode === 'custom') {
      if (!customHtmlBody.trim()) {
        toast.error('Введите текст/HTML сообщения');
        return;
      }
      if (customChannel === 'email' && !customSubject.trim()) {
        toast.error('Для email укажите тему');
        return;
      }
    }
    setSending(true);
    try {
      const body: Record<string, unknown> = { recipientType };
      if (sendMode === 'template') {
        body.templateId = sendTemplateId;
        if (attachmentPaths.length > 0) {
          const tpl = templates.find((t) => t.id === sendTemplateId);
          if (tpl?.channel === 'email') body.attachmentPaths = attachmentPaths.map((a) => a.path);
        }
      } else {
        body.channel = customChannel;
        body.htmlBody = customHtmlBody;
        if (customChannel === 'email') {
          body.subject = customSubject;
          if (attachmentPaths.length > 0) body.attachmentPaths = attachmentPaths.map((a) => a.path);
        }
      }
      if (recipientType === 'role') body.role = sendRole;
      if (recipientType === 'list' && recipientIds.length) body.recipientIds = recipientIds;
      if (recipientType === 'groups' && sendGroupIds.length) body.groupIds = sendGroupIds;
      if (sendExcludeGroupIds.length) body.excludeGroupIds = sendExcludeGroupIds;
      const r = await fetch('/api/portal/admin/comms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? 'Ошибка отправки');
      }
      const data = await r.json();
      if (data.async) {
        toast.success(
          `Запущена фоновая отправка (${data.recipientCount} получ.). Задача: ${data.taskId?.slice(0, 8)}… — см. Мониторинг.`
        );
      } else {
        toast.success(`Отправлено: ${data.sent}, ошибок: ${data.failed}`);
      }
      setSendTemplateId('');
      setRecipientIds([]);
      setSendGroupIds([]);
      setSendExcludeGroupIds([]);
      setAttachmentPaths([]);
      setCustomSubject('');
      setCustomHtmlBody('');
      await loadSends();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
    setSending(false);
  }

  const templateSearchLower = templateSearch.trim().toLowerCase();
  const filteredTemplates = templateSearchLower
    ? templates.filter(
        (t) =>
          t.name.toLowerCase().includes(templateSearchLower) ||
          t.channel.toLowerCase().includes(templateSearchLower) ||
          (t.subject?.toLowerCase().includes(templateSearchLower) ?? false)
      )
    : templates;

  const sortedTemplates = useMemo(() => {
    if (!templatesSortKey || !TEMPLATE_SORT_GETTERS[templatesSortKey]) return filteredTemplates;
    return sortTableBy(filteredTemplates, TEMPLATE_SORT_GETTERS[templatesSortKey], templatesSortDir);
  }, [filteredTemplates, templatesSortKey, templatesSortDir]);

  const templatesTotal = sortedTemplates.length;
  const templatesTotalPages = Math.max(1, Math.ceil(templatesTotal / templatesPageSize));
  const templatesCurrentPage = Math.min(templatesPage, templatesTotalPages - 1);
  const templatesStart = templatesCurrentPage * templatesPageSize;
  const templatesPageRows = sortedTemplates.slice(templatesStart, templatesStart + templatesPageSize);

  const sortedSends = useMemo(() => {
    if (!sendsSortKey || !COMMS_SEND_SORT_GETTERS[sendsSortKey]) return sends;
    return sortTableBy(sends, COMMS_SEND_SORT_GETTERS[sendsSortKey], sendsSortDir);
  }, [sends, sendsSortKey, sendsSortDir]);

  const sendsServerTotal = sendsTotal;
  const sendsTotalPages = Math.max(1, Math.ceil(sendsServerTotal / sendsPageSize));
  const sendsCurrentPage = Math.min(sendsPage, sendsTotalPages - 1);
  const sendsPageRows = sortedSends;

  return (
    <div className="mt-6 space-y-8">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--portal-text)]">Шаблоны</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--portal-text-muted)]" />
              <input
                type="search"
                placeholder="Найти в списке"
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                className="w-48 rounded-lg border border-[#E2E8F0] bg-white py-2 pl-8 pr-3 text-sm text-[var(--portal-text)] placeholder:text-[var(--portal-text-muted)]"
                aria-label="Найти в списке"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Добавить
            </Button>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">№</TableHead>
                <SortableTableHead sortKey="name" currentSortKey={templatesSortKey} currentSortDir={templatesSortDir} onSort={handleTemplatesSort}>Название</SortableTableHead>
                <SortableTableHead sortKey="channel" currentSortKey={templatesSortKey} currentSortDir={templatesSortDir} onSort={handleTemplatesSort}>Канал</SortableTableHead>
                <SortableTableHead sortKey="subject" currentSortKey={templatesSortKey} currentSortDir={templatesSortDir} onSort={handleTemplatesSort}>Тема</SortableTableHead>
                <TableHead className="w-24">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState
                      title="Нет шаблонов"
                      description="Добавьте шаблон для email или Telegram"
                      icon={<Mail className="h-10 w-10" />}
                      action={
                        <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
                          <Plus className="mr-2 h-4 w-4" /> Добавить
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                templatesPageRows.map((t, idx) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-[var(--portal-text-muted)]">{templatesStart + idx + 1}</TableCell>
                    <TableCell className="font-medium text-[var(--portal-text)]">{t.name}</TableCell>
                    <TableCell className="text-[var(--portal-text-muted)]">{t.channel}</TableCell>
                    <TableCell className="text-[var(--portal-text-muted)]">{t.subject ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditing(t)} aria-label="Редактировать">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600" onClick={() => setDeleteTarget(t)} aria-label="Удалить">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {sortedTemplates.length > 0 && (
          <TablePagination
            currentPage={templatesCurrentPage}
            totalPages={templatesTotalPages}
            total={templatesTotal}
            pageSize={templatesPageSize}
            pageSizeOptions={STANDARD_PAGE_SIZES}
            onPageChange={setTemplatesPage}
            onPageSizeChange={(s) => { setTemplatesPageSize(s); setTemplatesPage(0); }}
            columnConfig={TEMPLATES_TABLE_COLUMNS}
            visibleColumnIds={templatesVisibleColumnIds}
            onVisibleColumnIdsChange={setTemplatesVisibleColumnIds}
            onExportExcel={handleTemplatesExportExcel}
            exportLabel="Excel"
          />
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold text-[var(--portal-text)]">Отправить</h2>
        <div className="mt-3 portal-card bg-white p-4 space-y-4 max-w-2xl">
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="sendMode"
                checked={sendMode === 'template'}
                onChange={() => setSendMode('template')}
              />
              По шаблону
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="sendMode"
                checked={sendMode === 'custom'}
                onChange={() => { setSendMode('custom'); setAttachmentPaths([]); }}
              />
              Разовое сообщение (без шаблона)
            </label>
          </div>
          {sendMode === 'template' ? (
            <div>
              <Label>Шаблон</Label>
              <select
                value={sendTemplateId}
                onChange={(e) => { setSendTemplateId(e.target.value); setAttachmentPaths([]); }}
                className="mt-1 block w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
              >
                <option value="">Выберите шаблон</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.channel})</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-dashed border-[#E2E8F0] p-3">
              <div>
                <Label>Канал</Label>
                <select
                  value={customChannel}
                  onChange={(e) => {
                    const v = e.target.value as 'email' | 'telegram';
                    setCustomChannel(v);
                    if (v === 'telegram') setAttachmentPaths([]);
                  }}
                  className="mt-1 block w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
                >
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              {customChannel === 'email' && (
                <div>
                  <Label>Тема</Label>
                  <Input value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} className="mt-1" placeholder="Тема письма" />
                </div>
              )}
              <div>
                <Label>Текст / HTML</Label>
                <textarea
                  value={customHtmlBody}
                  onChange={(e) => setCustomHtmlBody(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm min-h-[100px] font-mono"
                  placeholder="{{name}}, {{email}} — подстановки как в шаблонах"
                />
              </div>
            </div>
          )}
          {((sendMode === 'template' && sendTemplateId && templates.find((t) => t.id === sendTemplateId)?.channel === 'email') ||
            (sendMode === 'custom' && customChannel === 'email')) && (
            <div>
              <Label className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Вложения (до 5 файлов, только email)
              </Label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <input type="file" className="text-sm" onChange={handleAttachmentPick} disabled={uploadingFile || sending} />
                {attachmentPaths.map((a) => (
                  <span key={a.path} className="inline-flex items-center gap-1 rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs">
                    {a.name}
                    <button type="button" className="text-red-600" aria-label="Убрать" onClick={() => setAttachmentPaths((p) => p.filter((x) => x.path !== a.path))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
          {sendMode === 'template' && sendTemplateId && (
            <div className="rounded-lg border border-[#E2E8F0] bg-slate-50/80 p-3 space-y-2">
              <Label>Тестовая отправка (только email-шаблоны)</Label>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[200px]">
                  <Input
                    type="email"
                    placeholder="email для проверки"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={handleTestSend} disabled={testing || !sendTemplateId}>
                  {testing ? '…' : 'Отправить тест'}
                </Button>
              </div>
            </div>
          )}
          <div>
            <Label>Получатели</Label>
            <select
              value={recipientType}
              onChange={(e) => setRecipientType(e.target.value as 'all' | 'role' | 'list' | 'groups')}
              className="mt-1 block w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
            >
              <option value="all">Все активные</option>
              <option value="role">По роли</option>
              <option value="list">Выбрать вручную</option>
              <option value="groups">По группам пользователей</option>
            </select>
          </div>
          {recipientType === 'role' && (
            <div>
              <Label>Роль</Label>
              <select
                value={sendRole}
                onChange={(e) => setSendRole(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}
          {recipientType === 'list' && (
            <div>
              <Label>Получатели</Label>
              <div className="mt-1 max-h-40 overflow-y-auto rounded border border-[#E2E8F0] bg-white p-2 space-y-1">
                {recipients.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={recipientIds.includes(u.id)}
                      onChange={(e) =>
                        setRecipientIds((prev) =>
                          e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)
                        )
                      }
                    />
                    <span>{u.displayName} {u.email && `<${u.email}>`}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {recipientType === 'groups' && (
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
                        checked={sendGroupIds.includes(g.id)}
                        onChange={(e) =>
                          setSendGroupIds((prev) =>
                            e.target.checked ? [...prev, g.id] : prev.filter((id) => id !== g.id)
                          )
                        }
                      />
                      <span>{g.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
          <div>
            <Label>Исключить группы (убрать из получателей участников выбранных групп)</Label>
            <div className="mt-2 max-h-32 overflow-y-auto rounded border border-amber-200 bg-amber-50/50 p-2">
              {userGroups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={sendExcludeGroupIds.includes(g.id)}
                    onChange={(e) =>
                      setSendExcludeGroupIds((prev) =>
                        e.target.checked ? [...prev, g.id] : prev.filter((id) => id !== g.id)
                      )
                    }
                  />
                  <span>{g.name}</span>
                </label>
              ))}
            </div>
          </div>
          <p className="text-xs text-[var(--portal-text-muted)]">
            При получателях от 25 письмо уходит в фоне — статус в разделе «Мониторинг» → «Выполняемые задачи».
          </p>
          <Button
            onClick={handleSend}
            disabled={
              sending ||
              (sendMode === 'template' && !sendTemplateId) ||
              (sendMode === 'custom' && (!customHtmlBody.trim() || (customChannel === 'email' && !customSubject.trim()))) ||
              (recipientType === 'groups' && sendGroupIds.length === 0) ||
              (recipientType === 'list' && recipientIds.length === 0)
            }
          >
            <Send className="mr-2 h-4 w-4" />
            {sending ? 'Отправка…' : 'Отправить'}
          </Button>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[var(--portal-text)]">Журнал отправок</h2>
          <Button type="button" variant="ghost" size="sm" onClick={() => loadSends()}>
            Обновить
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 items-end text-sm">
          <div>
            <Label className="text-xs">Статус</Label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="mt-0.5 block rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-sm"
            >
              <option value="">Все</option>
              <option value="sent">sent</option>
              <option value="failed">failed</option>
              <option value="skipped">skipped</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Канал</Label>
            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="mt-0.5 block rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-sm"
            >
              <option value="">Все</option>
              <option value="email">email</option>
              <option value="telegram">telegram</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Тест</Label>
            <select
              value={filterIsTest}
              onChange={(e) => setFilterIsTest(e.target.value)}
              className="mt-0.5 block rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-sm"
            >
              <option value="">Все</option>
              <option value="false">Боевые</option>
              <option value="true">Тестовые</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Дата с</Label>
            <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="mt-0.5 h-9 w-[140px]" />
          </div>
          <div>
            <Label className="text-xs">по</Label>
            <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="mt-0.5 h-9 w-[140px]" />
          </div>
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="date" currentSortKey={sendsSortKey} currentSortDir={sendsSortDir} onSort={handleSendsSort}>Дата</SortableTableHead>
                <SortableTableHead sortKey="channel" currentSortKey={sendsSortKey} currentSortDir={sendsSortDir} onSort={handleSendsSort}>Канал</SortableTableHead>
                <SortableTableHead sortKey="recipient" currentSortKey={sendsSortKey} currentSortDir={sendsSortDir} onSort={handleSendsSort}>Получатель</SortableTableHead>
                <SortableTableHead sortKey="status" currentSortKey={sendsSortKey} currentSortDir={sendsSortDir} onSort={handleSendsSort}>Статус</SortableTableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSends.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-[var(--portal-text-muted)] py-6">
                    Нет отправок
                  </TableCell>
                </TableRow>
              ) : (
                sendsPageRows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-[var(--portal-text-muted)]">{format(new Date(s.sentAt), 'dd.MM.yyyy HH:mm')}</TableCell>
                    <TableCell className="text-[var(--portal-text-muted)]">{s.channel}</TableCell>
                    <TableCell className="text-[var(--portal-text-muted)]">{s.recipient}</TableCell>
                    <TableCell className="text-[var(--portal-text-muted)]">
                      <span className="inline-flex flex-wrap items-center gap-1">
                        {s.status}
                        {s.isTest ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">тест</span>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setDetailSend(s)}>
                        Детали
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {sendsServerTotal > 0 && (
          <TablePagination
            currentPage={sendsCurrentPage}
            totalPages={sendsTotalPages}
            total={sendsServerTotal}
            pageSize={sendsPageSize}
            pageSizeOptions={STANDARD_PAGE_SIZES}
            onPageChange={setSendsPage}
            onPageSizeChange={(s) => { setSendsPageSize(s); setSendsPage(0); }}
            columnConfig={SENDS_TABLE_COLUMNS}
            visibleColumnIds={sendsVisibleColumnIds}
            onVisibleColumnIdsChange={setSendsVisibleColumnIds}
            onExportExcel={handleSendsExportExcel}
            exportLabel="Excel"
          />
        )}
      </section>

      {detailSend && (
        <Dialog open onOpenChange={(open) => !open && setDetailSend(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Рассылка: {detailSend.id}</DialogTitle>
            </DialogHeader>
            <dl className="mt-2 space-y-1 text-sm">
              <div><dt className="text-[var(--portal-text-muted)] inline">Канал: </dt><dd className="inline">{detailSend.channel}</dd></div>
              <div><dt className="text-[var(--portal-text-muted)] inline">Получатель: </dt><dd className="inline break-all">{detailSend.recipient}</dd></div>
              {detailSend.subject && <div><dt className="text-[var(--portal-text-muted)] inline">Тема: </dt><dd className="inline">{detailSend.subject}</dd></div>}
              <div><dt className="text-[var(--portal-text-muted)] inline">Статус: </dt><dd className="inline">{detailSend.status}{detailSend.isTest ? ' (тест)' : ''}</dd></div>
              {detailSend.errorMessage ? (
                <div className="rounded-md bg-red-50 p-2 text-red-800">
                  <dt className="text-xs font-medium">Ошибка</dt>
                  <dd className="mt-1 break-words text-sm">{detailSend.errorMessage}</dd>
                </div>
              ) : null}
              <div><dt className="text-[var(--portal-text-muted)] inline">Дата: </dt><dd className="inline">{format(new Date(detailSend.sentAt), 'dd.MM.yyyy HH:mm:ss')}</dd></div>
            </dl>
          </DialogContent>
        </Dialog>
      )}

      {creating && (
        <TemplateForm
          onClose={() => setCreating(false)}
          onSave={(data) => handleCreate(data)}
          title="Новый шаблон"
        />
      )}
      {editing && (
        <TemplateForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(data) => handleUpdate(editing.id, data)}
          title="Редактировать шаблон"
        />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Удалить шаблон?"
        description={deleteTarget ? `«${deleteTarget.name}» будет удалён.` : ''}
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); }}
      />
    </div>
  );
}

const STANDARD_TEMPLATE_VARS = ['name', 'email', 'displayName', 'userId'] as const;

function parseExtraVarCsvFromInitial(vars: string | null | undefined): string {
  try {
    const arr = JSON.parse(vars ?? '[]') as unknown;
    if (!Array.isArray(arr)) return '';
    const std = new Set(STANDARD_TEMPLATE_VARS);
    return arr
      .filter((x): x is string => typeof x === 'string' && x.length > 0 && !std.has(x as (typeof STANDARD_TEMPLATE_VARS)[number]))
      .join(', ');
  } catch {
    return '';
  }
}

function mergeTemplateVariablesJson(extraCsv: string): string {
  const extra = extraCsv
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const merged = Array.from(new Set([...STANDARD_TEMPLATE_VARS, ...extra]));
  return JSON.stringify(merged);
}

function TemplateForm({
  initial,
  onClose,
  onSave,
  title,
}: {
  initial?: Template;
  onClose: () => void;
  onSave: (data: { name: string; channel: string; subject?: string; htmlBody?: string; variables?: string }) => void;
  title: string;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [channel, setChannel] = useState(initial?.channel ?? 'email');
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [htmlBody, setHtmlBody] = useState(initial?.htmlBody ?? '');
  const [extraVarCsv, setExtraVarCsv] = useState(() => parseExtraVarCsvFromInitial(initial?.variables));
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function handleAiGenerate() {
    const templateName = name.trim() || 'Шаблон';
    setGenerating(true);
    try {
      const r = await fetch('/api/portal/admin/ai-settings/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: `Сгенерируй тему письма и тело сообщения для шаблона «${templateName}», канал: ${channel}. Для email — тело в HTML (простые теги). Для Telegram — обычный текст. Используй подстановки {{name}}, {{email}} где уместно. Ответь строго в формате:\nТема:\n...\n\nТело:\n...`,
          systemPrompt: 'Ты помогаешь писать шаблоны писем и сообщений для школы AVATERRA. Отвечай только в запрошенном формате: блок Тема, затем блок Тело. Без пояснений.',
          maxTokens: 1024,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Ошибка');
      const content = data.content ?? '';
      const themeMatch = content.match(/Тема:\s*\n?([\s\S]*?)(?=\n\nТело:|$)/i);
      const bodyMatch = content.match(/Тело:\s*\n?([\s\S]*)/i);
      if (themeMatch?.[1]) setSubject(themeMatch[1].trim());
      if (bodyMatch?.[1]) setHtmlBody(bodyMatch[1].trim());
      if (content && !themeMatch?.[1] && !bodyMatch?.[1]) setHtmlBody(content);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка генерации');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="t-name">Название</Label>
            <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="t-channel">Канал</Label>
            <select
              id="t-channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Label htmlFor="t-subject" className="mb-0">Тема (email)</Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={handleAiGenerate} disabled={generating}>
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                <span className="ml-1">{generating ? 'Генерация…' : 'AI сгенерировать'}</span>
              </Button>
            </div>
            <Input id="t-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1" placeholder="Для Telegram не используется" />
          </div>
          <div>
            <Label htmlFor="t-body">Тело (HTML для email, текст для Telegram)</Label>
            <p className="mt-1 text-xs text-[var(--portal-text-muted)]">
              Стандартные подстановки: {'{{name}}'}, {'{{email}}'}, {'{{displayName}}'}, {'{{userId}}'}.
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {(['{{name}}', '{{email}}', '{{displayName}}', '{{userId}}'] as const).map((tag) => (
                <Button
                  key={tag}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setHtmlBody((b) => `${b}${tag}`)}
                >
                  + {tag}
                </Button>
              ))}
            </div>
            <textarea
              id="t-body"
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
              className="mt-2 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm min-h-[120px] font-mono"
              placeholder="Подстановки: {{name}}, {{email}}"
            />
          </div>
          <div>
            <Label htmlFor="t-extra-vars">Дополнительные ключи подстановок (через запятую)</Label>
            <Input
              id="t-extra-vars"
              value={extraVarCsv}
              onChange={(e) => setExtraVarCsv(e.target.value)}
              className="mt-1"
              placeholder="например: courseTitle, city"
            />
          </div>
          {channel === 'email' && htmlBody.trim() && (
            <div>
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => setShowPreview((v) => !v)}>
                <Eye className="mr-1 h-4 w-4" />
                {showPreview ? 'Скрыть превью' : 'Превью (тестовые данные)'}
              </Button>
              {showPreview ? (
                <div className="mt-2 rounded-lg border border-[#E2E8F0] bg-[#fafafa] p-2">
                  <iframe
                    title="email-preview"
                    sandbox=""
                    className="h-72 w-full rounded border border-[#E2E8F0] bg-white"
                    srcDoc={buildPreviewHtml(htmlBody)}
                  />
                </div>
              ) : null}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => {
                setSaving(true);
                onSave({
                  name,
                  channel,
                  subject: subject || undefined,
                  htmlBody: htmlBody || undefined,
                  variables: mergeTemplateVariablesJson(extraVarCsv),
                });
                setSaving(false);
              }}
              disabled={saving || generating || !name.trim()}
            >
              Сохранить
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Отмена
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
