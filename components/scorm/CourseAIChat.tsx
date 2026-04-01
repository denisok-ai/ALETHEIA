'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { MessageCircle, X, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const SUGGESTED = [
  'Объясни этот раздел',
  'Какие ключевые понятия?',
  'Помоги с заданием',
];

export interface CourseAIChatProps {
  courseId: string;
  lessonId?: string;
  className?: string;
}

export function CourseAIChat({ courseId, lessonId = 'main', className }: CourseAIChatProps) {
  const [open, setOpen] = useState(false);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/portal/scorm/ai-assist',
      body: { courseId, lessonId },
    }),
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  return (
    <div className={cn('fixed bottom-6 right-6 z-40', className)}>
      {open && (
        <div className="mb-2 flex h-[420px] w-[380px] flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-xl">
          <div className="flex shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2">
            <span className="text-sm font-medium text-[var(--portal-text)]">AI-тьютор</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-[var(--portal-text-muted)] hover:bg-[#F1F5F9] hover:text-[var(--portal-text)]"
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-[var(--portal-text-muted)]">Задайте вопрос по материалам курса.</p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm',
                  m.role === 'user'
                    ? 'ml-6 bg-[var(--portal-accent-soft)] text-[var(--portal-text)]'
                    : 'mr-6 bg-[#F8FAFC] text-[var(--portal-text)]'
                )}
              >
                {m.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{String((m as { content?: string }).content ?? (m as { text?: string }).text ?? '')}</p>
                ) : (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{String((m as { content?: string }).content ?? (m as { text?: string }).text ?? '')}</ReactMarkdown>
                  </div>
                )}
              </div>
            ))}
            {error && (
              <p className="text-sm text-red-600">{error.message}</p>
            )}
          </div>
          <div className="shrink-0 border-t border-[#E2E8F0] p-2">
            {messages.length === 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {SUGGESTED.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendMessage({ text: q })}
                    disabled={isLoading}
                    className="rounded-full bg-[#F8FAFC] px-2 py-1 text-xs text-[var(--portal-text)] hover:bg-[var(--portal-accent-soft)]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.querySelector('input');
                const v = input?.value?.trim();
                if (v) {
                  sendMessage({ text: v });
                  if (input) input.value = '';
                }
              }}
            >
              <Input
                placeholder="Вопрос..."
                className="flex-1"
                disabled={isLoading}
                name="question"
              />
              <Button type="submit" size="sm" disabled={isLoading}>
                {isLoading ? '…' : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--portal-accent)] text-white shadow-lg hover:bg-[var(--portal-accent-dark)]"
        aria-label={open ? 'Закрыть чат' : 'Открыть AI-тьютор'}
      >
        <MessageCircle className="h-5 w-5" />
      </button>
    </div>
  );
}
