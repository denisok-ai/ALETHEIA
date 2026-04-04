'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/portal/Card';
import { Save } from 'lucide-react';

export function KnowledgeBaseBlock() {
  const [content, setContent] = useState('');
  const [initial, setInitial] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch('/api/portal/admin/ai-settings/knowledge-base')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        const text = d?.content ?? '';
        setContent(text);
        setInitial(text);
      })
      .catch(() => toast.error('Не удалось загрузить базу знаний'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/portal/admin/ai-settings/knowledge-base', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        toast.error('Ошибка сохранения');
        return;
      }
      setInitial(content);
      toast.success('База знаний сохранена');
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = content !== initial;

  return (
    <Card
      title="База знаний по продукту"
      description="Текст, на основании которого работает чат-бот (курс «Тело не врёт»). Поддерживается Markdown. Плейсхолдер {{COURSE_URL}} подставляется публичным URL оформления на Lynda (как кнопка «Купить курс» на лендинге). Тарифы на сайте при необходимости укажите отдельной ссылкой на главную (#pricing). Редактируйте по мере обновления материалов."
    >
      {loading ? (
        <p className="text-sm text-[var(--portal-text-muted)]">Загрузка…</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex-1 min-h-[320px]">
            <Label htmlFor="knowledge-base" className="sr-only">Текст базы знаний</Label>
            <textarea
              id="knowledge-base"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm resize-y min-h-[320px] focus:ring-2 focus:ring-[var(--portal-accent)]"
              placeholder="# База знаний\n\n## Раздел 1\n..."
              spellCheck={false}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={saving || !hasChanges}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Сохранение…' : 'Сохранить'}
            </Button>
            {hasChanges && (
              <span className="text-sm text-amber-600">Есть несохранённые изменения</span>
            )}
          </div>
        </form>
      )}
    </Card>
  );
}
