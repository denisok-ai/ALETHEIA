'use client';

/**
 * Admin courses: table + create form + SCORM upload.
 */
import { useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Course {
  id: string;
  title: string;
  description: string | null;
  scorm_path: string | null;
  thumbnail_url: string | null;
  status: string;
  price: number | null;
  created_at: string;
}

export function CoursesAdminClient({ initialCourses }: { initialCourses: Course[] }) {
  const [courses, setCourses] = useState(initialCourses);
  const [showCreate, setShowCreate] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/portal/admin/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc || null,
          price: newPrice ? parseInt(newPrice, 10) : null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setCourses((prev) => [{ ...data.course, id: data.course.id }, ...prev]);
      setShowCreate(false);
      setNewTitle('');
      setNewDesc('');
      setNewPrice('');
    } catch (err) {
      console.error(err);
    }
    setCreating(false);
  }

  async function handleUpload(courseId: string, file: File) {
    setUploading(courseId);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('courseId', courseId);
      const res = await fetch('/api/portal/admin/courses/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error(await res.text());
      setCourses((prev) =>
        prev.map((c) =>
          c.id === courseId ? { ...c, scorm_path: `courses/${courseId}/index.html` } : c
        )
      );
    } catch (err) {
      console.error(err);
    }
    setUploading(null);
  }

  return (
    <div className="mt-6">
      <div className="mb-4 flex gap-2">
        <Button onClick={() => setShowCreate((v) => !v)} variant="secondary">
          <Plus className="mr-2 h-4 w-4" />
          Создать курс
        </Button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-xl border border-border bg-white p-6"
        >
          <h2 className="text-lg font-semibold text-dark">Новый курс</h2>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="title">Название</Label>
              <Input
                id="title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="desc">Описание</Label>
              <textarea
                id="desc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-4 py-2"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="price">Цена (₽)</Label>
              <Input
                id="price"
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={creating}>
                {creating ? 'Создание…' : 'Создать'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                Отмена
              </Button>
            </div>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-soft">
              <th className="px-4 py-3 font-medium text-dark">Название</th>
              <th className="px-4 py-3 font-medium text-dark">Статус</th>
              <th className="px-4 py-3 font-medium text-dark">Цена</th>
              <th className="px-4 py-3 font-medium text-dark">SCORM</th>
              <th className="px-4 py-3 font-medium text-dark">Действия</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id} className="border-b border-border hover:bg-bg-cream">
                <td className="px-4 py-3">
                  <span className="font-medium text-dark">{c.title}</span>
                </td>
                <td className="px-4 py-3 text-text-muted">{c.status}</td>
                <td className="px-4 py-3 text-text-muted">{c.price != null ? `${c.price} ₽` : '—'}</td>
                <td className="px-4 py-3 text-text-muted">{c.scorm_path ? 'Загружен' : '—'}</td>
                <td className="px-4 py-3">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".zip"
                      className="hidden"
                      disabled={!!uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(c.id, f);
                        e.target.value = '';
                      }}
                    />
                    <span className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-bg-soft">
                      <Upload className="h-3 w-3" />
                      {uploading === c.id ? 'Загрузка…' : 'Загрузить ZIP'}
                    </span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {courses.length === 0 && (
        <p className="mt-4 text-center text-text-muted">Нет курсов. Создайте первый.</p>
      )}
    </div>
  );
}
