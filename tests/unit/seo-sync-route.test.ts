/**
 * Маршрут ручного синка SEO (app/api/portal/admin/seo/sync/route.ts): 403 для не-админа,
 * 409 при идущем прогоне, 200 с отчётом в остальных случаях. Сессия, синк и журнал подменены.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAdminSession, runSeoSync, hasRunningSeoSync } = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  runSeoSync: vi.fn(),
  hasRunningSeoSync: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ requireAdminSession }));
vi.mock('@/lib/seo/sync', () => ({ runSeoSync }));
vi.mock('@/lib/seo/store', () => ({ hasRunningSeoSync }));

import { POST, SYNC_BUSY_MESSAGE } from '@/app/api/portal/admin/seo/sync/route';

const REPORT = { sources: {} };

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminSession.mockResolvedValue({ session: null, userId: 'admin-1', role: 'admin' });
  hasRunningSeoSync.mockResolvedValue(false);
  runSeoSync.mockResolvedValue(REPORT);
});

describe('POST /api/portal/admin/seo/sync', () => {
  it('не-админ получает 403 и синк не запускается', async () => {
    requireAdminSession.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(403);
    expect(runSeoSync).not.toHaveBeenCalled();
  });

  it('админ без идущего прогона получает отчёт за 7 дней', async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ report: REPORT });
    expect(runSeoSync).toHaveBeenCalledWith({ days: 7 });
  });

  it('при открытом прогоне в журнале отвечает 409 с понятным текстом и не запускает второй', async () => {
    hasRunningSeoSync.mockResolvedValue(true);
    const res = await POST();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe(SYNC_BUSY_MESSAGE);
    expect(body.error).toMatch(/Синк уже идёт/);
    expect(runSeoSync).not.toHaveBeenCalled();
  });

  it('второй запрос, пришедший пока первый идёт в этом процессе, получает 409', async () => {
    let finish: (v: typeof REPORT) => void = () => {};
    runSeoSync.mockImplementation(() => new Promise((resolve) => (finish = resolve)));

    const first = POST();
    // Первый запрос уже прошёл проверку журнала и держит флаг процесса.
    await vi.waitFor(() => expect(runSeoSync).toHaveBeenCalledTimes(1));
    const second = await POST();
    expect(second.status).toBe(409);

    finish(REPORT);
    expect((await first).status).toBe(200);

    // После завершения флаг снят: следующий запуск снова разрешён.
    runSeoSync.mockResolvedValue(REPORT);
    expect((await POST()).status).toBe(200);
    expect(runSeoSync).toHaveBeenCalledTimes(2);
  });

  it('после падения синка флаг снимается, и повторный запуск проходит', async () => {
    runSeoSync.mockRejectedValueOnce(new Error('boom'));
    await expect(POST()).rejects.toThrow('boom');
    expect((await POST()).status).toBe(200);
  });
});
