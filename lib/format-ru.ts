/**
 * Локальное форматирование сумм и дат для портала (ru-RU).
 */
import { format, parseISO } from 'date-fns';

/** Целые рубли: разделители тысяч по правилам ru-RU. */
export function formatRub(n: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Number(n) || 0);
}

/** Дата YYYY-MM-DD (ISO) → дд.мм.гггг */
export function formatIsoDateRu(isoDate: string): string {
  try {
    return format(parseISO(isoDate), 'dd.MM.yyyy');
  } catch {
    return isoDate;
  }
}

/** Дата YYYY-MM-DD → дд.мм (ось графика, компактно). */
export function formatIsoDayMonth(isoDate: string): string {
  try {
    return format(parseISO(isoDate), 'dd.MM');
  } catch {
    return isoDate.slice(5);
  }
}
