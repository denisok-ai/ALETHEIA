/**
 * Student: earned certificates — redesigned.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';

export const metadata: Metadata = { title: 'Сертификаты' };

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { CertificateDownload } from './CertificateDownload';
import { Award, Calendar } from 'lucide-react';

export default async function StudentCertificatesPage() {
  const session = await getServerSession(authOptions);
  const userId  = (session?.user as { id?: string })?.id;

  if (!userId) {
    return (
      <div className="portal-card p-6">
        <p className="text-[var(--portal-text-muted)]">Загрузка…</p>
      </div>
    );
  }

  const list = await prisma.certificate.findMany({
    where: { userId, revokedAt: null },
    include: {
      course:   { select: { title: true } },
      template: { select: { allowUserDownload: true } },
    },
    orderBy: { issuedAt: 'desc' },
  });

  return (
    <div className="w-full space-y-6">
      <PageHeader
        items={[{ href: '/portal/student/dashboard', label: 'Дашборд' }, { label: 'Сертификаты' }]}
        title="Мои сертификаты"
        description="Документы о прохождении курсов"
      />

      {list.length === 0 ? (
        <div className="portal-card p-8 md:p-12 text-center">
          <Award className="h-12 w-12 mx-auto mb-4 text-[var(--portal-text-soft)]" />
          <h2 className="text-lg font-semibold text-[var(--portal-text)]">Пока нет сертификатов</h2>
          <p className="mt-2 text-sm text-[var(--portal-text-muted)] max-w-md mx-auto">
            Завершите курс на 100%, чтобы автоматически получить сертификат.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
          {list.map((c) => (
            <li
              key={c.id}
              className="portal-card flex flex-col sm:flex-row xl:flex-col xl:items-stretch gap-4 p-4 md:p-5
                hover:shadow-[var(--portal-shadow)] transition-shadow min-w-0"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--portal-accent-soft)] text-[var(--portal-accent-dark)]">
                  <Award className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--portal-text)] truncate" title={c.course?.title ?? 'Курс'}>
                    {c.course?.title ?? 'Курс'}
                  </p>
                  <p className="text-sm text-[var(--portal-text-muted)]">№ {c.certNumber}</p>
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-[var(--portal-text-soft)]">
                    <Calendar className="h-3 w-3 shrink-0" />
                    {new Date(c.issuedAt).toLocaleDateString('ru', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </div>
                </div>
              </div>
              <div className="shrink-0 border-t border-[#E2E8F0] pt-4 sm:border-t-0 sm:pt-0 xl:border-t xl:pt-4">
                <CertificateDownload
                  certId={c.id}
                  allowDownload={c.template?.allowUserDownload !== false}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
