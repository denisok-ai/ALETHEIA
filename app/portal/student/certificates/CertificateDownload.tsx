'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import {
  CERTIFICATE_TEMPLATE_LABELS,
  CERTIFICATE_TEMPLATE_IDS_FOR_SELECT,
  type CertificateTemplateId,
} from '@/lib/certificates-constants';

export function CertificateDownload({ certId, allowDownload = true }: { certId: string; allowDownload?: boolean }) {
  const [template, setTemplate] = useState<CertificateTemplateId>('default');
  const url = `/api/portal/certificates/${certId}/download${template !== 'default' ? `?template=${template}` : ''}`;

  if (!allowDownload) {
    return <span className="text-sm text-[var(--portal-text-muted)]">Электронная версия доступна только в реестре</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={template}
        onChange={(e) => setTemplate(e.target.value as CertificateTemplateId)}
        className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-sm text-[var(--portal-text)] hover:bg-[#F8FAFC]"
        aria-label="Шаблон сертификата"
      >
        {CERTIFICATE_TEMPLATE_IDS_FOR_SELECT.map((t) => (
          <option key={t} value={t}>{CERTIFICATE_TEMPLATE_LABELS[t]}</option>
        ))}
      </select>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Button size="sm" className="bg-[var(--portal-accent)] text-white hover:bg-[var(--portal-accent-dark)]">
          <Download className="mr-1.5 h-4 w-4" /> Скачать PDF
        </Button>
      </a>
    </div>
  );
}
