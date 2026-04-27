'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const ROLES = ['user', 'manager', 'admin'] as const;
const STATUSES = ['active', 'archived'] as const;

export function UserDetailClient({
  userId,
  accountEmail,
  createdAt,
  initialRole,
  initialStatus,
  initialDisplayName,
  initialEmail,
}: {
  userId: string;
  /** Email для входа в систему (User.email), только чтение */
  accountEmail: string;
  createdAt: string;
  initialRole: string;
  initialStatus: string;
  initialDisplayName: string | null;
  initialEmail: string | null;
}) {
  const [role, setRole] = useState(initialRole);
  const [status, setStatus] = useState(initialStatus);
  const [displayName, setDisplayName] = useState(initialDisplayName ?? '');
  const [email, setEmail] = useState(initialEmail ?? '');
  const [updating, setUpdating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  async function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    setUpdating(true);
    try {
      const res = await fetch(`/api/portal/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: v }),
      });
      if (!res.ok) throw new Error(await res.text());
      setRole(v);
      toast.success('Роль обновлена');
    } catch (e) {
      console.error(e);
      toast.error('Ошибка обновления');
    }
    setUpdating(false);
  }

  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    setUpdating(true);
    try {
      const res = await fetch(`/api/portal/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: v }),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus(v);
      toast.success('Статус обновлён');
    } catch (e) {
      console.error(e);
      toast.error('Ошибка обновления');
    }
    setUpdating(false);
  }

  async function handleResetPassword() {
    setShowResetConfirm(false);
    setResetting(true);
    try {
      const res = await fetch(`/api/portal/admin/users/${userId}/reset-password`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { tempPassword?: string; message?: string };
      toast.success(
        data.message ?? 'Пароль сброшен',
        { description: `Временный пароль: ${data.tempPassword ?? ''} (скопируйте и передайте пользователю)` }
      );
    } catch (e) {
      console.error(e);
      toast.error('Ошибка сброса пароля');
    }
    setResetting(false);
  }

  async function handleSaveProfile() {
    setSavingProfile(true);
    try {
      const res = await fetch(`/api/portal/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          email: email.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success('Профиль обновлён');
    } catch (e) {
      console.error(e);
      toast.error('Ошибка обновления');
    }
    setSavingProfile(false);
  }

  return (
    <>
      <div className="portal-card p-4">
        <h2 className="text-lg font-semibold text-[var(--portal-text)]">Учётная запись</h2>
        <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
          Данные входа и доступа. Смена email для входа — отдельной операцией (при необходимости через БД).
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-[var(--portal-text-muted)]">Email для входа</Label>
            <Input readOnly value={accountEmail} className="mt-1 max-w-md bg-[#F8FAFC]" aria-readonly />
          </div>
          <div>
            <Label className="text-[var(--portal-text-muted)]">Дата регистрации</Label>
            <p className="mt-2 text-sm font-medium text-[var(--portal-text)]">
              {format(new Date(createdAt), 'dd.MM.yyyy HH:mm')}
            </p>
          </div>
          <div>
            <Label className="text-sm text-[var(--portal-text-muted)]">Роль</Label>
            <select
              value={role}
              onChange={handleRoleChange}
              disabled={updating}
              className="mt-1 block rounded border border-[#E2E8F0] bg-white px-2 py-1.5 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-sm text-[var(--portal-text-muted)]">Статус</Label>
            <select
              value={status}
              onChange={handleStatusChange}
              disabled={updating}
              className="mt-1 block rounded border border-[#E2E8F0] bg-white px-2 py-1.5 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 border-t border-[#E2E8F0] pt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowResetConfirm(true)}
            disabled={resetting}
          >
            {resetting ? 'Сброс…' : 'Сбросить пароль'}
          </Button>
          <p className="mt-2 text-xs text-[var(--portal-text-muted)]">
            Будет сгенерирован временный пароль — передайте его пользователю безопасным каналом.
          </p>
        </div>
      </div>

      <div className="portal-card p-4">
        <h2 className="text-lg font-semibold text-[var(--portal-text)]">Профиль и контакты</h2>
        <div className="mt-3 space-y-3">
          <div>
            <Label className="text-[var(--portal-text-muted)]">Отображаемое имя</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 max-w-xs"
              placeholder="Отображаемое имя"
            />
          </div>
          <div>
            <Label className="text-[var(--portal-text-muted)]">Email в профиле (контакт)</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 max-w-xs"
              placeholder="email@example.com"
            />
          </div>
          <Button size="sm" onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile ? 'Сохранение…' : 'Сохранить профиль'}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        title="Сброс пароля"
        description="Будет сгенерирован новый временный пароль. Пользователю нужно будет войти с ним и сменить пароль. Продолжить?"
        confirmLabel="Сбросить"
        onConfirm={handleResetPassword}
      />
    </>
  );
}
