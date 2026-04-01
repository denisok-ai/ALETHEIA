'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Video, Send, HelpCircle, Clock, CheckCircle2, XCircle, ExternalLink, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { VerificationLessonConfig } from '@/lib/verification-lessons';

export interface LessonOption {
  id: string;
  title?: string;
}

const FORMAT_LABELS: Record<string, string> = {
  video: 'Видео',
  photo: 'Фото',
  document: 'Документ',
};

interface SubmissionItem {
  id: string;
  courseId: string;
  lessonId: string | null;
  videoUrl: string;
  status: string;
  comment: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<string, { label: string; icon: typeof Clock; cls: string }> = {
  pending: { label: 'На проверке', icon: Clock, cls: 'text-amber-600 bg-amber-50' },
  approved: { label: 'Одобрено', icon: CheckCircle2, cls: 'text-green-600 bg-green-50' },
  rejected: { label: 'Отклонено', icon: XCircle, cls: 'text-red-600 bg-red-50' },
};

export function CourseVerificationBlock({
  courseId,
  lessonOptions,
  requiredLessonIds = [],
  verificationConfigs = [],
}: {
  courseId: string;
  lessonOptions: LessonOption[];
  requiredLessonIds?: string[];
  verificationConfigs?: VerificationLessonConfig[];
}) {
  const configByLesson = new Map(verificationConfigs.map((c) => [c.lessonId, c]));
  const [videoUrl, setVideoUrl] = useState('');
  const [lessonId, setLessonId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [courseSubmissions, setCourseSubmissions] = useState<SubmissionItem[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const loadSubmissions = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/verifications');
      if (!res.ok) return;
      const data = await res.json();
      const items = (data.items ?? []).filter((i: SubmissionItem) => i.courseId === courseId);
      setCourseSubmissions(items.slice(0, 10));
    } catch {
      // ignore
    } finally {
      setLoadingSubmissions(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  async function handleUploadVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const form = new FormData();
      form.set('file', file);
      const res = await fetch('/api/portal/verifications/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Ошибка загрузки');
      if (data.url) setVideoUrl(data.url);
      toast.success('Видео загружено');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setUploadingVideo(false);
      e.target.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = videoUrl.trim();
    const isHttp = url.startsWith('http://') || url.startsWith('https://');
    const isUploaded = url.startsWith('/uploads/');
    if (!url || (!isHttp && !isUploaded)) {
      toast.error('Введите ссылку на видео или загрузите файл');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/portal/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          lessonId: lessonId || null,
          videoUrl: url,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Ошибка отправки');
        return;
      }
      toast.success('Задание отправлено на проверку');
      setVideoUrl('');
      setLessonId('');
      loadSubmissions();
    } catch {
      toast.error('Ошибка отправки');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="portal-card p-4 md:p-6">
      <div className="flex items-center gap-2 mb-3">
        <Video className="h-5 w-5 text-[var(--portal-text-muted)]" />
        <h2 className="text-base font-semibold text-[var(--portal-text)]">Задания на проверку</h2>
      </div>
      <p className="text-sm text-[var(--portal-text-muted)] mb-4">
        Запишите короткое видео (телефон или камера), загрузите на YouTube, Google Диск или другое облако с доступом по ссылке и вставьте ссылку ниже. Менеджер проверит в течение 1–2 рабочих дней.
      </p>
      {requiredLessonIds.length > 0 && (
        <div className="mb-3 space-y-2">
          <p className="text-sm font-medium text-[var(--portal-text)]">
            По этому курсу нужно отправить задание по урокам:
          </p>
          <ul className="space-y-2">
            {requiredLessonIds.map((id) => {
              const cfg = configByLesson.get(id);
              const title = lessonOptions.find((o) => o.id === id)?.title ?? id;
              const formatLabel = cfg?.requiredFormat ? FORMAT_LABELS[cfg.requiredFormat] : null;
              return (
                <li key={id} className="text-sm text-[var(--portal-text)] pl-2 border-l-2 border-[#E2E8F0]">
                  <span className="font-medium">{title}</span>
                  {formatLabel && <span className="text-[var(--portal-text-muted)] ml-1">({formatLabel})</span>}
                  {cfg?.instructions && (
                    <p className="mt-1 text-[var(--portal-text-muted)]">{cfg.instructions}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
        {lessonOptions.length > 0 && (
          <div>
            <Label htmlFor="ver-lesson">Урок (необязательно)</Label>
            <select
              id="ver-lesson"
              value={lessonId}
              onChange={(e) => setLessonId(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[#6366F1] focus:border-transparent min-h-10"
            >
              <option value="">Общее по курсу</option>
              {lessonOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.title ?? opt.id}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <Label htmlFor="ver-url">Ссылка на видео или загрузите файл *</Label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Input
              id="ver-url"
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://... или нажмите «Загрузить видео»"
              required
              className="min-h-10 flex-1 min-w-[180px] touch-manipulation"
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.avi,.mkv"
              className="hidden"
              onChange={handleUploadVideo}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={uploadingVideo}
              onClick={() => videoInputRef.current?.click()}
              className="min-h-10 touch-manipulation"
            >
              {uploadingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span className="ml-2">{uploadingVideo ? 'Загрузка…' : 'Загрузить видео'}</span>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary" disabled={submitting} className="min-h-10 touch-manipulation">
            {submitting ? 'Отправка…' : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Отправить на проверку
              </>
            )}
          </Button>
          <Link
            href="/portal/student/verifications"
            className="text-sm text-[var(--portal-accent)] hover:underline flex items-center gap-1"
          >
            Задания на проверку
          </Link>
          <Link
            href="/portal/student/help#verification"
            className="text-sm text-[var(--portal-text-soft)] hover:text-[var(--portal-text-muted)] flex items-center gap-1"
            title="Подробная инструкция"
          >
            <HelpCircle className="h-4 w-4" />
          </Link>
        </div>
      </form>

      {!loadingSubmissions && courseSubmissions.length > 0 && (
        <div className="mt-6 pt-4 border-t border-[#E2E8F0]">
          <p className="text-sm font-medium text-[var(--portal-text)] mb-2">Отправки по этому курсу</p>
          <ul className="space-y-2">
            {courseSubmissions.map((s) => {
              const cfg = STATUS_LABELS[s.status] ?? STATUS_LABELS.pending;
              const Icon = cfg.icon;
              const lessonLabel = s.lessonId
                ? (lessonOptions.find((o) => o.id === s.lessonId)?.title ?? s.lessonId)
                : 'Общее';
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-[#F1F5F9] last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${cfg.cls}`}>
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                    <span className="text-sm text-[var(--portal-text-muted)]">{lessonLabel}</span>
                    {s.status === 'rejected' && s.comment && (
                      <span className="text-xs text-red-600 truncate max-w-[180px]" title={s.comment}>
                        {s.comment}
                      </span>
                    )}
                  </div>
                  <a
                    href={s.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--portal-accent)] hover:underline inline-flex items-center gap-1 shrink-0"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Видео
                  </a>
                </li>
              );
            })}
          </ul>
          <Link
            href="/portal/student/verifications"
            className="inline-block mt-2 text-xs text-[var(--portal-accent)] hover:underline"
          >
            Все задания →
          </Link>
        </div>
      )}
    </div>
  );
}
