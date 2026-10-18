/**
 * Данные страницы согласования: план (items.json) и решения автора.
 * Неверный или не заданный токен → 404 без тела (существование ссылки не раскрываем).
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  REVIEW_DECISIONS_KEY,
  getConfiguredReviewToken,
  isValidReviewToken,
  loadReviewItems,
  parseDecisions,
  resolveReviewDir,
} from '@/lib/content-review';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ token: string }> };

const HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  if (!isValidReviewToken(token, getConfiguredReviewToken())) {
    return new NextResponse(null, { status: 404, headers: HEADERS });
  }

  const items = await loadReviewItems(resolveReviewDir());
  const row = await prisma.systemSetting.findUnique({ where: { key: REVIEW_DECISIONS_KEY } });
  const decisions = parseDecisions(row?.value);

  const mediaBase = `/api/review/${encodeURIComponent(token)}/media/`;
  const publicItems = items.map(({ video, poster, ...rest }) => ({
    ...rest,
    videoUrl: video ? mediaBase + video : undefined,
    poster: poster ? mediaBase + poster : undefined,
  }));

  return NextResponse.json({ items: publicItems, decisions }, { headers: HEADERS });
}
