/**
 * Admin: каталог шаблонов уведомлений — список с переходом в создание/редактирование.
 */
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/portal/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { LayoutTemplate, Plus } from 'lucide-react';

const TYPE_LABEL: Record<string, string> = {
  internal: 'Только в ленте',
  email: 'Только email',
  both: 'Лента и email',
};

export default async function AdminNotificationTemplatesPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || role !== 'admin') {
    return (
      <div className="p-6">
        <p className="text-text-muted">Доступ запрещён.</p>
      </div>
    );
  }

  const templates = await prisma.notificationTemplate.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, subject: true, type: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'Шаблоны уведомлений' },
        ]}
        title="Шаблоны уведомлений"
        description="Шаблоны тем и текстов для системных уведомлений (запись на курс, сертификат и т.д.). Плейсхолдеры: %recfirstname%, %reclastname%, %date%, %systemtitle%, %objectname%."
        actions={
          <Link
            href="/portal/admin/notification-templates/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-dark hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Добавить шаблон
          </Link>
        }
      />
      <Card>
        {templates.length === 0 ? (
          <EmptyState
            title="Нет шаблонов"
            description="Создайте шаблон для использования в наборах уведомлений."
            icon={<LayoutTemplate className="h-10 w-10" />}
            action={
              <Link href="/portal/admin/notification-templates/new">
                <Button>Добавить шаблон</Button>
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">№</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead>Тема (email)</TableHead>
                  <TableHead>Канал</TableHead>
                  <TableHead className="w-28"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t, idx) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-text-muted">{idx + 1}</TableCell>
                    <TableCell className="font-medium text-dark">
                      <Link href={`/portal/admin/notification-templates/${t.id}`} className="text-primary hover:underline">
                        {t.name}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-text-muted">{t.subject ?? '—'}</TableCell>
                    <TableCell className="text-text-muted">{TYPE_LABEL[t.type] ?? t.type}</TableCell>
                    <TableCell>
                      <Link href={`/portal/admin/notification-templates/${t.id}`}>
                        <Button variant="secondary" size="sm">Изменить</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
