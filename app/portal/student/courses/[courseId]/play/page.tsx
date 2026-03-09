'use client';

/**
 * SCORM player: iframe loads course content; we persist CMI via API.
 * For full SCORM 1.2/2004 RTE, integrate scorm-again or similar in a wrapper that proxies API to our backend.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function ScormPlayPage() {
  const params = useParams();
  const courseId = params?.courseId as string;
  const [scormUrl, setScormUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;
    fetch(`/api/portal/scorm/url?courseId=${courseId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { url?: string } | null) => {
        if (data?.url) setScormUrl(data.url);
        else setError('Курс не найден или контент не загружен');
      })
      .catch(() => setError('Ошибка загрузки'));
  }, [courseId]);

  if (error) {
    return (
      <div className="p-6">
        <p className="text-text-muted">{error}</p>
        <Link href={`/portal/student/courses/${courseId}`} className="mt-4 inline-block text-primary hover:underline">
          ← Назад к курсу
        </Link>
      </div>
    );
  }

  if (!scormUrl) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-text-muted">Загрузка плеера…</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-bg-cream px-4">
        <Link
          href={`/portal/student/courses/${courseId}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Выход из курса
        </Link>
      </div>
      <iframe
        title="SCORM курс"
        src={scormUrl}
        className="flex-1 w-full border-0"
        allow="fullscreen"
        allowFullScreen
      />
    </div>
  );
}
