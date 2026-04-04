'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { BookOpen, Clock, ListChecks, Video, ChevronDown } from 'lucide-react';

/** Цифры в шапке секции — по согласованию с заказчиком. */
const DISPLAY_PRACTICAL_LESSONS = 8;
const DISPLAY_HOURS = 25;

const modules = [
  { title: 'Введение в метод', lessons: 1, hours: 1 },
  { title: 'Мышечное тестирование', lessons: 4, hours: 4 },
  { title: 'Работа с подсознанием', lessons: 5, hours: 7 },
  { title: 'Работа с подсознанием. Инструменты', lessons: 2, hours: 3 },
  { title: 'Практика', lessons: 8, hours: 12 },
];

const moduleCount = modules.length;

export function Program() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="formats" ref={ref} className="relative border-t border-[var(--border)] bg-[var(--bg)] py-14 px-4 sm:px-5 md:py-20 md:px-6">
      <div className="relative mx-auto max-w-3xl">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="font-heading text-3xl font-semibold text-[var(--text)] sm:text-4xl"
        >
          Программа курса
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.04 }}
          className="mt-2 text-lg text-[var(--text-muted)] sm:text-xl"
        >
          Что входит в программу
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.08 }}
          className="mt-8 grid gap-5 border-b border-[var(--border)] pb-8 sm:grid-cols-3"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-periwinkle/30 p-3">
              <BookOpen className="h-6 w-6 text-plum" aria-hidden />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-[var(--text)]">{moduleCount}</p>
              <p className="text-sm text-[var(--text-muted)]">модулей</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-periwinkle/30 p-3">
              <ListChecks className="h-6 w-6 text-plum" aria-hidden />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-[var(--text)]">{DISPLAY_PRACTICAL_LESSONS}</p>
              <p className="text-sm leading-snug text-[var(--text-muted)]">живых практических уроков</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-periwinkle/30 p-3">
              <Clock className="h-6 w-6 text-plum" aria-hidden />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-[var(--text)]">{DISPLAY_HOURS}+</p>
              <p className="text-sm text-[var(--text-muted)]">часов материала</p>
            </div>
          </div>
        </motion.div>

        <div className="mt-6 space-y-3">
          {modules.map((mod, i) => (
            <motion.div
              key={mod.title}
              initial={{ opacity: 0, y: 12 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.12 + i * 0.05 }}
              className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm transition-shadow hover:shadow-md"
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--lavender-light)] sm:grid sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                aria-expanded={openIndex === i}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-periwinkle/35 text-sm font-bold text-plum">
                    {i + 1}
                  </span>
                  <h3 className="min-w-0 font-heading text-base font-semibold text-[var(--text)] sm:text-lg">{mod.title}</h3>
                </span>
                <span className="ml-auto hidden text-sm text-[var(--text-muted)] sm:block">
                  {mod.lessons} уроков · {mod.hours} ч
                </span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-[var(--text-muted)] transition-transform sm:justify-self-end ${
                    openIndex === i ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <p className="px-4 pb-3 text-sm text-[var(--text-muted)] sm:hidden">
                {mod.lessons} уроков · {mod.hours} ч
              </p>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden border-t border-[var(--border)] bg-[var(--lavender-light)]"
                  >
                    <div className="flex items-center gap-2 p-4 text-sm text-[var(--text)]">
                      <Video className="h-4 w-4 shrink-0 text-plum" aria-hidden />
                      Живые практические занятия и материалы для самостоятельной работы
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.35 }}
          className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
        >
          <Link href="/#pricing">
            <Button variant="landingRose" size="lg">
              Записаться на курс
            </Button>
          </Link>
          <Link href="#pricing" className="text-sm font-medium text-plum hover:underline">
            Смотреть тарифы
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
