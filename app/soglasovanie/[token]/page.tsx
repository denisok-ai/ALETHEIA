/**
 * Страница согласования контента с автором школы. Доступна только по секретной
 * ссылке: неверный токен (или не заданный CONTENT_REVIEW_TOKEN) → 404.
 * В sitemap не входит, в robots закрыта, на странице noindex.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getConfiguredReviewToken, isValidReviewToken } from '@/lib/content-review';
import ReviewBoard from './ReviewBoard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Согласование контента',
  robots: { index: false, follow: false },
};

export default async function ContentReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isValidReviewToken(token, getConfiguredReviewToken())) notFound();
  return <ReviewBoard token={token} />;
}
