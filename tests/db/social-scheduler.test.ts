/**
 * Планировщик автопубликации (lib/social/scheduler.ts) на реальной SQLite.
 * Telegram и алерты подменены: проверяем решения планировщика, а не сеть.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { notifyAdminsTelegram } from '@/lib/telegram-admin-notify';
import { publishText, publishVideo, TelegramPublishError } from '@/lib/social/connectors/telegram';
import { tick } from '@/lib/social/scheduler';

vi.mock('@/lib/social/connectors/telegram', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/social/connectors/telegram')>();
  return { ...actual, publishVideo: vi.fn(), publishText: vi.fn() };
});
vi.mock('@/lib/telegram-admin-notify', () => ({
  notifyAdminsTelegram: vi.fn(async () => ({ sent: 1, failed: 0, skipped: false })),
}));

const publishVideoMock = vi.mocked(publishVideo);
const notifyMock = vi.mocked(notifyAdminsTelegram);

/** Среда: 14 октября 2026, 11:00 МСК. */
const NOW = new Date('2026-10-14T08:00:00Z');
const at = (iso: string) => new Date(iso);
let n = 0;

async function resetDb() {
  await prisma.socialPost.deleteMany({});
  await prisma.socialItem.deleteMany({});
  await prisma.socialNetwork.deleteMany({});
  await prisma.socialRule.deleteMany({ where: { key: 'paused_all' } });
}

async function network(overrides: Partial<{ enabled: boolean; mode: string; chatId: string | null }> = {}) {
  return prisma.socialNetwork.create({
    data: {
      code: 'telegram',
      title: 'Telegram-канал школы',
      enabled: overrides.enabled ?? true,
      mode: overrides.mode ?? 'auto',
      chatId: overrides.chatId === undefined ? '-1003916704986' : overrides.chatId,
      profileUrl: 'https://t.me/avaterrapro',
    },
  });
}

async function post(opts: {
  scheduledAt?: Date;
  status?: string;
  itemStatus?: string;
  attempts?: number;
  publishedAt?: Date | null;
  updatedAt?: Date;
  mediaPath?: string | null;
  networkCode?: string;
}) {
  n += 1;
  const item = await prisma.socialItem.create({
    data: {
      kind: 'video',
      title: `Ролик ${n}`,
      mediaPath: opts.mediaPath === undefined ? `clip-${n}.mp4` : opts.mediaPath,
      status: opts.itemStatus ?? 'ready',
    },
  });
  const created = await prisma.socialPost.create({
    data: {
      itemId: item.id,
      networkCode: opts.networkCode ?? 'telegram',
      caption: `<b>Ролик ${n}</b>`,
      refCode: `tg-${String(n).padStart(2, '0')}`,
      status: opts.status ?? 'scheduled',
      scheduledAt: opts.scheduledAt ?? at('2026-10-14T05:00:00Z'),
      attempts: opts.attempts ?? 0,
      publishedAt: opts.publishedAt ?? null,
    },
  });
  if (opts.updatedAt) {
    return prisma.socialPost.update({ where: { id: created.id }, data: { updatedAt: opts.updatedAt } });
  }
  return created;
}

const okPublish = (messageId = 777) =>
  publishVideoMock.mockResolvedValue({ messageId, url: `https://t.me/avaterrapro/${messageId}` });

