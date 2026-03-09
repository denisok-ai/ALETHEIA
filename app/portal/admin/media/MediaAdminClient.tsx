'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface MediaItem {
  id: string;
  title: string;
  file_url: string;
  mime_type: string | null;
  category: string | null;
  created_at: string;
}

export function MediaAdminClient({ initialItems }: { initialItems: MediaItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (title.trim()) fd.append('title', title.trim());
      if (category.trim()) fd.append('category', category.trim());
      const res = await fetch('/api/portal/admin/media/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Ошибка загрузки');
      if (data.media) {
        setItems((prev) => [data.media, ...prev]);
        setTitle('');
        setCategory('');
        setFile(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
    setUploading(false);
  }

  return (
    <div className="mt-6 space-y-6">
      <form onSubmit={handleUpload} className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-lg font-semibold text-dark">Загрузить файл</h2>
        <div className="mt-4 flex flex-wrap gap-4">
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="media-file">Файл *</Label>
            <Input
              id="media-file"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
              className="mt-1"
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="media-title">Название</Label>
            <Input
              id="media-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название"
              className="mt-1"
            />
          </div>
          <div className="min-w-[120px]">
            <Label htmlFor="media-category">Категория</Label>
            <Input
              id="media-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="video, pdf, image"
              className="mt-1"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={uploading || !file}>
              {uploading ? 'Загрузка…' : 'Загрузить'}
            </Button>
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-soft">
              <th className="px-4 py-3 font-medium text-dark">Название</th>
              <th className="px-4 py-3 font-medium text-dark">Категория</th>
              <th className="px-4 py-3 font-medium text-dark">Тип</th>
              <th className="px-4 py-3 font-medium text-dark">Ссылка</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="border-b border-border hover:bg-bg-cream">
                <td className="px-4 py-3 font-medium text-dark">{m.title}</td>
                <td className="px-4 py-3 text-text-muted">{m.category ?? '—'}</td>
                <td className="px-4 py-3 text-text-muted">{m.mime_type ?? '—'}</td>
                <td className="px-4 py-3">
                  <a
                    href={m.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Открыть
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length === 0 && (
        <p className="mt-4 text-center text-text-muted">Нет файлов. Загрузите файл выше.</p>
      )}
    </div>
  );
}
