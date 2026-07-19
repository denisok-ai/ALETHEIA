/**
 * Приём отчётов о нарушениях CSP (заголовок Content-Security-Policy-Report-Only).
 *
 * Нужен, чтобы перед переходом на строгую политику (без 'unsafe-inline') увидеть
 * на реальном трафике, какие инлайн-скрипты сломались бы: у нас 16 блоков JSON-LD
 * и счётчик аналитики — вслепую такую миграцию катить нельзя.
 *
 * Отчёты только пишутся в лог (агрегированно), в БД не сохраняются: браузеры шлют
 * их массово, а ценность — в перечне уникальных источников, а не в объёме.
 */
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Уже залогированные нарушения — чтобы не спамить одинаковым в лог. */
const seen = new Set<string>();
const MAX_SEEN = 200;

type CspReport = {
  'csp-report'?: {
    'document-uri'?: string;
    'violated-directive'?: string;
    'blocked-uri'?: string;
    'script-sample'?: string;
  };
};

export async function POST(request: NextRequest) {
  // Эндпоинт публичный — защищаем от завала
  const limited = checkRateLimit(request, 'csp-report', 30);
  if (limited) return new NextResponse(null, { status: 429 });

  try {
    const body = (await request.json()) as CspReport;
    const r = body['csp-report'];
    if (!r) return new NextResponse(null, { status: 204 });

    const directive = (r['violated-directive'] ?? 'unknown').slice(0, 60);
    const blocked = (r['blocked-uri'] ?? 'inline').slice(0, 120);
    const doc = (r['document-uri'] ?? '').replace(/^https?:\/\/[^/]+/, '').slice(0, 80);
    const sample = (r['script-sample'] ?? '').slice(0, 80).replace(/\s+/g, ' ');

    const key = `${directive}|${blocked}|${doc}|${sample}`;
    if (!seen.has(key)) {
      if (seen.size >= MAX_SEEN) seen.clear();
      seen.add(key);
      console.warn(
        `[csp-report] ${directive} · blocked=${blocked} · page=${doc}${sample ? ` · sample="${sample}"` : ''}`
      );
    }
  } catch {
    // мусорное тело — игнорируем
  }
  return new NextResponse(null, { status: 204 });
}
