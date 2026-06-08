'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { TiltCard } from '@/components/ui/TiltCard';

type Props = {
  imageSrc?: string;
  imageAlt?: string;
  name: string;
  roleLabel: string;
  quote: string;
  facts: string[];
};

/** Компактный блок «Автор курса» с фото, цитатой и фактами; используется в продающих лендингах. */
export function AuthorMiniBlock({
  imageSrc = '/images/tatiana/tatiana-about.png',
  imageAlt = 'Татьяна Стрельцова — основательница школы AVATERRA',
  name,
  roleLabel,
  quote,
  facts,
}: Props) {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,360px)_1fr] lg:items-center lg:gap-14">
      <motion.div
        initial={{ opacity: 0, x: -24 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5 }}
        className="flex justify-center"
      >
        <TiltCard maxTilt={8} className="w-full max-w-sm">
          <div className="relative overflow-hidden rounded-2xl border-2 border-periwinkle/50 shadow-[var(--shadow-card)]">
            <Image
              src={imageSrc}
              alt={imageAlt}
              width={480}
              height={600}
              className="h-auto w-full object-cover"
            />
          </div>
        </TiltCard>
      </motion.div>

      <motion.article
        initial={{ opacity: 0, x: 24 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5, delay: 0.05 }}
      >
        <span className="block text-sm font-semibold uppercase tracking-widest text-plum">{roleLabel}</span>
        <h3 className="mt-2 font-heading text-2xl font-semibold text-[var(--text)] sm:text-3xl">
          {name}
        </h3>
        <p className="mt-6 border-l-4 border-rose pl-4 font-heading text-lg italic text-[var(--text)]">
          «{quote}»
        </p>
        <ul className="mt-6 space-y-2 text-[var(--text-muted)]">
          {facts.map((f) => (
            <li key={f} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-plum/60" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </motion.article>
    </div>
  );
}
