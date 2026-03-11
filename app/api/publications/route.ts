/**
 * Public: list visible publications (status=active, publishAt <= now).
 * Query: limit (default 10, max 50).
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit')) || 10, 50);

  const now = new Date();
  const list = await prisma.publication.findMany({
    where: {
      status: 'active',
      publishAt: { lte: now },
    },
    orderBy: { publishAt: 'desc' },
    take: limit,
  });

  return NextResponse.json({
    publications: list.map((p) => ({
      id: p.id,
      title: p.title,
      type: p.type,
      publishAt: p.publishAt.toISOString(),
      teaser: p.teaser,
      content: p.type === 'announcement' ? p.content : undefined,
      viewsCount: p.viewsCount,
      ratingSum: p.ratingSum,
      ratingCount: p.ratingCount,
    })),
  });
}
