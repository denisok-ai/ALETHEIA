'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Download, ArrowLeft } from 'lucide-react';
import { isPlaceholderOrExampleUrl } from '@/lib/placeholder-url';
import MediaViewerLazy from '@/components/portal/media/MediaViewerLazy';

type MediaRecord = {
  id: string;
  title: string;
  fileUrl: string;
  mimeType: string | null;
  allowDownload: boolean;
  type: string;
  thumbnailUrl?: string | null;
};

export function MediaViewClient({
  mediaId,
  media,
}: {
  mediaId: string;
  media: MediaRecord;
}) {
  const router = useRouter();
  const [viewRecord, setViewRecord] = useState<{
    file_url: string;
    mime_type: string | null;
    allow_download: boolean;
    thumbnail_url?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/portal/media/${mediaId}/view`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setViewRecord(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mediaId]);

  const src = viewRecord?.file_url ?? media.fileUrl;
  const mime = viewRecord?.mime_type ?? media.mimeType ?? '';
  const allowDownload = viewRecord?.allow_download ?? media.allowDownload;
  const poster = viewRecord?.thumbnail_url ?? media.thumbnailUrl ?? null;
  const isPlaceholder = isPlaceholderOrExampleUrl(src);

  if (loading) {
    return (
      <div className="portal-card p-10 text-center">
        <p className="text-sm text-[var(--portal-text-muted)]">Загрузка…</p>
      </div>
    );
  }

  const downloadUrl = src.startsWith('http') ? src : typeof window !== 'undefined' ? window.location.origin + src : src;

  return (
    <div className="space-y-4">
      <div className="portal-card p-4">
        <MediaViewerLazy title={media.title} src={src} mimeType={mime} poster={poster} />
      </div>

      <div className="flex flex-wrap gap-2">
        {allowDownload && !isPlaceholder && (
          <a
            href={downloadUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: 'primary', size: 'sm' }))}
          >
            <Download className="h-4 w-4 mr-2" /> Скачать
          </a>
        )}
        <Button variant="ghost" size="sm" onClick={() => router.push('/portal/student/media')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> К списку медиатеки
        </Button>
      </div>
    </div>
  );
}
