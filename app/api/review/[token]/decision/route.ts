/**
 * Решение автора по пункту плана: статус, правки текста и комментарий.
 * Хранится в SystemSetting (ключ content-review:decisions) слиянием по id.
 * После сохранения — best-effort уведомление админам в Telegram.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { notifyAdminsTelegramAsync } from '@/lib/telegram-admin-notify';
import {
  REVIEW_DECISIONS_KEY,
  getConfiguredReviewToken,
  isValidReviewToken,
  loadReviewItems,
  parseDecisions,
  resolveReviewDir,
  reviewNotificationLines,
  validateDecisionInput,
  type StoredDecision,
} from '@/lib/content-review';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ token: string }> };

const HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
const MAX_BODY_CHARS = 64 * 1024;

function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: HEADERS });
}

export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  if (!isValidReviewToken(token, getConfiguredReviewToken())) {
    return new NextResponse(null, { status: 404, headers: HEADERS });
  }
  const limited = checkRateLimit(request, 'content-review', 60);
  if (limited) return limited;

  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS) return json({ error: 'Слишком большой запрос' }, 413);
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: 'Некорректный JSON' }, 400);
  }

  const parsed = validateDecisionInput(payload);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const input = parsed.value;

  const items = await loadReviewItems(resolveReviewDir());
  if (!items.some((i) => i.id === input.id)) {
    return json({ error: 'Пункт плана не найден' }, 404);
  }

  const decision: StoredDecision = {
    status: input.status,
    title: input.title,
    body: input.body,
    ...(input.speech !== undefined ? { speech: input.speech } : {}),
    comment: input.comment,
    updatedAt: new Date().toISOString(),
  };

  // Чтение и запись в одной транзакции: два быстрых решения подряд не теряют друг друга.
  await prisma.$transaction(async (tx) => {
    const row = await tx.systemSetting.findUnique({ where: { key: REVIEW_DECISIONS_KEY } });
    const all = parseDecisions(row?.value);
    all[input.id] = decision;
    const value = JSON.stringify(all);
    await tx.systemSetting.upsert({
      where: { key: REVIEW_DECISIONS_KEY },
      create: { key: REVIEW_DECISIONS_KEY, value },
      update: { value },
    });
  });

  // Уведомление не должно ни задерживать ответ, ни ломать его.
  notifyAdminsTelegramAsync(
    'content_review',
    reviewNotificationLines(input.title, input.status, input.comment),
  );

  return json({ ok: true, decision });
}
