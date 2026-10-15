/**
 * Коннектор канала школы в MAX. Документация: https://dev.max.ru/docs-api (сверено 15.10.2026).
 *
 * Видео публикуется в три шага:
 *  1. POST /uploads?type=video → { url, token } — адрес загрузки и токен файла;
 *  2. POST <url> multipart (поле data) — сам файл;
 *  3. POST /messages?chat_id=… с attachments [{ type: 'video', payload: { token } }] и подписью (format=html).
 * Сразу после загрузки MAX может ответить attachment.not.ready (файл ещё обрабатывается):
 * сообщение при этом НЕ создано, поэтому шаг 3 безопасно повторяем с растущей паузой.
 *
 * Неоднозначность (ambiguous) — только у шага 3: запрос ушёл, ответа нет → пост мог появиться.
 * Сбои шагов 1–2 однозначны: в канал ничего не ушло.
 *
 * Токен: заголовок Authorization (query-параметр MAX больше не принимает).
 * Источник — MAX_BOT_TOKEN в окружении или max_bot_token в настройках портала (зашифрован).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { getEnvOverrides } from '@/lib/settings';
import { maxFetch } from './max-http';
import { SocialPublishError, type SocialPublished } from './publish-error';

export const MAX_API_BASE = 'https://platform-api2.max.ru';
/** Лимит текста сообщения/подписи MAX (знаков). */
export const MAX_TEXT_LIMIT = 4000;
/** Лимит видео MAX — 250 МБ. */
export const MAX_VIDEO_LIMIT_BYTES = 250 * 1024 * 1024;
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.webm']);

const API_TIMEOUT_MS = 30_000;
/** Загрузка держится в пределах 10-минутного порога «зависшего» поста в планировщике. */
const UPLOAD_TIMEOUT_MS = 5 * 60_000;
const MESSAGE_TIMEOUT_MS = 60_000;
/** Паузы перед повтором отправки, пока MAX обрабатывает видео: всего ~1,5 мин. */
const NOT_READY_DELAYS_MS = [3_000, 6_000, 12_000, 24_000, 48_000];

export type MaxErrorKind =
  | 'no_token'
  | 'not_admin'
  | 'chat_not_found'
  | 'file_missing'
  | 'file_too_big'
  | 'caption_too_long'
  | 'not_ready'
  | 'flood'
  | 'network'
  | 'api';

export class MaxPublishError extends SocialPublishError {
  declare readonly kind: MaxErrorKind;

  constructor(kind: MaxErrorKind, message: string, opts: { retryAfterSec?: number; ambiguous?: boolean } = {}) {
    super(kind, message, opts);
    this.name = 'MaxPublishError';
  }
}

export type MaxPublishVideoParams = {
  chatId: string;
  /** Абсолютный путь к файлу на диске (уже проверен на выход за каталог). */
  filePath: string;
  /** Подпись в HTML-подмножестве MAX: b, i, a, blockquote. */
  caption: string;
};

export type MaxPublishTextParams = { chatId: string; text: string };

/** Паузы между повторами; в тестах подменяется на мгновенную. */
export const maxTiming = {
  sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
};

async function resolveMaxToken(): Promise<string> {
  const fromEnv = process.env.MAX_BOT_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  const overrides = await getEnvOverrides();
  return overrides.max_bot_token?.trim() ?? '';
}

async function requireToken(): Promise<string> {
  const token = await resolveMaxToken();
  if (!token) {
    throw new MaxPublishError('no_token', 'Не задан токен бота MAX (MAX_BOT_TOKEN или max_bot_token в настройках).');
  }
  return token;
}

/** Перевод ответа API MAX ({ code, message }) в понятную ошибку. Токен в текст не попадает. */
export function mapMaxApiError(
  step: string,
  status: number,
  code: string | undefined,
  message: string | undefined,
  opts: { ambiguousOn5xx: boolean },
): MaxPublishError {
  const c = (code ?? '').toLowerCase();
  const m = (message ?? '').toLowerCase();
  const detail = [code, message].filter(Boolean).join(': ') || `HTTP ${status}`;
  if (c === 'attachment.not.ready' || m.includes('not.processed')) {
    return new MaxPublishError('not_ready', `MAX ещё обрабатывает видео (${detail}).`);
  }
  if (status === 401 || c.includes('verify.token') || c === 'unauthorized') {
    return new MaxPublishError('api', 'MAX отклонил токен бота (401). Проверьте токен в настройках.');
  }
  if (status === 429 || c.includes('too.many')) {
    return new MaxPublishError('flood', 'MAX просит снизить частоту запросов (429).', { retryAfterSec: 60 });
  }
  if (status === 403 || c.includes('denied') || c.includes('access') || m.includes('permission') || m.includes('not admin')) {
    return new MaxPublishError(
      'not_admin',
      `Бот MAX не может публиковать в канал: он не администратор канала или у него нет права «write» (${detail}).`,
    );
  }
  if (status === 404 || c.includes('chat.not.found') || c === 'not.found') {
    return new MaxPublishError('chat_not_found', `Канал MAX не найден (${detail}): проверьте chat id.`);
  }
  if (status === 413 || c.includes('too.large') || m.includes('too large')) {
    return new MaxPublishError('file_too_big', `MAX не принял файл как слишком большой (${detail}).`);
  }
  return new MaxPublishError('api', `MAX ${step}: ${detail}`, { ambiguous: opts.ambiguousOn5xx && status >= 500 });
}

