'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import { TiltCard } from '@/components/ui/TiltCard';
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
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % reviews.length), 5000);
    return () => clearInterval(t);
  }, [isInView]);

  return (
    <section id="reviews" ref={ref} className="relative py-28 px-5 overflow-hidden bg-gradient-to-b from-bg via-lavender-light/25 to-bg md:py-32 md:px-6">
      <motion.div
        style={{ perspective: 1200, transformStyle: 'preserve-3d' }}
        initial={{ opacity: 0, rotateX: 18 }}
        animate={isInView ? { opacity: 1, rotateX: 0 } : {}}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-4xl"
      >
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="block text-sm font-semibold uppercase tracking-widest text-accent"
        >
          Отзывы
        </motion.span>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.05 }}
          className="mt-2 font-heading text-3xl font-semibold text-dark sm:text-4xl"
        >
          Истории тех, кто прошёл наши программы
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.15 }}
          className="mt-8 flex items-center gap-1"
        >
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className="h-6 w-6 fill-[#D4AF37] text-accent"
              aria-hidden
            />
          ))}
          <span className="ml-2 text-sm text-text-muted">5.0 · на основе отзывов</span>
        </motion.div>

        <div className="relative mt-12 min-h-[240px]">
          {reviews.map((review, i) => (
            <motion.blockquote
              key={review.author}
              initial={false}
              animate={{
                opacity: i === index ? 1 : 0,
                x: i === index ? 0 : (i < index ? -80 : 80),
                scale: i === index ? 1 : 0.95,
                filter: i === index ? 'blur(0px)' : 'blur(4px)',
              }}
              transition={{ duration: 0.4 }}
              className={`absolute inset-0 ${i === index ? 'pointer-events-auto' : 'pointer-events-none'}`}
            >
              <TiltCard maxTilt={5} className="h-full rounded-2xl border border-lavender-soft/50 bg-lavender-light/40 bg-white/95 p-8 shadow-[var(--shadow-soft)] backdrop-blur-xl md:p-10">
                <Quote className="mb-4 h-10 w-10 text-accent/60" />
                <p className="text-lg italic leading-relaxed text-dark">{review.text}</p>
                <div className="mt-6 flex items-center justify-between">
                  <cite className="not-italic font-semibold text-text-muted">{review.author}</cite>
                  <div className="flex gap-1">
                    {Array.from({ length: review.rating }).map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-[#D4AF37] text-accent" />
                    ))}
                  </div>
                </div>
              </TiltCard>
            </motion.blockquote>
          ))}
        </div>

        <div className="mt-8 flex justify-center gap-2">
          {reviews.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === index ? 'w-8 bg-accent' : 'w-2 bg-accent/30 hover:bg-accent/50'
              }`}
              aria-label={`Отзыв ${i + 1}`}
            />
          ))}
        </div>
      </motion.div>
    </section>
  );
}
