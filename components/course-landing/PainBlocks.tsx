'use client';

import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

export type PainBlock = { title: string; text: string };

/** Карточки «Ты чувствуешь, что…» / «Этот курс — для вас, если…» — карточная сетка 2–3 в ряд. */
export function PainBlocks({ items }: { items: PainBlock[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((p, i) => (
        <motion.div
          key={p.title}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ delay: 0.04 + i * 0.04, duration: 0.4 }}
          className="flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] transition-colors hover:border-rose/40 md:p-7"
        >
          <AlertCircle className="mb-4 h-7 w-7 text-rose" aria-hidden />
          <h3 className="font-heading text-lg font-semibold text-[var(--text)]">{p.title}</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--text-muted)]">{p.text}</p>
        </motion.div>
      ))}
    </div>
  );
}

export type AudienceBlock = { audience: string; pain: string; solution: string };

/** «Для кого этот курс»: тёплая карточка с аудиторией, болью и решением. */
export function AudienceBlocks({ items }: { items: AudienceBlock[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {items.map((a, i) => (
        <motion.div
          key={a.audience}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ delay: 0.04 + i * 0.05, duration: 0.4 }}
          className="flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] md:p-7"
        >
          <span className="inline-flex w-fit rounded-full bg-periwinkle/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-plum">
            {a.audience}
          </span>
          <p className="mt-4 font-heading text-base italic text-[var(--text)]">«{a.pain}»</p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">{a.solution}</p>
        </motion.div>
      ))}
    </div>
  );
}
