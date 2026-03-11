/**
 * Student: submit rating 1–5 for a media resource.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: { value?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const value = typeof body.value === 'number' ? Math.round(body.value) : NaN;
  if (Number.isNaN(value) || value < 1 || value > 5) {
    return NextResponse.json({ error: 'Укажите оценку от 1 до 5' }, { status: 400 });
  }

  await prisma.media.update({
    where: { id },
    data: {
      ratingSum: { increment: value },
      ratingCount: { increment: 1 },
    },
  });

  const updated = await prisma.media.findUnique({
    where: { id },
    select: { ratingSum: true, ratingCount: true },
  });
  const count = updated?.ratingCount ?? 1;
  const avg = updated && count > 0 ? updated.ratingSum! / count : value;

  return NextResponse.json({
    success: true,
    rating_avg: Math.round(avg * 10) / 10,
    rating_count: count,
  });
}
