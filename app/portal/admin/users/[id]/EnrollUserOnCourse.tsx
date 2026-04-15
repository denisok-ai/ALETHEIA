'use client';

/**
 * Admin: enroll user on a course (from user detail page).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

type CourseOption = { id: string; title: string };

export function EnrollUserOnCourse({
  userId,
  courses,
  enrolledCourseIds,
}: {
  userId: string;
  courses: CourseOption[];
  enrolledCourseIds: string[];
}) {
  const router = useRouter();
  const [courseId, setCourseId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const availableCourses = courses.filter((c) => !enrolledCourseIds.includes(c.id));

  async function handleEnroll() {
    if (!courseId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/portal/admin/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, courseId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 409) {
          toast.error('Пользователь уже записан на этот курс');
          return;
        }
        throw new Error((err as { error?: string }).error || res.statusText);
      }
      toast.success('Пользователь записан на курс');
      setCourseId('');
      router.refresh();
    } catch (e) {
      console.error(e);
      toast.error('Ошибка записи на курс');
    }
    setLoading(false);
  }

  if (availableCourses.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
      <div className="min-w-[200px]">
        <Label htmlFor="enroll-course" className="text-xs text-[var(--portal-text-muted)]">
          Записать на курс
        </Label>
        <select
          id="enroll-course"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[var(--portal-accent)]"
        >
          <option value="">Выберите курс</option>
          {availableCourses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={!courseId || loading}
        onClick={handleEnroll}
      >
        <UserPlus className="mr-1 h-4 w-4" />
        {loading ? 'Запись…' : 'Записать'}
      </Button>
    </div>
  );
}
