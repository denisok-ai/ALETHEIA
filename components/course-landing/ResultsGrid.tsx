'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export type ResultItem = { title: string; text: string };

/** Сетка «Что вы получите после курса» / «Что произойдёт». */
export function ResultsGrid({ items }: { items: ResultItem[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((r, i) => (
        <motion.div
          key={r.title}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ delay: 0.04 + i * 0.04, duration: 0.4 }}
          className="flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-6 transition-colors hover:border-plum/40 hover:bg-[var(--lavender-light)] md:p-7"
        >
          <Sparkles className="mb-4 h-7 w-7 text-plum" aria-hidden />
          <h3 className="font-heading text-lg font-semibold text-[var(--text)]">{r.title}</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--text-muted)]">{r.text}</p>
        </motion.div>
      ))}
    </div>
  );
}
