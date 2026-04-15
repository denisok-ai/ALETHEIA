'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = 'Нет данных',
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-12 px-6 text-center',
        className
      )}
    >
      {icon && (
        <div className="mb-4 text-[var(--portal-text-muted)] [&_svg]:h-10 [&_svg]:w-10">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-[var(--portal-text)]">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-[var(--portal-text-muted)]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
