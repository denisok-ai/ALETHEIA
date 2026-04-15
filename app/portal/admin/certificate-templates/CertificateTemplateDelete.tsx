'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/portal/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Trash2 } from 'lucide-react';

export function CertificateTemplateDelete({ templateId, templateName }: { templateId: string; templateName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const r = await fetch(`/api/portal/admin/certificate-templates/${templateId}`, { method: 'DELETE' });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? 'Ошибка');
      toast.success('Шаблон удалён');
      router.push('/portal/admin/certificate-templates');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
    setLoading(false);
    setOpen(false);
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-[var(--portal-text)]">Удалить шаблон</h3>
          <p className="text-sm text-[var(--portal-text-muted)]">Действие необратимо. Шаблон не должен использоваться в выданных сертификатах.</p>
        </div>
        <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
          <Trash2 className="h-4 w-4 mr-1" /> Удалить
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Удалить шаблон?"
        description={`Шаблон «${templateName}» будет удалён.`}
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={handleDelete}
        loading={loading}
      />
    </Card>
  );
}
