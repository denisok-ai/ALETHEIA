/**
 * Сквозной учёт меток ?ref= (T3.3): cookie av_ref и журнал переходов.
 *
 * Поток: proxy.ts видит ?ref=<код> на публичной странице → ставит cookie av_ref
 * (первое касание: существующую валидную метку не перезаписываем) и пишет
 * SocialLinkEvent. Маршруты создания лида и заказа читают cookie через
 * acqRefFromRequest и сохраняют метку в Lead.acqRef / Order.acqRef.
 *
 * proxy.ts в Next 16 всегда работает на Node.js runtime (проверено в
 * node_modules/next/dist/build/index.js: isProxyFile → runtime 'nodejs'), поэтому
 * запись в БД делаем прямо оттуда, без HTTP-вызова к API-маршруту.
 */
import { createHmac } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { clientIpFromHeaders } from '@/lib/client-ip';
import { prisma } from '@/lib/db';
import { networkForRef, refFromValue } from './refs';

export const REF_COOKIE = 'av_ref';
/** 90 дней, в секундах. */
export const REF_COOKIE_MAX_AGE = 90 * 24 * 60 * 60;

const PATH_MAX = 200;

export function refCookieOptions(isProd: boolean) {
  return {
    path: '/',
    maxAge: REF_COOKIE_MAX_AGE,
    sameSite: 'lax' as const,
    secure: isProd,
    // Клиентский JS метку не читает: серверные маршруты берут её из запроса.
    httpOnly: true,
  };
}

/** Метка из cookie запроса или null. Для записи лида и заказа. */
export function acqRefFromRequest(request: { cookies: { get(name: string): { value: string } | undefined } }): string | null {
  return refFromValue(request.cookies.get(REF_COOKIE)?.value);
}

/** Минимальная длина секрета для хэша IP (как у шифрования секретов в lib/encrypt.ts). */
const IP_HASH_SECRET_MIN = 16;

/**
 * Хэш IP для уникальных посетителей по меткам: HMAC-SHA256 с секретом сервера (NEXTAUTH_SECRET),
 * первые 48 hex-символов. Сырой IP нигде не сохраняем; без IP или без секрета — null.
 * Node crypto: proxy.ts в Next 16 работает на Node.js runtime (см. комментарий в шапке файла).
 */
export function socialLinkIpHash(
  ip: string | null,
  secret: string | undefined = process.env.NEXTAUTH_SECRET,
): string | null {
  if (!ip || !secret || secret.length < IP_HASH_SECRET_MIN) return null;
  return createHmac('sha256', secret).update(ip, 'utf8').digest('hex').slice(0, 48);
}

/** Переход считаем только для «живого» открытия страницы: не prefetch и не служебные запросы. */
function isNavigationVisit(request: NextRequest): boolean {
  if (request.method !== 'GET') return false;
  const headers = request.headers;
  if (headers.has('next-router-prefetch')) return false;
  if (headers.get('purpose') === 'prefetch' || headers.get('sec-purpose')?.includes('prefetch')) return false;
  return true;
}

/**
 * Пишет переход в SocialLinkEvent. Ошибки глотаем: учёт не должен ломать страницу.
 * Вызывать без await из proxy (fire-and-forget).
 */
export async function recordSocialLinkVisit(refCode: string, path: string, ipHash: string | null = null): Promise<void> {
  const networkCode = networkForRef(refCode);
  if (!networkCode) return;
  try {
    await prisma.socialLinkEvent.create({
      data: { refCode, networkCode, path: path.slice(0, PATH_MAX), ipHash },
    });
  } catch (e) {
    console.error('[social-ref] запись перехода:', e);
  }
}

/**
 * Обработка метки на ответе middleware. Меняет только cookie и запускает запись перехода.
 * Возвращает метку, если она принята (для тестов и логов), иначе null.
 */
export function trackRefVisit(request: NextRequest, response: NextResponse, isProd: boolean): string | null {
  const refCode = refFromValue(request.nextUrl.searchParams.get('ref'));
  if (!refCode || !networkForRef(refCode)) return null;
  if (!isNavigationVisit(request)) return null;

  // Первое касание: если cookie уже есть и валидна, не трогаем её.
  if (!refFromValue(request.cookies.get(REF_COOKIE)?.value)) {
    response.cookies.set(REF_COOKIE, refCode, refCookieOptions(isProd));
  }
  // Хэш IP — ПДн по 152-ФЗ: пишем по решению владельца от 16.10.2026, отражено в /privacy (раздел 9).
  // Выключатель на случай отзыва решения: SOCIAL_LINK_IP_HASH=0.
  // IP — только через lib/client-ip.ts (первый элемент XFF подделывается).
  const ipHash =
    process.env.SOCIAL_LINK_IP_HASH === '0'
      ? null
      : socialLinkIpHash(clientIpFromHeaders((n) => request.headers.get(n)));
  void recordSocialLinkVisit(refCode, request.nextUrl.pathname, ipHash);
  return refCode;
}
