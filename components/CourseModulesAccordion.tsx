'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type CourseModuleItem = { title: string; teaser: string; detail: string };

export function CourseModulesAccordion({ modules }: { modules: CourseModuleItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {modules.map((mod, i) => (
        <div
          key={mod.title}
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm"
        >
          <button
            type="button"
            className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-[var(--lavender-light)] sm:items-center"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            aria-expanded={openIndex === i}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-periwinkle/35 text-sm font-bold text-plum">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-base font-semibold text-[var(--text)]">{mod.title}</span>
              <span className="mt-1 block text-sm italic text-[var(--text-muted)]">{mod.teaser}</span>
            </span>
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
                transition={{ duration: 0.25 }}
                className="overflow-hidden border-t border-[var(--border)] bg-[var(--lavender-light)]"
              >
                <p className="p-4 text-sm leading-relaxed text-[var(--text)]">{mod.detail}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
