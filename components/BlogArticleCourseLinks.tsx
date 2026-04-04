'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { BLOG_TO_COURSE_ANCHORS } from '@/lib/content/blog-course-links';

/** Контекстные ссылки на программу курса внизу статьи блога. */
export function BlogArticleCourseLinks({ slug }: { slug: string }) {
  const links = BLOG_TO_COURSE_ANCHORS[slug];
  if (!links?.length) return null;
  return (
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
  );
}
