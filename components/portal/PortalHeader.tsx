'use client';

/**
 * Portal header: logo, user menu, logout.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChevronDown, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Profile } from '@/lib/auth';

interface PortalHeaderProps {
  user: { email?: string | null };
  profile: Profile | null;
}

export function PortalHeader({ user, profile }: PortalHeaderProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    window.location.href = '/login';
  }

  const displayName = profile?.display_name || user?.email || 'Пользователь';

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-white px-4 shadow-sm">
      <Link href="/" className="font-heading text-lg font-bold text-primary">
        AVATERRA
      </Link>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-dark hover:bg-bg-soft"
        >
          <span className="max-w-[140px] truncate">{displayName}</span>
          <ChevronDown className={cn('h-4 w-4 transition', open && 'rotate-180')} />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-white py-1 shadow-lg">
            <div className="border-b border-border px-3 py-2 text-xs text-text-muted">
              {user?.email}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-dark hover:bg-bg-soft"
            >
              <LogOut className="h-4 w-4" />
              Выйти
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
