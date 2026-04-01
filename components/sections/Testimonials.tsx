'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

const reviews = [
  {
    text: '«Помнишь, мы года 4 назад делали групповое на сбычу желаний. У меня почти всё сбылось на 70% — именно то, что я просила и хотела. Осталось ещё немного.»',
    author: 'Марина П.',
    rating: 5,
  },
  {
    text: '«Пройдя курс 8 состояний, я поняла, как это прекрасно — быть женщиной. Все архетипы прочувствовала на себе. Благодарю Татьяну за все состояния.»',
    author: 'Ирина Г.',
    rating: 5,
  },
  {
    text: '«Из отличных новостей: диагноз дисплазия снят! Анализы пришли отличные — это счастье.»',
    author: 'Елена С.',
    rating: 5,
  },
];

export function Testimonials() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="reviews" ref={ref} className="relative scroll-mt-24 border-t border-[var(--border)] bg-[var(--bg)] py-24 px-5 md:py-28 md:px-6">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="max-w-3xl"
        >
          <span className="block text-sm font-semibold uppercase tracking-widest text-plum">Отзывы</span>
          <h2 className="mt-2 font-heading text-3xl font-semibold text-[var(--text)] sm:text-4xl">
            Истории тех, кто прошёл наши программы
          </h2>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <div className="flex gap-0.5" aria-hidden>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="h-5 w-5 fill-rose text-rose" />
              ))}
            </div>
            <span className="text-sm text-[var(--text-muted)]">5.0 · на основе отзывов</span>
          </div>
        </motion.div>

        <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {reviews.map((review, i) => (
            <motion.li
              key={review.author}
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.08 + i * 0.07, duration: 0.45 }}
            >
              <blockquote className="flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] md:p-7">
                <Quote className="mb-3 h-9 w-9 text-periwinkle shrink-0" aria-hidden />
                <p className="flex-1 text-base leading-relaxed text-[var(--text)]">{review.text}</p>
                <footer className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                  <cite className="not-italic text-sm font-semibold text-[var(--text-muted)]">{review.author}</cite>
                  <div className="flex gap-0.5" aria-label={`Оценка ${review.rating} из 5`}>
                    {Array.from({ length: review.rating }).map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-rose text-rose" />
                    ))}
                  </div>
                </footer>
              </blockquote>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
