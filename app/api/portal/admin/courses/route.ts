/**
 * Admin: list courses (GET), create course (POST).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('groupId')?.trim() || undefined;

  const where = groupId
    ? { courseGroups: { some: { groupId } } }
    : {};

  const courses = await prisma.course.findMany({
    where,
    select: { id: true, title: true },
    orderBy: { sortOrder: 'asc' },
  });
  return NextResponse.json({ courses });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const STATUS_VALUES = ['draft', 'published', 'cancelled', 'archived'] as const;
  let body: {
    title: string;
    description?: string | null;
    price?: number | null;
    startsAt?: string | null;
    endsAt?: string | null;
    status?: string;
    courseFormat?: 'scorm' | 'live_event';
    eventVenue?: string | null;
    eventUrl?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { title, description, price, startsAt, endsAt, status, courseFormat, eventVenue, eventUrl } = body;
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });
  const statusVal = status && STATUS_VALUES.includes(status as (typeof STATUS_VALUES)[number]) ? status : 'published';
  const formatVal = courseFormat === 'live_event' ? 'live_event' : 'scorm';

  const course = await prisma.course.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      courseFormat: formatVal,
      eventVenue: typeof eventVenue === 'string' && eventVenue.trim() ? eventVenue.trim() : null,
      eventUrl: typeof eventUrl === 'string' && eventUrl.trim() ? eventUrl.trim() : null,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
      price: price ?? null,
      status: statusVal,
    },
  });

  const defaultSets = await prisma.notificationSet.findMany({
    where: { isDefault: true },
    select: { id: true },
  });
  if (defaultSets.length > 0) {
    await prisma.courseNotificationSet.createMany({
      data: defaultSets.map((s) => ({ courseId: course.id, notificationSetId: s.id })),
    });
  }

  // Автоматически создать группу в Медиатеке с тем же названием (для привязки ресурсов по курсу)
  await prisma.group.create({
    data: {
      name: course.title,
      moduleType: 'media',
      type: 'dynamic',
      accessType: 'common',
      sourceCourseId: course.id,
    },
  });

  return NextResponse.json({
    course: {
      id: course.id,
      title: course.title,
      description: course.description,
      course_format: course.courseFormat,
      event_venue: course.eventVenue,
      event_url: course.eventUrl,
      starts_at: course.startsAt?.toISOString() ?? null,
      ends_at: course.endsAt?.toISOString() ?? null,
      scorm_path: course.scormPath,
      thumbnail_url: course.thumbnailUrl,
      status: course.status,
      price: course.price,
      sort_order: course.sortOrder,
      created_at: course.createdAt.toISOString(),
    },
  });
}
