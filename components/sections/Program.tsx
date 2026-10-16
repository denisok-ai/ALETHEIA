'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BookOpen, CalendarClock, Footprints, Video, ChevronDown } from 'lucide-react';

/**
 * 6 модулей практикума «Тело знает всё» — как в базе знаний школы
 * (content/knowledge/avaterra.yaml). Число уроков и часов по модулям не
 * указываем: для новой разбивки они не подтверждены.
 */
const modules = [
  { title: 'Введение и сверка баланса', text: 'Философия подхода, физиология теста, подготовка: вода, дыхание, сверка баланса. Этика работы.' },
  { title: 'Карта эмоций', text: 'Как точно назвать эмоцию и отличить свои эмоции от чужих.' },
  { title: 'Энергетический заряд', text: 'Шкала заряда 0–100 %, замер «до» и «после».' },
  { title: 'Лобный обхват', text: 'Техника снятия стресса за несколько минут и точки эмоционального баланса.' },
  { title: 'Регресс', text: 'Поиск причины во времени по принципу «слоёного пирога».' },
  { title: 'Изменение образа', text: 'Освобождение заряда, новый ресурсный образ и проверка завершённости.' },
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
          Программа практикума «Тело знает всё»
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.04 }}
          className="mt-2 text-lg text-[var(--text-muted)] sm:text-xl"
        >
          Шесть модулей для самостоятельного освоения подхода
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
              <CalendarClock className="h-6 w-6 text-plum" aria-hidden />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-[var(--text)]">3</p>
              <p className="text-sm leading-snug text-[var(--text-muted)]">месяца доступа</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-periwinkle/30 p-3">
              <Footprints className="h-6 w-6 text-plum" aria-hidden />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text)]">В своём темпе</p>
              <p className="text-sm text-[var(--text-muted)]">без расписания</p>
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
                className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--lavender-light)] sm:grid sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                aria-expanded={openIndex === i}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-periwinkle/35 text-sm font-bold text-plum">
                    {i + 1}
                  </span>
                  <h3 className="min-w-0 font-heading text-base font-semibold text-[var(--text)] sm:text-lg">{mod.title}</h3>
                </span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-[var(--text-muted)] transition-transform sm:justify-self-end ${
                    openIndex === i ? 'rotate-180' : ''
                  }`}
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
                    <div className="space-y-2 p-4 text-sm text-[var(--text)]">
                      <p>{mod.text}</p>
                      <p className="flex items-center gap-2 text-[var(--text-muted)]">
                        <Video className="h-4 w-4 shrink-0 text-plum" aria-hidden />
                        Видео, тексты, чек-листы и аудиопрактики — без кураторов и живых занятий
                      </p>
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
          <Link
            href="/course/navyki-myshechnogo-testirovaniya"
            className={cn(buttonVariants({ variant: 'landingRose', size: 'lg' }))}
          >
            Подробнее о практикуме
          </Link>
          <Link href="#pricing" className="text-sm font-medium text-plum hover:underline">
            Все форматы и цены
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
