'use client';

/**
 * Обязательное согласие на обработку ПДн: отдельная галочка, по умолчанию выключена.
 */
import Link from 'next/link';
import { cn } from '@/lib/utils';

type Props = {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  errorText?: string | null;
};

export function PersonalDataConsentCheckbox({
  id,
  checked,
  onCheckedChange,
  disabled,
  className,
  errorText,
}: Props) {
  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2 text-xs leading-snug text-[var(--text-muted)]">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          disabled={disabled}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#E2E8F0] text-plum focus:ring-plum"
          required={false}
          aria-invalid={!!errorText}
          aria-describedby={errorText ? `${id}-error` : undefined}
        />
        <span>
          Я даю{' '}
          <Link href="/pd-consent" className="font-medium text-plum underline hover:opacity-90">
            согласие на обработку персональных данных
          </Link>{' '}
          и подтверждаю, что ознакомлен(а) с{' '}
          <Link href="/privacy" className="font-medium text-plum underline hover:opacity-90">
            Политикой в отношении обработки персональных данных
          </Link>
          .
        </span>
      </label>
      {errorText ? (
        <p id={`${id}-error`} className="text-xs text-red-600" role="alert">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}
