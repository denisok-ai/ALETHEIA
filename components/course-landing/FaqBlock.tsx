'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle } from 'lucide-react';

export type FaqItem = { q: string; a: string };

/** FAQ-аккордеон в стиле главного FAQ (без поиска и AI-помощника — компактный вариант). */
export function FaqBlock({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div
            key={item.q}
            className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)]"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 p-4 text-left font-medium text-[var(--text)] transition-colors hover:bg-[var(--lavender-light)] md:p-5"
              onClick={() => setOpenIndex(open ? null : i)}
              aria-expanded={open}
            >
              <span className="flex min-w-0 items-center gap-3">
                <HelpCircle className="h-5 w-5 shrink-0 text-accent" aria-hidden />
                <span className="min-w-0">{item.q}</span>
              </span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 border-t border-[var(--border)] p-4 pl-12 leading-relaxed text-[var(--text-muted)] md:p-5 md:pl-14">
                    {item.a
                      .split(/\n\n+/)
                      .map((p) => p.trim())
                      .filter(Boolean)
                      .map((para, j) => (
                        <p key={j}>{para}</p>
                      ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
