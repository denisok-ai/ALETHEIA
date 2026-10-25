/**
 * Согласование контента с автором школы по секретной ссылке (/soglasovanie/<token>).
 *
 * Данные лежат НЕ в репозитории: каталог CONTENT_REVIEW_DIR (по умолчанию
 * private/review внутри проекта, он в .gitignore), в нём items.json и media/.
 * Решения хранятся в SystemSetting под ключом REVIEW_DECISIONS_KEY.
 *
 * Здесь только чистые функции (без БД и без чтения диска кроме loadReviewItems) —
 * они покрыты тестами в tests/unit/content-review.test.ts.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { REVIEW_LIMITS } from './content-review-shared';

// Клиентски-безопасная часть (лимиты, готовые ответы) живёт в content-review-shared.ts.
export {
  hasQuickReply,
  quickRepliesFor,
  REVIEW_LIMITS,
  REVIEW_QUICK_REPLIES,
  toggleQuickReply,
} from './content-review-shared';

export const REVIEW_TOKEN_MIN_LENGTH = 32;
export const REVIEW_DECISIONS_KEY = 'content-review:decisions';
export const REVIEW_STATUSES = ['approved', 'changes', 'rejected'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Имя файла медиа: 32 hex-символа (uuid без дефисов) и расширение. Ничего больше. */
const MEDIA_NAME_RE = /^[0-9a-f]{32}\.(mp4|jpg|jpeg|png)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type ReviewItem = {
  id: string;
  date: string | null;
  order: number;
  kind: string;
  network: string;
  title: string;
  titleVariants: string[];
  body: string;
  speech?: string;
  url?: string;
  ref?: string;
  durationSec?: number;
  /** Имя файла в media/ (уже проверено по MEDIA_NAME_RE). */
  video?: string;
  /** Имя файла в media/ (уже проверено по MEDIA_NAME_RE). */
  poster?: string;
  notes: string[];
  risks: string[];
  transcript?: string;
  lesson?: string;
  sourceTimecodes?: string;
};

export type StoredDecision = {
  status: ReviewStatus;
  title: string;
  body: string;
  speech?: string;
  comment: string;
  updatedAt: string;
};

export type DecisionInput = {
  id: string;
  status: ReviewStatus;
  title: string;
  body: string;
  speech?: string;
  comment: string;
};

// ---------------------------------------------------------------- токен и каталог

/**
 * Токен из окружения. Короче 32 символов — считаем, что токен не задан:
 * тогда все маршруты отвечают 404 (страница не подтверждает своего существования).
 */
export function getConfiguredReviewToken(env: Record<string, string | undefined> = process.env): string | null {
  const token = env.CONTENT_REVIEW_TOKEN ?? '';
  return token.length >= REVIEW_TOKEN_MIN_LENGTH ? token : null;
}

/** Сравнение токена за постоянное время. Разная длина — сразу отказ (длина не секрет). */
export function isValidReviewToken(
  provided: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  if (expected.length < REVIEW_TOKEN_MIN_LENGTH) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function resolveReviewDir(env: Record<string, string | undefined> = process.env, cwd = process.cwd()): string {
  const configured = env.CONTENT_REVIEW_DIR?.trim();
  return configured ? path.resolve(configured) : path.join(cwd, 'private', 'review');
}

// ---------------------------------------------------------------- медиа

export function isSafeMediaName(name: unknown): name is string {
  return typeof name === 'string' && MEDIA_NAME_RE.test(name);
}

/**
 * Абсолютный путь к файлу внутри <dir>/media/ или null.
 * Имя проверяется регэкспом (без разделителей и «..»), дополнительно путь
 * сверяется с каталогом media — на случай, если регэксп когда-нибудь ослабят.
 */
export function mediaFilePath(dir: string, name: unknown): string | null {
  if (!isSafeMediaName(name)) return null;
  const mediaDir = path.join(dir, 'media');
  const resolved = path.join(mediaDir, name);
  if (path.dirname(resolved) !== mediaDir) return null;
  return resolved;
}

export function mediaContentType(name: string): string {
  if (name.endsWith('.mp4')) return 'video/mp4';
  if (name.endsWith('.png')) return 'image/png';
  return 'image/jpeg';
}

export type ByteRange =
  | { kind: 'full' }
  | { kind: 'partial'; start: number; end: number }
  | { kind: 'unsatisfiable' };

/**
 * Разбор заголовка Range для одного диапазона bytes=a-b, bytes=a-, bytes=-n.
 * Нераспознанное или множественное значение игнорируется (отдаём файл целиком,
 * как велит RFC 9110). Диапазон за пределами файла — unsatisfiable (416).
 */
export function parseByteRange(header: string | null | undefined, size: number): ByteRange {
  if (!header || size <= 0) return { kind: 'full' };
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return { kind: 'full' };
  const [, rawStart, rawEnd] = m;
  if (rawStart === '' && rawEnd === '') return { kind: 'full' };

  if (rawStart === '') {
    // суффиксный диапазон: последние N байт
    const suffix = Number(rawEnd);
    if (suffix === 0) return { kind: 'unsatisfiable' };
    const start = Math.max(0, size - suffix);
    return { kind: 'partial', start, end: size - 1 };
  }

  const start = Number(rawStart);
  if (start >= size) return { kind: 'unsatisfiable' };
  const end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (end < start) return { kind: 'full' };
  return { kind: 'partial', start, end };
}

// ---------------------------------------------------------------- items.json

function str(v: unknown, max = 10000): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

function optStr(v: unknown, max = 10000): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v.slice(0, max) : undefined;
}

function strArr(v: unknown, max = 50): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, max) : [];
}

