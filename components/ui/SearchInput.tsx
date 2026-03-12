'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const DEBOUNCE_MS = 300;

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onSearch?: (value: string) => void;
  debounceMs?: number;
  wrapperClassName?: string;
}

export function SearchInput({
  onSearch,
  debounceMs = DEBOUNCE_MS,
  wrapperClassName,
  className,
  placeholder = 'Поиск…',
  ...props
}: SearchInputProps) {
  const [localValue, setLocalValue] = React.useState('');
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (!onSearch) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSearch(localValue.trim());
      timerRef.current = null;
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [localValue, debounceMs, onSearch]);

  return (
    <div className={cn('relative', wrapperClassName)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--portal-text-muted)]" />
      <Input
        type="search"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className={cn('pl-9', className)}
        {...props}
      />
    </div>
  );
}
