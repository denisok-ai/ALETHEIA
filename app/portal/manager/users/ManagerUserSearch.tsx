'use client';

/**
 * Manager: search users by email or name.
 */
import { useState } from 'react';

interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
  role: string;
  status: string;
  created_at: string;
}

export function ManagerUserSearch({ initialProfiles }: { initialProfiles: Profile[] }) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/manager/users/search?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles ?? []);
      }
    } catch {
      setProfiles([]);
    }
    setLoading(false);
  }

  return (
    <div className="mt-6">
      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Email или имя..."
          className="flex-1 rounded-lg border border-border px-4 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? 'Поиск…' : 'Найти'}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-soft">
              <th className="px-4 py-2 font-medium text-dark">Имя</th>
              <th className="px-4 py-2 font-medium text-dark">Email</th>
              <th className="px-4 py-2 font-medium text-dark">Статус</th>
              <th className="px-4 py-2 font-medium text-dark">Дата</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-b border-border hover:bg-bg-cream">
                <td className="px-4 py-2 font-medium text-dark">{p.display_name ?? '—'}</td>
                <td className="px-4 py-2 text-text-muted">{p.email ?? '—'}</td>
                <td className="px-4 py-2 text-text-muted">{p.status}</td>
                <td className="px-4 py-2 text-text-muted">
                  {new Date(p.created_at).toLocaleDateString('ru')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {profiles.length === 0 && (
        <p className="mt-4 text-center text-text-muted">Ничего не найдено.</p>
      )}
    </div>
  );
}
