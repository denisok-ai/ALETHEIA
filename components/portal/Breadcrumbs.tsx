'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Хлебные крошки" className="flex items-center gap-1 text-xs">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && (
            <ChevronRight
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: 'var(--portal-text-soft)' }}
              aria-hidden
            />
          )}
          {item.href ? (
            <Link
              href={item.href}
              className="transition"
              style={{ color: 'var(--portal-text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--portal-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--portal-text-muted)')}
            >
              {item.label}
            </Link>
          ) : (
            <span
              className="font-medium"
              style={{ color: 'var(--portal-text)' }}
              aria-current="page"
            >
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
