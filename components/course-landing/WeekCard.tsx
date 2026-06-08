'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';

export type WeekCardItem = {
  number: number;
  title: string;
  subtitle: string;
  intro: string;
  bullets: string[];
  imageSrc: string;
};

/** Карточка недели для лендинга «Пробуждение»: фото-арт + содержание. */
export function WeekCards({ items }: { items: WeekCardItem[] }) {
  return (
    <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">
      {items.map((w, i) => (
        <motion.article
          key={w.number}
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ delay: 0.05 + i * 0.05, duration: 0.45 }}
          className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]"
        >
          <div className="relative aspect-[4/3] w-full bg-[var(--lavender-light)]">
            <Image src={w.imageSrc} alt="" fill sizes="(max-width:768px)100vw,(max-width:1024px)50vw,33vw" className="object-cover" />
          </div>
          <div className="flex flex-1 flex-col p-6 md:p-7">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-periwinkle/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-plum">
              Неделя {w.number}
            </span>
            <h3 className="mt-3 font-heading text-xl font-semibold text-[var(--text)]">{w.title}</h3>
            <p className="mt-1 text-sm italic text-[var(--text-muted)]">{w.subtitle}</p>
            <p className="mt-4 text-sm leading-relaxed text-[var(--text)]">{w.intro}</p>
            <ul className="mt-4 space-y-1.5 text-sm text-[var(--text-muted)]">
              {w.bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-plum/60" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.article>
      ))}
    </div>
  );
}
