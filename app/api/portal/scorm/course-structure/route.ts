/**
 * Returns SCORM course structure (SCO list) for multi-SCO navigation.
 * GET ?courseId= → { items: { identifier, title, url }[], isMultiSco, scormVersion }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

type ManifestItem = { identifier: string; title?: string; href?: string };

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');
  if (!courseId) return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });

  if (role !== 'admin') {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) return NextResponse.json({ error: 'Not enrolled' }, { status: 403 });
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { scormPath: true, scormVersion: true, scormManifest: true, aiTutorEnabled: true },
  });
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  if (!course.scormPath) {
    return NextResponse.json({
      items: [{ identifier: 'main', title: undefined, url: '' }],
      isMultiSco: false,
      scormVersion: course.scormVersion ?? '1.2',
      noScormContent: true,
      aiTutorEnabled: course.aiTutorEnabled ?? true,
    });
  }

  const requestUrl = new URL(request.url);
  const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
  const basePath = course.scormPath.replace(/\/[^/]+$/, ''); // dir part e.g. "courses-xxx"
  const defaultEntryUrl = `${baseUrl}/uploads/scorm/${course.scormPath}`;

  let items: { identifier: string; title?: string; url: string }[] = [];
  let isMultiSco = false;

  if (course.scormManifest) {
    try {
      const manifest = JSON.parse(course.scormManifest) as { items?: ManifestItem[] };
      const rawItems = manifest.items ?? [];
      if (rawItems.length > 1) {
        isMultiSco = true;
        items = rawItems.map((it) => ({
          identifier: it.identifier,
          title: it.title,
          url: it.href
            ? `${baseUrl}/uploads/scorm/${basePath}/${it.href}`
            : defaultEntryUrl,
        }));
      } else if (rawItems.length === 1) {
        items = [{
          identifier: rawItems[0].identifier,
          title: rawItems[0].title,
          url: rawItems[0].href
            ? `${baseUrl}/uploads/scorm/${basePath}/${rawItems[0].href}`
            : defaultEntryUrl,
        }];
      }
    } catch {
      // ignore invalid manifest
    }
  }

  if (items.length === 0) {
    items = [{ identifier: 'main', title: undefined, url: defaultEntryUrl }];
  }

  return NextResponse.json({
    items,
    isMultiSco,
    scormVersion: course.scormVersion ?? '1.2',
    aiTutorEnabled: course.aiTutorEnabled ?? true,
  });
}
