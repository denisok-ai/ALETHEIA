'use client';

/**
 * Form for creating (POST) or editing (PATCH) a certificate template.
 * Подложка (PNG/JPG/PDF) и textMapping задаются в форме шаблона.
 */
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/portal/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';

interface TemplateFormData {
  name: string;
  backgroundImageUrl: string | null;
  textMapping: string | null;
  courseId: string | null;
  minScore: number | null;
  requiredStatus: string;
  validityDays: number | null;
  numberingFormat: string | null;
  allowUserDownload: boolean;
}

interface CertificateTemplateFormProps {
  templateId?: string;
  initial?: Partial<TemplateFormData>;
}

export function CertificateTemplateForm({ templateId, initial }: CertificateTemplateFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? '');
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(initial?.backgroundImageUrl ?? null);
  const [textMapping, setTextMapping] = useState(initial?.textMapping ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [removeBackground, setRemoveBackground] = useState(false);
  const [courseId, setCourseId] = useState<string | null>(initial?.courseId ?? null);
  const [minScore, setMinScore] = useState<string>(initial?.minScore != null ? String(initial.minScore) : '');
  const [requiredStatus, setRequiredStatus] = useState(initial?.requiredStatus ?? '');
  const [validityDays, setValidityDays] = useState<string>(initial?.validityDays != null ? String(initial.validityDays) : '');
  const [numberingFormat, setNumberingFormat] = useState(initial?.numberingFormat ?? '');
  const [allowUserDownload, setAllowUserDownload] = useState(initial?.allowUserDownload ?? true);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(!!templateId);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const initialSnapshot = useRef<string | null>(null);

  const snapshot = () =>
    JSON.stringify({
      name,
      backgroundImageUrl,
      textMapping,
      courseId,
      minScore,
      requiredStatus,
      validityDays,
      numberingFormat,
      allowUserDownload,
      hasFile: !!file,
      removeBackground,
    });

  useEffect(() => {
    fetch('/api/portal/admin/courses').then((r) => (r.ok ? r.json() : { courses: [] })).then((res) => {
      setCourses(res.courses ?? []);
    });
  }, []);

  useEffect(() => {
    if (templateId) {
      fetch(`/api/portal/admin/certificate-templates/${templateId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) {
            setName(d.name ?? '');
            setBackgroundImageUrl(d.backgroundImageUrl ?? null);
            setTextMapping(d.textMapping ?? '');
            setCourseId(d.courseId ?? null);
            setMinScore(d.minScore != null ? String(d.minScore) : '');
            setRequiredStatus(d.requiredStatus ?? '');
            setValidityDays(d.validityDays != null ? String(d.validityDays) : '');
            setNumberingFormat(d.numberingFormat ?? '');
            setAllowUserDownload(d.allowUserDownload !== false);
            initialSnapshot.current = JSON.stringify({
              name: d.name ?? '',
              backgroundImageUrl: d.backgroundImageUrl ?? null,
              textMapping: d.textMapping ?? '',
              courseId: d.courseId ?? null,
              minScore: d.minScore != null ? String(d.minScore) : '',
              requiredStatus: d.requiredStatus ?? '',
              validityDays: d.validityDays != null ? String(d.validityDays) : '',
              numberingFormat: d.numberingFormat ?? '',
              allowUserDownload: d.allowUserDownload !== false,
              hasFile: false,
              removeBackground: false,
            });
          }
        })
        .finally(() => setLoadingData(false));
    } else {
      initialSnapshot.current = JSON.stringify({
        name: initial?.name ?? '',
        backgroundImageUrl: initial?.backgroundImageUrl ?? null,
        textMapping: initial?.textMapping ?? '',
        courseId: initial?.courseId ?? null,
        minScore: initial?.minScore != null ? String(initial.minScore) : '',
        requiredStatus: initial?.requiredStatus ?? '',
        validityDays: initial?.validityDays != null ? String(initial.validityDays) : '',
        numberingFormat: initial?.numberingFormat ?? '',
        allowUserDownload: initial?.allowUserDownload ?? true,
        hasFile: false,
        removeBackground: false,
      });
    }
  }, [templateId, initial]);

  const isDirty = initialSnapshot.current !== null && snapshot() !== initialSnapshot.current;
  useUnsavedChanges(isDirty);

  function goToList() {
    if (isDirty) setLeaveConfirm(true);
    else router.push('/portal/admin/certificate-templates');
  }

  function confirmLeave() {
    setLeaveConfirm(false);
    router.push('/portal/admin/certificate-templates');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Укажите название шаблона');
      return;
    }

    const minScoreNum = minScore === '' ? null : parseInt(minScore, 10);
    const validityDaysNum = validityDays === '' ? null : parseInt(validityDays, 10);
    if (minScoreNum !== null && (isNaN(minScoreNum) || minScoreNum < 0 || minScoreNum > 100)) {
      toast.error('minScore: число от 0 до 100');
      return;
    }
    if (validityDaysNum !== null && (isNaN(validityDaysNum) || validityDaysNum <= 0)) {
      toast.error('Срок действия: положительное число дней');
      return;
    }

    setLoading(true);
    try {
      const useFormData = file && file.size > 0 || (templateId && removeBackground);
      if (templateId) {
        if (useFormData) {
          const fd = new FormData();
          fd.append('name', trimmedName);
          fd.append('textMapping', textMapping.trim() || '');
          fd.append('courseId', courseId || '');
          fd.append('minScore', minScore);
          fd.append('requiredStatus', requiredStatus);
          fd.append('validityDays', validityDays);
          fd.append('numberingFormat', numberingFormat);
          fd.append('allowUserDownload', String(allowUserDownload));
          if (removeBackground) fd.append('removeBackground', 'true');
          if (file && file.size > 0) fd.append('file', file);
          const r = await fetch(`/api/portal/admin/certificate-templates/${templateId}`, { method: 'PATCH', body: fd });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(data.error ?? 'Ошибка');
          toast.success('Шаблон обновлён');
          router.refresh();
        } else {
          const r = await fetch(`/api/portal/admin/certificate-templates/${templateId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: trimmedName,
              textMapping: textMapping.trim() || null,
              courseId: courseId || null,
              minScore: minScoreNum,
              requiredStatus: requiredStatus.trim() || null,
              validityDays: validityDaysNum,
              numberingFormat: numberingFormat.trim() || null,
              allowUserDownload,
            }),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(data.error ?? 'Ошибка');
          toast.success('Шаблон обновлён');
          router.refresh();
        }
      } else {
        if (file && file.size > 0) {
          const fd = new FormData();
          fd.append('name', trimmedName);
          fd.append('file', file);
          fd.append('textMapping', textMapping.trim() || '');
          fd.append('courseId', courseId || '');
          fd.append('minScore', minScore);
          fd.append('requiredStatus', requiredStatus);
          fd.append('validityDays', validityDays);
          fd.append('numberingFormat', numberingFormat);
          fd.append('allowUserDownload', String(allowUserDownload));
          const r = await fetch('/api/portal/admin/certificate-templates', { method: 'POST', body: fd });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(data.error ?? 'Ошибка');
          toast.success('Шаблон создан');
          router.push('/portal/admin/certificate-templates');
        } else {
          const r = await fetch('/api/portal/admin/certificate-templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: trimmedName,
              textMapping: textMapping.trim() || null,
              courseId: courseId || null,
              minScore: minScoreNum,
              requiredStatus: requiredStatus.trim() || null,
              validityDays: validityDaysNum,
              numberingFormat: numberingFormat.trim() || null,
              allowUserDownload,
            }),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(data.error ?? 'Ошибка');
          toast.success('Шаблон создан');
          router.push('/portal/admin/certificate-templates');
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
    setLoading(false);
  }

  if (loadingData) {
    return (
      <Card>
        <p className="text-text-muted">Загрузка…</p>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
        <div>
          <Label htmlFor="ct-name">Название шаблона</Label>
          <Input
            id="ct-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: Сертификат по курсу X"
            className="mt-1"
            required
          />
        </div>
        <div>
          <Label>Подложка (PNG, JPG или PDF)</Label>
          {backgroundImageUrl && !removeBackground && (
            <p className="mt-1 text-sm text-text-muted">Текущая: {backgroundImageUrl}</p>
          )}
          {!templateId && (
            <input
              id="ct-file"
              type="file"
              accept=".png,.jpg,.jpeg,.pdf"
              className="mt-1 block w-full text-sm text-text-muted file:mr-4 file:rounded file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-dark"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          )}
          {templateId && (
            <>
              <input
                id="ct-file-edit"
                type="file"
                accept=".png,.jpg,.jpeg,.pdf"
                className="mt-1 block w-full text-sm text-text-muted file:mr-4 file:rounded file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-dark"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRemoveBackground(false); }}
              />
              {backgroundImageUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="ct-remove-bg"
                    checked={removeBackground}
                    onChange={(e) => { setRemoveBackground(e.target.checked); if (e.target.checked) setFile(null); }}
                    className="h-4 w-4 rounded border-border"
                  />
                  <Label htmlFor="ct-remove-bg" className="font-normal text-sm">Удалить подложку</Label>
                </div>
              )}
            </>
          )}
          <p className="mt-1 text-xs text-text-muted">Без подложки используется макет по умолчанию при генерации PDF.</p>
        </div>
        <div>
          <Label htmlFor="ct-textmapping">textMapping (JSON, опционально)</Label>
          <textarea
            id="ct-textmapping"
            value={textMapping}
            onChange={(e) => setTextMapping(e.target.value)}
            rows={4}
            placeholder='{"name":{"x":100,"y":200},"date":{"x":100,"y":250},...}'
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 font-mono text-sm"
          />
          <p className="mt-1 text-xs text-text-muted">Координаты для полей: name, date, courseTitle, certNumber.</p>
        </div>
        <div>
          <Label htmlFor="ct-course">Курс</Label>
          <select
            id="ct-course"
            value={courseId ?? ''}
            onChange={(e) => setCourseId(e.target.value || null)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
          >
            <option value="">— общий шаблон</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="ct-minScore">Минимальный балл (%)</Label>
            <Input
              id="ct-minScore"
              type="number"
              min={0}
              max={100}
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              placeholder="0–100"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="ct-requiredStatus">requiredStatus</Label>
            <Input
              id="ct-requiredStatus"
              value={requiredStatus}
              onChange={(e) => setRequiredStatus(e.target.value)}
              placeholder="например completed"
              className="mt-1"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="ct-validityDays">Срок действия (дней)</Label>
            <Input
              id="ct-validityDays"
              type="number"
              min={1}
              value={validityDays}
              onChange={(e) => setValidityDays(e.target.value)}
              placeholder="пусто = без срока"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="ct-numberingFormat">Формат нумерации</Label>
            <Input
              id="ct-numberingFormat"
              value={numberingFormat}
              onChange={(e) => setNumberingFormat(e.target.value)}
              placeholder="CERT-%ID% или пусто"
              className="mt-1"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="ct-allowUserDownload"
            checked={allowUserDownload}
            onChange={(e) => setAllowUserDownload(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <Label htmlFor="ct-allowUserDownload" className="font-normal">Электронная версия доступна пользователям (кнопка «Скачать PDF»)</Label>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>
            {templateId ? 'Сохранить' : 'Создать'}
          </Button>
          <Button type="button" variant="secondary" onClick={goToList}>
            Отмена
          </Button>
        </div>
      </form>
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