beforeEach(async () => {
  await resetDb();
  publishVideoMock.mockReset();
  vi.mocked(publishText).mockReset();
  notifyMock.mockClear();
  n = 0;
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe('выбор поста', () => {
  it('берёт самый ранний due-пост; будущие и из неготовых материалов не трогает', async () => {
    await network();
    const early = await post({ scheduledAt: at('2026-10-14T05:00:00Z') });
    await post({ scheduledAt: at('2026-10-14T04:00:00Z'), itemStatus: 'draft' });
    await post({ scheduledAt: at('2026-10-14T09:00:00Z') });
    okPublish(501);

    const report = await tick(NOW);

    expect(report.published).toEqual([early.id]);
    expect(publishVideoMock).toHaveBeenCalledTimes(1);
    const args = publishVideoMock.mock.calls[0][0];
    expect(args.chatId).toBe('-1003916704986');
    expect(args.caption).toBe(early.caption);
    expect(args.filePath.endsWith('clip-1.mp4')).toBe(true);

    const row = await prisma.socialPost.findUniqueOrThrow({ where: { id: early.id } });
    expect(row.status).toBe('published');
    expect(row.externalId).toBe('501');
    expect(row.externalUrl).toBe('https://t.me/avaterrapro/501');
    expect(row.error).toBeNull();
  });

  it('пауза всех сетей (paused_all=1) — ничего не публикуется', async () => {
    await network();
    await prisma.socialRule.create({ data: { key: 'paused_all', value: '1' } });
    const p = await post({});
    const report = await tick(NOW);
    expect(report.held.join(' ')).toContain('paused_all');
    expect(publishVideoMock).not.toHaveBeenCalled();
    expect((await prisma.socialPost.findUniqueOrThrow({ where: { id: p.id } })).status).toBe('scheduled');
  });

  it('выключенная сеть (enabled=false) не получает постов', async () => {
    await network({ enabled: false });
    await post({});
    await tick(NOW);
    expect(publishVideoMock).not.toHaveBeenCalled();
  });

  it('материал без файла публикуется текстом', async () => {
    await network();
    vi.mocked(publishText).mockResolvedValueOnce({ messageId: 88, url: null });
    const p = await post({ mediaPath: null });
    const report = await tick(NOW);
    expect(report.published).toEqual([p.id]);
    expect(publishVideoMock).not.toHaveBeenCalled();
    expect((await prisma.socialPost.findUniqueOrThrow({ where: { id: p.id } })).externalUrl).toBeNull();
  });
});

describe('одна публикация в сеть за день по Москве', () => {
  it('второй пост того же дня ждёт; следующий день (МСК) публикует', async () => {
    await network();
    const first = await post({ scheduledAt: at('2026-10-14T05:00:00Z') });
    const second = await post({ scheduledAt: at('2026-10-14T05:30:00Z') });
    okPublish(1);

    const r1 = await tick(NOW);
    expect(r1.published).toEqual([first.id]);
    const r2 = await tick(at('2026-10-14T09:00:00Z'));
    expect(r2.published).toEqual([]);
    expect(r2.held.join(' ')).toContain('сегодня уже публиковали');
    expect((await prisma.socialPost.findUniqueOrThrow({ where: { id: second.id } })).status).toBe('scheduled');

    const r3 = await tick(at('2026-10-15T09:00:00Z'));
    expect(r3.published).toEqual([second.id]);
  });

  it('публикация 23:30 МСК предыдущего дня не занимает текущий день', async () => {
    await network();
    await post({
      status: 'published',
      publishedAt: at('2026-10-13T20:30:00Z'),
      scheduledAt: at('2026-10-13T20:00:00Z'),
    });
    const p = await post({ scheduledAt: at('2026-10-14T05:00:00Z') });
    okPublish(2);
    const report = await tick(NOW);
    expect(report.published).toEqual([p.id]);
  });
});

describe('ошибки и остановка сети', () => {
  it('две ошибки подряд выключают сеть и шлют алерт владельцу один раз', async () => {
    await network();
    const a = await post({ scheduledAt: at('2026-10-14T05:00:00Z') });
    const b = await post({ scheduledAt: at('2026-10-14T05:10:00Z') });
    publishVideoMock.mockRejectedValue(new TelegramPublishError('not_admin', 'Бот не может публиковать в канал'));

    await tick(NOW);
    const afterFirst = await prisma.socialPost.findUniqueOrThrow({ where: { id: a.id } });
    expect(afterFirst.status).toBe('scheduled');
    expect(afterFirst.attempts).toBe(1);
    expect(afterFirst.error).toContain('Бот не может');
    expect((await prisma.socialNetwork.findUniqueOrThrow({ where: { code: 'telegram' } })).failStreak).toBe(1);
    expect(notifyMock).not.toHaveBeenCalled();

    await tick(at('2026-10-14T08:10:00Z'));
    const net = await prisma.socialNetwork.findUniqueOrThrow({ where: { code: 'telegram' } });
    expect(net.enabled).toBe(false);
    expect(net.failStreak).toBe(0);
    expect(notifyMock).toHaveBeenCalledTimes(1);
    const lines = notifyMock.mock.calls[0][1] as string[];
    expect(lines[0]).toMatch(/^Автопубликация в канал остановлена: /);
    // Пост A остаётся самым ранним и получил обе попытки; B не трогали.
    expect((await prisma.socialPost.findUniqueOrThrow({ where: { id: a.id } })).attempts).toBe(2);
    expect((await prisma.socialPost.findUniqueOrThrow({ where: { id: b.id } })).attempts).toBe(0);

    // Выключенная сеть больше не пробует.
    publishVideoMock.mockClear();
    await tick(at('2026-10-15T08:00:00Z'));
    expect(publishVideoMock).not.toHaveBeenCalled();
  });

  it('успех сбрасывает счётчик ошибок подряд', async () => {
    await network();
    await post({ scheduledAt: at('2026-10-14T05:00:00Z') });
    publishVideoMock.mockRejectedValueOnce(new TelegramPublishError('api', 'временный сбой'));
    await tick(NOW);
    expect((await prisma.socialNetwork.findUniqueOrThrow({ where: { code: 'telegram' } })).failStreak).toBe(1);

    okPublish(3);
    const r = await tick(at('2026-10-14T08:10:00Z'));
    expect(r.published).toHaveLength(1);
    expect((await prisma.socialNetwork.findUniqueOrThrow({ where: { code: 'telegram' } })).failStreak).toBe(0);
  });

  it('лимит Telegram (flood) не считается ошибкой поста и не тратит попытку', async () => {
    await network();
    const p = await post({ scheduledAt: at('2026-10-14T05:00:00Z') });
    publishVideoMock.mockRejectedValueOnce(new TelegramPublishError('flood', 'подождать 30 с', { retryAfterSec: 30 }));
    const r = await tick(NOW);
    expect(r.failed).toEqual([]);
    expect(r.held.join(' ')).toContain('лимит Telegram');
    const row = await prisma.socialPost.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.status).toBe('scheduled');
    expect(row.attempts).toBe(0);
    expect((await prisma.socialNetwork.findUniqueOrThrow({ where: { code: 'telegram' } })).failStreak).toBe(0);
  });

  it('три попытки исчерпаны — пост failed', async () => {
    await network();
    const p = await post({ scheduledAt: at('2026-10-14T05:00:00Z'), attempts: 2 });
    publishVideoMock.mockRejectedValueOnce(new TelegramPublishError('api', 'Telegram sendVideo: ошибка'));
    await tick(NOW);
    const row = await prisma.socialPost.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.status).toBe('failed');
    expect(row.attempts).toBe(3);
  });

  it('неоднозначный сбой (пост мог уйти) — сразу failed и алерт «проверьте канал»', async () => {
    await network();
    const p = await post({ scheduledAt: at('2026-10-14T05:00:00Z') });
    publishVideoMock.mockRejectedValueOnce(
      new TelegramPublishError('network', 'Нет ответа от Telegram', { ambiguous: true }),
    );
    await tick(NOW);
    expect((await prisma.socialPost.findUniqueOrThrow({ where: { id: p.id } })).status).toBe('failed');
    const texts = notifyMock.mock.calls.map((c) => (c[1] as string[]).join(' '));
    expect(texts.some((t) => t.includes('ответ Telegram не получен'))).toBe(true);
  });
});

