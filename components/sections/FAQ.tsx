'use client';

import { useState, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, HelpCircle, MessageCircle, Send } from 'lucide-react';
import { ChatMarkdown } from '@/components/ChatMarkdown';
import { Button } from '@/components/ui/button';
import { FAQ_SECTION_ITEMS } from '@/lib/landing-faq';

export function FAQ() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [askQuestion, setAskQuestion] = useState('');
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  const filtered = FAQ_SECTION_ITEMS.filter(
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
    <section
      id="faq-extended"
      ref={ref}
      className="relative scroll-mt-24 border-t border-[var(--border)] bg-[var(--surface)] py-14 px-4 sm:px-5 md:py-20 md:px-6"
    >
      <div className="relative mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="max-w-3xl"
        >
          <span className="block text-sm font-semibold uppercase tracking-widest text-plum">Поиск и помощник</span>
          <h2 className="mt-2 font-heading text-3xl font-semibold text-[var(--text)] sm:text-4xl">
            Вопросы и помощник по курсу
          </h2>
          <p className="mt-4 text-[var(--text-muted)] leading-relaxed">
            Сначала поищите в списке; если нужно переформулировать — спросите помощника по базе знаний курса или откройте чат справа внизу на экране.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.06 }}
              className="relative"
            >
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-soft)]" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по вопросам..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] py-3.5 pl-12 pr-4 text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-plum focus:outline-none focus:ring-2 focus:ring-plum/25"
                aria-label="Поиск по вопросам"
              />
            </motion.div>

            <div className="mt-6 space-y-3">
              {filtered.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)] bg-[var(--lavender-light)] p-6 text-center text-[var(--text-muted)]">
                  Ничего не найдено. Попробуйте другой запрос.
                </p>
              ) : (
                filtered.map((item, idx) => {
                  const originalIndex = FAQ_SECTION_ITEMS.indexOf(item);
                  return (
                    <motion.div
                      key={item.q}
                      initial={{ opacity: 0, y: 14 }}
                      animate={isInView ? { opacity: 1, y: 0 } : {}}
                      transition={{ delay: 0.08 + idx * 0.03 }}
                      className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)]"
                    >
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-4 p-4 text-left font-medium text-[var(--text)] transition-colors hover:bg-[var(--lavender-light)]"
                        onClick={() => setOpenIndex(openIndex === originalIndex ? null : originalIndex)}
                        aria-expanded={openIndex === originalIndex}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <HelpCircle className="h-5 w-5 shrink-0 text-accent" aria-hidden />
                          <span className="min-w-0">{item.q}</span>
                        </span>
                        <ChevronDown
                          className={`h-5 w-5 shrink-0 transition-transform ${
                            openIndex === originalIndex ? 'rotate-180' : ''
                          }`}
                          aria-hidden
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
                            <p className="border-t border-[var(--border)] p-4 pl-12 leading-relaxed text-[var(--text-muted)]">
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
          </div>

          <aside className="lg:col-span-5">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.12 }}
              className="lg:sticky lg:top-28 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-6 shadow-[var(--shadow-soft)] md:p-8"
            >
              <div className="flex items-center gap-3 text-accent">
                <MessageCircle className="h-6 w-6 shrink-0" aria-hidden />
                <h3 className="font-heading text-xl font-semibold text-[var(--text)]">Задайте вопрос по курсу</h3>
              </div>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Ответ по базе знаний курса школы «АВАТЕРРА» (нейросеть). Не заменяет консультацию специалиста.
              </p>
              <div className="mt-5 flex flex-col gap-3">
                <input
                  type="text"
                  value={askQuestion}
                  onChange={(e) => {
                    setAskQuestion(e.target.value);
                    setAskError(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && !askLoading && handleAsk()}
                  placeholder="Напишите вопрос..."
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-3.5 px-4 text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-plum focus:outline-none focus:ring-2 focus:ring-plum/25"
                  disabled={askLoading}
                />
                <Button
                  type="button"
                  variant="landingPlum"
                  size="default"
                  onClick={handleAsk}
                  disabled={askLoading || !askQuestion.trim()}
                  className="w-full gap-2 sm:w-auto"
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
                <div className="mt-5 max-h-[min(24rem,50vh)] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--lavender-light)] p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent">Ответ</p>
                  <div className="chat-markdown text-sm text-[var(--text)] [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_a]:text-accent [&_a]:underline [&_a:hover]:opacity-80">
                    <ChatMarkdown>{askAnswer}</ChatMarkdown>
                  </div>
                </div>
              )}
            </motion.div>
          </aside>
        </div>
      </div>
    </section>
  );
}
