'use client';

import { motion } from 'framer-motion';
import { Quote, Star } from 'lucide-react';

export type LandingTestimonial = { text: string; author: string; meta?: string; rating?: number };

/** Карусель/сетка отзывов 3-в-ряд (LG) для лендинга. */
export function TestimonialsCompact({ items }: { items: LandingTestimonial[] }) {
  return (
    <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
      {items.map((review, i) => (
        <motion.li
          key={review.author + i}
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ delay: 0.05 + i * 0.06, duration: 0.4 }}
        >
          <blockquote className="flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] md:p-7">
            <Quote className="mb-3 h-9 w-9 shrink-0 text-periwinkle" aria-hidden />
            <p className="flex-1 text-base leading-relaxed text-[var(--text)]">{review.text}</p>
            <footer className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
              <cite className="not-italic text-sm font-semibold text-[var(--text-muted)]">
                {review.author}
                {review.meta ? <span className="ml-2 font-normal text-[var(--text-soft)]">{review.meta}</span> : null}
              </cite>
              <div className="flex gap-0.5" aria-label={`Оценка ${review.rating ?? 5} из 5`}>
                {Array.from({ length: review.rating ?? 5 }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-rose text-rose" />
                ))}
              </div>
            </footer>
          </blockquote>
        </motion.li>
      ))}
    </ul>
  );
}
