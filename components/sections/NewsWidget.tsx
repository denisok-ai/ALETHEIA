'use client';

/**
 * News widget for homepage: last 5 visible publications.
 */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Newspaper, ChevronRight } from 'lucide-react';

interface PubItem {
  id: string;
  title: string;
  type: string;
  publishAt: string;
  teaser: string | null;
  content?: string;
}

export function NewsWidget() {
  const [items, setItems] = useState<PubItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/publications?limit=5')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setItems(d?.publications ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || items.length === 0) return null;

  return (
    <section
      id="news"
      className="section-padding scroll-mt-24 border-t border-[var(--border)] bg-[var(--lavender-light)] px-5 md:px-6"
      aria-labelledby="news-heading"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10 max-w-2xl"
        >
          <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-plum">
            <Newspaper className="h-5 w-5" aria-hidden />
            Материалы
          </span>
          <h2 id="news-heading" className="mt-2 font-heading text-3xl font-semibold text-[var(--text)] sm:text-4xl">
            Новости и анонсы
          </h2>
          <p className="mt-3 text-[var(--text-muted)] leading-relaxed">События, статьи и объявления школы.</p>
        </motion.div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, 6).map((p, i) => (
            <motion.article
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <p className="text-xs text-[var(--text-muted)]">
                {new Date(p.publishAt).toLocaleDateString('ru', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
                {p.type === 'news' ? ' · Новость' : ' · Объявление'}
              </p>
              <h3 className="mt-1 font-semibold text-[var(--text)] line-clamp-2">{p.title}</h3>
              {p.type === 'news' && p.teaser && (
                <p className="mt-2 text-sm text-[var(--text-muted)] line-clamp-2">{p.teaser}</p>
              )}
              {p.type === 'announcement' && p.content && (
                <p className="mt-2 text-sm text-[var(--text-muted)] line-clamp-2">
                  {p.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150)}
                  {p.content.length > 150 ? '…' : ''}
                </p>
              )}
              <Link
                href={`/news/${p.id}`}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-plum hover:underline"
              >
                Читать далее
                <ChevronRight className="h-4 w-4" />
              </Link>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
