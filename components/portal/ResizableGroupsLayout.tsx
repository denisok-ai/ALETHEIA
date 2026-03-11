'use client';

/**
 * Двухколоночный layout: панель групп (слева) с перетаскиваемой границей и основная область.
 * Ширина панели сохраняется в localStorage по storageKey.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

const DEFAULT_WIDTH = 256;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;
const STORAGE_PREFIX = 'portal-groups-sidebar-width-';

export interface ResizableGroupsLayoutProps {
  /** Ключ для сохранения ширины в localStorage (например: courses, media, users) */
  storageKey: string;
  /** Содержимое панели групп (дерево групп) */
  sidebar: React.ReactNode;
  /** Основной контент справа */
  children: React.ReactNode;
  /** Дополнительные классы для контейнера */
  className?: string;
}

export function ResizableGroupsLayout({
  storageKey,
  sidebar,
  children,
  className,
}: ResizableGroupsLayoutProps) {
  const lsKey = `${STORAGE_PREFIX}${storageKey}`;

  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(lsKey);
      if (saved) {
        const n = parseInt(saved, 10);
        if (!Number.isNaN(n) && n >= MIN_WIDTH && n <= MAX_WIDTH) setWidth(n);
      }
    } catch {
      // ignore
    }
  }, [lsKey]);

  const persistWidth = useCallback(
    (w: number) => {
      const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w));
      setWidth(clamped);
      try {
        localStorage.setItem(lsKey, String(clamped));
      } catch {
        // ignore
      }
    },
    [lsKey]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setDragging(true);
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    []
  );

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      persistWidth(x);
    };

    const onUp = () => setDragging(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, persistWidth]);

  return (
    <div
      ref={containerRef}
      className={cn('flex', className)}
      style={{ position: 'relative' }}
    >
      <aside
        className="shrink-0 overflow-hidden flex flex-col"
        style={{ width: `${width}px` }}
      >
        {sidebar}
      </aside>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={width}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        aria-label="Изменить ширину панели групп"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 20 : 8;
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            persistWidth(width - step);
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            persistWidth(width + step);
          }
        }}
        className={cn(
          'shrink-0 w-2 cursor-col-resize flex items-stretch justify-center select-none',
          'hover:bg-border/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
          dragging && 'bg-primary/20'
        )}
      >
        <span
          className="w-0.5 bg-border rounded-full min-h-[40px] self-center"
          aria-hidden
        />
      </div>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
