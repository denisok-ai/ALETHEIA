'use client';

/**
 * Формат курса: онлайн SCORM или очное мероприятие / вебинар.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { COURSE_FORMAT_OPTIONS, type CourseFormatValue } from '@/lib/course-format';
import { Users, Video } from 'lucide-react';

export function CourseLiveEventBlock({
  courseId,
  initialFormat,
  initialVenue,
  initialUrl,
}: {
  courseId: string;
  initialFormat: string;
  initialVenue: string | null;
  initialUrl: string | null;
}) {
  const [courseFormat, setCourseFormat] = useState<CourseFormatValue>(
    initialFormat === 'live_event' ? 'live_event' : 'scorm'
  );
  const [eventVenue, setEventVenue] = useState(initialVenue ?? '');
  const [eventUrl, setEventUrl] = useState(initialUrl ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/portal/admin/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseFormat,
          eventVenue: eventVenue.trim() || null,
          eventUrl: eventUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? 'Ошибка сохранения');
      }
      toast.success('Сохранено');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  }

  const isLive = courseFormat === 'live_event';

  return (
    <div className="portal-card p-4 md:p-6 space-y-4">
      <div className="flex items-start gap-2">
        {isLive ? (
          <Users className="h-5 w-5 text-[var(--portal-accent)] shrink-0 mt-0.5" aria-hidden />
        ) : (
          <Video className="h-5 w-5 text-[var(--portal-text-muted)] shrink-0 mt-0.5" aria-hidden />
        )}
        <div>
          <h3 className="text-sm font-semibold text-[var(--portal-text)]">Формат проведения</h3>
          <p className="text-xs text-[var(--portal-text-muted)] mt-0.5">
            Для вебинаров и очных встреч выберите «Мероприятие» и укажите ссылку или адрес. Даты — в шапке карточки курса (начало / окончание).
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="course-format">Тип</Label>
        <select
          id="course-format"
          value={courseFormat}
          onChange={(e) => setCourseFormat(e.target.value as CourseFormatValue)}
          className="mt-1 block w-full max-w-lg rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
        >
          {COURSE_FORMAT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-[var(--portal-text-muted)] mt-1">
          {COURSE_FORMAT_OPTIONS.find((o) => o.value === courseFormat)?.description}
        </p>
      </div>

      {isLive && (
        <div className="space-y-3 pt-2 border-t border-[#E2E8F0]">
          <div>
            <Label htmlFor="event-venue">Площадка / формат участия</Label>
            <textarea
              id="event-venue"
              value={eventVenue}
              onChange={(e) => setEventVenue(e.target.value)}
              rows={2}
              placeholder="Например: Очно — Москва, ул. Примерная, 1, ауд. 305. Или: Онлайн — подключение по ссылке ниже."
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="event-url">Ссылка на вебинар</Label>
            <Input
              id="event-url"
              type="text"
              value={eventUrl}
              onChange={(e) => setEventUrl(e.target.value)}
              placeholder="https://zoom.us/j/... или другая ссылка для участников"
              className="mt-1"
            />
          </div>
        </div>
      )}

      <Button type="button" onClick={() => void save()} disabled={saving}>
        {saving ? 'Сохранение…' : 'Сохранить формат'}
      </Button>
    </div>
  );
}
