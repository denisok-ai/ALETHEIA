'use client';

import { useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { LANDING_FAQ_ITEMS } from '@/lib/landing-faq';

export function LandingFAQ() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      id="faq"
      ref={ref}
      className="relative border-t border-[var(--border)] bg-[var(--surface)] py-14 px-4 sm:px-5 md:py-20 md:px-6"
    >
      <div className="relative mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="max-w-3xl"
        >
          <span className="block text-sm font-semibold uppercase tracking-widest text-plum">Вопросы и ответы</span>
          <h2 className="mt-2 font-heading text-3xl font-semibold text-[var(--text)] sm:text-4xl">
            Часто задаваемые вопросы
          </h2>
          <p className="mt-4 text-[var(--text-muted)] leading-relaxed">
            Кратко о методе, аудитории курса и требованиях к подготовке.
          </p>
        </motion.div>

        <div className="mt-8 space-y-3">
          {LANDING_FAQ_ITEMS.map((item, i) => (
            <motion.div
              key={item.q}
              initial={{ opacity: 0, y: 12 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.06 + i * 0.04 }}
              className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)]"
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 p-4 text-left font-medium text-[var(--text)] transition-colors hover:bg-[var(--lavender-light)]"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                aria-expanded={openIndex === i}
              >
                <span className="min-w-0 pr-2">{item.q}</span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-[var(--text-muted)] transition-transform ${
                    openIndex === i ? 'rotate-180' : ''
                  }`}
                  aria-hidden
                />
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-[var(--border)]"
                  >
                    <p className="p-4 leading-relaxed text-[var(--text-muted)]">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
