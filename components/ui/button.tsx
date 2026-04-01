'use client';

/**
 * Кнопки: портал — токены --portal-* (plum); лендинг — landingRose / landingPlum / landingSoft.
 */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'rounded-lg font-semibold tracking-tight',
    'transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)] focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    'select-none',
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--portal-primary)] text-white hover:bg-[var(--portal-accent-dark)] active:opacity-95 shadow-sm hover:shadow-[0_4px_14px_rgba(133,107,146,0.35)]',

        secondary:
          'border border-[var(--portal-accent-muted)] bg-[var(--portal-accent-soft)] text-[var(--portal-accent-dark)] hover:bg-[var(--portal-primary)] hover:text-white hover:border-transparent',

        ghost:
          'text-[#475569] hover:bg-[var(--portal-surface-hover)] hover:text-[var(--portal-text)]',

        danger:
          'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 shadow-sm hover:shadow-[0_4px_14px_rgba(239,68,68,0.3)]',

        landingRose:
          'bg-[#CE8FB0] text-white hover:bg-[#b87a9c] active:scale-[0.98] shadow-sm hover:shadow-[0_4px_18px_rgba(206,143,176,0.35)]',
        landingPlum:
          'bg-[#856B92] text-white hover:bg-[#735a7d] shadow-sm hover:shadow-[0_4px_18px_rgba(133,107,146,0.35)]',
        landingSoft:
          'bg-[#B4B1D8] text-[#5F5467] hover:bg-[#9e9ac8] shadow-sm',

        accent:
          'bg-[#CE8FB0] text-white hover:bg-[#b87a9c] hover:shadow-[0_4px_18px_rgba(206,143,176,0.35)] active:scale-[0.98]',

        link:
          'text-[var(--portal-accent)] underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        xs: 'h-8 px-3 text-xs min-h-[2rem]',
        sm: 'h-9 px-3.5 text-sm min-h-[2.25rem]',
        default: 'h-11 px-5 text-sm min-h-[2.75rem]',
        lg: 'h-12 px-6 text-base min-h-[3rem]',
        xl: 'h-12 px-8 text-base min-h-[3rem] md:min-h-[3.25rem]',
        icon: 'h-11 w-11 min-h-[2.75rem] min-w-[2.75rem]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
);
Button.displayName = 'Button';

export { Button, buttonVariants };
