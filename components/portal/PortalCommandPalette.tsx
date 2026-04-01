'use client';

/**
 * Палитра команд: ⌘K / Ctrl+K — переход по разделам портала (по роли). Задел под поиск сущностей.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { usePortalUI } from './PortalUIProvider';
import { getPortalNavCommandsForRole, type PortalNavCommandItem } from '@/lib/portal-nav-commands';
import { Search } from 'lucide-react';

function normalize(s: string) {
  return s.toLowerCase().trim();
}

function filterItems(items: PortalNavCommandItem[], q: string) {
  if (!q.trim()) return items;
  const n = normalize(q);
  return items.filter(
    (i) => normalize(i.label).includes(n) || normalize(i.section).includes(n) || i.href.toLowerCase().includes(n)
  );
}

export function PortalCommandPalette() {
  const router = useRouter();
  const { profile } = usePortalUI();
  const role = profile?.role;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const baseItems = useMemo(() => getPortalNavCommandsForRole(role), [role]);
  const items = useMemo(() => filterItems(baseItems, query), [baseItems, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const openPalette = () => setOpen(true);
    window.addEventListener('portal-open-command-palette', openPalette);
    return () => window.removeEventListener('portal-open-command-palette', openPalette);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      const t = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(t);
    }
  }, [open]);

  const go = useCallback(
    (href: string) => {
      router.push(href);
      setOpen(false);
    },
    [router]
  );

  const onKeyDownList = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, items.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && items[activeIndex]) {
      e.preventDefault();
      go(items[activeIndex].href);
    }
  };

  if (!profile) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2 mb-0 border-b border-[#E2E8F0]">
          <DialogTitle className="text-lg">Переход по порталу</DialogTitle>
          <p className="text-sm font-normal text-[var(--portal-text-muted)] mt-1">
            Разделы по вашей роли. Поиск по сущностям — позже.
          </p>
        </DialogHeader>
        <div className="p-3 border-b border-[#E2E8F0]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--portal-text-muted)]" aria-hidden />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDownList}
              placeholder="Найти раздел…"
              className="pl-9 h-10"
              aria-label="Поиск раздела"
            />
          </div>
        </div>
        <ul
          className="max-h-[min(60vh,420px)] overflow-y-auto py-2 px-2"
          role="listbox"
          aria-label="Разделы"
        >
          {items.length === 0 ? (
            <li className="px-3 py-6 text-sm text-center text-[var(--portal-text-muted)]">Ничего не найдено</li>
          ) : (
            items.map((item, idx) => (
              <li key={`${item.href}-${item.label}`} role="option" aria-selected={idx === activeIndex}>
                <button
                  type="button"
                  onClick={() => go(item.href)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    idx === activeIndex
                      ? 'bg-[#EEF2FF] text-[#4338CA]'
                      : 'text-[var(--portal-text)] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <span className="font-medium block">{item.label}</span>
                  <span className="text-xs text-[var(--portal-text-muted)]">{item.section}</span>
                </button>
              </li>
            ))
          )}
        </ul>
        <p className="px-4 py-2 text-[10px] text-[var(--portal-text-soft)] border-t border-[#E2E8F0]">
          ⌘K / Ctrl+K — открыть · Enter — перейти
        </p>
      </DialogContent>
    </Dialog>
  );
}
