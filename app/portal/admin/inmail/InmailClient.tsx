'use client';

/**
 * Админка: входящая почта (IMAP), список, просмотр, ответ SMTP, настройка ящика.
 */
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { format } from 'date-fns';
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
import { Loader2, Inbox, RefreshCw, Plus, Pencil, Trash2, Send } from 'lucide-react';

type MailboxRow = {
  id: string;
  label: string;
  imapHost: string;
  imapPort: number;
  imapTls: boolean;
  username: string;
  folder: string;
  lastUid: number | null;
  lastSyncedAt: string | null;
  lastSyncStatus?: string | null;
  lastSyncError?: string | null;
  lastSyncCheckedAt?: string | null;
  retentionDays?: number;
  enabled: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpTls: boolean | null;
  hasPassword: boolean;
};

type MessageRow = {
  id: string;
  mailboxId: string;
  mailboxLabel: string;
  fromAddress: string;
  fromName: string | null;
  subject: string | null;
  receivedAt: string;
  snippet: string | null;
  hasAttachments: boolean;
  matchedUserId: string | null;
  matchedUser: { id: string; email: string; displayName: string | null } | null;
};

type MessageDetail = MessageRow & {
  toAddresses: string[];
  inReplyTo: string | null;
  references: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  messageId: string | null;
};

