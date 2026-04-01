/**
 * Admin: get (GET), update (PATCH), delete (DELETE) service.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const service = await prisma.service.findUnique({
    where: { id },
    include: { course: { select: { id: true, title: true } } },
  });
  if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 });

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
      courseTitle: service.course?.title ?? null,
      isActive: service.isActive,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  let body: {
    slug?: string;
    name?: string;
    price?: number | string;
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

  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data: {
    slug?: string;
    name?: string;
    price?: number;
    description?: string | null;
    imageUrl?: string | null;
    paykeeperTariffId?: string | null;
    courseId?: string | null;
    isActive?: boolean;
  } = {};
  if (typeof body.slug === 'string') {
    const slug = body.slug.trim().toLowerCase().replace(/\s+/g, '-');
    if (slug) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return NextResponse.json({ error: 'Некорректный slug' }, { status: 400 });
      }
      const conflict = await prisma.service.findFirst({ where: { slug, id: { not: id } } });
      if (conflict) return NextResponse.json({ error: 'Товар с таким slug уже существует' }, { status: 409 });
      data.slug = slug;
    }
  }
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
  if (body.description !== undefined) {
    data.description =
      typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null;
  }
  if (body.imageUrl !== undefined) {
    data.imageUrl = typeof body.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl.trim() : null;
  }
  if (body.paykeeperTariffId !== undefined) data.paykeeperTariffId = typeof body.paykeeperTariffId === 'string' && body.paykeeperTariffId.trim() ? body.paykeeperTariffId.trim() : null;
  if (body.courseId !== undefined) data.courseId = typeof body.courseId === 'string' && body.courseId.trim() ? body.courseId.trim() : null;
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive;

  if (body.price !== undefined) {
    const raw = body.price;
    let n: number | undefined;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) n = Math.trunc(raw);
    else if (typeof raw === 'string' && raw.trim() !== '') {
      const p = parseInt(raw.trim(), 10);
      if (Number.isFinite(p) && p >= 0) n = p;
    }
    if (n !== undefined) data.price = n;
  }

  const updated = await prisma.service.update({
    where: { id },
    data,
    include: { course: { select: { title: true } } },
  });

  return NextResponse.json({
    service: {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      description: updated.description,
      imageUrl: updated.imageUrl,
      price: updated.price,
      paykeeperTariffId: updated.paykeeperTariffId,
      courseId: updated.courseId,
      courseTitle: updated.course?.title ?? null,
      isActive: updated.isActive,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  await prisma.service.deleteMany({ where: { id } });
  return NextResponse.json({ success: true });
}
