'use client';

/**
 * Manager: search users by email or name. Portal design.
 */
import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Search, ExternalLink } from 'lucide-react';

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
      } else {
        toast.error('Ошибка поиска');
        setProfiles([]);
      }
    } catch {
      toast.error('Ошибка соединения');
      setProfiles([]);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="portal-card p-4 flex flex-wrap gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Email или имя..."
          className="flex-1 min-w-[200px] rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[var(--portal-text)] placeholder:text-[var(--portal-text-soft)] focus:ring-2 focus:ring-[#6366F1] focus:border-[#6366F1]"
        />
        <Button type="submit" variant="primary" disabled={loading}>
          <Search className="h-4 w-4 mr-1.5" />
          {loading ? 'Поиск…' : 'Найти'}
        </Button>
      </form>

      <div className="portal-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="px-4 py-3 font-semibold text-[var(--portal-text)]">Имя</th>
                <th className="px-4 py-3 font-semibold text-[var(--portal-text)]">Email</th>
                <th className="px-4 py-3 font-semibold text-[var(--portal-text)]">Статус</th>
                <th className="px-4 py-3 font-semibold text-[var(--portal-text)]">Дата</th>
                <th className="px-4 py-3 font-semibold text-[var(--portal-text)] w-10"></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--portal-text)]">{p.display_name ?? '—'}</td>
                  <td className="px-4 py-3 text-[var(--portal-text-muted)]">{p.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`status-badge ${p.status === 'active' ? 'badge-active' : 'badge-neutral'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--portal-text-muted)]">
                    {new Date(p.created_at).toLocaleDateString('ru')}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/portal/manager/users/${p.id}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded text-[var(--portal-text-muted)] hover:bg-[#EEF2FF] hover:text-[#6366F1]"
                      title="Открыть карточку"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {profiles.length === 0 && (
        <p className="text-center text-sm text-[var(--portal-text-muted)] py-6">Ничего не найдено.</p>
      )}
    </div>
  );
}
