/**
 * Админ: чтение и ручная корректировка заряда (UserEnergy) для пользователя.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { getGamificationNumbers } from '@/lib/gamification-config';
import {
  getEarnedBadges,
  levelFromTotalXp,
  xpProgressPercentInCurrentLevel,
} from '@/lib/gamification';
import { recordGamificationXpEvent } from '@/lib/gamification-ledger';
import { notifyGamificationAfterXpChange } from '@/lib/gamification-milestones';

const ACTION = 'user.energy.adjust';
const ENTITY = 'UserEnergy';
const HISTORY_LIMIT = 20;
const MAX_NOTE = 500;
const MAX_XP = 10_000_000;

function safeParseMetaJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseAuditDiff(diff: string | null): {
  oldXp?: number;
  newXp?: number;
  delta?: number;
  note?: string | null;
} {
  if (!diff) return {};
  try {
    const o = JSON.parse(diff) as Record<string, unknown>;
    return {
      oldXp: typeof o.oldXp === 'number' ? o.oldXp : undefined,
      newXp: typeof o.newXp === 'number' ? o.newXp : undefined,
      delta: typeof o.delta === 'number' ? o.delta : undefined,
      note: typeof o.note === 'string' ? o.note : o.note === null ? null : undefined,
    };
  } catch {
    return {};
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: userId } = await params;
  if (!userId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [energyRow, numbers, logs] = await Promise.all([
    prisma.userEnergy.findUnique({ where: { userId } }),
    getGamificationNumbers(),
    prisma.auditLog.findMany({
      where: { entity: ENTITY, entityId: userId, action: ACTION },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
    }),
  ]);

  let xpEvents: Awaited<ReturnType<typeof prisma.gamificationXpEvent.findMany>> = [];
  try {
    xpEvents = await prisma.gamificationXpEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
  } catch (e) {
    console.warn('[admin energy GET] gamificationXpEvent unavailable (migrate DB?):', e);
  }

  const xp = energyRow?.xp ?? 0;
  const { xpPerLevel, xpLessonComplete } = numbers;
  const level = levelFromTotalXp(xp, xpPerLevel);
  const chargePercent = Math.min(100, Math.max(0, Math.round(xpProgressPercentInCurrentLevel(xp, xpPerLevel))));

  const actorIds = Array.from(
    new Set(logs.map((l) => l.actorId).filter((id): id is string => Boolean(id)))
  );
  const actors =
    actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, email: true },
        })
      : [];
  const emailById = Object.fromEntries(actors.map((a) => [a.id, a.email]));

  const history = logs.map((l) => {
    const d = parseAuditDiff(l.diff);
    return {
      id: l.id,
      createdAt: l.createdAt.toISOString(),
      actorId: l.actorId,
      actorEmail: l.actorId ? emailById[l.actorId] ?? null : null,
      oldXp: d.oldXp ?? null,
      newXp: d.newXp ?? null,
      delta: d.delta ?? null,
      note: d.note ?? null,
    };
  });

  const gamificationEventsRaw = xpEvents.map((e) => ({
    id: e.id,
    source: e.source,
    delta: e.delta,
    balanceAfter: e.balanceAfter,
    meta: safeParseMetaJson(e.meta),
    createdAt: e.createdAt.toISOString(),
  }));

  const courseIdsForLabels = Array.from(
    new Set(
      gamificationEventsRaw
        .map((ev) => {
          const cid = ev.meta.courseId;
          return typeof cid === 'string' && cid ? cid : null;
        })
        .filter((id): id is string => Boolean(id))
    )
  );
  const courseRows =
    courseIdsForLabels.length > 0
      ? await prisma.course.findMany({
          where: { id: { in: courseIdsForLabels } },
          select: { id: true, title: true },
        })
      : [];
  const titleByCourseId = Object.fromEntries(courseRows.map((c) => [c.id, c.title]));

  const gamificationEvents = gamificationEventsRaw.map((ev) => {
    const cid = typeof ev.meta.courseId === 'string' ? ev.meta.courseId : null;
    const fromMeta =
      typeof ev.meta.courseTitle === 'string' && ev.meta.courseTitle.trim()
        ? ev.meta.courseTitle
        : null;
    const courseTitle = fromMeta ?? (cid ? titleByCourseId[cid] ?? null : null);
    return { ...ev, courseTitle };
  });

  return NextResponse.json({
    userId,
    xp,
    level,
    chargePercent,
    xpPerLevel,
    xpLessonComplete,
    xpVerificationApproved: numbers.xpVerificationApproved,
    lastPracticeAt: energyRow?.lastPracticeAt?.toISOString() ?? null,
    updatedAt: energyRow?.updatedAt?.toISOString() ?? null,
    badges: getEarnedBadges(xp).map((b) => ({ minXp: b.minXp, label: b.label, emoji: b.emoji })),
    history,
    gamificationEvents,
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: userId } = await params;
  if (!userId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: { mode?: string; value?: number; note?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const mode = body.mode === 'set' ? 'set' : body.mode === 'delta' ? 'delta' : null;
  if (!mode) {
    return NextResponse.json({ error: 'mode must be "delta" or "set"' }, { status: 400 });
  }

  const valueRaw = body.value;
  if (typeof valueRaw !== 'number' || !Number.isFinite(valueRaw)) {
    return NextResponse.json({ error: 'value must be a finite number' }, { status: 400 });
  }

  let note: string | null = null;
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== 'string') {
      return NextResponse.json({ error: 'note must be a string' }, { status: 400 });
    }
    note = body.note.trim().slice(0, MAX_NOTE) || null;
  }

  const numbers = await getGamificationNumbers();
  const { xpPerLevel } = numbers;

  const existing = await prisma.userEnergy.findUnique({ where: { userId } });
  const oldXp = existing?.xp ?? 0;

  let newXp: number;
  if (mode === 'delta') {
    const delta = Math.round(valueRaw);
    if (delta === 0) {
      return NextResponse.json({ error: 'delta must not be 0' }, { status: 400 });
    }
    newXp = Math.max(0, oldXp + delta);
  } else {
    newXp = Math.max(0, Math.round(valueRaw));
  }

  if (newXp > MAX_XP) {
    return NextResponse.json({ error: `xp must be at most ${MAX_XP}` }, { status: 400 });
  }

  const newLevel = levelFromTotalXp(newXp, xpPerLevel);

  await prisma.userEnergy.upsert({
    where: { userId },
    create: {
      userId,
      xp: newXp,
      level: newLevel,
      lastPracticeAt: null,
    },
    update: {
      xp: newXp,
      level: newLevel,
    },
  });

  const xpDelta = newXp - oldXp;
  if (xpDelta !== 0) {
    try {
      await recordGamificationXpEvent(prisma, {
        userId,
        source: mode === 'delta' ? 'admin_delta' : 'admin_set',
        delta: xpDelta,
        balanceAfter: newXp,
        meta: { note, mode },
      });
      await notifyGamificationAfterXpChange({
        userId,
        oldXp,
        newXp,
        xpPerLevel,
      });
    } catch (e) {
      console.error('[admin energy] ledger/notify error:', e);
    }
  }

  await writeAuditLog({
    actorId: auth.userId,
    action: ACTION,
    entity: ENTITY,
    entityId: userId,
    diff: {
      oldXp,
      newXp,
      delta: newXp - oldXp,
      note,
    },
  });

  const chargePercent = Math.min(
    100,
    Math.max(0, Math.round(xpProgressPercentInCurrentLevel(newXp, xpPerLevel)))
  );

  return NextResponse.json({
    success: true,
    xp: newXp,
    level: newLevel,
    chargePercent,
    xpPerLevel: numbers.xpPerLevel,
    xpLessonComplete: numbers.xpLessonComplete,
    xpVerificationApproved: numbers.xpVerificationApproved,
    badges: getEarnedBadges(newXp).map((b) => ({ minXp: b.minXp, label: b.label, emoji: b.emoji })),
  });
}
