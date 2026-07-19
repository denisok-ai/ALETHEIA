/**
 * Admin: список статей блога и создание новой.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { blogPostInputSchema, normalizeBlogBody } from '@/lib/validations/blog-post';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const posts = await prisma.blogPost.findMany({
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      source: true,
      sourceUrl: true,
      publishedAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    posts: posts.map((p) => ({
      ...p,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      updatedAt: p.updatedAt.toISOString(),
    })),
  });
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

  const parsed = blogPostInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Неверные данные' },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const existing = await prisma.blogPost.findUnique({ where: { slug: data.slug } });
  if (existing) {
    return NextResponse.json(
      { error: `Статья с адресом «${data.slug}» уже существует.` },
      { status: 409 }
    );
  }

  const { body: normalizedBody, bodyFormat } = normalizeBlogBody(data);

  const post = await prisma.blogPost.create({
    data: {
      slug: data.slug,
      title: data.title,
      h1: data.h1 || data.title,
      description: data.description,
      body: normalizedBody,
      bodyFormat,
      ogImage: data.ogImage || null,
      status: data.status,
      // Дата публикации проставляется в момент публикации, а не создания:
      // по ней строится порядок в блоге и lastmod в sitemap.
      publishedAt: data.status === 'published' ? new Date() : null,
      source: 'manual',
    },
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'blog.create',
    entity: 'BlogPost',
    entityId: post.id,
    diff: { slug: post.slug, status: post.status },
  });

  return NextResponse.json({ post: { id: post.id, slug: post.slug } }, { status: 201 });
}
