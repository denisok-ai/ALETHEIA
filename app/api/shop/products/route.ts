/**
 * Public: list products (services linked to published courses) for the main page shop.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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

  const products = services.map((s) => ({
    slug: s.slug,
    id: s.slug,
    name: s.name,
    price: s.price,
    description: s.course?.description ?? s.name,
    courseId: s.courseId,
    courseTitle: s.course?.title ?? s.name,
    features: s.course?.description
      ? [s.course.description.slice(0, 100) + (s.course.description.length > 100 ? '…' : '')]
      : [s.name],
  }));

  return NextResponse.json({ products });
}
