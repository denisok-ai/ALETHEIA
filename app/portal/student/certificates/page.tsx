/**
 * Student: list of earned certificates.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Breadcrumbs } from '@/components/portal/Breadcrumbs';
import { CertificateDownload } from './CertificateDownload';

export default async function StudentCertificatesPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Сертификаты</h1>
        <p className="mt-2 text-text-muted">Загрузка…</p>
      </div>
    );
  }

  const list = await prisma.certificate.findMany({
    where: { userId },
    include: {
      course: { select: { title: true } },
      template: { select: { allowUserDownload: true } },
    },
    orderBy: { issuedAt: 'desc' },
  });

  return (
    <div>
      <Breadcrumbs items={[{ href: '/portal/student/dashboard', label: 'Дашборд' }, { label: 'Сертификаты' }]} />
      <h1 className="mt-2 font-heading text-2xl font-bold text-dark">Сертификаты</h1>
      <p className="mt-1 text-text-muted">Выданные сертификаты после прохождения курсов</p>

      {list.length === 0 ? (
        <p className="mt-6 text-text-muted">Пока нет сертификатов. Завершите курс на 100%, чтобы получить сертификат.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {list.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-white p-4">
              <div>
                <p className="font-medium text-dark">{c.course?.title ?? 'Курс'}</p>
                <p className="text-sm text-text-muted">№ {c.certNumber}</p>
                <time className="text-xs text-text-soft">{new Date(c.issuedAt).toLocaleDateString('ru')}</time>
              </div>
              <CertificateDownload certId={c.id} allowDownload={c.template?.allowUserDownload !== false} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
