'use client';

/**
 * Admin: выбор уроков курса, по которым требуется верификация (отправка видео студентом).
 * Данные из scormManifest (items[].identifier). Сохраняется в Course.verificationRequiredLessonIds (JSON array).
 */
import { useState, useMemo } from 'react';
import { Video, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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

function parseRequiredIds(json: string | null): string[] {
  if (!json?.trim()) return [];
  try {
    const arr = JSON.parse(json) as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

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
  const initialSelected = useMemo(
    () => parseRequiredIds(verificationRequiredLessonIdsJson),
    [verificationRequiredLessonIdsJson]
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected));
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/portal/admin/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationRequiredLessonIds: Array.from(selected),
        }),
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
          Загрузите SCORM-пакет с манифестом — список уроков появится здесь. Можно будет отметить, по каким урокам студент должен отправить видео на проверку.
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
        Отмеченные уроки — по ним студент должен отправить видео на проверку. На странице курса у студента будет показано, по каким урокам нужно отправить задание.
      </p>
      <ul className="mt-3 space-y-2 max-h-48 overflow-y-auto">
        {lessons.map((lesson) => (
          <li key={lesson.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`ver-lesson-${lesson.id}`}
              checked={selected.has(lesson.id)}
              onChange={() => toggle(lesson.id)}
              className="h-4 w-4 rounded border-[#E2E8F0] text-[#6366F1] focus:ring-[#6366F1]"
            />
            <label
              htmlFor={`ver-lesson-${lesson.id}`}
              className="text-sm text-[var(--portal-text)] cursor-pointer flex-1 min-w-0 truncate"
            >
              {lesson.title ?? lesson.id}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
