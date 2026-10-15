/**
 * Коннектор MAX: три шага публикации видео, повторы на attachment.not.ready,
 * проверки до сети, разбор ошибок API. Сеть подменена: maxFetch и getEnvOverrides.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
vi.mock('@/lib/social/connectors/max-http', () => ({
  maxFetch: (...args: unknown[]) => fetchMock(...args),
}));
vi.mock('@/lib/settings', () => ({
  getEnvOverrides: vi.fn(async () => ({})),
}));

import {
  canPost,
  getUpdates,
  mapMaxApiError,
  MAX_API_BASE,
  MAX_TEXT_LIMIT,
  MaxPublishError,
  maxTiming,
  publishText,
  publishVideo,
} from '@/lib/social/connectors/max';
import { SocialPublishError } from '@/lib/social/connectors/publish-error';

const OLD_TOKEN = process.env.MAX_BOT_TOKEN;
let dir = '';
let videoPath = '';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const UPLOAD_URL = 'https://omub.okcdn.ru/upload.do?sig=abc&id=1';
const uploadsOk = () => json(200, { url: UPLOAD_URL, token: 'vid-token-1' });
const uploadDone = () => new Response('<retval>1</retval>', { status: 200 });
const messageOk = (mid = 'mid.42', url: string | null = 'https://max.ru/avaterra/AZ42') =>
  json(200, { message: { body: { mid, text: 'x' }, url } });
const notReady = () =>
  json(400, { code: 'attachment.not.ready', message: 'Key: errors.process.attachment.file.not.processed' });

beforeAll(async () => {
  process.env.MAX_BOT_TOKEN = 'max-test-token';
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'social-max-'));
  videoPath = path.join(dir, 'clip.mp4');
  await fs.writeFile(videoPath, Buffer.from('fake-mp4-bytes'));
});

afterAll(async () => {
  if (OLD_TOKEN === undefined) delete process.env.MAX_BOT_TOKEN;
  else process.env.MAX_BOT_TOKEN = OLD_TOKEN;
  await fs.rm(dir, { recursive: true, force: true });
});

beforeEach(() => {
  fetchMock.mockReset();
  vi.spyOn(maxTiming, 'sleep').mockResolvedValue(undefined);
});

describe('publishVideo: успешная публикация', () => {
  it('uploads → загрузка файла → messages с токеном видео и HTML-подписью', async () => {
    fetchMock.mockResolvedValueOnce(uploadsOk()).mockResolvedValueOnce(uploadDone()).mockResolvedValueOnce(messageOk());

    const res = await publishVideo({ chatId: '-72000000001', filePath: videoPath, caption: '<b>Тест</b>' });
    expect(res).toEqual({ messageId: 'mid.42', url: 'https://max.ru/avaterra/AZ42' });

    const [u1, i1] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(u1).toBe(`${MAX_API_BASE}/uploads?type=video`);
    expect(i1.method).toBe('POST');
    expect((i1.headers as Record<string, string>).Authorization).toBe('max-test-token');
    expect(u1).not.toContain('max-test-token');

    const [u2, i2] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(u2).toBe(UPLOAD_URL);
    expect((i2.body as FormData).get('data')).toBeInstanceOf(Blob);
    // Токен бота на видеохост не отправляем: в адресе загрузки своя подпись.
    expect(i2.headers).toBeUndefined();

    const [u3, i3] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(u3).toBe(`${MAX_API_BASE}/messages?chat_id=-72000000001`);
    expect(JSON.parse(i3.body as string)).toEqual({
      text: '<b>Тест</b>',
      format: 'html',
      attachments: [{ type: 'video', payload: { token: 'vid-token-1' } }],
    });
  });

  it('attachment.not.ready — повтор отправки с паузой, без повторной загрузки', async () => {
    fetchMock
      .mockResolvedValueOnce(uploadsOk())
      .mockResolvedValueOnce(uploadDone())
      .mockResolvedValueOnce(notReady())
      .mockResolvedValueOnce(notReady())
      .mockResolvedValueOnce(messageOk('mid.7', null));

    const res = await publishVideo({ chatId: '1', filePath: videoPath, caption: 'x' });
    expect(res).toEqual({ messageId: 'mid.7', url: null });
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(vi.mocked(maxTiming.sleep).mock.calls.map((c) => c[0])).toEqual([3_000, 6_000]);
  });

  it('видео так и не обработалось — ошибка not_ready, однозначная', async () => {
    fetchMock.mockResolvedValueOnce(uploadsOk()).mockResolvedValueOnce(uploadDone());
    for (let i = 0; i < 6; i++) fetchMock.mockResolvedValueOnce(notReady());

    const err = await publishVideo({ chatId: '1', filePath: videoPath, caption: 'x' }).catch((e) => e);
    expect(err).toBeInstanceOf(MaxPublishError);
    expect(err.kind).toBe('not_ready');
    expect(err.ambiguous).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2 + 6);
  });
});

describe('publishVideo: проверки до сети', () => {
  it('подпись длиннее лимита MAX — ошибка, запросов нет', async () => {
    const err = await publishVideo({ chatId: '1', filePath: videoPath, caption: 'я'.repeat(MAX_TEXT_LIMIT + 1) }).catch(
      (e) => e,
    );
    expect(err.kind).toBe('caption_too_long');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('файла нет — file_missing', async () => {
    const err = await publishVideo({ chatId: '1', filePath: path.join(dir, 'nope.mp4'), caption: 'x' }).catch((e) => e);
    expect(err.kind).toBe('file_missing');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('неподдерживаемый формат — ошибка до сети', async () => {
    const avi = path.join(dir, 'clip.avi');
    await fs.writeFile(avi, 'x');
    const err = await publishVideo({ chatId: '1', filePath: avi, caption: 'x' }).catch((e) => e);
    expect(err).toBeInstanceOf(MaxPublishError);
    expect(err.message).toContain('MP4');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('нет токена — no_token', async () => {
    delete process.env.MAX_BOT_TOKEN;
    try {
      const err = await publishText({ chatId: '1', text: 'x' }).catch((e) => e);
      expect(err.kind).toBe('no_token');
    } finally {
      process.env.MAX_BOT_TOKEN = 'max-test-token';
    }
  });
});

describe('неоднозначность исхода', () => {
  it('сбой сети на отправке поста — ambiguous (пост мог уйти)', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    const err = await publishText({ chatId: '1', text: 'x' }).catch((e) => e);
    expect(err).toBeInstanceOf(SocialPublishError);
    expect(err.kind).toBe('network');
    expect(err.ambiguous).toBe(true);
  });

  it('сбой сети на загрузке — однозначный: в канал ничего не ушло', async () => {
    fetchMock.mockResolvedValueOnce(uploadsOk()).mockRejectedValueOnce(new TypeError('fetch failed'));
    const err = await publishVideo({ chatId: '1', filePath: videoPath, caption: 'x' }).catch((e) => e);
    expect(err.kind).toBe('network');
    expect(err.ambiguous).toBe(false);
  });

  it('500 на отправке — ambiguous; 500 на uploads — нет', async () => {
    fetchMock.mockResolvedValueOnce(json(500, { code: 'internal', message: 'oops' }));
    const e1 = await publishText({ chatId: '1', text: 'x' }).catch((e) => e);
    expect(e1.ambiguous).toBe(true);

    fetchMock.mockResolvedValueOnce(json(500, { code: 'internal', message: 'oops' }));
    const e2 = await publishVideo({ chatId: '1', filePath: videoPath, caption: 'x' }).catch((e) => e);
    expect(e2.ambiguous).toBe(false);
  });

  it('200 без mid — ambiguous: подтвердить публикацию нечем', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { message: {} }));
    const err = await publishText({ chatId: '1', text: 'x' }).catch((e) => e);
    expect(err.ambiguous).toBe(true);
  });
});

describe('mapMaxApiError', () => {
  const map = (status: number, code?: string, message?: string) =>
    mapMaxApiError('шаг', status, code, message, { ambiguousOn5xx: true });

  it('401 — токен, 429 — flood с паузой, 403 — нет прав, 404 — канал не найден', () => {
    expect(map(401, 'verify.token').message).toContain('токен');
    const flood = map(429, 'too.many.requests');
    expect(flood.kind).toBe('flood');
    expect(flood.retryAfterSec).toBe(60);
    expect(map(403, 'chat.denied').kind).toBe('not_admin');
    expect(map(404, 'chat.not.found').kind).toBe('chat_not_found');
  });

  it('неизвестная 400 — api, однозначная', () => {
    const e = map(400, 'proto.payload', 'bad');
    expect(e.kind).toBe('api');
    expect(e.ambiguous).toBe(false);
  });
});

describe('служебное', () => {
  it('canPost: владелец — да; админ с write или старым post_edit_delete_message — да; без прав — нет', () => {
    expect(canPost({ is_owner: true })).toBe(true);
    expect(canPost({ is_admin: true, permissions: ['write'] })).toBe(true);
    expect(canPost({ is_admin: true, permissions: ['post_edit_delete_message'] })).toBe(true);
    expect(canPost({ is_admin: true, permissions: ['pin_message'] })).toBe(false);
    expect(canPost({ is_admin: false, permissions: null })).toBe(false);
  });

  it('getUpdates: типы через запятую, marker передаётся', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { updates: [{ update_type: 'bot_added', chat_id: 5 }], marker: 11 }));
    const res = await getUpdates(['bot_added', 'bot_removed'], { marker: 10, timeoutSec: 5 });
    expect(res).toEqual({ updates: [{ update_type: 'bot_added', chat_id: 5 }], marker: 11 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const q = new URL(url).searchParams;
    expect(q.get('types')).toBe('bot_added,bot_removed');
    expect(q.get('marker')).toBe('10');
    expect(q.get('timeout')).toBe('5');
    expect(init.method).toBe('GET');
  });
});
