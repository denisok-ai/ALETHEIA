/**
 * /news: пока опубликованных новостей нет, страница пустая — noindex, follow.
 * Как только появилась публикация, страница индексируется как обычно.
 * Данные — те же, что у страницы (prisma.publication, status: 'active').
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock('@/lib/db', () => ({ prisma: { publication: { findMany } } }));
vi.mock('@/lib/settings', () => ({
  getSystemSettings: async () => ({ site_url: 'https://avaterra.pro' }),
}));

import { generateMetadata } from '@/app/news/page';

describe('/news: индексация', () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it('без опубликованных новостей — noindex, follow; canonical и OG сохраняются', async () => {
    findMany.mockResolvedValue([]);
    const meta = await generateMetadata();
    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(meta.alternates?.canonical).toBe('https://avaterra.pro/news');
    expect(meta.openGraph?.url).toBe('https://avaterra.pro/news');
    expect(meta.openGraph?.images).toBeDefined();
  });

  it('есть хотя бы одна публикация — индексируется', async () => {
    findMany.mockResolvedValue([{ id: 'p1', title: 'Анонс', teaser: null, type: 'announcement', publishAt: new Date() }]);
    const meta = await generateMetadata();
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.alternates?.canonical).toBe('https://avaterra.pro/news');
  });

  it('выбирает только активные публикации', async () => {
    findMany.mockResolvedValue([]);
    await generateMetadata();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'active' } }));
  });
});
