/**
 * OG-карточка термина глоссария: /api/og/glossary/<slug> → PNG 1200×630 с названием термина.
 * Подставляется в og:image страницы термина (app/glossary/[term]/page.tsx).
 */
import { NextResponse } from 'next/server';
import { getGlossaryTerm } from '@/lib/content/glossary';
import { renderBlogCard } from '@/lib/og/blog-card';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const term = getGlossaryTerm(params.slug);
  if (!term) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return renderBlogCard(term.term, 'Аватэрра · Глоссарий');
}
