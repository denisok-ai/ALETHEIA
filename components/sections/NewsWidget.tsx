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
    <section className="section-padding bg-bg-cream" aria-labelledby="news-heading">
      <div className="container mx-auto max-w-6xl">
        <motion.h2
          id="news-heading"
          className="font-heading text-2xl font-bold text-dark mb-8 flex items-center gap-2"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Newspaper className="h-7 w-7 text-primary" />
          Новости и анонсы
        </motion.h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, 6).map((p, i) => (
            <motion.article
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-border bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <p className="text-xs text-text-muted">
                {new Date(p.publishAt).toLocaleDateString('ru', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
                {p.type === 'news' ? ' · Новость' : ' · Объявление'}
              </p>
              <h3 className="mt-1 font-semibold text-dark line-clamp-2">{p.title}</h3>
              {p.type === 'news' && p.teaser && (
                <p className="mt-2 text-sm text-text-muted line-clamp-2">{p.teaser}</p>
              )}
              {p.type === 'announcement' && p.content && (
                <p className="mt-2 text-sm text-text-muted line-clamp-2">
                  {p.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150)}
                  {p.content.length > 150 ? '…' : ''}
                </p>
              )}
              <Link
                href={`/news/${p.id}`}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
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
