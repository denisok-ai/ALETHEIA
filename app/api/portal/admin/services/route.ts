/**
 * Admin: list services (GET), create service (POST).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const services = await prisma.service.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      course: { select: { id: true, title: true, status: true } },
    },
  });

  return NextResponse.json({
    services: services.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      price: s.price,
      paykeeperTariffId: s.paykeeperTariffId,
      courseId: s.courseId,
      courseTitle: s.course?.title ?? null,
      isActive: s.isActive,
      createdAt: s.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { slug: string; name: string; price: number; paykeeperTariffId?: string | null; courseId?: string | null; isActive?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase().replace(/\s+/g, '-') : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const price = typeof body.price === 'number' && body.price >= 0 ? body.price : 0;

  if (!slug || !name) {
    return NextResponse.json({ error: 'slug и name обязательны' }, { status: 400 });
  }

  const existing = await prisma.service.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: 'Товар с таким slug уже существует' }, { status: 409 });
  }

  const courseId = typeof body.courseId === 'string' && body.courseId.trim() ? body.courseId.trim() : null;
  const paykeeperTariffId = typeof body.paykeeperTariffId === 'string' && body.paykeeperTariffId.trim() ? body.paykeeperTariffId.trim() : slug;
  const isActive = body.isActive !== false;

  const service = await prisma.service.create({
    data: {
      slug,
      name,
      price,
      paykeeperTariffId,
      courseId,
      isActive,
    },
  });

  return NextResponse.json({ service: { id: service.id, slug: service.slug, name: service.name, price: service.price, paykeeperTariffId: service.paykeeperTariffId, courseId: service.courseId, isActive: service.isActive } });
}
