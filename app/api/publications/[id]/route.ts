/**
 * Public: get one visible publication; increment viewsCount on view.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const incView = request.nextUrl.searchParams.get('view') === '1';

  const now = new Date();
  const pub = await prisma.publication.findFirst({
    where: {
      id,
      status: 'active',
      publishAt: { lte: now },
    },
  });

  if (!pub) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (incView) {
    await prisma.publication.update({
      where: { id },
      data: { viewsCount: { increment: 1 } },
    });
  }

  return NextResponse.json({
    publication: {
      id: pub.id,
      title: pub.title,
      type: pub.type,
      publishAt: pub.publishAt.toISOString(),
      teaser: pub.teaser,
      content: pub.content,
      viewsCount: incView ? pub.viewsCount + 1 : pub.viewsCount,
      ratingSum: pub.ratingSum,
      ratingCount: pub.ratingCount,
      allowComments: pub.allowComments,
      allowRating: pub.allowRating,
    },
  });
}
