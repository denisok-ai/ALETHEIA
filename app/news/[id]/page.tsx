/**
 * Public publication page: full text, view count, rating, comments.
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { PublicationViewClient } from './PublicationViewClient';

export default async function NewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const now = new Date();

  const pub = await prisma.publication.findFirst({
    where: {
      id,
      status: 'active',
      publishAt: { lte: now },
    },
  });

  if (!pub) notFound();

  return (
    <div className="min-h-screen bg-bg-cream">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href="/"
          className="text-sm text-primary hover:underline mb-6 inline-block"
        >
          ← На главную
        </Link>
        <article className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h1 className="font-heading text-2xl font-bold text-dark">{pub.title}</h1>
          <p className="mt-2 text-sm text-text-muted">
            {new Date(pub.publishAt).toLocaleDateString('ru', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <div
            className="mt-4 prose prose-sm max-w-none text-dark"
            dangerouslySetInnerHTML={{ __html: pub.content }}
          />
          <PublicationViewClient
            publicationId={pub.id}
            initialViewsCount={pub.viewsCount}
            allowRating={pub.allowRating}
            ratingSum={pub.ratingSum}
            ratingCount={pub.ratingCount}
            allowComments={pub.allowComments}
          />
        </article>
      </div>
    </div>
  );
}
