'use client';

/**
 * Поле ввода пароля / секрета с кнопкой «глаз» (показать / скрыть).
 */
import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input, type InputProps } from '@/components/ui/input';

export interface PasswordInputProps extends Omit<InputProps, 'type'> {
  /** aria-label когда текст скрыт (действие «показать») */
  ariaLabelShow?: string;
  /** aria-label когда текст виден (действие «скрыть») */
  ariaLabelHide?: string;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ariaLabelShow = 'Показать пароль', ariaLabelHide = 'Скрыть пароль', ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          {...props}
          className={cn('pr-11', className)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-[var(--portal-text-muted)] hover:text-[var(--portal-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)]/40"
          aria-label={visible ? ariaLabelHide : ariaLabelShow}
          title={visible ? 'Скрыть' : 'Показать'}
        >
          {visible ? <EyeOff className="h-4 w-4 shrink-0" aria-hidden /> : <Eye className="h-4 w-4 shrink-0" aria-hidden />}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = 'PasswordInput';
