'use client';

import { useState, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, HelpCircle, MessageCircle, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';

const items = [
  {
    q: 'Что такое мышечное тестирование?',
    a: 'Это метод кинезиологии, позволяющий через мышечный ответ тела получать информацию из подсознания и находить причины дисбаланса.',
    category: 'Методика',
  },
  {
    q: 'Как проходит консультация?',
    a: 'Сессия длится около 1–1,5 часов. Мы определяем запрос, проводим тестирование и коррекцию. Формат подстраивается под вас.',
    category: 'Формат',
  },
  {
    q: 'Можно ли заниматься онлайн?',
    a: 'Да. Онлайн-консультации проводятся по видеосвязи и так же эффективны при соблюдении условий связи и тишины.',
    category: 'Формат',
  },
  {
    q: 'Сколько длится курс AVATERRA?',
    a: 'Курс состоит из 10 занятий. Расписание согласовывается индивидуально. Поддержка на протяжении всего обучения.',
    category: 'Курс',
  },
];

export function FAQ() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [askQuestion, setAskQuestion] = useState('');
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  const filtered = items.filter(
    (item) =>
      item.q.toLowerCase().includes(search.toLowerCase()) ||
      item.a.toLowerCase().includes(search.toLowerCase())
  );

  const handleAsk = async () => {
    const text = askQuestion.trim();
    if (!text || askLoading) return;
    setAskError(null);
    setAskAnswer(null);
    setAskLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAskError(data?.error || 'Ошибка. Попробуйте позже.');
        return;
      }
      setAskAnswer(data.answer || 'Нет ответа.');
    } catch {
      setAskError('Ошибка соединения. Попробуйте позже.');
    } finally {
      setAskLoading(false);
    }
  };

  return (
    <section id="faq" ref={ref} className="relative py-28 px-5 md:py-32 md:px-6">
      <div className="absolute inset-0 bg-gradient-to-b from-bg via-lavender-light/20 to-bg" />
      <motion.div
        style={{ perspective: 1200, transformStyle: 'preserve-3d' }}
        initial={{ opacity: 0, rotateX: 18 }}
        animate={isInView ? { opacity: 1, rotateX: 0 } : {}}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto max-w-3xl"
      >
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="block text-sm font-semibold uppercase tracking-widest text-accent"
        >
          FAQ
        </motion.span>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.05 }}
          className="mt-2 font-heading text-3xl font-semibold text-dark"
        >
          Частые вопросы
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1 }}
          className="relative mt-10"
        >
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-soft" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по вопросам..."
            className="w-full rounded-xl border border-border bg-white py-3.5 pl-12 pr-4 text-dark placeholder:text-text-soft focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </motion.div>

        <div className="mt-8 space-y-3">
          {filtered.length === 0 ? (
            <p className="rounded-xl border border-border bg-bg-soft p-6 text-center text-text-muted">
              Ничего не найдено. Попробуйте другой запрос.
            </p>
          ) : (
            filtered.map((item, idx) => {
              const originalIndex = items.indexOf(item);
              return (
                <motion.div
                  key={item.q}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.15 + idx * 0.04 }}
                  className="rounded-xl border border-border bg-white overflow-hidden backdrop-blur-sm"
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 p-4 text-left font-medium text-dark hover:bg-bg-soft transition-colors"
                    onClick={() => setOpenIndex(openIndex === originalIndex ? null : originalIndex)}
                    aria-expanded={openIndex === originalIndex}
                  >
                    <span className="flex items-center gap-3">
                      <HelpCircle className="h-5 w-5 shrink-0 text-accent" />
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 transition-transform ${
                        openIndex === originalIndex ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <AnimatePresence>
                    {openIndex === originalIndex && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <p className="border-t border-border p-4 pl-12 leading-relaxed text-text-muted">
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Блок «Задайте вопрос» — ответы по базе знаний (DeepSeek) */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.35 }}
          className="mt-14 rounded-2xl border border-border bg-white p-6 shadow-sm md:p-8"
        >
          <div className="flex items-center gap-3 text-accent">
            <MessageCircle className="h-6 w-6 shrink-0" />
            <h3 className="font-heading text-xl font-semibold text-dark">
              Задайте вопрос по курсу
            </h3>
          </div>
          <p className="mt-2 text-sm text-text-muted">
            Ответ по базе знаний курса «Тело не врёт» (нейросеть). Не заменяет консультацию специалиста.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              value={askQuestion}
              onChange={(e) => {
                setAskQuestion(e.target.value);
                setAskError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && !askLoading && handleAsk()}
              placeholder="Напишите вопрос..."
              className="flex-1 rounded-xl border border-border bg-bg py-3.5 px-4 text-dark placeholder:text-text-soft focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              disabled={askLoading}
            />
            <Button
              type="button"
              variant="primary"
              size="default"
              onClick={handleAsk}
              disabled={askLoading || !askQuestion.trim()}
              className="shrink-0 gap-2"
            >
              {askLoading ? (
                'Отправка…'
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Отправить
                </>
              )}
            </Button>
          </div>
          {askError && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {askError}
            </p>
          )}
          {askAnswer !== null && (
            <div className="mt-5 rounded-xl border border-border bg-[var(--lavender-light)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent mb-2">Ответ</p>
              <div className="chat-markdown text-sm text-dark [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_a]:text-accent [&_a]:underline [&_a:hover]:opacity-80">
                <ReactMarkdown>{askAnswer}</ReactMarkdown>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </section>
  );
}
