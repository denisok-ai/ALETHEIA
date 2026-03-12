'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface DateRangeFilterProps {
  from?: Date | string | null;
  to?: Date | string | null;
  onFromChange?: (value: string) => void;
  onToChange?: (value: string) => void;
  className?: string;
  fromPlaceholder?: string;
  toPlaceholder?: string;
}

function toInputValue(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  return format(date, 'yyyy-MM-dd');
}

export function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  className,
  fromPlaceholder = 'С',
  toPlaceholder = 'По',
}: DateRangeFilterProps) {
  const fromVal = toInputValue(from);
  const toVal = toInputValue(to);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative flex-1">
        <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--portal-text-muted)]" />
        <Input
          type="date"
          value={fromVal}
          onChange={(e) => onFromChange?.(e.target.value)}
          placeholder={fromPlaceholder}
          className="pl-9"
        />
      </div>
      <span className="text-[var(--portal-text-muted)] text-sm">—</span>
      <div className="relative flex-1">
        <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--portal-text-muted)]" />
        <Input
          type="date"
          value={toVal}
          onChange={(e) => onToChange?.(e.target.value)}
          placeholder={toPlaceholder}
          className="pl-9"
        />
      </div>
    </div>
  );
}
