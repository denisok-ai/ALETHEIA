/**
 * Admin: чтение, правка и удаление статьи блога.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { blogPostInputSchema, normalizeBlogBody } from '@/lib/validations/blog-post';

type Params = { params: { id: string } };

/** Абзацы хранятся JSON-массивом — в форму отдаём читаемый текст. */
function bodyForForm(body: string, format: string): string {
  if (format !== 'paragraphs') return body;
  try {
    const parsed: unknown = JSON.parse(body);
    if (Array.isArray(parsed)) return parsed.filter((p) => typeof p === 'string').join('\n\n');
  } catch {
    /* испорченный JSON — отдаём как есть, чтобы правка была возможна */
  }
  return body;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const post = await prisma.blogPost.findUnique({ where: { id: params.id } });
  if (!post) return NextResponse.json({ error: 'Статья не найдена' }, { status: 404 });

  return NextResponse.json({
    post: {
      ...post,
      body: bodyForForm(post.body, post.bodyFormat),
      publishedAt: post.publishedAt?.toISOString() ?? null,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = blogPostInputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Неверные данные' },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const current = await prisma.blogPost.findUnique({ where: { id: params.id } });
  if (!current) return NextResponse.json({ error: 'Статья не найдена' }, { status: 404 });

  if (data.slug !== current.slug) {
    const clash = await prisma.blogPost.findUnique({ where: { slug: data.slug } });
    if (clash) {
      return NextResponse.json(
        { error: `Статья с адресом «${data.slug}» уже существует.` },
        { status: 409 }
      );
    }
  }

  const { body: normalizedBody, bodyFormat } = normalizeBlogBody(data);

  // Дата публикации ставится один раз — при первом переводе в «опубликовано».
  // Иначе каждое сохранение опубликованной статьи двигало бы её вверх в блоге
  // и меняло дату обновления в sitemap без реальной причины.
  const publishedAt =
    data.status === 'published' ? (current.publishedAt ?? new Date()) : null;

  const post = await prisma.blogPost.update({
    where: { id: params.id },
    data: {
      slug: data.slug,
      title: data.title,
      h1: data.h1 || data.title,
      description: data.description,
      body: normalizedBody,
      bodyFormat,
      ogImage: data.ogImage || null,
      status: data.status,
      publishedAt,
    },
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'blog.update',
    entity: 'BlogPost',
    entityId: post.id,
    diff: { slug: post.slug, status: post.status, wasStatus: current.status },
  });

  return NextResponse.json({ post: { id: post.id, slug: post.slug, status: post.status } });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const post = await prisma.blogPost.findUnique({ where: { id: params.id } });
  if (!post) return NextResponse.json({ error: 'Статья не найдена' }, { status: 404 });

  await prisma.blogPost.delete({ where: { id: params.id } });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'blog.delete',
    entity: 'BlogPost',
    entityId: params.id,
    diff: { slug: post.slug, title: post.title },
  });

  return NextResponse.json({ ok: true });
}
