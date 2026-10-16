/**
 * Действия админа над очередью соцсетей (lib/social/admin-actions.ts + admin-apply.ts) на реальной SQLite.
 * Переходы статусов, сброс счётчика ошибок при включении сети, пауза, запрещённые переходы.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { PAUSE_ALL_RULE } from '@/lib/social/scheduler';
import { applyPostAction, setNetworkEnabled, setPauseAll } from '@/lib/social/admin-apply';
import {
  checkPostAction,
  networkEnableData,
  parseMskInput,
  parseRescheduleInput,
  requeueScheduledAt,
  toMskInputValue,
} from '@/lib/social/admin-actions';

/** Среда: 14 октября 2026, 11:00 МСК. */
const NOW = new Date('2026-10-14T08:00:00Z');
const ACTOR = null;
let n = 0;

async function resetDb() {
  await prisma.auditLog.deleteMany({ where: { entity: { in: ['SocialPost', 'SocialNetwork', 'SocialRule'] } } });
  await prisma.socialPost.deleteMany({});
  await prisma.socialItem.deleteMany({});
  await prisma.socialNetwork.deleteMany({});
  await prisma.socialRule.deleteMany({ where: { key: PAUSE_ALL_RULE } });
}

async function network(overrides: Partial<{ code: string; enabled: boolean; failStreak: number; lastError: string | null }> = {}) {
  return prisma.socialNetwork.create({
    data: {
      code: overrides.code ?? 'telegram',
      title: 'Telegram-канал школы',
      enabled: overrides.enabled ?? true,
      mode: 'auto',
      chatId: '-1003916704986',
      failStreak: overrides.failStreak ?? 0,
      lastError: overrides.lastError ?? null,
    },
  });
}

async function post(opts: { status?: string; scheduledAt?: Date | null; attempts?: number; error?: string | null } = {}) {
  n += 1;
  const item = await prisma.socialItem.create({
    data: { kind: 'video', title: `Ролик ${n}`, mediaPath: `clip-${n}.mp4`, status: 'ready' },
  });
  return prisma.socialPost.create({
    data: {
      itemId: item.id,
      networkCode: 'telegram',
      caption: `<b>Ролик ${n}</b>`,
      refCode: `tg-${String(n).padStart(2, '0')}`,
      status: opts.status ?? 'scheduled',
      scheduledAt: opts.scheduledAt === undefined ? new Date('2026-10-14T05:00:00Z') : opts.scheduledAt,
      attempts: opts.attempts ?? 0,
      error: opts.error ?? null,
    },
  });
}

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe('переходы статусов (чистая часть)', () => {
  it('вернуть в очередь — только из failed', () => {
    expect(checkPostAction('requeue', 'failed')).toEqual({ ok: true });
    for (const status of ['published', 'scheduled', 'publishing', 'skipped', 'ready_post_sent']) {
      const res = checkPostAction('requeue', status);
      expect(res.ok).toBe(false);
    }
  });

  it('пропустить и перенести — только из scheduled; publishing не трогаем', () => {
    expect(checkPostAction('skip', 'scheduled')).toEqual({ ok: true });
    expect(checkPostAction('reschedule', 'scheduled')).toEqual({ ok: true });
    for (const action of ['skip', 'reschedule'] as const) {
      expect(checkPostAction(action, 'publishing').ok).toBe(false);
      expect(checkPostAction(action, 'published').ok).toBe(false);
      expect(checkPostAction(action, 'failed').ok).toBe(false);
    }
  });

  it('возврат в очередь: прошедшее время сдвигаем на now, будущее сохраняем', () => {
    const past = new Date('2026-10-13T05:00:00Z');
    const future = new Date('2026-10-20T05:00:00Z');
    expect(requeueScheduledAt(past, NOW)).toEqual(NOW);
    expect(requeueScheduledAt(null, NOW)).toEqual(NOW);
    expect(requeueScheduledAt(future, NOW)).toEqual(future);
  });

  it('ввод datetime-local читается как МСК и обратно', () => {
    expect(parseMskInput('2026-10-15T10:30')).toEqual(new Date('2026-10-15T07:30:00Z'));
    expect(parseMskInput('2026-02-31T10:00')).toBeNull();
    expect(parseMskInput('ерунда')).toBeNull();
    expect(toMskInputValue(new Date('2026-10-15T07:30:00Z'))).toBe('2026-10-15T10:30');
    expect(toMskInputValue(null)).toBe('');
  });

  it('перенос: прошедшее время и пустой ввод отклоняются', () => {
    expect(parseRescheduleInput('2026-10-14T10:00', NOW).ok).toBe(false); // 10:00 МСК < 11:00 МСК
    expect(parseRescheduleInput('', NOW).ok).toBe(false);
    const ok = parseRescheduleInput('2026-10-15T10:00', NOW);
    expect(ok).toEqual({ ok: true, date: new Date('2026-10-15T07:00:00Z') });
  });

  it('включение сети сбрасывает failStreak и lastError, выключение — только enabled', () => {
    expect(networkEnableData(true)).toEqual({ enabled: true, failStreak: 0, lastError: null });
    expect(networkEnableData(false)).toEqual({ enabled: false });
  });
});

describe('пауза всех сетей', () => {
  it('включает и снимает SocialRule paused_all', async () => {
    expect((await setPauseAll(true, ACTOR)).ok).toBe(true);
    expect((await prisma.socialRule.findUnique({ where: { key: PAUSE_ALL_RULE } }))?.value).toBe('1');

    expect((await setPauseAll(false, ACTOR)).ok).toBe(true);
    expect((await prisma.socialRule.findUnique({ where: { key: PAUSE_ALL_RULE } }))?.value).toBe('0');
  });
});

