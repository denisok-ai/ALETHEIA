'use client';

/**
 * Универсальный компонент кнопки — Indigo-дизайн-система 2026.
 * Используется на публичном сайте и в портале.
 */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'rounded-lg font-semibold tracking-tight',
    'transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    'select-none',
  ].join(' '),
  {
    variants: {
      variant: {
        /* Основная кнопка — Indigo */
        primary:
          'bg-[#6366F1] text-white hover:bg-[#4F46E5] active:bg-[#4338CA] shadow-sm hover:shadow-[0_4px_14px_rgba(99,102,241,0.35)]',

        /* Вторичная — outline Indigo */
        secondary:
          'border border-[#C7D2FE] bg-[#EEF2FF] text-[#4338CA] hover:bg-[#6366F1] hover:text-white hover:border-transparent',

        /* Призрак — лёгкий hover */
        ghost:
          'text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]',

        /* Деструктивный */
        danger:
          'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 shadow-sm hover:shadow-[0_4px_14px_rgba(239,68,68,0.3)]',

        /* Акцентный — золотой (для публичного сайта) */
        accent:
          'bg-[#D4AF37] text-[#1a1a2e] hover:bg-[#b8942a] hover:shadow-[0_0_24px_rgba(212,175,55,0.35)] active:scale-[0.98]',

        /* Ссылка-кнопка */
        link:
          'text-[#6366F1] underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        xs:      'h-7  px-3   text-xs',
        sm:      'h-8  px-3.5 text-sm',
        default: 'h-10 px-5   text-sm',
        lg:      'h-11 px-6   text-base',
        xl:      'h-13 px-8   text-base',
        icon:    'h-9  w-9',
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
