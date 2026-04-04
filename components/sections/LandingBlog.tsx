import Link from 'next/link';
import { blogPostsMeta } from '@/lib/content/course-lynda-teaser';

const latestPosts = [...blogPostsMeta]
  .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
  .slice(0, 3);

function formatPublished(iso: string) {
  try {
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(
      new Date(iso)
    );
  } catch {
    return '';
  }
}

/** Три последние статьи блога — превью на главной (без изображений). */
export function LandingBlog() {
  return (
    <section
      id="blog"
      className="relative border-t border-[var(--border)] bg-[var(--lavender-light)] py-14 px-4 sm:px-5 md:py-20 md:px-6"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="block text-sm font-semibold uppercase tracking-widest text-plum">Блог</span>
            <h2 className="mt-2 font-heading text-3xl font-semibold text-[var(--text)] sm:text-4xl">
              Свежие материалы
            </h2>
            <p className="mt-3 max-w-2xl text-[var(--text-muted)] leading-relaxed">
              Статьи о мышечном тестировании, телесной обратной связи и практике школы AVATERRA.
            </p>
          </div>
          <Link
            href="/blog"
            className="shrink-0 text-sm font-semibold text-plum underline decoration-plum/35 underline-offset-4 transition-colors hover:text-plum/90"
          >
            Все статьи
          </Link>
        </div>

        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {latestPosts.map((post) => (
            <li key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="group flex h-full min-h-[12rem] flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] transition-all hover:border-plum/30 hover:shadow-[var(--shadow-card)] md:p-7"
              >
                <time
                  dateTime={post.publishedAt}
                  className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]"
                >
                  {formatPublished(post.publishedAt)}
                </time>
                <h3 className="mt-3 border-l-[3px] border-plum/80 pl-4 font-heading text-lg font-semibold leading-snug text-[var(--text)] transition-colors group-hover:text-plum">
                  {post.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--text-muted)] line-clamp-4">
                  {post.description}
                </p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-plum">
                  Читать
                  <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
