/**
 * Коннектор Telegram-канала школы (T3.5). Образец: audio-mastering-web/backend/app/social/connectors/telegram.py.
 *
 * Методы Bot API: sendVideo (multipart, файл с диска), sendMessage (текст).
 * Исходящие вызовы — только через lib/telegram-fetch.ts (прокси HTTPS_PROXY на VPS).
 *
 * Ретраи: публикации (sendVideo/sendMessage) идут через telegramWebFetch, у которого
 * нет повторов. Повтор после таймаута мог бы опубликовать ролик дважды: запрос дошёл,
 * ответ потерян. Поэтому сетевой сбой здесь — «неоднозначный» (ambiguous): планировщик
 * не повторяет такой пост сам, а просит владельца проверить канал.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { getEnvOverrides } from '@/lib/settings';
import { telegramWebFetch } from '@/lib/telegram-fetch';
import { TELEGRAM_CAPTION_LIMIT } from '../telegram-caption';

/** Лимит Bot API на загрузку файла ботом. */
export const TELEGRAM_UPLOAD_LIMIT_BYTES = 50 * 1024 * 1024;
/** Загрузка 50 МБ через прокси может идти минутами: таймаут шире обычного. */
const VIDEO_UPLOAD_TIMEOUT_MS = 10 * 60_000;
const MESSAGE_TIMEOUT_MS = 60_000;
/** Лимит текста sendMessage (знаков). */
const MESSAGE_LIMIT = 4096;

export type TelegramErrorKind =
  | 'no_token'
  | 'not_admin'
  | 'chat_not_found'
  | 'file_missing'
  | 'file_too_big'
  | 'caption_too_long'
  | 'flood'
  | 'network'
  | 'api';

export class TelegramPublishError extends Error {
  readonly kind: TelegramErrorKind;
  /** Сколько секунд просит подождать Telegram (только для flood). */
  readonly retryAfterSec?: number;
  /**
   * Исход неизвестен: запрос могло получить, но ответа не дождались.
   * Такой пост нельзя повторять автоматически — в канале может уже лежать.
   */
  readonly ambiguous: boolean;

  constructor(kind: TelegramErrorKind, message: string, opts: { retryAfterSec?: number; ambiguous?: boolean } = {}) {
    super(message);
    this.name = 'TelegramPublishError';
    this.kind = kind;
    this.retryAfterSec = opts.retryAfterSec;
    this.ambiguous = opts.ambiguous ?? false;
  }
}

export type TelegramPublished = {
  messageId: number;
  /** https://t.me/<username>/<id>, если канал публичный (есть username). Иначе null. */
  url: string | null;
};

export type PublishVideoParams = {
  chatId: string;
  /** Абсолютный путь к файлу на диске (уже проверен на выход за каталог). */
  filePath: string;
  caption: string;
  width?: number;
  height?: number;
};

export type PublishTextParams = {
  chatId: string;
  text: string;
};

type TelegramMessage = { message_id: number; chat?: { username?: string } };

async function resolveBotToken(): Promise<string> {
  const fromEnv = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  const overrides = await getEnvOverrides();
  return overrides.telegram_bot_token?.trim() ?? '';
}

function assertCaption(caption: string): void {
  if (!caption.trim()) {
    throw new TelegramPublishError('api', 'Подпись пустая: публиковать нечего.');
  }
  // Считаем по UTF-16 (length): это не меньше числа знаков, то есть проверка строже лимита Telegram.
  if (caption.length > TELEGRAM_CAPTION_LIMIT) {
    throw new TelegramPublishError(
      'caption_too_long',
      `Подпись ${caption.length} знаков: лимит Telegram для подписи к видео — ${TELEGRAM_CAPTION_LIMIT}. Сократите текст.`,
    );
  }
}

/** Перевод ответа Bot API в понятное сообщение. Токен в тексте не появляется: description его не содержит. */
export function mapTelegramApiError(
  method: string,
  status: number,
  description: string | undefined,
  retryAfterSec: number | undefined,
): TelegramPublishError {
  const d = (description ?? '').toLowerCase();
  if (status === 401 || d.includes('unauthorized')) {
    return new TelegramPublishError('api', 'Telegram отклонил токен бота (401). Проверьте TELEGRAM_BOT_TOKEN.');
  }
  if (status === 429 || retryAfterSec !== undefined) {
    const sec = retryAfterSec ?? 60;
    return new TelegramPublishError('flood', `Telegram просит подождать ${sec} с (лимит запросов к боту).`, {
      retryAfterSec: sec,
    });
  }
  if (d.includes('chat not found')) {
    return new TelegramPublishError('chat_not_found', 'Канал не найден (chat not found): проверьте chat id канала.');
  }
  if (
    d.includes('not enough rights') ||
    d.includes('not a member') ||
    d.includes('have no rights') ||
    d.includes('kicked') ||
    d.includes('forbidden')
  ) {
    return new TelegramPublishError(
      'not_admin',
      `Бот не может публиковать в канал: он не администратор канала или у него нет права публикации (${description ?? status}).`,
    );
  }
  if (status === 413 || d.includes('too big') || d.includes('too large')) {
    return new TelegramPublishError('file_too_big', `Telegram не принял файл как слишком большой (${TELEGRAM_UPLOAD_LIMIT_BYTES / 1048576} МБ лимит).`);
  }
  if (d.includes('caption is too long')) {
    return new TelegramPublishError('caption_too_long', 'Telegram: подпись слишком длинная.');
  }
  return new TelegramPublishError('api', `Telegram ${method}: ${description ?? `HTTP ${status}`}`, {
    ambiguous: status >= 500,
  });
}

