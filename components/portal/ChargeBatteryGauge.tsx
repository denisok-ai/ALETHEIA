/**
 * Горизонтальная «батарейка»: корпус + заливка по доле 0–100 %.
 * Декоративный блок: рядом на странице уже есть текст «Заряд: N%» — aria-hidden, чтобы не дублировать скринридер.
 */
import { cn } from '@/lib/utils';

export interface ChargeBatteryGaugeProps {
  /** Доля заполнения текущего сегмента уровня, 0–100 (может быть дробной). */
  percent: number;
  className?: string;
}

export function ChargeBatteryGauge({ percent, className }: ChargeBatteryGaugeProps) {
  const w = Math.min(100, Math.max(0, percent));

  return (
    <div
      className={cn('flex items-center gap-0 select-none', className)}
      aria-hidden
    >
      <div
        className="relative h-8 min-w-[7rem] w-full max-w-[10rem] overflow-hidden rounded-l-[10px]
          border-2 border-r-0 border-[var(--portal-accent-muted)] bg-white/90 shadow-sm"
      >
        <div
          className="h-full rounded-l-[8px] bg-gradient-to-r from-[var(--portal-accent)] to-[var(--portal-primary-light)]
            transition-[width] duration-500 ease-out"
          style={{ width: `${w}%` }}
        />
      </div>
      <div
        className="h-[18px] w-[5px] shrink-0 rounded-r-[4px] border-2 border-l-0 border-[var(--portal-accent-muted)]
          bg-[var(--portal-accent-muted)]/35 shadow-sm"
        aria-hidden
      />
    </div>
  );
}
