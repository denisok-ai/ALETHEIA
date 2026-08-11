/**
 * OG-изображение статьи блога: /api/og/blog/<slug> → PNG 1200×630 с заголовком.
 * Подставляется в og:image статей без собственной картинки (lib/content/blog-posts.ts).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getBlogPostBySlug } from '@/lib/content/blog-posts';
import { renderBlogCard } from '@/lib/og/blog-card';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: { slug: string } }) {
  const post = await getBlogPostBySlug(params.slug);
  if (!post) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return renderBlogCard(post.h1 || post.title);
}
