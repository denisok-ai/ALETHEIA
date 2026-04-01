'use client';

/**
 * Панель AI для черновика описания товара витрины: произвольный запрос + вставка в поле.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';

type Context = {
  name: string;
  slug: string;
  courseTitle: string | null;
  description: string;
};

export function ServiceAiHelper({
  context,
  onInsert,
  className = '',
}: {
  context: Context;
  onInsert: (text: string) => void;
  className?: string;
}) {
  const [task, setTask] = useState('');
  const [loading, setLoading] = useState(false);

  async function run() {
    const instruction =
      task.trim() ||
      'Сформулируй краткое продающее описание услуги для карточки на главной сайта (2–4 предложения).';
    setLoading(true);
    try {
      const ctxParts = [
        `Название: ${context.name}`,
        `Slug: ${context.slug}`,
        context.courseTitle ? `Курс: ${context.courseTitle}` : '',
        context.description ? `Черновик описания: ${context.description}` : '',
      ].filter(Boolean);
      const res = await fetch('/api/portal/admin/ai-settings/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          context: ctxParts.join('\n'),
          maxTokens: 600,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Ошибка AI');
      }
      const content = typeof data.content === 'string' ? data.content.trim() : '';
      if (!content) {
        throw new Error('Пустой ответ модели');
      }
      onInsert(content);
      toast.success('Текст вставлен в описание');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка запроса');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 ${className}`}>
      <p className="text-xs font-medium text-[var(--portal-text-muted)]">AI-помощник (описание карточки)</p>
      <textarea
        value={task}
        onChange={(e) => setTask(e.target.value)}
        placeholder="Запрос: например «Короче, акцент на результат за 10 занятий» или оставьте пустым для шаблона"
        rows={2}
        className="mt-2 w-full rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:ring-offset-0"
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-2 gap-2"
        onClick={() => void run()}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Сгенерировать и вставить
      </Button>
    </div>
  );
}
