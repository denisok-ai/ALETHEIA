/**
 * Admin: add media resource of type "link" (external URL).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { mediaCreateLinkSchema } from '@/lib/validations/media';

function mimeFromUrl(url: string): string | null {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith('.pdf')) return 'application/pdf';
  if (pathname.match(/\.(jpg|jpeg|png|gif|webp)$/)) return `image/${pathname.split('.').pop() === 'jpg' ? 'jpeg' : pathname.split('.').pop()}`;
  if (pathname.endsWith('.mp4')) return 'video/mp4';
  if (pathname.endsWith('.mp3')) return 'audio/mpeg';
  return null;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = mediaCreateLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Ошибка валидации', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { url, title, category, description, allowDownload } = parsed.data;
  const mimeType = mimeFromUrl(url);

  const media = await prisma.media.create({
    data: {
      title,
      fileUrl: url,
      mimeType,
      category: category ?? null,
      description: description ?? null,
      type: 'link',
      allowDownload: allowDownload ?? true,
      ownerId: auth.userId ?? null,
    },
  });

  return NextResponse.json({
    media: {
      id: media.id,
      title: media.title,
      file_url: media.fileUrl,
      mime_type: media.mimeType,
      category: media.category,
      type: media.type,
      description: media.description,
      allow_download: media.allowDownload,
      views_count: media.viewsCount,
      rating_sum: media.ratingSum,
      rating_count: media.ratingCount,
      created_at: media.createdAt.toISOString(),
    },
  });
}
