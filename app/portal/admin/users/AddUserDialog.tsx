'use client';

/**
 * Кнопка «Добавить пользователя» и модальное окно с формой создания пользователя.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';

const ROLES = [
  { value: 'user', label: 'Студент' },
  { value: 'manager', label: 'Менеджер' },
  { value: 'admin', label: 'Администратор' },
] as const;

export function AddUserDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<string>('user');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Заполните email и пароль');
      return;
    }
    if (password.length < 6) {
      toast.error('Пароль не менее 6 символов');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/portal/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim() || undefined,
          role,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Ошибка создания');
        return;
      }
      toast.success('Пользователь создан');
      setOpen(false);
      setEmail('');
      setPassword('');
      setDisplayName('');
      setRole('user');
      router.refresh();
    } catch {
      toast.error('Ошибка создания');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Добавить пользователя
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить пользователя</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <Label htmlFor="add-user-email">Email *</Label>
              <Input
                id="add-user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="mt-1"
                required
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="add-user-password">Пароль *</Label>
              <Input
                id="add-user-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Не менее 6 символов"
                className="mt-1"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label htmlFor="add-user-display">Имя (необязательно)</Label>
              <Input
                id="add-user-display"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Отображаемое имя"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="add-user-role">Роль</Label>
              <select
                id="add-user-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--portal-accent)]"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Создание…' : 'Создать'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Отмена
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
