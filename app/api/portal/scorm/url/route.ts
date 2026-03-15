/**
 * Returns URL for the SCORM package entry point.
 * Course.scormPath is the path relative to public/uploads/scorm/ (e.g. course-id/index.html).
 * For local storage we serve from /uploads/scorm/{path}.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');
  if (!courseId) return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });

  if (role !== 'admin' && role !== 'manager') {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment || enrollment.accessClosed) return NextResponse.json({ error: 'Not enrolled' }, { status: 403 });
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { scormPath: true, scormVersion: true, scormManifest: true },
  });
  if (!course?.scormPath) return NextResponse.json({ error: 'No SCORM content' }, { status: 404 });

  let baseUrl: string;
  try {
    const requestUrl = new URL(request.url);
    baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
    if (!requestUrl.host) baseUrl = 'https://avaterra.pro';
  } catch {
    baseUrl = 'https://avaterra.pro';
  }
  const pathPrefix = '/uploads/scorm/';
  const lessonId = searchParams.get('lessonId');
  let url = `${baseUrl.replace(/\/+$/, '')}${pathPrefix}${course.scormPath.replace(/^\/+/, '')}`;

  if (lessonId && lessonId !== 'main' && course.scormManifest) {
    try {
      const manifest = JSON.parse(course.scormManifest) as { items?: { identifier: string; href?: string }[] };
      const item = manifest.items?.find((i) => i.identifier === lessonId);
      if (item?.href) {
        const basePath = course.scormPath.replace(/\/[^/]+$/, '');
        const pathPart = `${basePath}/${item.href}`.replace(/^\/+/, '');
        url = `${baseUrl.replace(/\/+$/, '')}${pathPrefix}${pathPart}`;
      }
    } catch {
      // use default url
    }
  }

  return NextResponse.json({
    url,
    scormVersion: course.scormVersion ?? '1.2',
  });
}