type ApiCallOpts = { timeoutMs: number; ambiguousOnNetwork: boolean };

/** Вызов platform-api2.max.ru с JSON-ответом. */
async function callApi<T>(
  method: 'GET' | 'POST',
  pathAndQuery: string,
  body: unknown,
  step: string,
  opts: ApiCallOpts,
): Promise<T> {
  const token = await requireToken();
  let res: Response;
  try {
    res = await maxFetch(`${MAX_API_BASE}${pathAndQuery}`, {
      method,
      headers: {
        Authorization: token,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
  } catch (e) {
    const reason = e instanceof Error && e.name === 'TimeoutError' ? 'таймаут' : 'сетевой сбой';
    throw new MaxPublishError(
      'network',
      opts.ambiguousOnNetwork
        ? `Нет ответа от MAX (${reason}): пост мог уйти в канал. Проверьте канал перед повтором.`
        : `Нет ответа от MAX на шаге «${step}» (${reason}); в канал ничего не ушло.`,
      { ambiguous: opts.ambiguousOnNetwork },
    );
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw mapMaxApiError(step, res.status, data.code as string | undefined, data.message as string | undefined, {
      ambiguousOn5xx: opts.ambiguousOnNetwork,
    });
  }
  return data as T;
}

type MaxMessage = { body?: { mid?: string }; url?: string | null };

function toPublished(data: { message?: MaxMessage }): SocialPublished {
  const mid = data.message?.body?.mid;
  if (!mid) {
    // Ответ 200 без идентификатора: пост, скорее всего, создан, но подтвердить нечем.
    throw new MaxPublishError('api', 'MAX ответил без идентификатора сообщения: проверьте канал вручную.', {
      ambiguous: true,
    });
  }
  return { messageId: mid, url: data.message?.url ?? null };
}

function assertText(text: string, what: string): void {
  if (!text.trim()) throw new MaxPublishError('api', `${what} пустая: публиковать нечего.`);
  if (text.length > MAX_TEXT_LIMIT) {
    throw new MaxPublishError(
      'caption_too_long',
      `${what} ${text.length} знаков: лимит MAX — ${MAX_TEXT_LIMIT}. Сократите текст.`,
    );
  }
}

/** Шаг 2: файл на адрес загрузки. Ответ видеохоста — `<retval>1</retval>`, поэтому смотрим только статус. */
async function uploadFile(uploadUrl: string, filePath: string): Promise<void> {
  const buffer = await fs.readFile(filePath);
  const form = new FormData();
  form.append('data', new Blob([new Uint8Array(buffer)]), path.basename(filePath));
  let res: Response;
  try {
    res = await maxFetch(uploadUrl, { method: 'POST', body: form, signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS) });
  } catch (e) {
    const reason = e instanceof Error && e.name === 'TimeoutError' ? 'таймаут' : 'сетевой сбой';
    throw new MaxPublishError('network', `Загрузка видео в MAX прервалась (${reason}); в канал ничего не ушло.`);
  }
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).slice(0, 200);
    throw mapMaxApiError('загрузка видео', res.status, undefined, text, { ambiguousOn5xx: false });
  }
}

/** Шаг 3 с повторами на attachment.not.ready. */
async function sendWithRetry(chatId: string, body: unknown): Promise<SocialPublished> {
  for (let attempt = 0; ; attempt++) {
    try {
      const data = await callApi<{ message?: MaxMessage }>(
        'POST',
        `/messages?chat_id=${encodeURIComponent(chatId)}`,
        body,
        'отправка поста',
        { timeoutMs: MESSAGE_TIMEOUT_MS, ambiguousOnNetwork: true },
      );
      return toPublished(data);
    } catch (e) {
      const delay = NOT_READY_DELAYS_MS[attempt];
      if (e instanceof MaxPublishError && e.kind === 'not_ready' && delay !== undefined) {
        await maxTiming.sleep(delay);
        continue;
      }
      throw e;
    }
  }
}

