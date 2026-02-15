'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { BookOpen, Clock, Video, ChevronDown } from 'lucide-react';

const modules = [
  { title: 'Введение в кинезиологию', lessons: 3, hours: 2 },
  { title: 'Мышечное тестирование: основы', lessons: 4, hours: 3 },
  { title: 'Работа с подсознанием', lessons: 5, hours: 4 },
  { title: 'Практика и интеграция', lessons: 4, hours: 3 },
];

const totalLessons = modules.reduce((s, m) => s + m.lessons, 0);
const totalHours = modules.reduce((s, m) => s + m.hours, 0);

export function Program() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="formats" ref={ref} className="relative py-28 px-5 md:py-32 md:px-6">
      <div className="absolute inset-0 bg-gradient-to-b from-bg via-lavender-light/30 to-bg" />
      <motion.div
        style={{ perspective: 1200, transformStyle: 'preserve-3d' }}
        initial={{ opacity: 0, rotateX: 18 }}
        animate={isInView ? { opacity: 1, rotateX: 0 } : {}}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto max-w-5xl"
      >
        {/* Контент секции без декоративной плашки — сразу заголовок и содержание */}
        <div className="rounded-2xl bg-white/95 px-6 py-10 shadow-[var(--shadow-soft)] backdrop-blur-md sm:px-10 sm:py-12">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            className="inline-block rounded-full bg-accent/15 px-4 py-1.5 text-sm font-semibold uppercase tracking-widest text-accent"
          >
            Программа курса
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.05 }}
            className="mt-3 font-heading text-3xl font-semibold text-dark sm:text-4xl"
          >
            Что входит в программу
          </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1 }}
          className="mt-10 flex flex-wrap gap-8 rounded-2xl border border-border/60 bg-bg-cream/80 p-7 sm:p-8"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-accent/20 p-3">
              <BookOpen className="h-6 w-6 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark">{totalLessons}</p>
              <p className="text-sm text-text-muted">модулей и уроков</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-accent/20 p-3">
              <Clock className="h-6 w-6 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark">{totalHours}+</p>
              <p className="text-sm text-text-muted">часов материала</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.2 }}
          className="mt-6"
        >
          <p className="mb-2 text-sm font-medium text-dark">Объём программы</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-border">
            <motion.div
              initial={{ width: 0 }}
              animate={isInView ? { width: '100%' } : {}}
              transition={{ duration: 1.2, delay: 0.3 }}
              className="h-full rounded-full bg-gradient-to-r from-accent/30 to-accent"
            />
          </div>
        </motion.div>

        <div className="mt-12 space-y-3">
          {modules.map((mod, i) => (
            <motion.div
              key={mod.title}
              initial={{ opacity: 0, x: -20 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.25 + i * 0.06 }}
              className="rounded-xl border border-border bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-bg-soft/80 transition-colors"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                aria-expanded={openIndex === i}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent">
                    {i + 1}
                  </span>
                  <span className="font-heading font-semibold text-dark">{mod.title}</span>
                </span>
                <span className="text-sm text-text-muted shrink-0">{mod.lessons} уроков · {mod.hours} ч</span>
                <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${openIndex === i ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden border-t border-border bg-bg-soft/60"
                  >
                    <div className="flex items-center gap-2 p-4 text-sm text-dark">
                      <Video className="h-4 w-4 shrink-0 text-accent" />
                      Видеоуроки и практические задания
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.6 }}
          className="mt-14 text-center"
        >
          <Link href="#contact">
            <Button variant="primary" size="lg">
              Записаться на курс
            </Button>
          </Link>
        </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
