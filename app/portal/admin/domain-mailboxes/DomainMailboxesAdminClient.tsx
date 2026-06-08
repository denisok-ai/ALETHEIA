'use client';

/**
 * Admin: создание ящиков @avaterra.pro и управление статусом.
 */
import { useCallback, useState } from 'react';
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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loader2 } from 'lucide-react';

export type DomainMailboxRow = {
  id: string;
  email: string;
  localPart: string;
  domain: string;
  label: string;
  status: string;
  provisioningKind: string;
  createdAt: string;
  inboundMailbox: {
    id: string;
    enabled: boolean;
    lastSyncedAt: string | null;
    lastSyncStatus: string | null;
    lastSyncError: string | null;
    lastSyncCheckedAt: string | null;
  } | null;
};

export function DomainMailboxesAdminClient({
  initialItems,
  provisioningMode,
  mailDomain,
}: {
  initialItems: DomainMailboxRow[];
  provisioningMode: string;
  mailDomain: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [localPart, setLocalPart] = useState('');
  const [label, setLabel] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lastCreatedPassword, setLastCreatedPassword] = useState<string | null>(null);

  const [pwdMailboxId, setPwdMailboxId] = useState<string | null>(null);
  const [pwdMailboxEmail, setPwdMailboxEmail] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newPwd2, setNewPwd2] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  const handlePwdDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && !pwdSaving) {
        setPwdMailboxId(null);
        setNewPwd('');
        setNewPwd2('');
      }
    },
    [pwdSaving]
  );

  async function refresh() {
    const res = await fetch('/api/portal/admin/domain-mailboxes', { cache: 'no-store' });
    const data = (await res.json()) as { items?: DomainMailboxRow[] };
    if (res.ok && data.items) setItems(data.items);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setLastCreatedPassword(null);
    try {
      const res = await fetch('/api/portal/admin/domain-mailboxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localPart,
          label: label || localPart,
          password: password.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        plainPassword?: string;
        email?: string;
      };
      if (!res.ok) {
        toast.error(data.error || 'Не удалось создать ящик');
        return;
      }
      toast.success(`Создан ящик ${data.email ?? ''}`);
      if (data.plainPassword) setLastCreatedPassword(data.plainPassword);
      setLocalPart('');
      setLabel('');
      setPassword('');
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function patchAction(id: string, action: 'suspend' | 'resume') {
    const res = await fetch(`/api/portal/admin/domain-mailboxes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast.error(data.error || 'Ошибка');
      return;
    }
    toast.success(action === 'suspend' ? 'Ящик приостановлен' : 'Ящик снова активен');
    await refresh();
  }

  async function submitPasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!pwdMailboxId) return;
    if (newPwd !== newPwd2) {
      toast.error('Пароли не совпадают');
      return;
    }
    setPwdSaving(true);
    try {
      const res = await fetch(`/api/portal/admin/domain-mailboxes/${pwdMailboxId}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPwd }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || 'Не удалось сменить пароль');
        return;
      }
      toast.success('Пароль обновлён — можно снова запустить синхронизацию IMAP');
      setPwdMailboxId(null);
      setNewPwd('');
      setNewPwd2('');
      await refresh();
    } finally {
      setPwdSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/portal/admin/domain-mailboxes/${deleteId}`, { method: 'DELETE' });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || 'Не удалось удалить');
        return;
      }
      toast.success('Ящик удалён');
      setDeleteId(null);
      await refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-[var(--portal-border)] bg-[var(--portal-surface)] p-4 md:p-6 space-y-4">
        <h2 className="text-base font-semibold text-[var(--portal-text)]">Создать ящик @{mailDomain}</h2>
        <p className="text-sm text-[var(--portal-muted)]">
          Режим провижининга на сервере: <strong>{provisioningMode || 'none'}</strong>
          {provisioningMode === 'mailcow'
            ? ' — ящик создаётся в Mailcow через API.'
            : ' — запись только в БД и IMAP; создайте ящик вручную в Mailcow с тем же паролем.'}
        </p>
        {lastCreatedPassword ? (
          <div
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
            role="status"
          >
            <strong>Сохраните пароль</strong> (показывается один раз):{' '}
            <code className="break-all">{lastCreatedPassword}</code>
          </div>
        ) : null}
        <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="dm-local">Имя (до @)</Label>
            <Input
              id="dm-local"
              value={localPart}
              onChange={(e) => setLocalPart(e.target.value)}
              placeholder="support"
              autoComplete="off"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dm-label">Подпись / метка</Label>
            <Input
              id="dm-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Поддержка"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="dm-pwd">Пароль (необязательно)</Label>
            <Input
              id="dm-pwd"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Оставьте пустым — сгенерируем автоматически"
              autoComplete="new-password"
            />
          </div>
          <div className="md:col-span-2 lg:col-span-4">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Создание…
                </>
              ) : (
                'Создать ящик'
              )}
            </Button>
          </div>
        </form>
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold text-[var(--portal-text)]">Список ящиков</h2>
        {items.length === 0 ? (
          <EmptyState title="Нет ящиков" description="Создайте первый ящик выше." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--portal-border)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>IMAP синк</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.email}</div>
                      <div className="text-xs text-[var(--portal-muted)]">{row.label}</div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          row.status === 'active' ? 'text-emerald-400' : 'text-amber-400'
                        }
                      >
                        {row.status}
                      </span>
                      <div className="text-xs text-[var(--portal-muted)]">{row.provisioningKind}</div>
                    </TableCell>
                    <TableCell className="text-sm text-[var(--portal-muted)]">
                      {row.inboundMailbox ? (
                        <>
                          <div>last: {row.inboundMailbox.lastSyncStatus ?? '—'}</div>
                          <div className="text-xs">
                            {row.inboundMailbox.lastSyncedAt
                              ? new Date(row.inboundMailbox.lastSyncedAt).toLocaleString()
                              : 'ещё не синхронизировался'}
                          </div>
                          {row.inboundMailbox.lastSyncError ? (
                            <div className="text-xs text-red-400">{row.inboundMailbox.lastSyncError}</div>
                          ) : null}
                        </>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {row.status === 'active' ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => patchAction(row.id, 'suspend')}
                        >
                          Пауза
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => patchAction(row.id, 'resume')}
                        >
                          Включить
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setPwdMailboxId(row.id);
                          setPwdMailboxEmail(row.email);
                          setNewPwd('');
                          setNewPwd2('');
                        }}
                      >
                        Пароль
                      </Button>
                      <Button type="button" variant="danger" size="sm" onClick={() => setDeleteId(row.id)}>
                        Удалить
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={pwdMailboxId !== null} onOpenChange={handlePwdDialogOpenChange}>
        <DialogContent className="max-w-lg border-[var(--portal-border)] bg-[var(--portal-surface)]">
          <DialogHeader>
            <DialogTitle>Сменить пароль ящика</DialogTitle>
          </DialogHeader>
          <p className="mb-4 text-sm text-[var(--portal-muted)]">
            <span className="font-mono">{pwdMailboxEmail}</span>
            {provisioningMode !== 'mailcow' ? (
              <>
                {' '}
                — режим провижининга <strong>не mailcow</strong>: после смены укажите тот же пароль вручную в Mailcow,
                иначе Dovecot не примет входящее подключение.
              </>
            ) : (
              <> — пароль будет отправлен в Mailcow через API.</>
            )}
          </p>
          <form onSubmit={submitPasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dm-new-pwd">Новый пароль</Label>
              <Input
                id="dm-new-pwd"
                type="password"
                autoComplete="new-password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dm-new-pwd2">Повтор пароля</Label>
              <Input
                id="dm-new-pwd2"
                type="password"
                autoComplete="new-password"
                value={newPwd2}
                onChange={(e) => setNewPwd2(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setPwdMailboxId(null);
                  setNewPwd('');
                  setNewPwd2('');
                }}
                disabled={pwdSaving}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={pwdSaving}>
                {pwdSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Сохранение…
                  </>
                ) : (
                  'Сохранить'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && !deleting && setDeleteId(null)}
        title="Удалить ящик?"
        description="Запись в приложении и (при режиме mailcow) ящик на почтовом сервере будут удалены. Это необратимо."
        confirmLabel="Удалить"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
