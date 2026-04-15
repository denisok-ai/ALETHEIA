'use client';

import { PageHeader } from '@/components/portal/PageHeader';
import { Award, Calendar } from 'lucide-react';
import { PORTAL_PATH } from '@/lib/portal-paths';
import { CertificateDownload } from './CertificateDownload';

export type StudentCertificateRow = {
  id: string;
  certNumber: string;
  courseTitle: string;
  issuedAt: string;
  allowDownload: boolean;
};

export function StudentCertificatesView({ items }: { items: StudentCertificateRow[] }) {
  return (
    <div className="w-full space-y-6">
      <PageHeader
        items={[{ href: PORTAL_PATH.studentDashboard, label: 'Дашборд' }, { label: 'Сертификаты' }]}
        title="Мои сертификаты"
        description="Документы о прохождении курсов"
      />

      {items.length === 0 ? (
        <div className="portal-card p-8 md:p-12 text-center">
          <Award className="h-12 w-12 mx-auto mb-4 text-[var(--portal-text-soft)]" aria-hidden />
          <h2 className="text-lg font-semibold text-[var(--portal-text)]">Пока нет сертификатов</h2>
          <p className="mt-2 text-sm text-[var(--portal-text-muted)] max-w-md mx-auto">
            Завершите курс на 100%, чтобы автоматически получить сертификат.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
          {items.map((c) => (
            <li
              key={c.id}
              className="portal-card flex flex-col sm:flex-row xl:flex-col xl:items-stretch gap-4 p-4 md:p-5
                hover:shadow-[var(--portal-shadow)] transition-shadow min-w-0"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--portal-accent-soft)] text-[var(--portal-accent-dark)]">
                  <Award className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--portal-text)] truncate" title={c.courseTitle}>
                    {c.courseTitle}
                  </p>
                  <p className="text-sm text-[var(--portal-text-muted)]">№ {c.certNumber}</p>
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-[var(--portal-text-soft)]">
                    <Calendar className="h-3 w-3 shrink-0" aria-hidden />
                    {new Date(c.issuedAt).toLocaleDateString('ru', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              </div>
              <div className="shrink-0 border-t border-[#E2E8F0] pt-4 sm:border-t-0 sm:pt-0 xl:border-t xl:pt-4">
                <CertificateDownload certId={c.id} allowDownload={c.allowDownload} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
