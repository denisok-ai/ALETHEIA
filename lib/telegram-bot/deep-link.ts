/**
 * Deep link в бота: `t.me/AvaterraProBot?start=<payload>`.
 *
 * Смысл механизма: боту Telegram запрещено писать первым, поэтому диалог всегда
 * начинает человек. Deep link — единственный способ дать ему нажать «Начать» и
 * при этом не потерять, откуда он пришёл и с какой заявкой связан.
 *
 * Формат payload (Telegram допускает A-Z a-z 0-9 _ - и до 64 символов):
 *   s-<source>  — метка источника: s-site-footer, s-blog, s-course-mt…
 *   l-<leadId>  — привязка к лиду, уже созданному формой на сайте
 *   r<code>     — метка соцсети ?ref= без дефиса: rtg01 = tg-01 (первое касание)
 * Части разделяются `_`: `s-site-footer_l-42_rtg01`.
 * Payload без `r`-части разбирается ровно как раньше.
 */
import { networkForRef } from '../social/refs';

export type StartPayload = {
  entrySource?: string;
  leadId?: number;
  /** Метка ?ref= в каноническом виде (tg-01). */
  ref?: string;
};

const MAX_SOURCE_LEN = 32;
/** Лимит Telegram на аргумент /start. */
export const START_PAYLOAD_MAX_LEN = 64;

/** Метка source: только строчная латиница, цифры и дефис. */
export function sanitizeSource(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SOURCE_LEN);
}

/** Метка ref в сегмент payload: tg-01 → rtg01. Некорректная метка → null. */
function refSegment(ref: string): string | null {
  // networkForRef проверяет и форму метки, и известный префикс сети (как в cookie).
  if (!networkForRef(ref)) return null;
  return `r${ref.replace('-', '')}`;
}

/**
 * Собрать payload для ссылки. Длиннее 64 символов не отдаём: сначала убираем
 * метку ref (она восстанавливается с первого касания на сайте), затем source.
 */
export function buildStartPayload(params: { source?: string; leadId?: number; ref?: string | null }): string {
  let source: string | null = null;
  if (params.source) {
    const clean = sanitizeSource(params.source);
    if (clean) source = `s-${clean}`;
  }
  const lead =
    params.leadId && Number.isInteger(params.leadId) && params.leadId > 0 ? `l-${params.leadId}` : null;
  const ref = params.ref ? refSegment(params.ref) : null;

  const build = (withSource: boolean, withRef: boolean) =>
    [withSource ? source : null, lead, withRef ? ref : null].filter((p): p is string => Boolean(p)).join('_');

  let payload = build(true, true);
  if (payload.length > START_PAYLOAD_MAX_LEN) payload = build(true, false);
  if (payload.length > START_PAYLOAD_MAX_LEN) payload = build(false, false);
  return payload;
}

/** Разобрать аргумент `/start <payload>`. Мусор игнорируется, ошибок не бросает. */
export function parseStartPayload(raw?: string | null): StartPayload {
  const result: StartPayload = {};
  if (!raw) return result;

  for (const part of raw.split('_')) {
    if (part.startsWith('s-')) {
      const source = sanitizeSource(part.slice(2));
      if (source) result.entrySource = source;
      continue;
    }
    if (part.startsWith('l-')) {
      const id = Number.parseInt(part.slice(2), 10);
      // Верхняя граница — Prisma Int (32 бит): «l-99999999999999999999» иначе
      // проходил как 1e20 и ронял запрос к БД вместо тихого игнора.
      if (Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647) result.leadId = id;
      continue;
    }
    const m = /^r([a-z]{2})(\d{2,3})$/.exec(part);
    if (m) {
      const ref = `${m[1]}-${m[2]}`;
      if (networkForRef(ref)) result.ref = ref;
    }
  }
  return result;
}

/** Есть ли в payload хоть что-то осмысленное (иначе это обычный /start). */
export function hasStartPayload(payload: StartPayload): boolean {
  return Boolean(payload.entrySource || payload.leadId || payload.ref);
}
