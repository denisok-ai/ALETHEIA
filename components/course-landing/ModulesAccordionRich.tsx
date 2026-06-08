'use client';

import { useState } from 'react';
import { ChevronDown, Gift } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type RichModuleItem = {
  id?: string;
  number: number;
  title: string;
  weekTitle: string;
  intro: string;
  bullets: string[];
  results?: string[];
  bonus?: string;
};

/** Подробный аккордеон программы курса: используется для лендинга «МТ» (6 модулей). */
export function ModulesAccordionRich({ modules }: { modules: RichModuleItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-4">
      {modules.map((mod, i) => {
        const open = openIndex === i;
        return (
          <div
            key={mod.id ?? mod.title}
            id={mod.id}
            className="scroll-mt-28 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]"
          >
            <button
              type="button"
              className="flex w-full items-start gap-3 p-5 text-left transition-colors hover:bg-[var(--lavender-light)] sm:items-center md:p-6"
              onClick={() => setOpenIndex(open ? null : i)}
              aria-expanded={open}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-periwinkle/35 font-heading text-sm font-bold text-plum">
                {mod.number}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-heading text-base font-semibold text-[var(--text)] sm:text-lg">
                  {mod.title}
                </span>
                <span className="mt-1 block text-sm italic text-[var(--text-muted)]">
                  {mod.weekTitle}
                </span>
              </span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-[var(--text-muted)] transition-transform ${
                  open ? 'rotate-180' : ''
                }`}
                aria-hidden
              />
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden border-t border-[var(--border)] bg-[var(--lavender-light)]"
                >
                  <div className="p-5 text-sm leading-relaxed md:p-6">
                    <p className="text-[var(--text)]">{mod.intro}</p>

                    <div className="mt-4 grid gap-5 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-plum">
                          Содержание
                        </p>
                        <ul className="mt-2 space-y-1.5 text-[var(--text)]">
                          {mod.bullets.map((b) => (
                            <li key={b} className="flex gap-2">
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-plum/60" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {mod.results?.length ? (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-plum">
                            Результат модуля
                          </p>
                          <ul className="mt-2 space-y-1.5 text-[var(--text)]">
                            {mod.results.map((r) => (
                              <li key={r} className="flex gap-2">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose" />
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>

                    {mod.bonus ? (
                      <div className="mt-5 flex items-start gap-3 rounded-xl border border-rose/30 bg-[var(--surface)] p-4">
                        <Gift className="mt-0.5 h-5 w-5 shrink-0 text-rose" aria-hidden />
                        <p className="text-sm text-[var(--text)]">
                          <span className="font-semibold">Бонус модуля: </span>
                          {mod.bonus}
                        </p>
                      </div>
                    ) : null}
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
