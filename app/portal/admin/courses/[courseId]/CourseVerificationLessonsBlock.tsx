'use client';

/**
 * Admin: выбор уроков с верификацией и настройка (инструкция, макс. файлов, формат).
 * Сохраняется в Course.verificationRequiredLessonIds (JSON array of objects).
 */
import { useState, useMemo } from 'react';
import { Video, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { parseVerificationLessons, type VerificationLessonConfig } from '@/lib/verification-lessons';

export interface LessonOption {
  id: string;
  title?: string;
}

function parseManifestItems(scormManifest: string | null): LessonOption[] {
  if (!scormManifest?.trim()) return [];
  try {
    const parsed = JSON.parse(scormManifest) as { items?: { identifier: string; title?: string }[] };
    const items = parsed.items ?? [];
    return items.map((it) => ({ id: it.identifier, title: it.title }));
  } catch {
    return [];
  }
}

const FORMAT_OPTIONS = [
  { value: 'video', label: 'Видео' },
  { value: 'photo', label: 'Фото' },
  { value: 'document', label: 'Документ' },
] as const;

export function CourseVerificationLessonsBlock({
  courseId,
  scormManifest,
  verificationRequiredLessonIdsJson,
}: {
  courseId: string;
  scormManifest: string | null;
  verificationRequiredLessonIdsJson: string | null;
}) {
  const lessons = useMemo(() => parseManifestItems(scormManifest), [scormManifest]);
  const initialConfigs = useMemo(
    () => parseVerificationLessons(verificationRequiredLessonIdsJson),
    [verificationRequiredLessonIdsJson]
  );

  const getConfig = (lessonId: string): VerificationLessonConfig => {
    const existing = initialConfigs.find((c) => c.lessonId === lessonId);
    return existing ?? { lessonId };
  };

  const [configs, setConfigs] = useState<Map<string, VerificationLessonConfig>>(() => {
    const m = new Map<string, VerificationLessonConfig>();
    initialConfigs.forEach((c) => m.set(c.lessonId, { ...c }));
    return m;
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    setConfigs((prev) => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.set(id, getConfig(id));
        setExpanded((e) => new Set(e).add(id));
      }
      return next;
    });
  };

  const updateConfig = (lessonId: string, patch: Partial<VerificationLessonConfig>) => {
    setConfigs((prev) => {
      const next = new Map(prev);
      const cur = next.get(lessonId) ?? { lessonId };
      next.set(lessonId, { ...cur, ...patch });
      return next;
    });
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function handleSave() {
    setSaving(true);
    try {
      const payload = Array.from(configs.values()).map((c) => ({
        lessonId: c.lessonId,
        instructions: c.instructions || undefined,
        maxFiles: c.maxFiles,
        requiredFormat: c.requiredFormat,
      }));
      const res = await fetch(`/api/portal/admin/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationRequiredLessonIds: payload }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Ошибка сохранения');
      }
      toast.success('Сохранено');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  if (lessons.length === 0) {
    return (
      <div className="portal-card p-4">
        <div className="flex items-center gap-2 text-[var(--portal-text-muted)]">
          <Video className="h-5 w-5" />
          <h2 className="text-base font-semibold text-[var(--portal-text)]">Уроки с верификацией</h2>
        </div>
        <p className="mt-2 text-sm text-[var(--portal-text-muted)]">
          Загрузите SCORM-пакет с манифестом — список уроков появится здесь.
        </p>
      </div>
    );
  }

  return (
    <div className="portal-card p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Video className="h-5 w-5 text-[var(--portal-text-muted)]" />
          <h2 className="text-base font-semibold text-[var(--portal-text)]">Уроки с верификацией</h2>
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="min-h-9"
        >
          <Save className="h-4 w-4 mr-1" />
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </div>
      <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
        Отмеченные уроки — по ним студент должен отправить задание на проверку. Можно задать инструкцию, формат и макс. число файлов.
      </p>
      <ul className="mt-3 space-y-2 max-h-64 overflow-y-auto">
        {lessons.map((lesson) => {
          const cfg = configs.get(lesson.id);
          const isSelected = !!cfg;
          const isExp = expanded.has(lesson.id);
          return (
            <li key={lesson.id} className="rounded-lg border border-[#E2E8F0] overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-[#F8FAFC]">
                <input
                  type="checkbox"
                  id={`ver-lesson-${lesson.id}`}
                  checked={isSelected}
                  onChange={() => toggle(lesson.id)}
                  className="h-4 w-4 rounded border-[#E2E8F0] text-[#6366F1] focus:ring-[#6366F1]"
                />
                <button
                  type="button"
                  onClick={() => isSelected && toggleExpanded(lesson.id)}
                  className="flex items-center gap-1 flex-1 min-w-0 text-left"
                  disabled={!isSelected}
                >
                  {isSelected ? (isExp ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />) : null}
                  <label htmlFor={`ver-lesson-${lesson.id}`} className="text-sm text-[var(--portal-text)] cursor-pointer truncate">
                    {lesson.title ?? lesson.id}
                  </label>
                </button>
              </div>
              {isSelected && isExp && (
                <div className="px-3 py-2 space-y-2 border-t border-[#E2E8F0] bg-white">
                  <div>
                    <Label htmlFor={`ver-inst-${lesson.id}`} className="text-xs">Инструкция для студента</Label>
                    <textarea
                      id={`ver-inst-${lesson.id}`}
                      value={cfg?.instructions ?? ''}
                      onChange={(e) => updateConfig(lesson.id, { instructions: e.target.value })}
                      placeholder="Опишите задание..."
                      className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm min-h-[60px]"
                      rows={2}
                    />
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <div>
                      <Label htmlFor={`ver-max-${lesson.id}`} className="text-xs">Макс. файлов</Label>
                      <Input
                        id={`ver-max-${lesson.id}`}
                        type="number"
                        min={1}
                        max={10}
                        value={cfg?.maxFiles ?? ''}
                        onChange={(e) => updateConfig(lesson.id, { maxFiles: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                        className="mt-1 w-20"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`ver-format-${lesson.id}`} className="text-xs">Формат</Label>
                      <select
                        id={`ver-format-${lesson.id}`}
                        value={cfg?.requiredFormat ?? ''}
                        onChange={(e) => updateConfig(lesson.id, { requiredFormat: e.target.value as VerificationLessonConfig['requiredFormat'] || undefined })}
                        className="mt-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
                      >
                        <option value="">— любой</option>
                        {FORMAT_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
