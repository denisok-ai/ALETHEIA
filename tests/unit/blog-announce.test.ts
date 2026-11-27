/**
 * Автоанонс статей (27.11.2026, перезапуск продаж): явное blog_announce_enabled='true'
 * работает поверх общей паузы content_paused (она держит LLM-конвейер постов),
 * без явного включения пауза останавливает анонсы как раньше.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const settings = new Map<string, string>();
const findFirst = vi.fn();
const send = vi.fn();
const config = { paused: true, contentChannelId: '-100123', siteUrl: 'https://avaterra.pro' };

vi.mock('@/lib/db', () => ({
  prisma: {
    systemSetting: {
      findUnique: async ({ where }: { where: { key: string } }) =>
        settings.has(where.key) ? { key: where.key, value: settings.get(where.key) } : null,
      upsert: async () => ({}),
    },
    blogPost: { findFirst: (...a: unknown[]) => findFirst(...a) },
  },
}));
vi.mock('@/lib/content/config', () => ({ getContentConfig: async () => config }));
vi.mock('@/lib/telegram', () => ({ sendTelegramMessageWithResult: (...a: unknown[]) => send(...a) }));
vi.mock('@/lib/telegram-admin-notify', () => ({ notifyAdminsTelegramAsync: () => undefined }));
vi.mock('@/lib/telegram-channel-bot', () => ({ getChannelBotToken: async () => 'smm-token' }));

import { announceNextBlogPost } from '@/lib/content/blog-announce';

const post = { slug: 'chto-takoe-test', h1: 'Что такое тест', title: 't', description: 'Описание' };

describe('blog-announce: пауза и явное включение', () => {
  beforeEach(() => {
    settings.clear();
    findFirst.mockReset().mockResolvedValue(post);
    send.mockReset().mockResolvedValue({ ok: true });
    config.paused = true;
  });

  it('общая пауза без явного включения — пропуск, как раньше', async () => {
    expect(await announceNextBlogPost()).toEqual({ ok: true, skipped: 'paused' });
    expect(send).not.toHaveBeenCalled();
  });

  it('выключено явно — пропуск даже без паузы', async () => {
    config.paused = false;
    settings.set('blog_announce_enabled', 'false');
    expect(await announceNextBlogPost()).toEqual({ ok: true, skipped: 'disabled' });
  });

  it('явное true поверх паузы — анонс уходит ботом канала', async () => {
    settings.set('blog_announce_enabled', 'true');
    const r = await announceNextBlogPost();
    expect(r).toEqual({ ok: true, slug: 'chto-takoe-test' });
    expect(send).toHaveBeenCalledTimes(1);
    const [chat, text, opts] = send.mock.calls[0]!;
    expect(chat).toBe('-100123');
    expect(text).toContain('https://avaterra.pro/blog/chto-takoe-test');
    expect(opts).toEqual({ botToken: 'smm-token' });
  });

  it('сухой прогон — ничего не отправляет', async () => {
    settings.set('blog_announce_enabled', 'true');
    expect(await announceNextBlogPost({ dryRun: true })).toEqual({ ok: true, slug: 'chto-takoe-test', dryRun: true });
    expect(send).not.toHaveBeenCalled();
  });
});
