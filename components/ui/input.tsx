'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-[var(--portal-text)] placeholder:text-[var(--portal-text-soft)] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30 transition-colors',
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export { Input };
