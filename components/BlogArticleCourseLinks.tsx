'use client';

import Link from 'next/link';
import { BookOpen, ArrowRight } from 'lucide-react';
import { BLOG_TO_COURSE_ANCHORS, BLOG_CTA } from '@/lib/content/blog-course-links';

/** Контекстные ссылки на программу курса + призыв к действию (тарифы) внизу статьи. */
export function BlogArticleCourseLinks({ slug }: { slug: string }) {
  const links = BLOG_TO_COURSE_ANCHORS[slug];
  const cta = BLOG_CTA[slug];
  if (!links?.length && !cta) return null;
  return (
    <>
      {links?.length ? (
        <aside className="mt-8 rounded-2xl border border-plum/25 bg-[var(--lavender-light)] p-5 shadow-sm">
          <div className="flex items-center gap-2 text-plum">
            <BookOpen className="h-5 w-5 shrink-0" aria-hidden />
            <h2 className="font-heading text-lg font-semibold text-[var(--text)]">Связь с программой курса</h2>
          </div>
          <ul className="mt-3 space-y-2 text-[var(--text-muted)]">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-plum underline-offset-2 hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}

      {cta ? (
        <aside className="mt-6 rounded-2xl border border-rose/40 bg-[var(--surface)] p-6 shadow-sm">
          <h2 className="font-heading text-xl font-semibold text-[var(--text)]">{cta.heading}</h2>
          <p className="mt-2 text-[var(--text-muted)]">{cta.text}</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={cta.primary.href}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose px-5 py-3 font-semibold text-white transition-colors hover:bg-rose/90"
            >
              {cta.primary.label}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            {cta.secondary ? (
              <Link
                href={cta.secondary.href}
                className="inline-flex items-center justify-center rounded-xl border border-plum/30 px-5 py-3 font-semibold text-plum transition-colors hover:bg-plum/[0.06]"
              >
                {cta.secondary.label}
              </Link>
            ) : null}
          </div>
        </aside>
      ) : null}
    </>
  );
}
