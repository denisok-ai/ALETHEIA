/**
 * Применение действий админа к очереди соцсетей (T3.8): запись в БД и журнал аудита.
 * Правила переходов и формат данных — в lib/social/admin-actions.ts.
 * Серверный модуль: используется только API-маршрутами и тестами.
 */
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { PAUSE_ALL_RULE } from './scheduler';
import {
  checkPostAction,
  networkEnableData,
  parseRescheduleInput,
  pauseRuleValue,
  requeueScheduledAt,
  type PostAction,
} from './admin-actions';

export type ApplyResult = { ok: true } | { ok: false; status: 400 | 404 | 409; error: string };

/** Пауза всех сетей: SocialRule paused_all = '1' / '0'. */
export async function setPauseAll(paused: boolean, actorId: string | null): Promise<ApplyResult> {
  const value = pauseRuleValue(paused);
  await prisma.socialRule.upsert({
    where: { key: PAUSE_ALL_RULE },
    create: { key: PAUSE_ALL_RULE, value },
    update: { value },
  });
  await writeAuditLog({ actorId, action: 'social.pause', entity: 'SocialRule', entityId: PAUSE_ALL_RULE, diff: { paused } });
  return { ok: true };
}

/** Включить/выключить сеть. Включение сбрасывает failStreak и lastError (см. networkEnableData). */
export async function setNetworkEnabled(code: string, enabled: boolean, actorId: string | null): Promise<ApplyResult> {
  const net = await prisma.socialNetwork.findUnique({ where: { code }, select: { id: true } });
  if (!net) return { ok: false, status: 404, error: `Сеть «${code}» не найдена` };
  await prisma.socialNetwork.update({ where: { id: net.id }, data: networkEnableData(enabled) });
  await writeAuditLog({
    actorId,
    action: 'social.network.enabled',
    entity: 'SocialNetwork',
    entityId: String(net.id),
    diff: { code, enabled },
  });
  return { ok: true };
}

export type PostActionInput = { action: PostAction; scheduledAt?: string };

/**
 * Действие над постом. Переход проверяется дважды: по статусу, прочитанному сейчас,
 * и условием updateMany по исходному статусу (защита от гонки с планировщиком).
 */
export async function applyPostAction(
  postId: number,
  input: PostActionInput,
  actorId: string | null,
  now: Date = new Date(),
): Promise<ApplyResult> {
  const post = await prisma.socialPost.findUnique({
    where: { id: postId },
    select: { id: true, status: true, scheduledAt: true },
  });
  if (!post) return { ok: false, status: 404, error: `Пост ${postId} не найден` };

  const check = checkPostAction(input.action, post.status);
  if (!check.ok) return { ok: false, status: 409, error: check.error };

  const guard = { id: postId, status: post.status };
  let changes: Record<string, unknown>;
  if (input.action === 'requeue') {
    changes = {
      status: 'scheduled',
      attempts: 0,
      error: null,
      publishedAt: null,
      scheduledAt: requeueScheduledAt(post.scheduledAt, now),
    };
  } else if (input.action === 'skip') {
    changes = { status: 'skipped' };
  } else {
    const parsed = parseRescheduleInput(input.scheduledAt ?? '', now);
    if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
    changes = { scheduledAt: parsed.date };
  }

  const res = await prisma.socialPost.updateMany({ where: guard, data: changes });
  if (res.count !== 1) {
    return { ok: false, status: 409, error: 'Статус поста уже изменился. Обновите страницу.' };
  }

  await writeAuditLog({
    actorId,
    action: `social.post.${input.action}`,
    entity: 'SocialPost',
    entityId: String(postId),
    diff: { from: post.status, to: changes },
  });
  return { ok: true };
}
