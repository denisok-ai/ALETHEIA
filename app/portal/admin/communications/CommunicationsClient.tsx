'use client';

/**
 * Admin Communications: CRUD templates, send form (Resend/Telegram), recent sends.
 */
import { useState, useEffect } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Plus, Pencil, Trash2, Send, Search, Mail } from 'lucide-react';
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
}

interface RecipientUser {
  id: string;
  email: string | null;
  displayName: string;
  telegramId: number | null;
}

const CHANNELS = ['email', 'telegram'] as const;
const ROLES = ['user', 'manager', 'admin'] as const;

export function CommunicationsClient({
  initialTemplates,
  initialSends,
}: {
  initialTemplates: Template[];
  initialSends: CommsSendRow[];
}) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [sends, setSends] = useState<CommsSendRow[]>(initialSends);
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

  useEffect(() => {
    fetch('/api/portal/admin/comms/recipients')
      .then((r) => r.json())
      .then((d) => setRecipients(d.users ?? []))
      .catch(() => {});
  }, []);

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

  async function loadSends() {
    const r = await fetch('/api/portal/admin/comms/sends');
    if (r.ok) {
      const d = await r.json();
      setSends(d.sends ?? []);
    }
  }

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

  async function refetchSends() {
    const r = await fetch('/api/portal/admin/comms/sends');
    if (r.ok) {
      const d = await r.json();
      setSends(d.sends ?? []);
    }
  }

  async function handleSend() {
    if (!sendTemplateId) {
      toast.error('Выберите шаблон');
      return;
    }
    setSending(true);
    try {
      const body: {
        templateId: string;
        recipientType: string;
        role?: string;
        recipientIds?: string[];
        groupIds?: string[];
        excludeGroupIds?: string[];
      } = { templateId: sendTemplateId, recipientType };
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
      toast.success(`Отправлено: ${data.sent}, ошибок: ${data.failed}`);
      setSendTemplateId('');
      setRecipientIds([]);
      setSendGroupIds([]);
      setSendExcludeGroupIds([]);
      await refetchSends();
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

  return (
    <div className="mt-6 space-y-8">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-dark">Шаблоны</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                placeholder="Найти в списке"
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                className="w-48 rounded-lg border border-border bg-white py-2 pl-8 pr-3 text-sm text-dark placeholder:text-text-muted"
                aria-label="Найти в списке"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Добавить
            </Button>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">№</TableHead>
                <TableHead>Название</TableHead>
                <TableHead>Канал</TableHead>
                <TableHead>Тема</TableHead>
                <TableHead className="w-24">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.length === 0 ? (
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
                filteredTemplates.map((t, idx) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-text-muted">{idx + 1}</TableCell>
                    <TableCell className="font-medium text-dark">{t.name}</TableCell>
                    <TableCell className="text-text-muted">{t.channel}</TableCell>
                    <TableCell className="text-text-muted">{t.subject ?? '—'}</TableCell>
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
      </section>

      <section>
        <h2 className="text-lg font-semibold text-dark">Отправить</h2>
        <div className="mt-3 rounded-xl border border-border bg-white p-4 space-y-4 max-w-xl">
          <div>
            <Label>Шаблон</Label>
            <select
              value={sendTemplateId}
              onChange={(e) => setSendTemplateId(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
            >
              <option value="">Выберите шаблон</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.channel})</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Получатели</Label>
            <select
              value={recipientType}
              onChange={(e) => setRecipientType(e.target.value as 'all' | 'role' | 'list' | 'groups')}
              className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
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
                className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
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
              <div className="mt-1 max-h-40 overflow-y-auto rounded border border-border bg-white p-2 space-y-1">
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
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-border p-2">
                {userGroups.length === 0 ? (
                  <p className="text-sm text-text-muted">Нет групп. Создайте группы в разделе «Пользователи».</p>
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
          <Button
            onClick={handleSend}
            disabled={
              sending ||
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
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-dark">Последние отправки</h2>
          <Button type="button" variant="ghost" size="sm" onClick={() => loadSends()}>
            Обновить
          </Button>
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Канал</TableHead>
                <TableHead>Получатель</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sends.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-text-muted py-6">
                    Нет отправок
                  </TableCell>
                </TableRow>
              ) : (
                sends.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-text-muted">{format(new Date(s.sentAt), 'dd.MM.yyyy HH:mm')}</TableCell>
                    <TableCell className="text-text-muted">{s.channel}</TableCell>
                    <TableCell className="text-text-muted">{s.recipient}</TableCell>
                    <TableCell className="text-text-muted">{s.status}</TableCell>
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
      </section>

      {detailSend && (
        <Dialog open onOpenChange={(open) => !open && setDetailSend(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Рассылка: {detailSend.id}</DialogTitle>
            </DialogHeader>
            <dl className="mt-2 space-y-1 text-sm">
              <div><dt className="text-text-muted inline">Канал: </dt><dd className="inline">{detailSend.channel}</dd></div>
              <div><dt className="text-text-muted inline">Получатель: </dt><dd className="inline break-all">{detailSend.recipient}</dd></div>
              {detailSend.subject && <div><dt className="text-text-muted inline">Тема: </dt><dd className="inline">{detailSend.subject}</dd></div>}
              <div><dt className="text-text-muted inline">Статус: </dt><dd className="inline">{detailSend.status}</dd></div>
              <div><dt className="text-text-muted inline">Дата: </dt><dd className="inline">{format(new Date(detailSend.sentAt), 'dd.MM.yyyy HH:mm:ss')}</dd></div>
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
  const [saving, setSaving] = useState(false);

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
              className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="t-subject">Тема (email)</Label>
            <Input id="t-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1" placeholder="Для Telegram не используется" />
          </div>
          <div>
            <Label htmlFor="t-body">Тело (HTML для email, текст для Telegram)</Label>
            <textarea
              id="t-body"
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm min-h-[120px] font-mono"
              placeholder="Подстановки: {{name}}, {{email}}"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => {
                setSaving(true);
                onSave({ name, channel, subject: subject || undefined, htmlBody: htmlBody || undefined });
                setSaving(false);
              }}
              disabled={saving || !name.trim()}
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
