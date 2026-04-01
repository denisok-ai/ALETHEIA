'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type StatusVariant =
  | 'new'
  | 'active'
  | 'archived'
  | 'draft'
  | 'published'
  | 'pending'
  | 'open'
  | 'in_progress'
  | 'resolved'
  | 'closed'
  | 'contacted'
  | 'qualified'
  | 'converted'
  | 'paid'
  | 'default';

const variantStyles: Record<StatusVariant, string> = {
  new: 'bg-[var(--portal-accent-soft)] text-[var(--portal-accent-dark)] border-[var(--portal-accent-muted)]',
  active: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  archived: 'bg-[#F1F5F9] text-[var(--portal-text-muted)] border-[#E2E8F0]',
  draft: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  published: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  pending: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  open: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  in_progress: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  resolved: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  closed: 'bg-[#F1F5F9] text-[var(--portal-text-muted)] border-[#E2E8F0]',
  contacted: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  qualified: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  converted: 'bg-[var(--portal-accent-soft)] text-[var(--portal-accent-dark)] border-[var(--portal-accent-muted)]',
  paid: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  default: 'bg-[#F8FAFC] text-[var(--portal-text)] border-[#E2E8F0]',
};

const defaultLabels: Partial<Record<StatusVariant, string>> = {
  new: 'Новый',
  active: 'Активен',
  archived: 'Архив',
  draft: 'Черновик',
  published: 'Опубликован',
  pending: 'Ожидает',
  open: 'Открыт',
  in_progress: 'В работе',
  resolved: 'Решён',
  closed: 'Закрыт',
  contacted: 'Связались',
  qualified: 'Квалифицирован',
  converted: 'Конвертирован',
  paid: 'Оплачен',
};

export interface StatusBadgeProps {
  variant?: StatusVariant;
  label?: string;
  className?: string;
}

export function StatusBadge({
  variant = 'default',
  label,
  className,
}: StatusBadgeProps) {
  const displayLabel = label ?? defaultLabels[variant] ?? variant;
  const styles = variantStyles[variant] ?? variantStyles.default;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        styles,
        className
      )}
    >
      {displayLabel}
    </span>
  );
}
