/**
 * Student: profile and settings.
 */
import { getUser } from '@/lib/auth';

export default async function StudentProfilePage() {
  const { user, profile } = await getUser();

  if (!user) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Профиль</h1>
        <p className="mt-2 text-text-muted">Загрузка…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-dark">Профиль</h1>
      <p className="mt-1 text-text-muted">Ваши данные и настройки</p>

      <div className="mt-6 max-w-md space-y-4 rounded-xl border border-border bg-white p-6">
        <div>
          <label className="text-sm font-medium text-text-muted">Email</label>
          <p className="text-dark">{user.email ?? '—'}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-text-muted">Имя</label>
          <p className="text-dark">{profile?.display_name ?? '—'}</p>
        </div>
      </div>
    </div>
  );
}
