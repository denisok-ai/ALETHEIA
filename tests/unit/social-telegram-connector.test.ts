/**
 * Коннектор Telegram: сборка запросов, лимиты до сети, разбор ошибок Bot API.
 * Сеть подменена: telegramWebFetch и getEnvOverrides.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
vi.mock('@/lib/telegram-fetch', () => ({
  telegramWebFetch: (...args: unknown[]) => fetchMock(...args),
  telegramApiFetch: (...args: unknown[]) => fetchMock(...args),
}));
vi.mock('@/lib/settings', () => ({
  getEnvOverrides: vi.fn(async () => ({})),
}));

import {
  mapTelegramApiError,
  publishText,
  publishVideo,
  TelegramPublishError,
  TELEGRAM_UPLOAD_LIMIT_BYTES,
} from '@/lib/social/connectors/telegram';

const OLD_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let dir = '';
let videoPath = '';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeAll(async () => {
  process.env.TELEGRAM_BOT_TOKEN = 'test-token-123';
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'social-tg-'));
  videoPath = path.join(dir, 'clip.mp4');
  await fs.writeFile(videoPath, Buffer.from('fake-mp4-bytes'));
});

afterAll(async () => {
  if (OLD_TOKEN === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN = OLD_TOKEN;
  await fs.rm(dir, { recursive: true, force: true });
});

beforeEach(() => {
  fetchMock.mockReset();
});

describe('publishVideo: успешная публикация', () => {
  it('отправляет sendVideo multipart и возвращает ссылку t.me для публичного канала', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, { ok: true, result: { message_id: 42, chat: { id: -1003916704986, username: 'avaterrapro' } } }),
    );
    const res = await publishVideo({ chatId: '-1003916704986', filePath: videoPath, caption: '<b>Тест</b>', width: 720, height: 1280 });

    expect(res).toEqual({ messageId: 42, url: 'https://t.me/avaterrapro/42' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/bottest-token-123/sendVideo');
    expect(init.method).toBe('POST');
    const form = init.body as FormData;
    expect(form.get('chat_id')).toBe('-1003916704986');
    expect(form.get('parse_mode')).toBe('HTML');
    expect(form.get('supports_streaming')).toBe('true');
    expect(form.get('caption')).toBe('<b>Тест</b>');
    expect(form.get('width')).toBe('720');
    expect(form.get('height')).toBe('1280');
    expect(form.get('video')).toBeInstanceOf(Blob);
  });

  it('без username у канала ссылки нет', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true, result: { message_id: 7, chat: { id: -100 } } }));
    const res = await publishVideo({ chatId: '-100', filePath: videoPath, caption: 'x' });
    expect(res).toEqual({ messageId: 7, url: null });
  });
});

describe('publishVideo: проверки до сети', () => {
  it('подпись длиннее 1024 знаков — ошибка, запроса нет', async () => {
    const caption = 'а'.repeat(1025);
    await expect(publishVideo({ chatId: '-100', filePath: videoPath, caption })).rejects.toMatchObject({
      kind: 'caption_too_long',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('подпись ровно 1024 знака проходит проверку', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true, result: { message_id: 1, chat: { id: -100 } } }));
    await expect(publishVideo({ chatId: '-100', filePath: videoPath, caption: 'а'.repeat(1024) })).resolves.toBeDefined();
  });

  it('файл больше 50 МБ — ошибка до загрузки', async () => {
    const big = path.join(dir, 'big.mp4');
    const fh = await fs.open(big, 'w');
    await fh.truncate(TELEGRAM_UPLOAD_LIMIT_BYTES + 1);
    await fh.close();
    await expect(publishVideo({ chatId: '-100', filePath: big, caption: 'x' })).rejects.toMatchObject({
      kind: 'file_too_big',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('файла нет на диске — понятная ошибка', async () => {
    await expect(
      publishVideo({ chatId: '-100', filePath: path.join(dir, 'нет-такого.mp4'), caption: 'x' }),
    ).rejects.toMatchObject({ kind: 'file_missing' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('не задан токен — ошибка без запроса', async () => {
    const saved = process.env.TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_BOT_TOKEN = '';
    try {
      await expect(publishVideo({ chatId: '-100', filePath: videoPath, caption: 'x' })).rejects.toMatchObject({
        kind: 'no_token',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      process.env.TELEGRAM_BOT_TOKEN = saved;
    }
  });
});

describe('publishText', () => {
  it('sendMessage с HTML и включённым превью ссылок', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true, result: { message_id: 9, chat: { id: -100, username: 'avaterrapro' } } }));
    const res = await publishText({ chatId: '-100', text: 'Текст' });
    expect(res).toEqual({ messageId: 9, url: 'https://t.me/avaterrapro/9' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url.endsWith('/sendMessage')).toBe(true);
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ chat_id: '-100', text: 'Текст', parse_mode: 'HTML', disable_web_page_preview: false });
  });
});

describe('ошибки Bot API → понятные сообщения', () => {
  it('chat not found', () => {
    const e = mapTelegramApiError('sendVideo', 400, 'Bad Request: chat not found', undefined);
    expect(e.kind).toBe('chat_not_found');
    expect(e.message).toContain('chat id');
  });

  it('бот не админ канала', () => {
    expect(mapTelegramApiError('sendVideo', 400, 'Bad Request: not enough rights to send video', undefined).kind).toBe('not_admin');
    expect(mapTelegramApiError('sendVideo', 403, 'Forbidden: bot is not a member of the channel chat', undefined).kind).toBe('not_admin');
  });

  it('flood wait с retry_after', () => {
    const e = mapTelegramApiError('sendVideo', 429, 'Too Many Requests: retry after 30', 30);
    expect(e.kind).toBe('flood');
    expect(e.retryAfterSec).toBe(30);
    expect(e.message).toContain('30');
  });

  it('файл слишком большой по версии Telegram', () => {
    expect(mapTelegramApiError('sendVideo', 413, 'Request Entity Too Large', undefined).kind).toBe('file_too_big');
  });

  it('ошибка сервера 5xx считается неоднозначной (пост мог уйти)', () => {
    const e = mapTelegramApiError('sendVideo', 500, 'Internal Server Error', undefined);
    expect(e.kind).toBe('api');
    expect(e.ambiguous).toBe(true);
  });

  it('ответ Bot API с ok:false — ошибка с текстом Telegram', async () => {
    fetchMock.mockResolvedValueOnce(json(400, { ok: false, description: 'Bad Request: chat not found' }));
    const err = await publishVideo({ chatId: '-100', filePath: videoPath, caption: 'x' }).catch((e) => e);
    expect(err).toBeInstanceOf(TelegramPublishError);
    expect(err.kind).toBe('chat_not_found');
    expect(err.ambiguous).toBe(false);
  });

  it('сетевой сбой после отправки — неоднозначный, токен не попадает в текст', async () => {
    fetchMock.mockRejectedValueOnce(new Error('socket hang up https://api.telegram.org/bottest-token-123/sendVideo'));
    const err = await publishVideo({ chatId: '-100', filePath: videoPath, caption: 'x' }).catch((e) => e);
    expect(err).toBeInstanceOf(TelegramPublishError);
    expect(err.kind).toBe('network');
    expect(err.ambiguous).toBe(true);
    expect(err.message).not.toContain('test-token-123');
  });
});
