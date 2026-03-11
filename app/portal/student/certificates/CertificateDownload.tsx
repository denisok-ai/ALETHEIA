'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { CERTIFICATE_TEMPLATE_LABELS, type CertificateTemplateId } from '@/lib/certificates-constants';

const TEMPLATES: CertificateTemplateId[] = ['default', 'minimal', 'elegant'];

export function CertificateDownload({ certId, allowDownload = true }: { certId: string; allowDownload?: boolean }) {
  const [template, setTemplate] = useState<CertificateTemplateId>('default');
  const url = `/api/portal/certificates/${certId}/download${template !== 'default' ? `?template=${template}` : ''}`;

  if (!allowDownload) {
    return <span className="text-sm text-text-muted">Электронная версия доступна только в реестре</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={template}
        onChange={(e) => setTemplate(e.target.value as CertificateTemplateId)}
        className="rounded-lg border border-border bg-white px-2 py-1.5 text-sm text-dark"
        aria-label="Шаблон сертификата"
      >
        {TEMPLATES.map((t) => (
          <option key={t} value={t}>{CERTIFICATE_TEMPLATE_LABELS[t]}</option>
        ))}
      </select>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Button size="sm" className="bg-primary text-white hover:bg-primary/90">
          <Download className="mr-1.5 h-4 w-4" /> Скачать PDF
        </Button>
      </a>
    </div>
  );
}
