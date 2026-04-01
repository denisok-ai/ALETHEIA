'use client';

/**
 * Блок версий SCORM-пакета: таблица версий, активация, загрузка новой версии.
 */
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { Upload, Check, Loader2, Package, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/ui/EmptyState';

type ScormVersionRow = {
  id: string;
  version: number;
  scormPath: string;
  scormVersion: string | null;
  fileSize: number | null;
  notes: string | null;
  isActive: boolean;
  uploadedById: string | null;
  createdAt: string;
};

function formatSize(bytes: number | null): string {
  if (bytes == null || bytes === 0) return '—';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${bytes} Б`;
}

export function ScormVersionsBlock({ courseId }: { courseId: string }) {
  const [versions, setVersions] = useState<ScormVersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/admin/courses/${courseId}/scorm-versions`);
      const raw = await res.text();
      if (!res.ok) {
        let msg = raw;
        try {
          const j = JSON.parse(raw) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          /* текст как есть */
        }
        if (res.status === 413) {
          msg = 'Файл слишком большой для сервера (nginx). Нужно увеличить client_max_body_size.';
        }
        throw new Error(msg || `Ошибка ${res.status}`);
      }
      const data = JSON.parse(raw) as { versions: ScormVersionRow[] };
      setVersions(data.versions ?? []);
    } catch (e) {
      console.error(e);
      toast.error('Ошибка загрузки версий');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [courseId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('courseId', courseId);
      const res = await fetch('/api/portal/admin/courses/upload', { method: 'POST', body: form });
      let data: { success?: boolean; error?: string };
      try {
        data = (await res.json()) as { success?: boolean; error?: string };
      } catch {
        throw new Error(res.ok ? 'Неверный ответ сервера' : `Ошибка ${res.status}`);
      }
      if (!res.ok) throw new Error(data.error ?? `Ошибка ${res.status}`);
      toast.success('SCORM-пакет загружен');
      load();
      window.location.reload();
    } catch (err) {
      console.error('SCORM upload error:', err);
      const m = err instanceof Error ? err.message : 'Ошибка загрузки SCORM';
      toast.error(
        m.includes('413') || /too large|body/i.test(m)
          ? 'Архив слишком большой: на сервере nginx нужен client_max_body_size (например 512m).'
          : m
      );
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleActivate(versionId: string) {
    setActivating(versionId);
    try {
      const res = await fetch(`/api/portal/admin/courses/${courseId}/scorm-versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Ошибка');
      toast.success('Версия активирована');
      load();
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка активации');
    } finally {
      setActivating(null);
    }
  }

  if (loading) {
    return (
      <div className="portal-card p-4">
        <div className="flex items-center gap-2 text-[var(--portal-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загрузка версий…
        </div>
      </div>
    );
  }

  return (
    <div id="course-scorm-versions" className="portal-card scroll-mt-24 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[var(--portal-text)]">Версии SCORM и загрузка ZIP</h2>
        <div className="flex items-center gap-2">
          {versions.length > 0 && (
            <Link href={`/portal/student/courses/${courseId}/play`} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="primary" size="sm" className="gap-1.5">
                <Play className="h-4 w-4" />
                Запустить плеер
              </Button>
            </Link>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip"
            className="sr-only"
            aria-hidden
            disabled={uploading}
            onChange={handleUpload}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {uploading ? 'Загрузка…' : versions.length > 0 ? 'Загрузить новую версию' : 'Загрузить SCORM ZIP'}
          </Button>
        </div>
      </div>
      <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
        Хранятся последние 5 версий. Выберите активную версию для отображения в плеере. Прогресс при просмотре не сохраняется.
      </p>

      {versions.length === 0 ? (
        <EmptyState
          className="mt-4"
          title="Нет SCORM-пакетов"
          description="Загрузите ZIP-архив с SCORM-курсом для отображения в плеере."
          icon={<Package className="h-10 w-10" />}
        />
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-[#E2E8F0]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Версия</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Размер</TableHead>
                <TableHead>SCORM</TableHead>
                <TableHead>Активна</TableHead>
                <TableHead className="w-32">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">v{v.version}</TableCell>
                  <TableCell className="text-[var(--portal-text-muted)] text-sm">
                    {format(new Date(v.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                  </TableCell>
                  <TableCell className="text-[var(--portal-text-muted)] text-sm">
                    {formatSize(v.fileSize)}
                  </TableCell>
                  <TableCell className="text-[var(--portal-text-muted)] text-sm">
                    {v.scormVersion ?? '—'}
                  </TableCell>
                  <TableCell>
                    {v.isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <Check className="h-3 w-3" />
                        Активна
                      </span>
                    ) : (
                      <span className="text-[var(--portal-text-muted)] text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {!v.isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={activating === v.id}
                        onClick={() => handleActivate(v.id)}
                      >
                        {activating === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Активировать'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