/** Опубликовать видео из файла с подписью. Проверки до сети: подпись, файл, формат, размер. */
export async function publishVideo(params: MaxPublishVideoParams): Promise<SocialPublished> {
  assertText(params.caption, 'Подпись');
  const name = path.basename(params.filePath);
  if (!VIDEO_EXTENSIONS.has(path.extname(params.filePath).toLowerCase())) {
    throw new MaxPublishError('api', `MAX принимает видео MP4, MOV, MKV, WEBM; файл «${name}» другого формата.`);
  }
  let size: number;
  try {
    size = (await fs.stat(params.filePath)).size;
  } catch {
    throw new MaxPublishError('file_missing', `Файл ролика не найден на сервере: ${name}`);
  }
  if (size === 0) throw new MaxPublishError('file_missing', `Файл ролика пустой: ${name}`);
  if (size > MAX_VIDEO_LIMIT_BYTES) {
    const mb = Math.round((size / 1048576) * 10) / 10;
    throw new MaxPublishError('file_too_big', `Ролик ${mb} МБ: больше лимита MAX для видео (250 МБ).`);
  }

  const upload = await callApi<{ url?: string; token?: string }>('POST', '/uploads?type=video', undefined, 'адрес загрузки', {
    timeoutMs: API_TIMEOUT_MS,
    ambiguousOnNetwork: false,
  });
  if (!upload.url || !upload.token) {
    throw new MaxPublishError('api', 'MAX не выдал адрес загрузки или токен видео (POST /uploads).');
  }
  await uploadFile(upload.url, params.filePath);
  return sendWithRetry(params.chatId, {
    text: params.caption,
    format: 'html',
    attachments: [{ type: 'video', payload: { token: upload.token } }],
  });
}

/** Опубликовать текст (HTML) в канал. */
export async function publishText(params: MaxPublishTextParams): Promise<SocialPublished> {
  assertText(params.text, 'Текст');
  return sendWithRetry(params.chatId, { text: params.text, format: 'html' });
}

// ── Служебные вызовы для подключения канала (scripts/max-connect.ts) ──

export type MaxBotInfo = { user_id: number; first_name?: string; username?: string | null };

export async function getMe(): Promise<MaxBotInfo> {
  return callApi<MaxBotInfo>('GET', '/me', undefined, 'проверка токена', {
    timeoutMs: API_TIMEOUT_MS,
    ambiguousOnNetwork: false,
  });
}

export type MaxMembership = { is_admin?: boolean; is_owner?: boolean; permissions?: string[] | null };

/** Членство бота в канале: админ ли и есть ли право писать посты. */
export async function getMembership(chatId: string): Promise<MaxMembership> {
  return callApi<MaxMembership>('GET', `/chats/${encodeURIComponent(chatId)}/members/me`, undefined, 'членство в канале', {
    timeoutMs: API_TIMEOUT_MS,
    ambiguousOnNetwork: false,
  });
}

/** Право публиковать посты в канале (write; в старых ответах — post_edit_delete_message). */
export function canPost(m: MaxMembership): boolean {
  if (m.is_owner) return true;
  const perms = m.permissions ?? [];
  return Boolean(m.is_admin) && (perms.includes('write') || perms.includes('post_edit_delete_message'));
}

export type MaxChatInfo = { chat_id: number; type?: string; title?: string | null; link?: string | null };

export async function getChat(chatId: string): Promise<MaxChatInfo> {
  return callApi<MaxChatInfo>('GET', `/chats/${encodeURIComponent(chatId)}`, undefined, 'информация о канале', {
    timeoutMs: API_TIMEOUT_MS,
    ambiguousOnNetwork: false,
  });
}

export type MaxUpdate = { update_type: string; chat_id?: number; timestamp?: number; is_channel?: boolean };

/**
 * События бота через long polling (GET /updates). Нужен один раз — узнать chat_id канала
 * из события bot_added: другого способа API MAX не даёт (GET /chats отключён с июня 2026).
 * Без marker MAX отдаёт только последнее событие; дальше передаём marker из прошлого ответа.
 */
export async function getUpdates(
  types: string[],
  opts: { marker?: number | null; timeoutSec?: number } = {},
): Promise<{ updates: MaxUpdate[]; marker: number | null }> {
  const timeoutSec = opts.timeoutSec ?? 30;
  const q = new URLSearchParams({ timeout: String(timeoutSec), limit: '100', types: types.join(',') });
  if (opts.marker != null) q.set('marker', String(opts.marker));
  const data = await callApi<{ updates?: MaxUpdate[]; marker?: number | null }>(
    'GET',
    `/updates?${q.toString()}`,
    undefined,
    'события бота',
    { timeoutMs: (timeoutSec + 15) * 1000, ambiguousOnNetwork: false },
  );
  return { updates: data.updates ?? [], marker: data.marker ?? null };
}
