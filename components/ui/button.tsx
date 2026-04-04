'use client';

/**
 * Кнопки: портал — токены --portal-* (plum); лендинг — landingRose / landingPlum / landingSoft.
 * Стили вариантов — в `./button-variants` (без «use client»), чтобы RSC могли стилизовать Link.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { buttonVariants, type ButtonVariantProps } from '@/components/ui/button-variants';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariantProps {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      ref={ref}
      {...props}
    />
  )
);
Button.displayName = 'Button';

export { Button, buttonVariants };
