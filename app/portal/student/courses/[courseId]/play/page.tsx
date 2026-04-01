'use client';

/**
 * SCORM player: single- or multi-SCO. Initializes scorm-again API, loads saved CMI, then iframe.
 * Multi-SCO: sidebar (ScormNavigation) + progress bar; certificate when all SCOs completed.
 */
import { useCallback, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ScormNavigation, type ScoItem, type ScoStatus } from '@/components/scorm/ScormNavigation';
import { ScormProgressBar } from '@/components/scorm/ScormProgressBar';
import { CourseAIChat } from '@/components/scorm/CourseAIChat';

type StructureItem = { identifier: string; title?: string; url: string };
type ProgressItem = { lesson_id: string; completion_status: string | null; score: number | null; time_spent: number };

export default function ScormPlayPage() {
  const params = useParams();
  const courseId = params?.courseId as string;
  const [structure, setStructure] = useState<{
    items: StructureItem[];
    isMultiSco: boolean;
    scormVersion: string;
    aiTutorEnabled?: boolean;
  } | null>(null);
  const [progressByLesson, setProgressByLesson] = useState<Record<string, ProgressItem>>({});
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [scormUrl, setScormUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const apiInitialized = useRef<string | null>(null);
  const refreshProgressRef = useRef<() => void>(() => {});
  const scormInitializedRef = useRef(false);
  const fallbackModeRef = useRef(false);
  const lessonStartTimeRef = useRef<number>(0);
  const currentLessonIdRef = useRef<string | null>(null);

  const refreshProgress = useCallback(async () => {
    const res = await fetch(
      `/api/portal/scorm/progress/all?courseId=${encodeURIComponent(courseId)}`
    );
    if (!res.ok) return;
    const data = (await res.json()) as { progress: ProgressItem[] };
    const byLesson: Record<string, ProgressItem> = {};
    for (const p of data.progress) {
      byLesson[p.lesson_id] = p;
    }
    setProgressByLesson(byLesson);
  }, [courseId]);

  useEffect(() => {
    refreshProgressRef.current = refreshProgress;
  }, [refreshProgress]);

  const saveFallbackProgress = useCallback(
    async (lessonId: string, completionStatus: 'incomplete' | 'completed') => {
      const elapsed = Math.floor((Date.now() - lessonStartTimeRef.current) / 1000);
      try {
        const res = await fetch('/api/portal/scorm/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            courseId,
            lessonId,
            completion_status: completionStatus,
            time_spent: elapsed,
          }),
        });
        if (res.ok) {
          console.log('[SCORM] fallback progress saved', { lessonId, completionStatus, time_spent: elapsed });
          refreshProgressRef.current?.();
        }
      } catch (e) {
        console.warn('[SCORM] fallback progress save error', e);
      }
    },
    [courseId]
  );

  const initApiForLesson = useCallback(
    async (lessonId: string, url: string, scormVersion: string, cmiData: Record<string, unknown>) => {
      scormInitializedRef.current = false;
      fallbackModeRef.current = false;
      lessonStartTimeRef.current = Date.now();

      const commitUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/portal/scorm/progress`;
      const requestHandler = (commitObj: unknown) => {
        const payload = Object.assign(
          typeof commitObj === 'object' && commitObj !== null ? { ...commitObj } : {},
          { courseId, lessonId }
        );
        console.log('[SCORM] commit', { courseId, lessonId, completion_status: (payload as Record<string, unknown>).completion_status ?? (payload as Record<string, unknown>).completionStatus });
        return payload;
      };
      const xhrHandler = (xhr: XMLHttpRequest) => {
        try {
          const json = JSON.parse(xhr.responseText || '{}');
          console.log('[SCORM] progress response', { status: xhr.status, success: json.success, courseId, lessonId });
          if (json.success) refreshProgressRef.current?.();
          return { result: !!json.success, errorCode: 0 };
        } catch (e) {
          console.warn('[SCORM] progress response parse error', { status: xhr.status, responseText: xhr.responseText?.slice(0, 200), courseId, lessonId }, e);
          return { result: false, errorCode: 101 };
        }
      };

      const commonOptions = {
        lmsCommitUrl: commitUrl,
        autocommit: true,
        autocommitSeconds: 15,
        requestHandler,
        xhrResponseHandler: xhrHandler,
        renderCommonCommitFields: true as const,
        sendFullCommit: true as const,
        xhrWithCredentials: true,
        useBeaconInsteadOfFetch: 'on-terminate' as const,
      };

      if (scormVersion === '2004') {
        const { Scorm2004API } = await import('scorm-again');
        const api = new Scorm2004API(commonOptions);
        api.on?.('Initialize', () => { scormInitializedRef.current = true; });
        if (Object.keys(cmiData).length > 0) api.loadFromJSON(cmiData as Record<string, unknown>);
        (window as unknown as { API_1484_11?: unknown }).API_1484_11 = api;
        (window as unknown as { API?: unknown }).API = undefined;
      } else {
        const { Scorm12API } = await import('scorm-again');
        const api = new Scorm12API(commonOptions);
        api.on?.('LMSInitialize', () => { scormInitializedRef.current = true; });
        if (Object.keys(cmiData).length > 0) api.loadFromJSON(cmiData as Record<string, unknown>);
        (window as unknown as { API?: unknown }).API = api;
        (window as unknown as { API_1484_11?: unknown }).API_1484_11 = undefined;
      }
      apiInitialized.current = lessonId;
    },
    [courseId]
  );

  useEffect(() => {
    if (!courseId) return;

    (async () => {
      try {
        const [structRes, progressAllRes] = await Promise.all([
          fetch(`/api/portal/scorm/course-structure?courseId=${encodeURIComponent(courseId)}`),
          fetch(`/api/portal/scorm/progress/all?courseId=${encodeURIComponent(courseId)}`),
        ]);

        if (!structRes.ok) {
          setError('Курс не найден или контент не загружен');
          return;
        }

        const structData = (await structRes.json()) as {
          items: StructureItem[];
          isMultiSco: boolean;
          scormVersion: string;
          noScormContent?: boolean;
          aiTutorEnabled?: boolean;
        };
        if (structData.noScormContent) {
          setError('У этого курса пока нет загруженного SCORM-контента. Загрузите пакет в разделе Админка → Курсы.');
          return;
        }
        setStructure(structData);

        const progressData = progressAllRes.ok
          ? ((await progressAllRes.json()) as { progress: ProgressItem[] })
          : { progress: [] };
        const byLesson: Record<string, ProgressItem> = {};
        for (const p of progressData.progress) {
          byLesson[p.lesson_id] = p;
        }
        setProgressByLesson(byLesson);

        const items = structData.items;
        const firstId = items[0]?.identifier ?? 'main';
        setCurrentLessonId(firstId);

        const progressRes = await fetch(
          `/api/portal/scorm/progress?courseId=${encodeURIComponent(courseId)}&lessonId=${encodeURIComponent(firstId)}`
        );
        const cmiData = progressRes.ok
          ? ((await progressRes.json()) as { cmi_data?: Record<string, unknown> }).cmi_data ?? {}
          : {};

        const urlRes = await fetch(
          `/api/portal/scorm/url?courseId=${encodeURIComponent(courseId)}&lessonId=${encodeURIComponent(firstId)}`
        );
        const urlData = (await urlRes.json()) as { url?: string };
        const url = urlData.url ?? items[0]?.url;

        await initApiForLesson(firstId, url, structData.scormVersion, cmiData);
        setScormUrl(url);
      } catch (e) {
        console.error('SCORM init error:', e);
        setError('Ошибка инициализации плеера');
      }
    })();
  }, [courseId, initApiForLesson]);

  const handleSelectLesson = useCallback(
    async (lessonId: string) => {
      if (!structure || lessonId === currentLessonId) return;

      if (fallbackModeRef.current && currentLessonId) {
        await saveFallbackProgress(currentLessonId, 'completed');
      }

      setCurrentLessonId(lessonId);
      const item = structure.items.find((i) => i.identifier === lessonId);
      const url =
        item?.url ??
        `${typeof window !== 'undefined' ? window.location.origin : ''}/api/portal/scorm/url?courseId=${courseId}&lessonId=${lessonId}`;

      const progressRes = await fetch(
        `/api/portal/scorm/progress?courseId=${encodeURIComponent(courseId)}&lessonId=${encodeURIComponent(lessonId)}`
      );
      const cmiData = progressRes.ok
        ? ((await progressRes.json()) as { cmi_data?: Record<string, unknown> }).cmi_data ?? {}
        : {};

      let resolvedUrl = url;
      if (!item?.url) {
        const urlRes = await fetch(
          `/api/portal/scorm/url?courseId=${encodeURIComponent(courseId)}&lessonId=${encodeURIComponent(lessonId)}`
        );
        const data = (await urlRes.json()) as { url?: string };
        resolvedUrl = data.url ?? url;
      }

      await initApiForLesson(lessonId, resolvedUrl, structure.scormVersion, cmiData);
      setScormUrl(resolvedUrl);
    },
    [courseId, structure, currentLessonId, initApiForLesson, saveFallbackProgress]
  );

  useEffect(() => {
    if (!structure || !scormUrl || !currentLessonId) return;
    const t = setTimeout(() => {
      if (!scormInitializedRef.current) {
        fallbackModeRef.current = true;
        console.log('[SCORM] non-SCORM content detected, using fallback tracking', { courseId, lessonId: currentLessonId });
        void saveFallbackProgress(currentLessonId, 'incomplete');
      }
    }, 10000);
    return () => clearTimeout(t);
  }, [structure, scormUrl, currentLessonId, courseId, saveFallbackProgress]);

  useEffect(() => {
    currentLessonIdRef.current = currentLessonId;
  }, [currentLessonId]);

  useEffect(() => {
    if (!structure || !scormUrl) return;
    const saveOnExit = () => {
      const lid = currentLessonIdRef.current;
      if (fallbackModeRef.current && lid) {
        void saveFallbackProgress(lid, 'completed');
      }
    };
    const handleBeforeUnload = saveOnExit;
    const handlePageHide = saveOnExit;
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      saveOnExit();
    };
  }, [structure, scormUrl, saveFallbackProgress]);

  useEffect(() => {
    if (!structure || !scormUrl) return;
    const t = setInterval(refreshProgress, 45000);
    return () => clearInterval(t);
  }, [structure, scormUrl, refreshProgress]);

  const isCompleted = (status: string | null | undefined) =>
    status === 'completed' || status === 'passed';

  const navItems: ScoItem[] =
    structure?.items.map((it) => {
      const p = progressByLesson[it.identifier];
      let status: ScoStatus = 'not_started';
      if (p && isCompleted(p.completion_status)) status = 'completed';
      else if (it.identifier === currentLessonId || p) status = 'in_progress';
      return { ...it, status };
    }) ?? [];

  const completedCount = Object.values(progressByLesson).filter((p) =>
    isCompleted(p.completion_status)
  ).length;
  const totalCount = structure?.items.length ?? 1;

  if (error) {
    const isNoScorm = error.includes('нет загруженного SCORM');
    return (
      <div className="p-6">
        <p className="text-[var(--portal-text-muted)]">{error}</p>
        <div className="mt-4 flex flex-wrap gap-4">
          <Link
            href={`/portal/student/courses/${courseId}`}
            className="inline-block text-[var(--portal-accent)] hover:underline"
          >
            ← Назад к курсу
          </Link>
          {isNoScorm && (
            <Link
              href={`/portal/admin/courses/${courseId}`}
              className="inline-block text-[var(--portal-accent)] hover:underline"
            >
              Админка → загрузить SCORM
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (!structure || !scormUrl) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-[var(--portal-text-muted)]">Загрузка плеера…</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-4">
        <div className="flex items-center gap-4">
          <Link
            href={`/portal/student/courses/${courseId}`}
            className="text-sm font-medium text-[var(--portal-accent)] hover:underline"
          >
            ← Выход из курса
          </Link>
          {structure.isMultiSco && (
            <ScormProgressBar
              completedCount={completedCount}
              totalCount={totalCount}
            />
          )}
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        {structure.isMultiSco && navItems.length > 0 && (
          <ScormNavigation
            items={navItems}
            currentLessonId={currentLessonId}
            onSelect={handleSelectLesson}
          />
        )}
        <iframe
          ref={iframeRef}
          key={scormUrl}
          title="SCORM курс"
          src={scormUrl}
          className="flex-1 w-full border-0 min-h-0"
          allow="fullscreen"
          allowFullScreen
        />
      </div>
      {structure?.aiTutorEnabled !== false && (
        <CourseAIChat courseId={courseId} lessonId={currentLessonId ?? undefined} />
      )}
    </div>
  );
}
