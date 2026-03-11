'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/portal/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Sparkles, Check, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

type Template = {
  id: string;
  name: string;
  content: string;
  isActive: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  updatedAt: string;
};

export function PromptTemplatesBlock() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formContent, setFormContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateInstruction, setGenerateInstruction] = useState('');
  const [generating, setGenerating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  const fetchTemplates = useCallback(() => {
    fetch('/api/portal/admin/ai-settings/prompt-templates')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setTemplates(d?.templates ?? []))
      .catch(() => toast.error('Не удалось загрузить шаблоны'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  function openCreate() {
    setEditingId(null);
    setFormName('');
    setFormContent('');
    setModalOpen(true);
  }

  function openEdit(t: Template) {
    setEditingId(t.id);
    setFormName(t.name);
    setFormContent(t.content);
    setModalOpen(true);
  }

  async function handleSave() {
    const name = formName.trim() || 'Без названия';
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/portal/admin/ai-settings/prompt-templates/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, content: formContent }),
        });
        if (!res.ok) throw new Error();
        toast.success('Шаблон обновлён');
      } else {
        const res = await fetch('/api/portal/admin/ai-settings/prompt-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, content: formContent }),
        });
        if (!res.ok) throw new Error();
        toast.success('Шаблон создан');
      }
      setModalOpen(false);
      fetchTemplates();
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  async function setActive(t: Template) {
    if (t.isActive) return;
    try {
      const res = await fetch(`/api/portal/admin/ai-settings/prompt-templates/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Активный шаблон: ${t.name}`);
      fetchTemplates();
    } catch {
      toast.error('Ошибка');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/portal/admin/ai-settings/prompt-templates/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      toast.success('Шаблон удалён');
      setDeleteTarget(null);
      fetchTemplates();
    } catch {
      toast.error('Ошибка удаления');
    }
  }

  async function handleGenerate() {
    const instruction = generateInstruction.trim();
    if (!instruction) {
      toast.error('Введите описание промпта');
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/portal/admin/ai-settings/prompt-templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Ошибка генерации');
        return;
      }
      setFormContent(data.content ?? '');
      setFormName('');
      setEditingId(null);
      setGenerateOpen(false);
      setGenerateInstruction('');
      setModalOpen(true);
      toast.success('Промпт сгенерирован, отредактируйте и сохраните');
    } catch {
      toast.error('Ошибка генерации');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card
      title="Шаблоны промптов"
      description="Варианты system prompt для чат-бота. Один шаблон — активный (используется в чате). Генерируйте с помощью AI, сравнивайте статистику и выбирайте более эффективный."
    >
      {loading ? (
        <p className="text-sm text-text-muted">Загрузка…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Добавить шаблон
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setGenerateOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4" />
              Сгенерировать с AI
            </Button>
          </div>

          {templates.length === 0 ? (
            <p className="mt-4 text-sm text-text-muted">Нет шаблонов. Добавьте или сгенерируйте с AI.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg-cream">
                    <th className="px-3 py-2 text-left font-medium text-dark">Название</th>
                    <th className="px-3 py-2 text-left font-medium text-dark">Активный</th>
                    <th className="px-3 py-2 text-left font-medium text-dark">Использований</th>
                    <th className="px-3 py-2 text-left font-medium text-dark">Последнее использование</th>
                    <th className="px-3 py-2 text-right font-medium text-dark">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={t.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-medium">{t.name}</td>
                      <td className="px-3 py-2">
                        {t.isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                            <Check className="h-3 w-3" /> Активный
                          </span>
                        ) : (
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActive(t)}>
                            Сделать активным
                          </Button>
                        )}
                      </td>
                      <td className="px-3 py-2 text-text-muted">{t.usageCount}</td>
                      <td className="px-3 py-2 text-text-muted">
                        {t.lastUsedAt ? format(new Date(t.lastUsedAt), 'dd.MM.yyyy HH:mm', { locale: ru }) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(t)} aria-label="Редактировать">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700" onClick={() => setDeleteTarget(t)} aria-label="Удалить">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Редактировать шаблон' : 'Новый шаблон'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 overflow-y-auto">
                <div>
                  <Label htmlFor="tpl-name">Название</Label>
                  <Input
                    id="tpl-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Например: Строгий консультант"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="tpl-content">Текст промпта (system prompt)</Label>
                  <textarea
                    id="tpl-content"
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    rows={12}
                    className="mt-1 w-full rounded-lg border border-border px-3 py-2 font-mono text-sm"
                    placeholder="Ты консультант..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" onClick={handleSave} disabled={saving}>
                    {saving ? 'Сохранение…' : 'Сохранить'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                    Отмена
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Сгенерировать промпт с AI</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-text-muted">
                Опишите, каким должен быть консультант или стиль ответов. AI предложит текст system prompt.
              </p>
              <div className="mt-4">
                <Label htmlFor="gen-instr">Описание</Label>
                <textarea
                  id="gen-instr"
                  value={generateInstruction}
                  onChange={(e) => setGenerateInstruction(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                  placeholder="Например: дружелюбный тон, короткие ответы, акцент на мышечном тесте"
                />
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={handleGenerate} disabled={generating}>
                  {generating ? 'Генерация…' : 'Сгенерировать'}
                </Button>
                <Button variant="ghost" onClick={() => setGenerateOpen(false)}>Отмена</Button>
              </div>
            </DialogContent>
          </Dialog>

          <ConfirmDialog
            open={!!deleteTarget}
            onOpenChange={(open) => !open && setDeleteTarget(null)}
            title="Удалить шаблон?"
            description={deleteTarget ? `«${deleteTarget.name}» будет удалён.` : ''}
            onConfirm={handleDelete}
            confirmLabel="Удалить"
            variant="danger"
          />
        </>
      )}
    </Card>
  );
}
