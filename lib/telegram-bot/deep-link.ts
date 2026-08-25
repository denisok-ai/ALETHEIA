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
 * Комбинация: `s-site-footer_l-42` (разделитель `_`).
 */

export type StartPayload = {
  entrySource?: string;
  leadId?: number;
};

const MAX_SOURCE_LEN = 32;

/** Метка источника: только строчная латиница, цифры и дефис. */
export function sanitizeSource(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SOURCE_LEN);
}

/** Собрать payload для ссылки. */
export function buildStartPayload(params: { source?: string; leadId?: number }): string {
  const parts: string[] = [];
  if (params.source) {
    const clean = sanitizeSource(params.source);
    if (clean) parts.push(`s-${clean}`);
  }
  if (params.leadId && Number.isInteger(params.leadId) && params.leadId > 0) {
    parts.push(`l-${params.leadId}`);
  }
  return parts.join('_');
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
      if (Number.isInteger(id) && id > 0) result.leadId = id;
    }
  }
  return result;
}

/** Есть ли в payload хоть что-то осмысленное (иначе это обычный /start). */
export function hasStartPayload(payload: StartPayload): boolean {
  return Boolean(payload.entrySource || payload.leadId);
}
