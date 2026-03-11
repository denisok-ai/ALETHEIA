'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CourseAdminClient({
  courseId,
  courseTitle,
  hasScorm,
}: {
  courseId: string;
  courseTitle: string;
  hasScorm: boolean;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleReupload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('courseId', courseId);
      const res = await fetch('/api/portal/admin/courses/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error(await res.text());
      toast.success('SCORM-пакет загружен заново');
      window.location.reload();
    } catch (err) {
      console.error(err);
      toast.error('Ошибка загрузки');
    }
    setUploading(false);
    e.target.value = '';
  }

  return (
    <label className="cursor-pointer">
      <input
        type="file"
        accept=".zip"
        className="hidden"
        disabled={uploading}
        onChange={handleReupload}
      />
      <Button type="button" variant="secondary">
        <span className="inline-flex items-center">
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? 'Загрузка…' : hasScorm ? 'Заменить SCORM ZIP' : 'Загрузить SCORM ZIP'}
        </span>
      </Button>
    </label>
  );
}
