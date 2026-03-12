'use client';

/**
 * Admin: certificates for this course — list, download, revoke.
 */
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Download, Ban } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

type CertRow = {
  id: string;
  certNumber: string;
  userId: string;
  userEmail: string | null;
  displayName: string | null;
  issuedAt: string;
  revokedAt: string | null;
};

export function CourseCertificatesBlock({
  courseId,
  courseTitle,
}: {
  courseId: string;
  courseTitle: string;
}) {
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState<CertRow | null>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchCerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/admin/certificates?courseId=${encodeURIComponent(courseId)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { certificates: CertRow[] };
      setCerts(data.certificates ?? []);
    } catch (e) {
      console.error(e);
      toast.error('Ошибка загрузки сертификатов');
    }
    setLoading(false);
  }, [courseId]);

  useEffect(() => {
    fetchCerts();
  }, [fetchCerts]);

  async function handleRevoke(c: CertRow) {
    setRevokeTarget(null);
    setRevoking(true);
    try {
      const res = await fetch(`/api/portal/admin/certificates/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revoked: true }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? 'Ошибка');
      }
      setCerts((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, revokedAt: new Date().toISOString() } : x))
      );
      toast.success('Сертификат аннулирован');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
    setRevoking(false);
  }

  const downloadUrl = (certId: string) => `/api/portal/admin/certificates/${certId}/download`;

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <h2 className="text-lg font-semibold text-[var(--portal-text)]">Сертификаты курса</h2>
      <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
        Список выданных сертификатов по курсу «{courseTitle}». Скачивание PDF и аннулирование.
      </p>

      {loading ? (
        <TableSkeleton rows={4} cols={5} className="mt-4" />
      ) : certs.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--portal-text-muted)]">По этому курсу сертификаты ещё не выданы.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Номер</TableHead>
                <TableHead>Пользователь</TableHead>
                <TableHead>Дата выдачи</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="w-[140px]">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certs.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.certNumber}</TableCell>
                  <TableCell>
                    <Link
                      href={`/portal/admin/users/${c.userId}`}
                      className="text-[#6366F1] hover:underline"
                    >
                      {c.displayName || c.userEmail || c.userId}
                    </Link>
                  </TableCell>
                  <TableCell className="text-[var(--portal-text-muted)]">
                    {format(new Date(c.issuedAt), 'dd.MM.yyyy HH:mm')}
                  </TableCell>
                  <TableCell>
                    {c.revokedAt ? (
                      <span className="text-red-600">Аннулирован</span>
                    ) : (
                      <span className="text-green-600">Активен</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <a
                        href={downloadUrl(c.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--portal-text-muted)] hover:bg-[#F1F5F9] hover:text-[#6366F1]"
                        title="Скачать PDF"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                      {!c.revokedAt && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          onClick={() => setRevokeTarget(c)}
                          aria-label="Аннулировать"
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Аннулировать сертификат?"
        description={
          revokeTarget
            ? `Сертификат №${revokeTarget.certNumber} будет аннулирован. Действие необратимо.`
            : ''
        }
        onConfirm={() => { if (revokeTarget) void handleRevoke(revokeTarget); }}
        confirmLabel="Аннулировать"
        variant="danger"
        loading={revoking}
      />
    </div>
  );
}