export function InmailClient() {
  const [mailboxes, setMailboxes] = useState<MailboxRow[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>('');
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [fromFilter, setFromFilter] = useState('');
  const [unmatchedOnly, setUnmatchedOnly] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [detail, setDetail] = useState<MessageDetail | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);

  const [mailboxDialog, setMailboxDialog] = useState(false);
  const [editingMailbox, setEditingMailbox] = useState<MailboxRow | null>(null);
  const [deleteMailbox, setDeleteMailbox] = useState<MailboxRow | null>(null);

  const loadMailboxes = useCallback(async () => {
    const res = await fetch('/api/portal/admin/inmail/mailboxes');
    if (!res.ok) {
      toast.error('Не удалось загрузить ящики');
      return;
    }
    const data = (await res.json()) as { mailboxes: MailboxRow[] };
    setMailboxes(data.mailboxes);
    setSelectedMailboxId((prev) => {
      if (prev && data.mailboxes.some((m) => m.id === prev)) return prev;
      return data.mailboxes[0]?.id ?? '';
    });
  }, []);

  const loadMessages = useCallback(async () => {
    setLoadingList(true);
    try {
      const sp = new URLSearchParams();
      sp.set('page', String(page));
      sp.set('pageSize', String(pageSize));
      if (selectedMailboxId) sp.set('mailboxId', selectedMailboxId);
      if (fromFilter.trim()) sp.set('from', fromFilter.trim());
      if (unmatchedOnly) sp.set('unmatchedOnly', 'true');
      const res = await fetch(`/api/portal/admin/inmail/messages?${sp}`);
      if (!res.ok) {
        toast.error('Не удалось загрузить письма');
        return;
      }
      const data = (await res.json()) as { messages: MessageRow[]; total: number };
      setMessages(data.messages);
      setTotal(data.total);
    } finally {
      setLoadingList(false);
    }
  }, [page, selectedMailboxId, fromFilter, unmatchedOnly]);

  useEffect(() => {
    void loadMailboxes();
  }, [loadMailboxes]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  async function handleSync() {
    if (!selectedMailboxId) {
      toast.error('Выберите ящик');
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch(`/api/portal/admin/inmail/mailboxes/${selectedMailboxId}/sync`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'Ошибка синхронизации');
        return;
      }
      toast.success(`Импортировано: ${data.imported ?? 0}`);
      await loadMailboxes();
      await loadMessages();
    } finally {
      setSyncing(false);
    }
  }

  async function openDetail(id: string) {
    const res = await fetch(`/api/portal/admin/inmail/messages/${id}`);
    if (!res.ok) {
      toast.error('Не удалось открыть письмо');
      return;
    }
    const data = (await res.json()) as { message: MessageDetail };
    setDetail(data.message);
    setReplyText('');
  }

  async function sendReply() {
    if (!detail || !replyText.trim()) return;
    setReplySending(true);
    try {
      const res = await fetch(`/api/portal/admin/inmail/messages/${detail.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: replyText.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'Ошибка отправки');
        return;
      }
      toast.success('Ответ отправлен');
      setReplyText('');
    } finally {
      setReplySending(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="portal-card p-6 space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px] space-y-2">
            <Label>Ящик IMAP</Label>
            <select
              className="flex h-10 w-full rounded-md border border-[var(--portal-border)] bg-[var(--portal-surface)] px-3 text-sm"
              value={selectedMailboxId}
              onChange={(e) => {
                setSelectedMailboxId(e.target.value);
                setPage(1);
              }}
            >
              {mailboxes.length === 0 && <option value="">— Нет ящиков —</option>}
              {mailboxes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} {!m.enabled ? '(выкл.)' : ''}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" variant="secondary" onClick={() => handleSync()} disabled={!selectedMailboxId || syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Синхронизировать</span>
          </Button>
          <Button type="button" onClick={() => { setEditingMailbox(null); setMailboxDialog(true); }}>
            <Plus className="h-4 w-4" />
            <span className="ml-2">Новый ящик</span>
          </Button>
          {selectedMailboxId && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const m = mailboxes.find((x) => x.id === selectedMailboxId);
                if (m) {
                  setEditingMailbox(m);
                  setMailboxDialog(true);
                }
              }}
            >
              <Pencil className="h-4 w-4" />
              <span className="ml-2">Изменить</span>
            </Button>
          )}
        </div>
        {selectedMailboxId && (
          <>
            <p className="text-xs text-[var(--portal-text-muted)]">
              Последняя синхронизация:{' '}
              {mailboxes.find((m) => m.id === selectedMailboxId)?.lastSyncedAt
                ? format(new Date(mailboxes.find((m) => m.id === selectedMailboxId)!.lastSyncedAt!), 'dd.MM.yyyy HH:mm')
                : '—'}
              . Автоматически: cron{' '}
              <code className="rounded bg-[#F1F5F9] px-1">GET /api/cron/inmail-sync</code> с CRON_SECRET.
            </p>
            {mailboxes.find((m) => m.id === selectedMailboxId)?.lastSyncError?.trim() ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                <strong>Ошибка последней синхронизации:</strong>{' '}
                {mailboxes.find((m) => m.id === selectedMailboxId)?.lastSyncError}
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="portal-card p-6 space-y-4">
        <h2 className="text-base font-semibold text-[var(--portal-text)] flex items-center gap-2">
          <Inbox className="h-4 w-4" />
          Входящие
        </h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="inmail_from">От (поиск)</Label>
            <Input
              id="inmail_from"
              value={fromFilter}
              onChange={(e) => setFromFilter(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setPage(1)}
              placeholder="email…"
              className="w-56"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
            <input
              type="checkbox"
              checked={unmatchedOnly}
              onChange={(e) => {
                setUnmatchedOnly(e.target.checked);
                setPage(1);
              }}
            />
            Только без пользователя в базе
          </label>
          <Button type="button" variant="secondary" size="sm" onClick={() => { setPage(1); void loadMessages(); }}>
            Применить
          </Button>
        </div>

        {loadingList && messages.length === 0 ? (
          <div className="flex justify-center py-12 text-[var(--portal-text-muted)]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <EmptyState title="Нет писем" description="Настройте ящик и нажмите «Синхронизировать»." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>От</TableHead>
                  <TableHead>Тема</TableHead>
                  <TableHead>Пользователь</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => void openDetail(row.id)}
                  >
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(row.receivedAt), 'dd.MM.yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{row.fromAddress}</div>
                      {row.fromName && <div className="text-xs text-[var(--portal-text-muted)]">{row.fromName}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{row.subject || '(без темы)'}</div>
                      {row.snippet && (
                        <div className="text-xs text-[var(--portal-text-muted)] line-clamp-1">{row.snippet}</div>
                      )}
                      {row.hasAttachments && (
                        <span className="text-xs text-amber-700">вложения</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.matchedUser ? (
                        <Link
                          href={`/portal/admin/users/${row.matchedUser.id}`}
                          className="text-[var(--portal-accent)] hover:underline text-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.matchedUser.email}
                        </Link>
                      ) : (
                        <span className="text-xs text-[var(--portal-text-muted)]">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--portal-text-muted)]">
                Всего: {total}. Стр. {page} / {totalPages}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Назад
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Вперёд
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.subject || '(без темы)'}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="text-[var(--portal-text-muted)]">
                <div>От: {detail.fromName ? `${detail.fromName} ` : ''}&lt;{detail.fromAddress}&gt;</div>
                <div>Кому: {detail.toAddresses.join(', ') || '—'}</div>
                <div>{format(new Date(detail.receivedAt), 'dd.MM.yyyy HH:mm')}</div>
                {detail.matchedUser && (
                  <div>
                    Пользователь:{' '}
                    <Link href={`/portal/admin/users/${detail.matchedUser.id}`} className="text-[var(--portal-accent)] hover:underline">
                      {detail.matchedUser.email}
                    </Link>
                  </div>
                )}
              </div>
              {detail.bodyHtml ? (
                <iframe
                  title="html-body"
                  className="w-full min-h-[240px] rounded border border-[var(--portal-border)] bg-white"
                  sandbox=""
                  srcDoc={detail.bodyHtml}
                />
              ) : (
                <pre className="whitespace-pre-wrap rounded border border-[var(--portal-border)] p-3 bg-[var(--portal-surface)]">
                  {detail.bodyText || '—'}
                </pre>
              )}
              <div className="space-y-2 border-t border-[var(--portal-border)] pt-4">
                <Label>Ответ через SMTP ящика</Label>
                <p className="text-xs text-[var(--portal-text-muted)]">
                  Ответ <strong>не</strong> идёт через Resend (массовая/транзакционная почта сайта). Отправка — через SMTP этого входящего ящика (пароль приложения в настройках ящика). Типичные хосты: smtp.yandex.ru:587, smtp.mail.ru:465 или 587, smtp.gmail.com:587.
                </p>
                <textarea
                  className="w-full min-h-[120px] rounded-md border border-[var(--portal-border)] bg-[var(--portal-surface)] p-3 text-sm"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Текст ответа…"
                />
                <Button type="button" onClick={() => void sendReply()} disabled={replySending || !replyText.trim()}>
                  {replySending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span className="ml-2">Отправить ответ</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <MailboxFormDialog
        open={mailboxDialog}
        onOpenChange={setMailboxDialog}
        initial={editingMailbox}
        onSaved={async () => {
          setMailboxDialog(false);
          setEditingMailbox(null);
          await loadMailboxes();
        }}
        onDelete={(m) => {
          setMailboxDialog(false);
          setDeleteMailbox(m);
        }}
      />

      <ConfirmDialog
        open={!!deleteMailbox}
        onOpenChange={(o) => !o && setDeleteMailbox(null)}
        title="Удалить ящик?"
        description={deleteMailbox ? `Будут удалены все импортированные письма: «${deleteMailbox.label}».` : ''}
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={async () => {
          if (!deleteMailbox) return;
          const res = await fetch(`/api/portal/admin/inmail/mailboxes/${deleteMailbox.id}`, { method: 'DELETE' });
          setDeleteMailbox(null);
          if (!res.ok) {
            toast.error('Не удалось удалить');
            return;
          }
          toast.success('Ящик удалён');
          await loadMailboxes();
          setSelectedMailboxId('');
        }}
      />
    </div>
  );
}

function MailboxFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: MailboxRow | null;
  onSaved: () => void | Promise<void>;
  onDelete: (m: MailboxRow) => void;
}) {
  const [label, setLabel] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('993');
  const [imapTls, setImapTls] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [folder, setFolder] = useState('INBOX');
  const [enabled, setEnabled] = useState(true);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpTls, setSmtpTls] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setLabel(initial.label);
      setImapHost(initial.imapHost);
      setImapPort(String(initial.imapPort));
      setImapTls(initial.imapTls);
      setUsername(initial.username);
      setPassword('');
      setFolder(initial.folder);
      setEnabled(initial.enabled);
      setSmtpHost(initial.smtpHost ?? '');
      setSmtpPort(initial.smtpPort != null ? String(initial.smtpPort) : '587');
      setSmtpTls(initial.smtpTls !== false);
    } else {
      setLabel('');
      setImapHost('');
      setImapPort('993');
      setImapTls(true);
      setUsername('');
      setPassword('');
      setFolder('INBOX');
      setEnabled(true);
      setSmtpHost('');
      setSmtpPort('587');
      setSmtpTls(true);
    }
  }, [open, initial]);

  function applyMailboxPreset(kind: 'yandex' | 'mailru' | 'gmail') {
    if (kind === 'yandex') {
      setImapHost('imap.yandex.ru');
      setImapPort('993');
      setImapTls(true);
      setSmtpHost('smtp.yandex.ru');
      setSmtpPort('587');
      setSmtpTls(true);
    } else if (kind === 'mailru') {
      setImapHost('imap.mail.ru');
      setImapPort('993');
      setImapTls(true);
      setSmtpHost('smtp.mail.ru');
      setSmtpPort('465');
      setSmtpTls(true);
    } else {
      setImapHost('imap.gmail.com');
      setImapPort('993');
      setImapTls(true);
      setSmtpHost('smtp.gmail.com');
      setSmtpPort('587');
      setSmtpTls(true);
    }
  }

  async function submit() {
    if (!label.trim() || !imapHost.trim() || !username.trim()) {
      toast.error('Заполните название, IMAP-хост и логин');
      return;
    }
    if (!initial && !password.trim()) {
      toast.error('Укажите пароль приложения');
      return;
    }
    setSaving(true);
    try {
      if (initial) {
        const body: Record<string, unknown> = {
          label: label.trim(),
          imapHost: imapHost.trim(),
          imapPort: Number(imapPort) || 993,
          imapTls,
          username: username.trim(),
          folder: folder.trim() || 'INBOX',
          enabled,
          smtpHost: smtpHost.trim() || null,
          smtpPort: smtpPort.trim() ? Number(smtpPort) : null,
          smtpTls,
        };
        if (password.trim()) body.password = password.trim();
        const res = await fetch(`/api/portal/admin/inmail/mailboxes/${initial.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          toast.error(typeof d.error === 'string' ? d.error : 'Ошибка сохранения');
          return;
        }
        toast.success('Сохранено');
      } else {
        const res = await fetch('/api/portal/admin/inmail/mailboxes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: label.trim(),
            imapHost: imapHost.trim(),
            imapPort: Number(imapPort) || 993,
            imapTls,
            username: username.trim(),
            password: password.trim(),
            folder: folder.trim() || 'INBOX',
            enabled,
            smtpHost: smtpHost.trim() || null,
            smtpPort: smtpPort.trim() ? Number(smtpPort) : null,
            smtpTls,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          toast.error(typeof d.error === 'string' ? d.error : 'Ошибка создания');
          return;
        }
        toast.success('Ящик создан');
      }
      onOpenChange(false);
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Ящик IMAP' : 'Новый ящик IMAP'}</DialogTitle>
          <p className="text-xs text-[var(--portal-text-muted)]">
            Используйте <strong>пароль приложения</strong>, не основной пароль аккаунта. Ответы из «Входящих» отправляются через SMTP этого ящика, не через Resend.
          </p>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <Label>Название</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Поддержка" />
          </div>
          <div className="space-y-1">
            <Label>IMAP хост</Label>
            <Input value={imapHost} onChange={(e) => setImapHost(e.target.value)} placeholder="imap.yandex.ru" />
          </div>
          <div className="flex gap-2">
            <div className="space-y-1 flex-1">
              <Label>Порт</Label>
              <Input value={imapPort} onChange={(e) => setImapPort(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 pt-7">
              <input type="checkbox" checked={imapTls} onChange={(e) => setImapTls(e.target.checked)} />
              TLS
            </label>
          </div>
          <div className="space-y-1">
            <Label>Логин (email)</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Пароль приложения {initial && '(оставьте пустым, чтобы не менять)'}</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="rounded-lg border border-dashed border-[var(--portal-border)] p-3 space-y-2">
            <p className="text-xs font-medium text-[var(--portal-text-muted)]">Подсказки провайдеров</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => applyMailboxPreset('yandex')}>
                Яндекс
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => applyMailboxPreset('mailru')}>
                Mail.ru
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => applyMailboxPreset('gmail')}>
                Gmail
              </Button>
            </div>
            <p className="text-[10px] leading-snug text-[var(--portal-text-muted)]">
              Яндекс: imap.yandex.ru / smtp.yandex.ru:587 · Mail.ru: imap.mail.ru / smtp.mail.ru:465 или 587 · Gmail:
              imap.gmail.com / smtp.gmail.com:587
            </p>
          </div>
          <div className="space-y-1">
            <Label>Папка</Label>
            <Input value={folder} onChange={(e) => setFolder(e.target.value)} />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Включён
          </label>
          <div className="border-t border-[var(--portal-border)] pt-3 space-y-2">
            <p className="font-medium text-xs text-[var(--portal-text-muted)]">SMTP (ответы)</p>
            <div className="space-y-1">
              <Label>SMTP хост (пусто = как IMAP)</Label>
              <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.yandex.ru" />
            </div>
            <div className="flex gap-2 items-end">
              <div className="space-y-1 flex-1">
                <Label>SMTP порт</Label>
                <Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 pb-2">
                <input type="checkbox" checked={smtpTls} onChange={(e) => setSmtpTls(e.target.checked)} />
                TLS/STARTTLS
              </label>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" onClick={() => void submit()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span className="ml-2">Сохранить</span>
            </Button>
            {initial && (
              <Button type="button" variant="danger" onClick={() => initial && onDelete(initial)}>
                <Trash2 className="h-4 w-4" />
                <span className="ml-2">Удалить…</span>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
