'use client';

/**
 * Карточка SCORM: просмотр манифеста и запуск плеера. Загрузка ZIP — только в блоке «Версии SCORM» ниже.
 */
import Link from 'next/link';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScormManifestViewer } from '@/components/admin/ScormManifestViewer';

export function ScormPackageCard({
  courseId,
  scormManifest,
  scormVersion,
}: {
  courseId: string;
  scormManifest: string | null;
  scormVersion: string | null;
}) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-[var(--portal-text)]">Структура пакета (манифест)</span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {scormManifest ? (
            <Link href={`/portal/student/courses/${courseId}/play`} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="primary" size="sm" className="gap-1.5">
                <Play className="h-4 w-4" />
                Запустить плеер (проверка)
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
      {scormManifest ? (
        <p className="mb-2 text-xs text-[var(--portal-text-muted)]">
          Загрузка и версии ZIP — в блоке{' '}
          <a href="#course-scorm-versions" className="text-[var(--portal-accent)] underline hover:no-underline">
            «Версии SCORM»
          </a>
          . Администратор может открыть плеер без записи на курс.
        </p>
      ) : (
        <p className="mb-2 text-sm text-[var(--portal-text-muted)]">
          Пакет ещё не загружен.{' '}
          <a href="#course-scorm-versions" className="font-medium text-[var(--portal-accent)] underline hover:no-underline">
            Перейти к загрузке ZIP
          </a>
        </p>
      )}
      <ScormManifestViewer scormManifest={scormManifest} scormVersion={scormVersion} className="mt-2" />
    </div>
  );
}
