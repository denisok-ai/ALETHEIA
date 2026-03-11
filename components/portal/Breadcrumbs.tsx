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
    <nav aria-label="Хлебные крошки" className="flex items-center gap-1 text-sm text-text-muted">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-border" aria-hidden />}
          {item.href ? (
            <Link href={item.href} className="hover:text-primary hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="text-dark font-medium" aria-current="page">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
