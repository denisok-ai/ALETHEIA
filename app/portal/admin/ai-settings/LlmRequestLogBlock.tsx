'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/portal/Card';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface LogEntry {
  at: string;
  source: string;
  model: string;
  promptChars: number;
  responseChars: number;
  promptTokensEst?: number;
  responseTokensEst?: number;
  durationMs: number;
  userId?: string;
  role?: string;
}

interface Aggregate {
  totalCalls: number;
  promptTokensEst: number;
  responseTokensEst: number;
  promptChars: number;
  responseChars: number;
}

const SOURCE_LABELS: Record<string, string> = {
  chatbot: 'Чат-бот',
  'suggest-reply': 'Подсказка ответа (тикет)',
  'ticket-auto-reply': 'Автоответ при создании тикета',
  'generate-text': 'Генерация текста',
  'ai-assist': 'AI-тьютор в курсе',
  'prompt-generate': 'Генерация промпта',
  'verification-ai-summary': 'Подсказка по заданию (верификация)',
};

export function LlmRequestLogBlock() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [aggregate, setAggregate] = useState<Aggregate | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/portal/admin/ai-settings/request-log')
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((d) => {
        setEntries(d.entries ?? []);
        setAggregate(d.aggregate ?? null);
      })
      .catch(() => {
        setEntries([]);
        setAggregate(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card
      title="Лог запросов к AI"
      description="Последние вызовы моделей (чат-бот, подсказки в тикетах, автоответ и др.). Хранится в памяти процесса; после перезапуска сводка обнуляется. Оценка токенов: символы ÷ 4 (ориентир для биллинга)."
    >
      {aggregate && aggregate.totalCalls > 0 && (
        <div className="mb-4 grid gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm sm:grid-cols-3">
          <div>
            <span className="text-[var(--portal-text-muted)]">Вызовов в памяти:</span>{' '}
            <span className="font-semibold text-[var(--portal-text)]">{aggregate.totalCalls}</span>
          </div>
          <div>
            <span className="text-[var(--portal-text-muted)]">Σ токенов (оценка, вх.):</span>{' '}
            <span className="font-semibold text-[var(--portal-text)]">{aggregate.promptTokensEst.toLocaleString('ru-RU')}</span>
          </div>
          <div>
            <span className="text-[var(--portal-text-muted)]">Σ токенов (оценка, отв.):</span>{' '}
            <span className="font-semibold text-[var(--portal-text)]">{aggregate.responseTokensEst.toLocaleString('ru-RU')}</span>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 mb-3">
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>
      {loading && entries.length === 0 ? (
        <p className="text-sm text-[var(--portal-text-muted)]">Загрузка…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-[var(--portal-text-muted)]">Пока нет записей. Запросы появятся после использования чат-бота, подсказки ответа в тикете или автоответа при создании обращения.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#E2E8F0]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <th className="px-3 py-2 text-left font-medium text-[var(--portal-text-muted)]">Дата</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--portal-text-muted)]">Сценарий</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--portal-text-muted)]">Модель</th>
                <th className="px-3 py-2 text-right font-medium text-[var(--portal-text-muted)]">Симв. / ток. (оц.)</th>
                <th className="px-3 py-2 text-right font-medium text-[var(--portal-text-muted)]">Время</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--portal-text-muted)]">Роль</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={`${e.at}-${i}`} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                  <td className="px-3 py-2 text-[var(--portal-text)] whitespace-nowrap">
                    {format(new Date(e.at), 'dd.MM.yyyy HH:mm:ss')}
                  </td>
                  <td className="px-3 py-2 text-[var(--portal-text)]">
                    {SOURCE_LABELS[e.source] ?? e.source}
                  </td>
                  <td className="px-3 py-2 text-[var(--portal-text-muted)]">{e.model}</td>
                  <td className="px-3 py-2 text-right text-[var(--portal-text-muted)] text-xs">
                    {e.promptChars}/{e.responseChars} · ~{e.promptTokensEst ?? '—'}/{e.responseTokensEst ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-[var(--portal-text-muted)]">{e.durationMs} мс</td>
                  <td className="px-3 py-2 text-[var(--portal-text-muted)]">{e.role ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
