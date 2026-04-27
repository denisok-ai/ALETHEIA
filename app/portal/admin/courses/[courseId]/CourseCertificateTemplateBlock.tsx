'use client';

/**
 * Привязка шаблона сертификата к курсу в блоке Обзор.
 * Выбор шаблона — во всплывающем окне.
 */
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Award, ExternalLink, Loader2, LayoutTemplate, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type TemplateRow = {
  id: string;
  name: string;
  courseId: string | null;
  courseTitle: string | null;
};

export function CourseCertificateTemplateBlock({
  courseId,
  courseTitle,
  initialBoundTemplateId,
}: {
  courseId: string;
  courseTitle: string;
  initialBoundTemplateId: string | null;
}) {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>(initialBoundTemplateId ?? '');
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/portal/admin/certificate-templates');
      if (!res.ok) throw new Error('Ошибка загрузки');
      const data = (await res.json()) as { templates: TemplateRow[] };
      setTemplates(data.templates ?? []);
      const bound = data.templates?.find((t: TemplateRow) => t.courseId === courseId);
      setSelectedId(bound?.id ?? '');
    } catch {
      toast.error('Ошибка загрузки шаблонов');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleBind(templateId: string | null) {
    setSaving(true);
    try {
      const templatesBoundToCourse = templates.filter((t) => t.courseId === courseId);
      await Promise.all(
        templatesBoundToCourse.map((t) =>
          fetch(`/api/portal/admin/certificate-templates/${t.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseId: null }),
          })
        )
      );

      if (templateId) {
        const res = await fetch(`/api/portal/admin/certificate-templates/${templateId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error((d as { error?: string }).error ?? 'Ошибка');
        }
      }
      setSelectedId(templateId ?? '');
      toast.success(templateId ? 'Шаблон привязан' : 'Привязка снята');
      setDialogOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="portal-card p-4">
        <div className="flex items-center gap-2 text-[var(--portal-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загрузка шаблонов…
        </div>
      </div>
    );
  }

  // Показываем все шаблоны — можно привязать любой, в т.ч. переназначить с другого курса
  const availableTemplates = templates;
  const selectedTemplate = templates.find((t) => t.id === selectedId);

  return (
    <div className="portal-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-[var(--portal-text)] flex items-center gap-2">
          <Award className="h-5 w-5 text-[var(--portal-accent)]" />
          Шаблон для выдачи сертификатов
        </h2>
        <Link
          href="/portal/admin/certificate-templates"
          className="text-sm text-[var(--portal-accent)] hover:underline flex items-center gap-1"
        >
          Управление шаблонами
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
        Используется при автоматической выдаче. Список уже выданных сертификатов — на вкладке «Сертификаты курса».
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setDialogOpen(true)}
          className="min-w-[200px] justify-between"
        >
          <span className="truncate">
            {selectedTemplate ? selectedTemplate.name : '— не привязан'}
          </span>
          <LayoutTemplate className="h-4 w-4 shrink-0 ml-2" />
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Выбор шаблона сертификата</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--portal-text-muted)] -mt-4 mb-4">
            Выберите шаблон для курса «{courseTitle}» или отмените привязку.
          </p>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
            <button
              type="button"
              onClick={() => handleBind(null)}
              disabled={saving}
              className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                !selectedId
                  ? 'border-[var(--portal-accent)] bg-[var(--portal-accent)]/10 text-[var(--portal-accent)]'
                  : 'border-[#E2E8F0] hover:bg-[#F8FAFC] text-[var(--portal-text)]'
              }`}
            >
              {!selectedId && <Check className="h-5 w-5 shrink-0" />}
              <span className="flex-1">— не привязывать</span>
            </button>
            {availableTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleBind(t.id)}
                disabled={saving}
                className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                  selectedId === t.id
                    ? 'border-[var(--portal-accent)] bg-[var(--portal-accent)]/10 text-[var(--portal-accent)]'
                    : 'border-[#E2E8F0] hover:bg-[#F8FAFC] text-[var(--portal-text)]'
                }`}
              >
                {selectedId === t.id && <Check className="h-5 w-5 shrink-0" />}
                <span className="flex-1 font-medium">{t.name}</span>
                {t.courseTitle && t.courseId !== courseId && (
                  <span className="text-xs text-[var(--portal-text-muted)]">
                    ({t.courseTitle})
                  </span>
                )}
              </button>
            ))}
          </div>
          {availableTemplates.length === 0 && (
            <p className="text-sm text-[var(--portal-text-muted)] py-4">
              Нет доступных шаблонов. Создайте шаблон в разделе «Управление шаблонами».
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
