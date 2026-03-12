'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Download, ArrowLeft } from 'lucide-react';

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv'];
const AUDIO_MIMES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'];
const PDF_MIMES = ['application/pdf'];

type MediaRecord = {
  id: string;
  title: string;
  fileUrl: string;
  mimeType: string | null;
  allowDownload: boolean;
  type: string;
};

export function MediaViewClient({
  mediaId,
  media,
}: {
  mediaId: string;
  media: MediaRecord;
}) {
  const router = useRouter();
  const [viewRecord, setViewRecord] = useState<{ file_url: string; mime_type: string | null; allow_download: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/portal/media/${mediaId}/view`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setViewRecord(data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mediaId]);

  const src = viewRecord?.file_url ?? media.fileUrl;
  const mime = viewRecord?.mime_type ?? media.mimeType ?? '';
  const allowDownload = viewRecord?.allow_download ?? media.allowDownload;

  const isImage = IMAGE_MIMES.includes(mime);
  const isVideo = mime.startsWith('video/');
  const isAudio = mime.startsWith('audio/');
  const isPdf = PDF_MIMES.includes(mime) || mime.includes('pdf');

  if (loading) {
    return (
      <div className="portal-card p-10 text-center">
        <p className="text-sm text-[var(--portal-text-muted)]">Загрузка…</p>
      </div>
    );
  }

  const downloadUrl = src.startsWith('http') ? src : (typeof window !== 'undefined' ? window.location.origin + src : src);

  return (
    <div className="space-y-4">
      <div className="portal-card p-4">
        {isImage && (
          // eslint-disable-next-line @next/next/no-img-element -- dynamic media URL
          <img src={src} alt={media.title} className="max-h-[70vh] w-full object-contain rounded-lg" />
        )}
        {isVideo && !isImage && (
          <video controls className="w-full max-h-[70vh] rounded-lg" src={src}>
            Ваш браузер не поддерживает видео.
          </video>
        )}
        {isAudio && !isVideo && (
          <audio controls className="w-full" src={src}>
            Ваш браузер не поддерживает аудио.
          </audio>
        )}
        {isPdf && !isVideo && !isAudio && (
          <iframe title={media.title} src={src} className="w-full h-[70vh] rounded-lg border border-[#E2E8F0]" />
        )}
        {!isImage && !isVideo && !isAudio && !isPdf && (
          <div className="space-y-3 py-4">
            <p className="text-sm text-[var(--portal-text-muted)]">Предпросмотр недоступен.</p>
            {allowDownload && (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#6366F1] hover:underline"
              >
                Открыть / Скачать
              </a>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {allowDownload && (
          <a href={downloadUrl} download target="_blank" rel="noopener noreferrer">
            <Button variant="primary" size="sm">
              <Download className="h-4 w-4 mr-2" /> Скачать
            </Button>
          </a>
        )}
        <Button variant="ghost" size="sm" onClick={() => router.push('/portal/student/media')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> К списку медиатеки
        </Button>
      </div>
    </div>
  );
}