describe('блокировка от двойной публикации', () => {
  it('два параллельных прохода публикуют пост один раз', async () => {
    await network();
    const p = await post({ scheduledAt: at('2026-10-14T05:00:00Z') });
    publishVideoMock.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return { messageId: 5, url: null };
    });

    await Promise.all([tick(NOW), tick(NOW)]);

    expect(publishVideoMock).toHaveBeenCalledTimes(1);
    expect((await prisma.socialPost.findUniqueOrThrow({ where: { id: p.id } })).status).toBe('published');
  });

  it('два разных поста одной сети в один день: параллельные проходы публикуют только один', async () => {
    await network();
    await post({ scheduledAt: at('2026-10-14T05:00:00Z') });
    await post({ scheduledAt: at('2026-10-14T05:05:00Z') });
    publishVideoMock.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return { messageId: 6, url: null };
    });

    await Promise.all([tick(NOW), tick(NOW)]);

    expect(publishVideoMock).toHaveBeenCalledTimes(1);
    const published = await prisma.socialPost.count({ where: { status: 'published' } });
    expect(published).toBe(1);
  });

  it('пост в publishing свежий (< 10 мин) не трогается и не публикуется повторно', async () => {
    await network();
    const p = await post({
      status: 'publishing',
      publishedAt: NOW,
      updatedAt: at('2026-10-14T07:55:00Z'),
      scheduledAt: at('2026-10-14T05:00:00Z'),
    });
    await tick(NOW);
    expect(publishVideoMock).not.toHaveBeenCalled();
    expect((await prisma.socialPost.findUniqueOrThrow({ where: { id: p.id } })).status).toBe('publishing');
  });

  it('пост, зависший в publishing > 10 мин, переводится в failed и не публикуется повторно', async () => {
    await network();
    const p = await post({
      status: 'publishing',
      publishedAt: at('2026-10-14T07:00:00Z'),
      updatedAt: at('2026-10-14T07:00:00Z'),
      scheduledAt: at('2026-10-14T05:00:00Z'),
    });
    const report = await tick(NOW);
    expect(report.recovered).toEqual([p.id]);
    expect(publishVideoMock).not.toHaveBeenCalled();
    const row = await prisma.socialPost.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.status).toBe('failed');
    expect(row.error).toContain('Возможно, он уже в канале');
    const texts = notifyMock.mock.calls.map((c) => (c[1] as string[]).join(' '));
    expect(texts.some((t) => t.toLowerCase().includes('проверьте канал'))).toBe(true);
  });
});
