'use client';

/**
 * PDF preview: встроенный просмотр браузера через iframe (страницы, зум — средствами Chrome/Firefox/Edge).
 * Обходим react-pdf/pdfjs-dist: в Next.js dev их бандл с eval-source-map даёт Object.defineProperty on non-object.
 */
import { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';

type Props = {
  fileUrl: string;
  title: string;
};

function absolutePdfSrc(fileUrl: string) {
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) return fileUrl;
  if (typeof window === 'undefined') return fileUrl;
  const path = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
  return `${window.location.origin}${path}`;
}

export function MediaPdfPanel({ fileUrl, title }: Props) {
  const iframeSrc = useMemo(() => absolutePdfSrc(fileUrl), [fileUrl]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={iframeSrc}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#6366F1] hover:underline"
        >
          <ExternalLink className="h-4 w-4" />
          Открыть PDF в новой вкладке
        </a>
        <span className="text-xs text-[var(--portal-text-muted)]">
          Листание и масштаб — панель встроенного просмотрщика PDF в браузере
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-[#F1F5F9]">
        <iframe
          title={title}
          src={iframeSrc}
          className="h-[min(75vh,720px)] w-full border-0 bg-white"
        />
      </div>
    </div>
  );
}
