/**
 * Public: list products (services linked to published courses) for the main page shop.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/** Не кешировать: иначе nginx proxy_cache / CDN / браузер держат старый список тарифов. */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Первая строка description — краткий текст карточки; строки с «•» или с новой строки — пункты списка. */
function descriptionToCardAndFeatures(
  raw: string | null | undefined,
  courseDesc: string | null | undefined,
  name: string
): { cardDescription: string; features: string[] } {
  const lines = (raw ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    const fallback = (courseDesc?.trim() || name).slice(0, 2000);
    const featuresFromCourse = courseDesc
      ? [courseDesc.slice(0, 100) + (courseDesc.length > 100 ? '…' : '')]
      : [name];
    return { cardDescription: fallback, features: featuresFromCourse };
  }
  const first = lines[0];
  const rest = lines.slice(1).map((l) => l.replace(/^[\s•\-*]+\s*/, '').trim()).filter(Boolean);
  const features =
    rest.length > 0
      ? rest
      : courseDesc
        ? [courseDesc.slice(0, 100) + (courseDesc.length > 100 ? '…' : '')]
        : [name];
  return { cardDescription: first.slice(0, 2000), features };
}

export async function GET() {
  const services = await prisma.service.findMany({
    where: {
      isActive: true,
      courseId: { not: null },
      course: { status: 'published' },
    },
    include: {
      course: {
        select: { id: true, title: true, description: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const products = services.map((s) => {
    const { cardDescription, features } = descriptionToCardAndFeatures(
      s.description,
      s.course?.description ?? null,
      s.name
    );
    return {
      slug: s.slug,
      id: s.slug,
      name: s.name,
      price: s.price,
      description: cardDescription,
      imageUrl: s.imageUrl ?? null,
      courseId: s.courseId,
      courseTitle: s.course?.title ?? s.name,
      features,
    };
  });

  return NextResponse.json(
    { products },
    {
      headers: {
        'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
      },
    }
  );
}
