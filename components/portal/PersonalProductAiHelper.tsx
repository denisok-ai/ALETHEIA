'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Sparkles } from 'lucide-react';

const PRESET_PROMPTS = [
  'Краткое продающее описание персональной консультации (2-3 предложения)',
  'Описание для индивидуального сеанса мышечного тестирования',
  'Текст для персональной диагностики тела и психосоматики',
  'Описание VIP-консультации с мастером школы',
  'Текст для пробного мини-сеанса знакомства с методом',
];

export function PersonalProductAiHelper({
  context,
  onInsert,
}: {
  context: { name: string; description: string };
  onInsert: (text: string) => void;
}) {
  const [task, setTask] = useState('');
  const [loading, setLoading] = useState(false);

  async function run(preset?: string) {
    const instruction = preset || task.trim() || PRESET_PROMPTS[0];
    setLoading(true);
    try {
      const ctxParts = [
        `Название услуги: ${context.name || '(не указано)'}`,
        context.description ? `Текущее описание: ${context.description}` : '',
        'Контекст: школа AVATERRA — Phygital школа мышечного тестирования, курс «Тело не врет». Основательница — Татьяна Стрельцова, 22 года практики.',
        'Формат: персональная индивидуальная услуга, клиент получает уникальную ссылку на оплату.',
      ].filter(Boolean);
      const res = await fetch('/api/portal/admin/ai-settings/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          context: ctxParts.join('\n'),
          maxTokens: 500,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Ошибка AI');
      const content = typeof data.content === 'string' ? data.content.trim() : '';
      if (!content) throw new Error('Пустой ответ модели');
      onInsert(content);
      toast.success('Описание сгенерировано');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка AI');
    }
    setLoading(false);
  }

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-2 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {PRESET_PROMPTS.map((preset, i) => (
          <button
            key={i}
            onClick={() => run(preset)}
            disabled={loading}
            className="px-2 py-1 text-xs bg-white border border-purple-200 rounded-full hover:bg-purple-100 disabled:opacity-50 transition-colors"
          >
            {preset.slice(0, 40)}…
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Свой запрос для AI…"
          className="flex-1 px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-purple-400 outline-none"
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <button
          onClick={() => run()}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          Генерировать
        </button>
      </div>
    </div>
  );
}
