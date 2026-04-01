'use client';

/**
 * Форма создания/редактирования шаблона уведомления (name, subject, body, type).
 */
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/portal/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';

interface TemplateFormProps {
  templateId?: string | null;
}

export function NotificationTemplateForm({ templateId }: TemplateFormProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<'internal' | 'email' | 'both'>('both');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const initialLoaded = useRef(false);
  const [initial, setInitial] = useState({ name: '', subject: '', body: '', type: 'both' as const });

  useEffect(() => {
    if (!templateId) {
      initialLoaded.current = true;
      return;
    }
    setLoading(true);
    fetch(`/api/portal/admin/notification-templates/${templateId}`)
      .then((r) => r.json())
      .then((d) => {
        const n = d.name ?? '';
        const s = d.subject ?? '';
        const b = d.body ?? '';
        const t = d.type && ['internal', 'email', 'both'].includes(d.type) ? d.type : 'both';
        setName(n);
        setSubject(s);
        setBody(b);
        setType(t);
        setInitial({ name: n, subject: s, body: b, type: t });
        initialLoaded.current = true;
      })
      .finally(() => setLoading(false));
  }, [templateId]);

  const isDirty =
    initialLoaded.current &&
    (name !== initial.name || subject !== initial.subject || body !== initial.body || type !== initial.type);
  useUnsavedChanges(isDirty);

  function goToList() {
    if (isDirty) {
      setLeaveConfirm(true);
    } else {
      router.push('/portal/admin/notification-templates');
    }
  }

  function confirmLeave() {
    setLeaveConfirm(false);
    router.push('/portal/admin/notification-templates');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { name: name.trim(), subject: subject.trim() || null, body, type };
      const url = templateId
        ? `/api/portal/admin/notification-templates/${templateId}`
        : '/api/portal/admin/notification-templates';
      const method = templateId ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        const d = await r.json();
        if (templateId) {
          router.refresh();
        } else {
          router.push(`/portal/admin/notification-templates/${d.id}`);
          router.refresh();
        }
      } else {
        const err = await r.json();
        alert(err.error || 'Ошибка сохранения');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!templateId) return;
    const r = await fetch(`/api/portal/admin/notification-templates/${templateId}`, { method: 'DELETE' });
    if (r.ok) {
      router.push('/portal/admin/notification-templates');
      router.refresh();
    } else {
      const d = await r.json();
      alert(d.error || 'Ошибка удаления');
    }
    setDeleteConfirm(false);
  }

  async function handleAiGenerate() {
    const templateName = name.trim() || 'Шаблон уведомления';
    setGenerating(true);
    try {
      const r = await fetch('/api/portal/admin/ai-settings/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: `Сгенерируй тему и текст уведомления для шаблона «${templateName}», канал: ${type}. Используй плейсхолдеры %recfirstname%, %reclastname%, %date%, %systemtitle%, %objectname% где уместно. Ответь строго в формате:\nТема:\n...\n\nТекст:\n...`,
          systemPrompt: 'Ты помогаешь писать шаблоны уведомлений для школы AVATERRA. Отвечай только в формате: блок Тема, затем блок Текст. Без пояснений.',
          maxTokens: 1024,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Ошибка');
      const content = data.content ?? '';
      const themeMatch = content.match(/Тема:\s*\n?([\s\S]*?)(?=\n\nТекст:|$)/i);
      const bodyMatch = content.match(/Текст:\s*\n?([\s\S]*)/i);
      if (themeMatch?.[1]) setSubject(themeMatch[1].trim());
      if (bodyMatch?.[1]) setBody(bodyMatch[1].trim());
      if (content && !themeMatch?.[1] && !bodyMatch?.[1]) setBody(content);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка генерации');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="nt-name">Название</Label>
          <Input
            id="nt-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: Запись на курс"
            required
            className="mt-1"
          />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <Label htmlFor="nt-subject" className="mb-0">Тема (для email)</Label>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={handleAiGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span className="ml-1">{generating ? 'Генерация…' : 'AI сгенерировать'}</span>
            </Button>
          </div>
          <Input
            id="nt-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Тема письма"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="nt-type">Канал</Label>
          <select
            id="nt-type"
            value={type}
            onChange={(e) => setType(e.target.value as 'internal' | 'email' | 'both')}
            className="mt-1 block w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--portal-accent)]"
          >
            <option value="both">Лента и email</option>
            <option value="internal">Только в ленте</option>
            <option value="email">Только email</option>
          </select>
        </div>
        <div>
          <Label htmlFor="nt-body">Текст (тело). Плейсхолдеры: %recfirstname%, %reclastname%, %date%, %systemtitle%, %objectname%</Label>
          <textarea
            id="nt-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            required
            className="mt-1 block w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--portal-accent)] font-mono"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={loading}>
            {templateId ? 'Сохранить' : 'Создать'}
          </Button>
          <Button type="button" variant="secondary" onClick={goToList}>
            <ArrowLeft className="h-4 w-4" />
            К списку
          </Button>
          {templateId && (
            <Button
              type="button"
              variant="secondary"
              className="text-red-600 hover:text-red-700"
              onClick={() => setDeleteConfirm(true)}
            >
              Удалить
            </Button>
          )}
        </div>
      </form>
      <ConfirmDialog
        open={deleteConfirm}
        onOpenChange={setDeleteConfirm}
        title="Удалить шаблон?"
        description="Шаблон будет удалён. Если он привязан к наборам уведомлений, удаление будет недоступно."
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={leaveConfirm}
        onOpenChange={setLeaveConfirm}
        title="Есть несохранённые изменения"
        description="Уйти без сохранения? Изменения будут потеряны."
        confirmLabel="Уйти"
        variant="danger"
        onConfirm={confirmLeave}
      />
    </Card>
  );
}
