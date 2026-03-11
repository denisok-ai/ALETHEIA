'use client';

/**
 * Блок учётной записи: имя, email, выход. Для размещения в сайдбаре (нижний левый угол).
 */
import { useState, useRef, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePortalUI } from './PortalUIProvider';

interface PortalAccountBlockProps {
  collapsed?: boolean;
  className?: string;
}

export function PortalAccountBlock({ collapsed, className }: PortalAccountBlockProps) {
  const { user, profile } = usePortalUI();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

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

  if (!user?.email) return null;

  return (
    <div className={cn('relative mt-auto pt-3 border-t border-border', className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center rounded-lg py-2 text-sm font-medium transition text-dark hover:bg-bg-soft',
          collapsed ? 'justify-center px-2' : 'gap-2 px-3'
        )}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {collapsed ? (
          <User className="h-5 w-5 shrink-0 text-text-muted" aria-hidden />
        ) : (
          <>
            <span className="min-w-0 truncate text-left">{displayName}</span>
            <ChevronDown className={cn('h-4 w-4 shrink-0 transition', open && 'rotate-180')} />
          </>
        )}
      </button>
      {open && (
        <div
          ref={dropdownRef}
          role="menu"
          className="absolute left-0 bottom-full mb-1 w-48 rounded-lg border border-border bg-white py-1 shadow-lg"
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
  );
}
