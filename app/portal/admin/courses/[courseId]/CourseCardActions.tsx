'use client';

/**
 * Действия в карточке курса: Копировать (с переходом на карточку копии), Удалить (с подтверждением).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Copy, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';

interface CourseCardActionsProps {
  courseId: string;
  courseTitle: string;
  courseDescription: string | null;
  courseStartsAt: string | null;
  courseEndsAt: string | null;
  coursePrice: number | null;
}

export function CourseCardActions({
  courseId,
  courseTitle,
  courseDescription,
  courseStartsAt,
  courseEndsAt,
  coursePrice,
}: CourseCardActionsProps) {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copying, setCopying] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleCopy() {
    setCopying(true);
    try {
      const res = await fetch('/api/portal/admin/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${courseTitle} (копия)`,
          description: courseDescription,
          startsAt: courseStartsAt,
          endsAt: courseEndsAt,
          price: coursePrice,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      toast.success('Курс скопирован');
      router.push(`/portal/admin/courses/${data.course.id}`);
    } catch (err) {
      console.error(err);
      toast.error('Ошибка копирования');
    }
    setCopying(false);
  }

  async function handleDelete() {
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/portal/admin/courses/${courseId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      toast.success('Курс удалён');
      router.push('/portal/admin/courses');
    } catch (err) {
      console.error(err);
      toast.error('Ошибка удаления');
    }
    setDeleting(false);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/portal/admin/courses"
          className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm font-medium text-[var(--portal-text)] hover:bg-[#F8FAFC] hover:text-[#6366F1] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          К списку курсов
        </Link>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleCopy}
          disabled={copying}
        >
          <Copy className="mr-2 h-4 w-4" />
          {copying ? 'Копирование…' : 'Копировать'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleting}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Удалить
        </Button>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Подтверждение"
        description={`В случае удаления курса «${courseTitle}» будут безвозвратно удалены все связанные данные (записи на курс, прогресс, сертификаты по курсу и т.д.). Уверены, что хотите продолжить?`}
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={handleDelete}
      />
    </>
  );
}