async function callBotApi(
  method: string,
  body: FormData | string,
  opts: { timeoutMs: number; json: boolean },
): Promise<TelegramMessage> {
  const token = await resolveBotToken();
  if (!token) {
    throw new TelegramPublishError('no_token', 'Не задан токен Telegram-бота (TELEGRAM_BOT_TOKEN).');
  }
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const init: RequestInit = {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(opts.timeoutMs),
    ...(opts.json ? { headers: { 'Content-Type': 'application/json' } } : {}),
  };

  let res: Response;
  try {
    res = await telegramWebFetch(url, init);
  } catch (e) {
    // Текст ошибки fetch может содержать URL с токеном: в сообщение его не выводим.
    const reason = e instanceof Error && e.name === 'TimeoutError' ? 'таймаут' : 'сетевой сбой';
    throw new TelegramPublishError(
      'network',
      `Нет ответа от Telegram (${reason}): пост мог уйти в канал. Проверьте канал перед повтором.`,
      { ambiguous: true },
    );
  }

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
    result?: TelegramMessage;
    parameters?: { retry_after?: number };
  };
  if (!res.ok || data.ok === false || !data.result) {
    throw mapTelegramApiError(method, res.status, data.description, data.parameters?.retry_after);
  }
  return data.result;
}

function toPublished(message: TelegramMessage): TelegramPublished {
  const username = message.chat?.username;
  return {
    messageId: message.message_id,
    url: username ? `https://t.me/${username}/${message.message_id}` : null,
  };
}

function videoMimeType(filePath: string): string {
  return path.extname(filePath).toLowerCase() === '.mov' ? 'video/quicktime' : 'video/mp4';
}

/**
 * Опубликовать видео из файла. Проверки до сети: подпись ≤ 1024 знаков, файл есть и ≤ 50 МБ.
 */
export async function publishVideo(params: PublishVideoParams): Promise<TelegramPublished> {
  assertCaption(params.caption);

  let size: number;
  try {
    size = (await fs.stat(params.filePath)).size;
  } catch {
    throw new TelegramPublishError('file_missing', `Файл ролика не найден на сервере: ${path.basename(params.filePath)}`);
  }
  if (size > TELEGRAM_UPLOAD_LIMIT_BYTES) {
    const mb = Math.round((size / 1048576) * 10) / 10;
    throw new TelegramPublishError(
      'file_too_big',
      `Ролик ${mb} МБ: больше лимита Telegram для загрузки ботом (50 МБ). Сожмите файл.`,
    );
  }
  if (size === 0) {
    throw new TelegramPublishError('file_missing', `Файл ролика пустой: ${path.basename(params.filePath)}`);
  }

  const buffer = await fs.readFile(params.filePath);
  const form = new FormData();
  form.append('chat_id', params.chatId);
  form.append('caption', params.caption);
  form.append('parse_mode', 'HTML');
  form.append('supports_streaming', 'true');
  if (params.width && params.width > 0) form.append('width', String(params.width));
  if (params.height && params.height > 0) form.append('height', String(params.height));
  form.append(
    'video',
    new Blob([new Uint8Array(buffer)], { type: videoMimeType(params.filePath) }),
    path.basename(params.filePath),
  );

  const message = await callBotApi('sendVideo', form, { timeoutMs: VIDEO_UPLOAD_TIMEOUT_MS, json: false });
  return toPublished(message);
}

/** Опубликовать текст (HTML) в канал. Превью ссылок включено. */
export async function publishText(params: PublishTextParams): Promise<TelegramPublished> {
  if (!params.text.trim()) {
    throw new TelegramPublishError('api', 'Текст пустой: публиковать нечего.');
  }
  if (params.text.length > MESSAGE_LIMIT) {
    throw new TelegramPublishError('api', `Текст ${params.text.length} знаков: лимит сообщения Telegram — ${MESSAGE_LIMIT}.`);
  }
  const message = await callBotApi(
    'sendMessage',
    JSON.stringify({
      chat_id: params.chatId,
      text: params.text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    }),
    { timeoutMs: MESSAGE_TIMEOUT_MS, json: true },
  );
  return toPublished(message);
}