describe('сеть: включение и выключение', () => {
  it('включение сбрасывает failStreak и lastError', async () => {
    await network({ enabled: false, failStreak: 2, lastError: 'Forbidden: bot was kicked' });
    expect((await setNetworkEnabled('telegram', true, ACTOR)).ok).toBe(true);

    const net = await prisma.socialNetwork.findUniqueOrThrow({ where: { code: 'telegram' } });
    expect(net.enabled).toBe(true);
    expect(net.failStreak).toBe(0);
    expect(net.lastError).toBeNull();
  });

  it('выключение не трогает счётчик ошибок', async () => {
    await network({ enabled: true, failStreak: 1, lastError: 'сбой' });
    await setNetworkEnabled('telegram', false, ACTOR);

    const net = await prisma.socialNetwork.findUniqueOrThrow({ where: { code: 'telegram' } });
    expect(net.enabled).toBe(false);
    expect(net.failStreak).toBe(1);
    expect(net.lastError).toBe('сбой');
  });

  it('неизвестная сеть — 404', async () => {
    const res = await setNetworkEnabled('nope', true, ACTOR);
    expect(res).toMatchObject({ ok: false, status: 404 });
  });
});

describe('действия над постом', () => {
  it('failed → scheduled: попытки 0, ошибка снята, прошедшее время заменяется на now', async () => {
    const p = await post({
      status: 'failed',
      scheduledAt: new Date('2026-10-13T05:00:00Z'),
      attempts: 3,
      error: 'timeout',
    });
    const res = await applyPostAction(p.id, { action: 'requeue' }, ACTOR, NOW);
    expect(res.ok).toBe(true);

    const after = await prisma.socialPost.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.status).toBe('scheduled');
    expect(after.attempts).toBe(0);
    expect(after.error).toBeNull();
    expect(after.scheduledAt).toEqual(NOW);
  });

  it('failed → scheduled: будущее время сохраняется', async () => {
    const future = new Date('2026-10-20T05:00:00Z');
    const p = await post({ status: 'failed', scheduledAt: future, attempts: 3, error: 'x' });
    await applyPostAction(p.id, { action: 'requeue' }, ACTOR, NOW);
    const after = await prisma.socialPost.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.scheduledAt).toEqual(future);
  });

  it('вернуть в очередь опубликованный пост — 409, строка не меняется', async () => {
    const p = await post({ status: 'published', attempts: 1 });
    const res = await applyPostAction(p.id, { action: 'requeue' }, ACTOR, NOW);
    expect(res).toMatchObject({ ok: false, status: 409 });
    const after = await prisma.socialPost.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.status).toBe('published');
  });

  it('пропустить: scheduled → skipped; publishing пропустить нельзя', async () => {
    const queued = await post({ status: 'scheduled' });
    expect((await applyPostAction(queued.id, { action: 'skip' }, ACTOR, NOW)).ok).toBe(true);
    expect((await prisma.socialPost.findUniqueOrThrow({ where: { id: queued.id } })).status).toBe('skipped');

    const busy = await post({ status: 'publishing' });
    const res = await applyPostAction(busy.id, { action: 'skip' }, ACTOR, NOW);
    expect(res).toMatchObject({ ok: false, status: 409 });
    expect((await prisma.socialPost.findUniqueOrThrow({ where: { id: busy.id } })).status).toBe('publishing');
  });

  it('перенести: новое время по МСК; некорректный или прошедший ввод — 400, строка не меняется', async () => {
    const p = await post({ status: 'scheduled' });
    const ok = await applyPostAction(p.id, { action: 'reschedule', scheduledAt: '2026-10-15T10:00' }, ACTOR, NOW);
    expect(ok.ok).toBe(true);
    expect((await prisma.socialPost.findUniqueOrThrow({ where: { id: p.id } })).scheduledAt).toEqual(
      new Date('2026-10-15T07:00:00Z'),
    );

    const bad = await applyPostAction(p.id, { action: 'reschedule', scheduledAt: 'не дата' }, ACTOR, NOW);
    expect(bad).toMatchObject({ ok: false, status: 400 });
    const past = await applyPostAction(p.id, { action: 'reschedule', scheduledAt: '2026-10-14T10:00' }, ACTOR, NOW);
    expect(past).toMatchObject({ ok: false, status: 400 });
    expect((await prisma.socialPost.findUniqueOrThrow({ where: { id: p.id } })).scheduledAt).toEqual(
      new Date('2026-10-15T07:00:00Z'),
    );
  });

  it('перенести уже failed пост — 409', async () => {
    const p = await post({ status: 'failed', error: 'x' });
    const res = await applyPostAction(p.id, { action: 'reschedule', scheduledAt: '2026-10-15T10:00' }, ACTOR, NOW);
    expect(res).toMatchObject({ ok: false, status: 409 });
  });

  it('несуществующий пост — 404', async () => {
    const res = await applyPostAction(999999, { action: 'skip' }, ACTOR, NOW);
    expect(res).toMatchObject({ ok: false, status: 404 });
  });

  it('действия пишутся в журнал аудита', async () => {
    const p = await post({ status: 'scheduled' });
    await applyPostAction(p.id, { action: 'skip' }, ACTOR, NOW);
    const rows = await prisma.auditLog.findMany({ where: { entity: 'SocialPost', entityId: String(p.id) } });
    expect(rows.map((r) => r.action)).toContain('social.post.skip');
  });
});
