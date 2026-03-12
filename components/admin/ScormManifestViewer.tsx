'use client';

import { FileText, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ManifestItem {
  identifier: string;
  title?: string;
  href?: string;
  resourceId?: string;
}

export interface ScormManifestViewerProps {
  /** JSON string from Course.scormManifest */
  scormManifest: string | null;
  /** Optional: version "1.2" | "2004" */
  scormVersion?: string | null;
  className?: string;
}

export function ScormManifestViewer({
  scormManifest,
  scormVersion,
  className,
}: ScormManifestViewerProps) {
  if (!scormManifest?.trim()) {
    return (
      <div className={cn('rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-sm text-[var(--portal-text-muted)]', className)}>
        Манифест не загружен (загрузите SCORM ZIP с imsmanifest.xml).
      </div>
    );
  }

  let version: string | undefined;
  let title: string | undefined;
  let items: ManifestItem[] = [];

  try {
    const parsed = JSON.parse(scormManifest) as {
      version?: string;
      title?: string;
      items?: ManifestItem[];
    };
    version = parsed.version ?? scormVersion ?? undefined;
    title = parsed.title;
    items = parsed.items ?? [];
  } catch {
    return (
      <div className={cn('rounded-lg border border-[#E2E8F0] bg-[#FEF2F2] p-4 text-sm text-red-600', className)}>
        Ошибка разбора манифеста.
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border border-[#E2E8F0] bg-white p-4', className)}>
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--portal-text)]">
        <FolderOpen className="h-4 w-4 text-[#6366F1]" />
        Структура курса
        {version && (
          <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-xs text-[var(--portal-text-muted)]">
            SCORM {version}
          </span>
        )}
      </div>
      {title && <p className="mb-2 text-sm text-[var(--portal-text-muted)]">{title}</p>}
      <ul className="space-y-1">
        {items.length === 0 ? (
          <li className="text-sm text-[var(--portal-text-muted)]">Один SCO (без разбивки)</li>
        ) : (
          items.map((it) => (
            <li
              key={it.identifier}
              className="flex items-center gap-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm"
            >
              <FileText className="h-4 w-4 shrink-0 text-[var(--portal-text-muted)]" />
              <div className="min-w-0 flex-1">
                <span className="font-medium text-[var(--portal-text)]">{it.title || it.identifier}</span>
                {it.href && (
                  <p className="truncate text-xs text-[var(--portal-text-muted)]">{it.href}</p>
                )}
              </div>
              <code className="shrink-0 text-xs text-[var(--portal-text-muted)]">{it.identifier}</code>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
