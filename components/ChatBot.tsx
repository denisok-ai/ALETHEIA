'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Message = { role: 'user' | 'bot'; text: string };

export function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: 'bot', text: data?.error || 'Ошибка. Попробуйте позже.' },
        ]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: data.answer || 'Нет ответа.' },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: 'Ошибка соединения. Попробуйте позже.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-20 right-4 z-50 w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-border/80 bg-surface shadow-[var(--shadow-card)] md:bottom-24 md:right-6"
          >
            <div className="flex items-center justify-between border-b border-border/80 bg-[var(--lavender-light)] px-5 py-4 rounded-t-2xl">
              <span className="font-semibold text-dark">
                Консультант курса «Тело не врёт»
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-text-muted hover:bg-white/60 hover:text-dark transition-colors"
                aria-label="Закрыть чат"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div
              ref={listRef}
              className="h-80 overflow-y-auto p-5 space-y-4 bg-bg"
            >
              {messages.length === 0 && (
                <p className="text-sm text-text-muted">
                  Задайте любой вопрос о курсе, здоровье, усталости, страхах, деньгах или отношениях. Я отвечу по базе знаний курса.
                </p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-xl px-4 py-3 text-sm max-w-[90%]',
                    m.role === 'user'
                      ? 'ml-auto bg-[var(--lavender-soft)] text-dark'
                      : 'mr-auto bg-[var(--lavender-light)] text-dark'
                  )}
                >
                  {m.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  ) : (
                    <div className="chat-markdown [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_a]:text-accent [&_a]:underline [&_a:hover]:opacity-80">
                      <ReactMarkdown>{m.text}</ReactMarkdown>
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="mr-auto rounded-xl px-3 py-2 text-sm bg-[var(--lavender-light)] text-text-muted">
                  Думаю…
                </div>
              )}
            </div>
            <div className="border-t border-border/80 p-4 rounded-b-2xl bg-surface">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                  placeholder="Напишите вопрос..."
                  className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm placeholder:text-text-soft focus:outline-none focus:ring-2 focus:ring-accent/40"
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="primary"
                  size="default"
                  onClick={send}
                  disabled={loading || !input.trim()}
                  className="shrink-0"
                >
                  Отправить
                </Button>
              </div>
              <p className="mt-2 text-xs text-text-muted">
                Ответы по базе знаний курса. Не заменяют консультацию врача.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg hover:bg-accent-hover hover:scale-105 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 md:bottom-8 md:right-6"
        aria-label={open ? 'Закрыть чат' : 'Открыть чат с консультантом'}
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </motion.button>
    </>
  );
}
