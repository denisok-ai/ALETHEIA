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
      description: s.description,
      imageUrl: s.imageUrl,
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

  let body: {
    slug: string;
    name: string;
    price: number;
    description?: string | null;
    imageUrl?: string | null;
    paykeeperTariffId?: string | null;
    courseId?: string | null;
    isActive?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase().replace(/\s+/g, '-') : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const price = typeof body.price === 'number' && body.price >= 0 ? body.price : 0;
  const slugOk = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);

  if (!slug || !name) {
    return NextResponse.json({ error: 'slug и name обязательны' }, { status: 400 });
  }
  if (!slugOk) {
    return NextResponse.json(
      { error: 'slug: только латиница в нижнем регистре, цифры и дефисы' },
      { status: 400 },
    );
  }

  const existing = await prisma.service.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: 'Товар с таким slug уже существует' }, { status: 409 });
  }

  const courseId = typeof body.courseId === 'string' && body.courseId.trim() ? body.courseId.trim() : null;
  const paykeeperTariffId = typeof body.paykeeperTariffId === 'string' && body.paykeeperTariffId.trim() ? body.paykeeperTariffId.trim() : slug;
  const isActive = body.isActive !== false;
  const description =
    typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null;
  const imageUrl =
    typeof body.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl.trim() : null;

  const service = await prisma.service.create({
    data: {
      slug,
      name,
      description,
      imageUrl,
      price,
      paykeeperTariffId,
      courseId,
      isActive,
    },
  });

  return NextResponse.json({
    service: {
      id: service.id,
      slug: service.slug,
      name: service.name,
      description: service.description,
      imageUrl: service.imageUrl,
      price: service.price,
      paykeeperTariffId: service.paykeeperTariffId,
      courseId: service.courseId,
      isActive: service.isActive,
    },
  });
}
