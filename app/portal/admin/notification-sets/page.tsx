/**
 * Admin: каталог наборов уведомлений — список с переходом в карточку набора.
 */
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/portal/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { getNotificationSetEventLabel } from '@/lib/notification-set-events';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Bell, FileText } from 'lucide-react';

export default async function AdminNotificationSetsPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || role !== 'admin') {
    return (
      <div className="p-6">
        <p className="text-text-muted">Доступ запрещён.</p>
      </div>
    );
  }

  const sets = await prisma.notificationSet.findMany({
    orderBy: [{ eventType: 'asc' }, { name: 'asc' }],
    select: { id: true, eventType: true, name: true, isDefault: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'Наборы уведомлений' },
        ]}
        title="Наборы уведомлений"
        description="Каталог наборов для прикрепления к мероприятиям"
      />
      <Card title="Каталог" description="Наборы, отмеченные «По умолчанию», автоматически прикрепляются к новым курсам.">
        {sets.length === 0 ? (
          <EmptyState
            title="Нет наборов уведомлений"
            description="Наборы создаются через сид или миграции БД"
            icon={<Bell className="h-10 w-10" />}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">№</TableHead>
                  <TableHead>Тип события</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead className="w-24">По умолчанию</TableHead>
                  <TableHead className="w-28"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sets.map((s, idx) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-text-muted">{idx + 1}</TableCell>
                    <TableCell className="text-text-muted">
                      {getNotificationSetEventLabel(s.eventType)}
                    </TableCell>
                    <TableCell className="font-medium text-dark">
                      <Link
                        href={`/portal/admin/notification-sets/${s.id}`}
                        className="text-primary hover:underline"
                      >
                        {s.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-text-muted">{s.isDefault ? 'Да' : 'Нет'}</TableCell>
                    <TableCell>
                      <Link href={`/portal/admin/notification-sets/${s.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 gap-1">
                          <FileText className="h-4 w-4" />
                          Подробнее
                        </Button>
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
