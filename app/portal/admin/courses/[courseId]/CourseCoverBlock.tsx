'use client';

/**
 * Блок «Обложка курса»: превью, загрузка файла, AI-генерация.
 */
import { useState, useRef } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ImagePlus, Loader2, Sparkles } from 'lucide-react';

interface CourseCoverBlockProps {
  courseId: string;
  initialThumbnailUrl: string | null;
  onSaved?: (thumbnailUrl: string | null) => void;
}

export function CourseCoverBlock({
  courseId,
  initialThumbnailUrl,
  onSaved,
}: CourseCoverBlockProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState(initialThumbnailUrl ?? '');
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleGenerateCover() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/portal/admin/courses/${courseId}/cover/generate`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || res.statusText);
      }
      const data = (await res.json()) as { url: string };
      setThumbnailUrl(data.url);
      onSaved?.(data.url);
      toast.success('Обложка сгенерирована');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка генерации');
    } finally {
      setGenerating(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set('file', file);
      const res = await fetch(`/api/portal/admin/courses/${courseId}/cover`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || res.statusText);
      }
      const data = (await res.json()) as { url: string };
      setThumbnailUrl(data.url);
      onSaved?.(data.url);
      toast.success('Обложка загружена');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  const displayUrl = thumbnailUrl.trim() || null;
  const isExternalUrl = displayUrl?.startsWith('http://') || displayUrl?.startsWith('https://');

  return (
    <div className="portal-card p-4">
      <h2 className="text-base font-semibold text-[var(--portal-text)]">Обложка курса</h2>
      <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
        Изображение для карточки курса (превью). Загрузите файл или сгенерируйте с помощью AI.
      </p>
      <div className="mt-4 flex flex-wrap gap-6 items-start">
        <div className="flex-shrink-0">
          {displayUrl ? (
            <div className="relative w-40 h-24 rounded-lg border border-[#E2E8F0] overflow-hidden bg-[var(--portal-bg)]">
              {isExternalUrl ? (
                // Внешний URL: без настройки remotePatterns в next.config next/image не подходит
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayUrl}
                  alt="Обложка"
                  className="object-cover w-full h-full"
                />
              ) : (
                <Image
                  src={displayUrl}
                  alt="Обложка"
                  fill
                  className="object-cover"
                  sizes="160px"
                  unoptimized={displayUrl.startsWith('/uploads/')}
                />
              )}
            </div>
          ) : (
            <div className="w-40 h-24 rounded-lg border border-dashed border-[#E2E8F0] flex items-center justify-center bg-[var(--portal-bg)] text-[var(--portal-text-muted)]">
              <ImagePlus className="h-8 w-8" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || generating}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              <span className="ml-2">{uploading ? 'Загрузка…' : 'Загрузить файл'}</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleGenerateCover}
              disabled={uploading || generating}
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              <span className="ml-2">{generating ? 'Генерация…' : 'AI Сгенерировать обложку'}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