/**
 * Приводит содержимое items.json к безопасной форме. Записи без id пропускаются,
 * неверные имена медиа отбрасываются. Порядок: дата, затем order (как в админке).
 */
export function parseReviewItems(raw: unknown): ReviewItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ReviewItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const o = entry as Record<string, unknown>;
    const id = str(o.id, 200).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const item: ReviewItem = {
      id,
      date: typeof o.date === 'string' && DATE_RE.test(o.date) ? o.date : null,
      order: typeof o.order === 'number' && Number.isFinite(o.order) ? o.order : 0,
      kind: str(o.kind, 60),
      network: str(o.network, 30),
      title: str(o.title, 500),
      titleVariants: strArr(o.titleVariants, 20),
      body: str(o.body),
      notes: strArr(o.notes),
      risks: strArr(o.risks),
    };
    const speech = optStr(o.speech);
    if (speech !== undefined) item.speech = speech;
    const url = optStr(o.url, 2000);
    if (url !== undefined) item.url = url;
    const ref = optStr(o.ref, 200);
    if (ref !== undefined) item.ref = ref;
    if (typeof o.durationSec === 'number' && Number.isFinite(o.durationSec)) item.durationSec = o.durationSec;
    if (isSafeMediaName(o.video)) item.video = o.video;
    if (isSafeMediaName(o.poster)) item.poster = o.poster;
    const transcript = optStr(o.transcript);
    if (transcript !== undefined) item.transcript = transcript;
    const lesson = optStr(o.lesson, 500);
    if (lesson !== undefined) item.lesson = lesson;
    const tc = optStr(o.sourceTimecodes, 200);
    if (tc !== undefined) item.sourceTimecodes = tc;
    out.push(item);
  }
  return out.sort((a, b) => {
    const ka = (a.date ?? '9999') + String(a.order).padStart(6, '0');
    const kb = (b.date ?? '9999') + String(b.order).padStart(6, '0');
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

/** Читает items.json. Нет файла — пустой план (страница покажет «ещё не загружен»). */
export async function loadReviewItems(dir: string): Promise<ReviewItem[]> {
  let text: string;
  try {
    text = await fs.readFile(path.join(dir, 'items.json'), 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
  try {
    return parseReviewItems(JSON.parse(text));
  } catch (e) {
    console.error('[content-review] items.json не разобран:', e);
    return [];
  }
}

// ---------------------------------------------------------------- решения

/** Разбор значения SystemSetting. Битый JSON — пустой набор решений, а не падение. */
export function parseDecisions(raw: string | null | undefined): Record<string, StoredDecision> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, StoredDecision> = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const v = value as Record<string, unknown>;
      if (!isReviewStatus(v.status)) continue;
      const d: StoredDecision = {
        status: v.status,
        title: str(v.title, REVIEW_LIMITS.title),
        body: str(v.body, REVIEW_LIMITS.body),
        comment: str(v.comment, REVIEW_LIMITS.comment),
        updatedAt: str(v.updatedAt, 40),
      };
      const speech = optStr(v.speech, REVIEW_LIMITS.speech);
      if (speech !== undefined) d.speech = speech;
      out[id] = d;
    }
    return out;
  } catch {
    return {};
  }
}

export function isReviewStatus(v: unknown): v is ReviewStatus {
  return typeof v === 'string' && (REVIEW_STATUSES as readonly string[]).includes(v);
}

/**
 * Валидация тела POST /decision. Возвращает либо очищенные значения, либо текст
 * ошибки для ответа 400. Существование id проверяется в маршруте (нужен items.json).
 */
export function validateDecisionInput(
  input: unknown,
): { ok: true; value: DecisionInput } | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Ожидается JSON-объект' };
  }
  const o = input as Record<string, unknown>;
  if (typeof o.id !== 'string' || o.id.trim() === '' || o.id.length > 200) {
    return { ok: false, error: 'Некорректный id' };
  }
  if (!isReviewStatus(o.status)) {
    return { ok: false, error: 'Некорректный статус' };
  }
  const textFields: Array<[keyof typeof REVIEW_LIMITS, unknown]> = [
    ['title', o.title],
    ['body', o.body],
    ['comment', o.comment],
  ];
  for (const [field, value] of textFields) {
    if (typeof value !== 'string') return { ok: false, error: `Поле ${field} должно быть строкой` };
    if (value.length > REVIEW_LIMITS[field]) {
      return { ok: false, error: `Поле ${field} длиннее ${REVIEW_LIMITS[field]} символов` };
    }
  }
  let speech: string | undefined;
  if (o.speech !== undefined) {
    if (typeof o.speech !== 'string') return { ok: false, error: 'Поле speech должно быть строкой' };
    if (o.speech.length > REVIEW_LIMITS.speech) {
      return { ok: false, error: `Поле speech длиннее ${REVIEW_LIMITS.speech} символов` };
    }
    speech = o.speech;
  }
  const title = (o.title as string).trim();
  if (title === '') return { ok: false, error: 'Заголовок не может быть пустым' };
  return {
    ok: true,
    value: {
      id: o.id,
      status: o.status,
      title,
      body: o.body as string,
      ...(speech !== undefined ? { speech } : {}),
      comment: (o.comment as string).trim(),
    },
  };
}

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  approved: 'Согласовано',
  changes: 'Нужны правки',
  rejected: 'Отклонено',
};

/** Строки для Telegram-оповещения владельцу: коротко, комментарий обрезан. */
export function reviewNotificationLines(title: string, status: ReviewStatus, comment: string): string[] {
  const lines = [`«${title.slice(0, 120)}»: ${REVIEW_STATUS_LABEL[status]}`];
  if (comment) lines.push(`Комментарий: ${comment.length > 300 ? comment.slice(0, 300) + '…' : comment}`);
  return lines;
}
