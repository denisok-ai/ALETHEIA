'use client';

import { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Video, ExternalLink, CheckCircle2, XCircle, Clock, Plus, Pencil, Save, X, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: 'На проверке', icon: Clock, className: 'text-amber-600 bg-amber-50' },
  approved: { label: 'Одобрено', icon: CheckCircle2, className: 'text-green-600 bg-green-50' },
  rejected: { label: 'Отклонено', icon: XCircle, className: 'text-red-600 bg-red-50' },
};

interface VerificationItem {
  id: string;
  courseId: string;
  courseTitle: string;
  lessonId: string | null;
  assignmentType?: string;
  videoUrl: string;
  status: string;
  comment: string | null;
  createdAt: string;
}

interface EnrolledCourse {
  id: string;
  title: string;
  scormManifest: string | null;
}

function lessonOptionsFromManifest(manifest: string | null): { id: string; title?: string }[] {
  if (!manifest?.trim()) return [];
  try {
    const p = JSON.parse(manifest) as { items?: { identifier?: string; title?: string }[] };
    const items = p?.items;
    if (!Array.isArray(items) || items.length === 0) return [];
    return items.map((it) => ({
      id: typeof it.identifier === 'string' ? it.identifier : 'main',
      title: typeof it.title === 'string' ? it.title : undefined,
    }));
  } catch {
    return [];
  }
}

