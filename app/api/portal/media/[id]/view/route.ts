/**
 * Student: get media for viewing and increment viewsCount (one count per request).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canStudentAccessMedia } from '@/lib/media-access';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const media = await prisma.media.findUnique({
    where: { id },
    include: { mediaGroups: { select: { groupId: true } } },
  });
  if (!media) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const allowed = await canStudentAccessMedia(userId, media);
  if (!allowed) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.media.update({
    where: { id },
    data: { viewsCount: { increment: 1 } },
  });

  const url = media.fileUrl.startsWith('http') ? media.fileUrl : undefined;
  return NextResponse.json({
    id: media.id,
    title: media.title,
    file_url: media.fileUrl,
    url: url ?? media.fileUrl,
    mime_type: media.mimeType,
    allow_download: media.allowDownload,
    type: media.type,
  });
}
