'use client';

/**
 * Ссылки на демо-PDF встроенных макетов (админ, открывается в браузере).
 */
import { ExternalLink } from 'lucide-react';
import { CERTIFICATE_TEMPLATE_IDS, CERTIFICATE_TEMPLATE_LABELS } from '@/lib/certificates-constants';

export function CertificateLayoutPreviewLinks() {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
      <p className="text-sm font-semibold text-[var(--portal-text)]">Просмотр макетов PDF</p>
      <p className="mt-1 text-xs text-[var(--portal-text-muted)]">
        Демо-данные; открывается в новой вкладке (inline PDF). Встроенные макеты без подложки из медиатеки.
      </p>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {CERTIFICATE_TEMPLATE_IDS.map((id) => (
          <li key={id}>
            <a
              href={`/api/portal/admin/certificates/sample-preview?template=${encodeURIComponent(id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-[var(--portal-accent)] underline decoration-[var(--portal-accent)]/40 underline-offset-2 hover:decoration-[var(--portal-accent)]"
            >
              {CERTIFICATE_TEMPLATE_LABELS[id]}
              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