export function VerificationsPageClient({
  initialList,
  enrolledCourses,
}: {
  initialList: VerificationItem[];
  enrolledCourses: EnrolledCourse[];
}) {
  const [list, setList] = useState<VerificationItem[]>(initialList);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addCourseId, setAddCourseId] = useState('');
  const [addLessonId, setAddLessonId] = useState('');
  const [addVideoUrl, setAddVideoUrl] = useState('');
  const [addAssignmentType, setAddAssignmentType] = useState<'video' | 'text'>('video');
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVideoUrl, setEditVideoUrl] = useState('');
  const [editLessonId, setEditLessonId] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const addVideoInputRef = useRef<HTMLInputElement>(null);
  const editVideoInputRef = useRef<HTMLInputElement>(null);

  const lessonOptionsByCourse = useMemo(() => {
    const map: Record<string, { id: string; title?: string }[]> = {};
    for (const c of enrolledCourses) {
      map[c.id] = lessonOptionsFromManifest(c.scormManifest);
    }
    return map;
  }, [enrolledCourses]);

  const currentLessonOptions = addCourseId ? lessonOptionsByCourse[addCourseId] ?? [] : [];

  async function handleUploadVideo(e: React.ChangeEvent<HTMLInputElement>, setUrl: (url: string) => void) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const form = new FormData();
      form.set('file', file);
      const res = await fetch('/api/portal/verifications/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Ошибка загрузки');
      if (data.url) setUrl(data.url);
      toast.success('Видео загружено');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setUploadingVideo(false);
      e.target.value = '';
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const url = addVideoUrl.trim();
    const isText = addAssignmentType === 'text';
    if (isText) {
      if (url.length < 1 || url.length > 20000) {
        toast.error('Текст ответа: от 1 до 20 000 символов');
        return;
      }
    } else {
      const isHttp = url.startsWith('http://') || url.startsWith('https://');
      const isUploaded = url.startsWith('/uploads/');
      if (!url || (!isHttp && !isUploaded)) {
        toast.error('Введите ссылку на видео или загрузите файл');
        return;
      }
    }
    if (!addCourseId) {
      toast.error('Выберите курс');
      return;
    }
    setSubmittingAdd(true);
    try {
      const res = await fetch('/api/portal/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: addCourseId,
          lessonId: addLessonId || null,
          videoUrl: url,
          assignmentType: isText ? 'text' : 'video',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Ошибка');
      const newItem: VerificationItem = {
        id: data.id,
        courseId: data.courseId,
        courseTitle: enrolledCourses.find((c) => c.id === data.courseId)?.title ?? 'Курс',
        lessonId: data.lessonId,
        assignmentType: isText ? 'text' : 'video',
        videoUrl: url,
        status: 'pending',
        comment: null,
        createdAt: data.createdAt,
      };
      setList((prev) => [newItem, ...prev]);
      setAddVideoUrl('');
      setAddLessonId('');
      setAddCourseId('');
      setAddAssignmentType('video');
      setShowAddForm(false);
      toast.success('Задание добавлено на проверку');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setSubmittingAdd(false);
    }
  }

  function startEdit(item: VerificationItem) {
    setEditingId(item.id);
    setEditVideoUrl(item.videoUrl);
    setEditLessonId(item.lessonId ?? '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditVideoUrl('');
    setEditLessonId('');
  }

  async function saveEdit(id: string, mode: 'video' | 'text') {
    const url = editVideoUrl.trim();
    if (mode === 'text') {
      if (url.length < 1 || url.length > 20000) {
        toast.error('Текст ответа: от 1 до 20 000 символов');
        return;
      }
    } else if (!url || (!url.startsWith('http') && !url.startsWith('/uploads/'))) {
      toast.error('Введите корректную ссылку на видео или путь к загруженному файлу');
      return;
    }
    setSubmittingEdit(true);
    try {
      const res = await fetch(`/api/portal/verifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: url,
          lessonId: editLessonId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Ошибка');
      setList((prev) =>
        prev.map((v) =>
          v.id === id
            ? { ...v, videoUrl: url, lessonId: editLessonId || null }
            : v
        )
      );
      setEditingId(null);
      setEditVideoUrl('');
      setEditLessonId('');
      toast.success('Задание обновлено');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setSubmittingEdit(false);
    }
  }

  if (list.length === 0 && !showAddForm) {
    return (
      <div className="w-full space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="primary"
            onClick={() => setShowAddForm(true)}
            className="min-h-10"
          >
            <Plus className="h-4 w-4 mr-2" />
            Добавить задание
          </Button>
        </div>
        {showAddForm && (
          <form onSubmit={handleAdd} className="portal-card p-4 md:p-6 space-y-4">
            <h3 className="text-base font-semibold text-[var(--portal-text)]">Новое задание</h3>
            <div>
              <Label htmlFor="add-course">Курс *</Label>
              <select
                id="add-course"
                value={addCourseId}
                onChange={(e) => {
                  setAddCourseId(e.target.value);
                  setAddLessonId('');
                }}
                className="mt-1 block w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm min-h-10"
              >
                <option value="">Выберите курс</option>
                {enrolledCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            {currentLessonOptions.length > 0 && (
              <div>
                <Label htmlFor="add-lesson">Урок (необязательно)</Label>
                <select
                  id="add-lesson"
                  value={addLessonId}
                  onChange={(e) => setAddLessonId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm min-h-10"
                >
                  <option value="">Общее по курсу</option>
                  {currentLessonOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.title ?? opt.id}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <Label htmlFor="add-type">Тип задания</Label>
              <select
                id="add-type"
                value={addAssignmentType}
                onChange={(e) => {
                  setAddAssignmentType(e.target.value as 'video' | 'text');
                  setAddVideoUrl('');
                }}
                className="mt-1 block w-full max-w-md rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm min-h-10"
              >
                <option value="video">Видео (ссылка или файл)</option>
                <option value="text">Текстовый ответ</option>
              </select>
            </div>
            {addAssignmentType === 'text' ? (
              <div>
                <Label htmlFor="add-text">Текст ответа *</Label>
                <textarea
                  id="add-text"
                  value={addVideoUrl}
                  onChange={(e) => setAddVideoUrl(e.target.value)}
                  rows={8}
                  required
                  maxLength={20000}
                  className="mt-1 block w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm min-h-[120px]"
                  placeholder="Ваш ответ по заданию…"
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="add-url">Ссылка на видео или загрузите файл *</Label>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Input
                    id="add-url"
                    type="text"
                    value={addVideoUrl}
                    onChange={(e) => setAddVideoUrl(e.target.value)}
                    placeholder="https://... или нажмите «Загрузить видео»"
                    required
                    className="min-h-10 flex-1 min-w-[200px]"
                  />
                  <input
                    ref={addVideoInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,.mp4,.webm,.mov,.avi,.mkv"
                    className="hidden"
                    onChange={(e) => handleUploadVideo(e, setAddVideoUrl)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={uploadingVideo}
                    onClick={() => addVideoInputRef.current?.click()}
                    className="min-h-10"
                  >
                    {uploadingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    <span className="ml-2">{uploadingVideo ? 'Загрузка…' : 'Загрузить видео'}</span>
                  </Button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="primary" disabled={submittingAdd}>
                {submittingAdd ? 'Отправка…' : 'Отправить на проверку'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowAddForm(false)}>
                Отмена
              </Button>
            </div>
          </form>
        )}
        <div className="portal-card p-8 md:p-12 text-center">
          <Video className="h-12 w-12 mx-auto mb-4 text-[var(--portal-text-soft)]" />
          <h2 className="text-lg font-semibold text-[var(--portal-text)]">Пока нет заданий</h2>
          <p className="mt-2 text-sm text-[var(--portal-text-muted)] max-w-md mx-auto">
            Добавьте задание кнопкой выше или со страницы курса: блок «Задания на проверку» → ссылка на видео.
          </p>
          <Link
            href="/portal/student/courses"
            className="inline-block mt-4 text-sm font-medium text-[var(--portal-accent)] hover:underline"
          >
            Перейти к моим курсам →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="primary"
          onClick={() => setShowAddForm(!showAddForm)}
          className="min-h-10"
        >
          <Plus className="h-4 w-4 mr-2" />
          Добавить задание
        </Button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAdd} className="portal-card p-4 md:p-6 space-y-4">
          <h3 className="text-base font-semibold text-[var(--portal-text)]">Новое задание</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="add-course">Курс *</Label>
              <select
                id="add-course"
                value={addCourseId}
                onChange={(e) => {
                  setAddCourseId(e.target.value);
                  setAddLessonId('');
                }}
                className="mt-1 block w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm min-h-10"
              >
                <option value="">Выберите курс</option>
                {enrolledCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            {currentLessonOptions.length > 0 && (
              <div>
                <Label htmlFor="add-lesson">Урок (необязательно)</Label>
                <select
                  id="add-lesson"
                  value={addLessonId}
                  onChange={(e) => setAddLessonId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm min-h-10"
                >
                  <option value="">Общее по курсу</option>
                  {currentLessonOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.title ?? opt.id}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="add-type-main">Тип задания</Label>
            <select
              id="add-type-main"
              value={addAssignmentType}
              onChange={(e) => {
                setAddAssignmentType(e.target.value as 'video' | 'text');
                setAddVideoUrl('');
              }}
              className="mt-1 block w-full max-w-md rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm min-h-10"
            >
              <option value="video">Видео (ссылка или файл)</option>
              <option value="text">Текстовый ответ</option>
            </select>
          </div>
          {addAssignmentType === 'text' ? (
            <div>
              <Label htmlFor="add-text-main">Текст ответа *</Label>
              <textarea
                id="add-text-main"
                value={addVideoUrl}
                onChange={(e) => setAddVideoUrl(e.target.value)}
                rows={8}
                required
                maxLength={20000}
                className="mt-1 block w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm min-h-[120px]"
                placeholder="Ваш ответ по заданию…"
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="add-url-main">Ссылка на видео или загрузите файл *</Label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Input
                  id="add-url-main"
                  type="text"
                  value={addVideoUrl}
                  onChange={(e) => setAddVideoUrl(e.target.value)}
                  placeholder="https://... или нажмите «Загрузить видео»"
                  required
                  className="min-h-10 flex-1 min-w-[200px] max-w-xl"
                />
                <input
                  ref={addVideoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,.mp4,.webm,.mov,.avi,.mkv"
                  className="hidden"
                  onChange={(e) => handleUploadVideo(e, setAddVideoUrl)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={uploadingVideo}
                  onClick={() => addVideoInputRef.current?.click()}
                  className="min-h-10"
                >
                  {uploadingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <span className="ml-2">{uploadingVideo ? 'Загрузка…' : 'Загрузить видео'}</span>
                </Button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={submittingAdd}>
              {submittingAdd ? 'Отправка…' : 'Отправить на проверку'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowAddForm(false)}>
              Отмена
            </Button>
          </div>
        </form>
      )}

      <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
        {list.map((v) => {
          const cfg = STATUS_CONFIG[v.status] ?? STATUS_CONFIG.pending;
          const Icon = cfg.icon;
          const isEditing = editingId === v.id;

          return (
            <li
              key={v.id}
              className="portal-card p-4 md:p-5 flex flex-col gap-3 min-w-0 hover:shadow-[var(--portal-shadow)] transition-shadow"
            >
              <div className="flex items-start justify-between gap-2 min-w-0">
                <p className="font-medium text-[var(--portal-text)] truncate" title={v.courseTitle}>
                  {v.courseTitle}
                </p>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${cfg.className}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {cfg.label}
                </span>
              </div>

              {isEditing ? (
                <div className="space-y-3 pt-2 border-t border-[#E2E8F0]">
                  <div>
                    {v.assignmentType === 'text' ? (
                      <>
                        <Label htmlFor={`edit-text-${v.id}`}>Текст ответа</Label>
                        <textarea
                          id={`edit-text-${v.id}`}
                          value={editVideoUrl}
                          onChange={(e) => setEditVideoUrl(e.target.value)}
                          rows={6}
                          maxLength={20000}
                          className="mt-1 block w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-sm"
                        />
                      </>
                    ) : (
                      <>
                        <Label htmlFor={`edit-url-${v.id}`}>Ссылка на видео или загрузите файл</Label>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Input
                            id={`edit-url-${v.id}`}
                            type="text"
                            value={editVideoUrl}
                            onChange={(e) => setEditVideoUrl(e.target.value)}
                            className="min-h-9 text-sm flex-1 min-w-[160px]"
                          />
                          <input
                            ref={editVideoInputRef}
                            type="file"
                            accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.avi,.mkv"
                            className="hidden"
                            onChange={(e) => handleUploadVideo(e, setEditVideoUrl)}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={uploadingVideo}
                            onClick={() => editVideoInputRef.current?.click()}
                            className="min-h-9"
                          >
                            {uploadingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            <span className="ml-1">{uploadingVideo ? 'Загрузка…' : 'Загрузить'}</span>
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                  {(lessonOptionsByCourse[v.courseId]?.length ?? 0) > 0 && (
                    <div>
                      <Label htmlFor={`edit-lesson-${v.id}`}>Урок</Label>
                      <select
                        id={`edit-lesson-${v.id}`}
                        value={editLessonId}
                        onChange={(e) => setEditLessonId(e.target.value)}
                        className="mt-1 block w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-sm min-h-9"
                      >
                        <option value="">Общее по курсу</option>
                        {(lessonOptionsByCourse[v.courseId] ?? []).map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.title ?? opt.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={() => saveEdit(v.id, v.assignmentType === 'text' ? 'text' : 'video')}
                      disabled={submittingEdit}
                    >
                      <Save className="h-3.5 w-3.5 mr-1" />
                      Сохранить
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={cancelEdit}>
                      <X className="h-3.5 w-3.5 mr-1" />
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs text-[var(--portal-text-muted)]">
                    {v.assignmentType === 'text' ? (
                      <span className="inline-block rounded bg-[var(--portal-accent-soft)] px-1.5 py-0.5 font-medium text-[var(--portal-accent-dark)]">Текст</span>
                    ) : (
                      <span className="inline-block rounded bg-[#F1F5F9] px-1.5 py-0.5 font-medium text-[var(--portal-text)]">Видео</span>
                    )}
                    {v.lessonId && ` · Урок: ${v.lessonId}`}
                  </p>
                  {v.assignmentType === 'text' ? (
                    <p className="text-sm text-[var(--portal-text)] line-clamp-6 whitespace-pre-wrap break-words">
                      {v.videoUrl}
                    </p>
                  ) : (
                    <a
                      href={v.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-[var(--portal-accent)] hover:underline truncate"
                    >
                      <ExternalLink className="h-4 w-4 shrink-0" />
                      <span className="truncate">Смотреть видео</span>
                    </a>
                  )}
                  {v.status === 'rejected' && v.comment && (
                    <p className="text-sm text-[var(--portal-text-muted)] bg-red-50/50 rounded-lg px-3 py-2 border border-red-100">
                      {v.comment}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2 mt-auto">
                    <time className="text-xs text-[var(--portal-text-soft)]">
                      {new Date(v.createdAt).toLocaleString('ru', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                    {v.status === 'pending' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(v)}
                        className="text-[var(--portal-accent)]"
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Редактировать
                      </Button>
                    )}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
