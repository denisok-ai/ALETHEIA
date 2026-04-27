/**
 * Public: submit rating 1–5 for a publication (if allowRating).
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { publicationRateSchema } from '@/lib/validations/publication';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const pub = await prisma.publication.findFirst({
    where: { id, status: 'active', allowRating: true },
  });
  if (!pub) return NextResponse.json({ error: 'Not found or rating disabled' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = publicationRateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid value', issues: parsed.error.issues }, { status: 400 });
  }

  await prisma.publication.update({
    where: { id },
    data: {
      ratingSum: { increment: parsed.data.value },
      ratingCount: { increment: 1 },
    },
  });

  const updated = await prisma.publication.findUnique({
    where: { id },
    select: { ratingSum: true, ratingCount: true },
  });

  return NextResponse.json({
    success: true,
    ratingSum: updated?.ratingSum ?? pub.ratingSum + parsed.data.value,
    ratingCount: updated?.ratingCount ?? pub.ratingCount + 1,
  });
}
