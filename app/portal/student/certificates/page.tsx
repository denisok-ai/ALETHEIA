/**
 * Student: earned certificates — redesigned.
 */
import { getServerSession } from 'next-auth';
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
    where: { userId },
    include: {
      course:   { select: { title: true } },
      template: { select: { allowUserDownload: true } },
    },
    orderBy: { issuedAt: 'desc' },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        items={[{ href: '/portal/student/dashboard', label: 'Дашборд' }, { label: 'Сертификаты' }]}
        title="Мои сертификаты"
        description="Документы о прохождении курсов"
      />

      {list.length === 0 ? (
        <div className="portal-card p-10 text-center">
          <Award className="h-12 w-12 mx-auto mb-4 text-[var(--portal-text-soft)]" />
          <h2 className="text-lg font-semibold text-[var(--portal-text)]">Пока нет сертификатов</h2>
          <p className="mt-2 text-sm text-[var(--portal-text-muted)] max-w-sm mx-auto">
            Завершите курс на 100%, чтобы автоматически получить сертификат.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((c) => (
            <li
              key={c.id}
              className="portal-card flex flex-wrap items-center justify-between gap-4 p-5
                hover:shadow-[var(--portal-shadow)] transition-shadow"
            >
              <div className="flex items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl
                  bg-[#EEF2FF] text-[#4F46E5]">
                  <Award className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-[var(--portal-text)]">
                    {c.course?.title ?? 'Курс'}
                  </p>
                  <p className="text-sm text-[var(--portal-text-muted)]">№ {c.certNumber}</p>
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-[var(--portal-text-soft)]">
                    <Calendar className="h-3 w-3" />
                    {new Date(c.issuedAt).toLocaleDateString('ru', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                  </div>
                </div>
              </div>
              <CertificateDownload
                certId={c.id}
                allowDownload={c.template?.allowUserDownload !== false}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
