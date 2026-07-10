/**
 * Внутренняя проверка доступа к /uploads/scorm/* для nginx auth_request.
 * nginx передаёт X-Original-URI и Cookie сессии.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasCourseLearningAccess } from '@/lib/course-learning-access';
import { courseIdFromScormAssetPath } from '@/lib/scorm/course-id-from-path';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const uri =
    request.headers.get('x-original-uri') ||
    request.headers.get('x-forwarded-uri') ||
    request.nextUrl.searchParams.get('uri') ||
    '';
  let pathname = uri;
  try {
    if (uri.startsWith('http')) pathname = new URL(uri).pathname;
    else if (uri.startsWith('/')) pathname = uri.split('?')[0] ?? uri;
  } catch {
    pathname = uri;
  }

  const courseId = courseIdFromScormAssetPath(pathname);
  if (!courseId) {
    return new NextResponse(null, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) {
    return new NextResponse(null, { status: 401 });
  }

  if (role !== 'admin' && role !== 'manager') {
    const ok = await hasCourseLearningAccess(userId, courseId, role);
    if (!ok) return new NextResponse(null, { status: 403 });
  }

  return new NextResponse(null, { status: 200 });
}
