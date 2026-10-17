/**
 * Разбор файла очереди для scripts/social-enqueue.ts (чистая функция, без БД и сети).
 *
 * Формат — массив объектов:
 *   [{ "file": "2026-10-14-test.mp4", "title": "…", "body": "…", "ref": "tg-01",
 *      "scheduledAt": "2026-10-14 10:00", "url": "https://avaterra.pro/glossary/…" }]
 * Без "file" запись — текстовый пост (SocialItem.kind 'news', без медиа): тогда "body" обязателен,
 * это и есть текст поста.
 * "url" необязателен: куда ведёт ссылка в подписи (абсолютный https-адрес на avaterra.pro, без метки ?ref=
 * — метку добавит сборка подписи). Без "url" ссылка ведёт на страницу практикума.
 * "postType" необязателен: тип поста из post_types avaterra.yaml (educational, pain, course…). По нему
 * проверяются окно длины и CTA (lib/social/post-checks.ts). Без него эти проверки пропускаются.
 * scheduledAt без смещения — московское время (МСК, UTC+3); с «Z» или «+03:00» — как есть.
 */
import { isValidRefCode, networkForRef } from './refs';
import { resolveSocialMediaPath } from './media-path';

export type QueueEntry = {
  /** Имя файла относительно каталога соцсетей; null — текстовый пост без медиа. */
  file: string | null;
  title: string;
  body: string;
  ref: string;
  scheduledAt: Date;
  /** Необязательная строка хештегов; по умолчанию — из telegram-caption. */
  hashtags?: string;
  /** Необязательная ссылка для подписи (https://avaterra.pro/…, без метки); по умолчанию — практикум. */
  url?: string;
  /** Необязательный тип поста из post_types avaterra.yaml. */
  postType?: string;
};

export type QueueParseResult = {
  entries: QueueEntry[];
  errors: string[];
};

/** Домен, на котором разрешены ссылки поста очереди. Иные домены — ошибка разбора. */
export const QUEUE_URL_HOST = 'avaterra.pro';

/**
 * Проверка ссылки поста: абсолютный https-адрес на avaterra.pro без учётных данных.
 * Возвращает исходную строку (без изменений) или причину отказа.
 */
export function checkQueueUrl(raw: string): { ok: true; url: string } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: 'не абсолютный адрес (нужен https://avaterra.pro/…)' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, reason: 'нужен https:// (http не принимаем)' };
  if (parsed.hostname.toLowerCase() !== QUEUE_URL_HOST) {
    return { ok: false, reason: `домен ${parsed.hostname} не разрешён, только ${QUEUE_URL_HOST}` };
  }
  if (parsed.username || parsed.password) return { ok: false, reason: 'адрес с логином и паролем не принимаем' };
  return { ok: true, url: raw };
}

const MSK_NAIVE_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;
const HAS_OFFSET_RE = /(Z|[+-]\d{2}:?\d{2})$/i;

/** Московское время без смещения или ISO-строка со смещением → Date; null, если не разобрать. */
export function parseScheduledAt(raw: string): Date | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  const naive = MSK_NAIVE_RE.exec(value);
  if (naive) {
    const [, y, mo, d, h, mi, s] = naive;
    const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s ?? '00'}+03:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (!HAS_OFFSET_RE.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Префикс метки по сети: подсказка в тексте ошибки. */
const REF_EXAMPLE: Readonly<Record<string, string>> = { telegram: 'Telegram вида tg-01', max: 'MAX вида mx-01' };

/** Проверка структуры и путей. Подписи и БД проверяет вызывающий код. */
export function parseQueueInput(
  raw: unknown,
  opts: { mediaDir: string; networkCode?: 'telegram' | 'max'; postTypes?: readonly string[] },
): QueueParseResult {
  const networkCode = opts.networkCode ?? 'telegram';
  const errors: string[] = [];
  const entries: QueueEntry[] = [];
  if (!Array.isArray(raw)) {
    return { entries, errors: ['файл очереди должен быть JSON-массивом объектов'] };
  }
  if (raw.length === 0) {
    return { entries, errors: ['очередь пуста'] };
  }

  const seenRefs = new Set<string>();
  raw.forEach((item, index) => {
    const at = `запись ${index + 1}`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`${at}: не объект`);
      return;
    }
    const rec = item as Record<string, unknown>;
    const str = (key: string) => (typeof rec[key] === 'string' ? (rec[key] as string).trim() : '');

    const file = str('file');
    const title = str('title');
    const body = typeof rec.body === 'string' ? rec.body.trim() : '';
    const ref = str('ref');
    const scheduledRaw = str('scheduledAt');
    const hashtags = typeof rec.hashtags === 'string' ? rec.hashtags : undefined;
    const postType = str('postType');
    const urlRaw = rec.url === undefined || rec.url === null ? '' : typeof rec.url === 'string' ? rec.url.trim() : null;
    let ok = true;
    if (postType && opts.postTypes && !opts.postTypes.includes(postType)) {
      errors.push(`${at}: postType «${postType}» нет в post_types avaterra.yaml (${opts.postTypes.join(', ')})`);
      ok = false;
    }
    let url: string | undefined;
    if (urlRaw === null) {
      errors.push(`${at}: url должен быть строкой (абсолютный https-адрес на ${QUEUE_URL_HOST})`);
      ok = false;
    } else if (urlRaw) {
      const checked = checkQueueUrl(urlRaw);
      if (checked.ok) url = checked.url;
      else {
        errors.push(`${at}: url «${urlRaw}» — ${checked.reason}`);
        ok = false;
      }
    }

    if (!file && !body) {
      errors.push(`${at}: текстовый пост без file: нужен body (текст поста)`);
      ok = false;
    } else if (file) {
      try {
        resolveSocialMediaPath(file, opts.mediaDir);
      } catch (e) {
        errors.push(`${at}: file «${file}» — ${(e as Error).message}`);
        ok = false;
      }
    }
    if (!title) {
      errors.push(`${at}: не задан title`);
      ok = false;
    }
    if (!isValidRefCode(ref) || networkForRef(ref) !== networkCode) {
      errors.push(`${at}: ref «${ref}» должен быть меткой ${REF_EXAMPLE[networkCode]}`);
      ok = false;
    } else if (seenRefs.has(ref)) {
      errors.push(`${at}: метка ${ref} повторяется в файле`);
      ok = false;
    } else {
      seenRefs.add(ref);
    }
    const scheduledAt = parseScheduledAt(scheduledRaw);
    if (!scheduledAt) {
      errors.push(`${at}: scheduledAt «${scheduledRaw}» не разобран (ожидается «2026-10-14 10:00» по МСК)`);
      ok = false;
    }

    if (ok && scheduledAt) {
      entries.push({
        file: file || null,
        title,
        body,
        ref,
        scheduledAt,
        ...(hashtags !== undefined ? { hashtags } : {}),
        ...(url !== undefined ? { url } : {}),
        ...(postType ? { postType } : {}),
      });
    }
  });

  return { entries, errors };
}
