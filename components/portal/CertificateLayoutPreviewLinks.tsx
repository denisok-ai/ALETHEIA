'use client';

/**
 * Ссылки на готовые образцы PDF из public (прямые файлы, без авторизации).
 */
import { Download } from 'lucide-react';
import { CERTIFICATE_TEMPLATE_IDS, CERTIFICATE_TEMPLATE_LABELS } from '@/lib/certificates-constants';

export function CertificateLayoutPreviewLinks() {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
      <p className="text-sm font-semibold text-[var(--portal-text)]">Готовые PDF в проекте</p>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {CERTIFICATE_TEMPLATE_IDS.map((id) => (
          <li key={`static-${id}`}>
            <a
              href={`/certificates-samples/sample-${id}.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-[var(--portal-accent)] underline decoration-[var(--portal-accent)]/40 underline-offset-2 hover:decoration-[var(--portal-accent)]"
            >
              <Download className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              {CERTIFICATE_TEMPLATE_LABELS[id]}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
