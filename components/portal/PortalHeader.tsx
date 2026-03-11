'use client';

/**
 * Portal header: logo, mobile menu button, user dropdown (with focus trap).
 */
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { ChevronDown, LogOut, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Profile } from '@/lib/auth';
import { usePortalUI } from './PortalUIProvider';

interface PortalHeaderProps {
  user: { email?: string | null };
  profile: Profile | null;
  portalTitle?: string;
}

export function PortalHeader({ user, profile, portalTitle = 'AVATERRA' }: PortalHeaderProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { setMobileMenuOpen } = usePortalUI();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Focus trap: when dropdown opens, focus first focusable; Tab cycles within dropdown; Escape closes
  useEffect(() => {
    if (!open || !dropdownRef.current) return;
    const el = dropdownRef.current;
    const focusables = el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    first?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    await signOut({ callbackUrl: '/login' });
  }

  const displayName = profile?.display_name || user?.email || 'Пользователь';

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-white px-4 shadow-sm">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg text-dark hover:bg-bg-soft"
          aria-label="Открыть меню"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/" className="font-heading text-lg font-bold text-primary">
          {portalTitle}
        </Link>
      </div>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-dark hover:bg-bg-soft"
          aria-expanded={open}
          aria-haspopup="true"
        >
          <span className="max-w-[140px] truncate">{displayName}</span>
          <ChevronDown className={cn('h-4 w-4 transition', open && 'rotate-180')} />
        </button>
        {open && (
          <div
            ref={dropdownRef}
            role="menu"
            className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-white py-1 shadow-lg"
          >
            <div className="border-b border-border px-3 py-2 text-xs text-text-muted" role="none">
              {user?.email}
            </div>
            <button
              type="button"
              role="menuitem"
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
