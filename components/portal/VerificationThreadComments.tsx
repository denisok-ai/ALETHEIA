'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MessageCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ThreadCommentSerialized } from '@/lib/verification-thread-comments';
import { VERIFICATION_THREAD_COMMENT_MAX_LEN } from '@/lib/verification-thread-comments';

interface VerificationThreadCommentsProps {
  verificationId: string;
  viewerUserId: string;
  initialComments: ThreadCommentSerialized[];
  /** Показывать форму добавления (слушатель и проверяющий могут писать). */
  canPost?: boolean;
}

export function VerificationThreadComments({
  verificationId,
  viewerUserId,
  initialComments,
  canPost = true,
}: VerificationThreadCommentsProps) {
  const [comments, setComments] = useState<ThreadCommentSerialized[]>(initialComments);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) {
      toast.error('Введите текст');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/portal/verifications/${verificationId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'Не удалось отправить');
        return;
      }
      const c = data.comment as ThreadCommentSerialized | undefined;
      if (c) setComments((prev) => [...prev, c]);
      setDraft('');
      toast.success('Комментарий добавлен');
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]/80 p-3 space-y-2">
      <p className="text-xs font-medium text-[var(--portal-text-muted)] flex items-center gap-1.5">
        <MessageCircle className="h-3.5 w-3.5" aria-hidden />
        Комментарии к заданию
      </p>
      {comments.length === 0 ? (
        <p className="text-xs text-[var(--portal-text-soft)]">Пока нет сообщений.</p>
      ) : (
        <ul className="space-y-2 max-h-48 overflow-y-auto">
          {comments.map((c) => {
            const mine = c.authorUserId === viewerUserId;
            return (
              <li
                key={c.id}
                className={`rounded-md px-2.5 py-2 text-sm ${
                  mine
                    ? 'bg-[var(--portal-accent-soft)]/60 border border-[var(--portal-accent-muted)]/30'
                    : 'bg-white border border-[#E2E8F0]'
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-1 gap-x-2">
                  <span className="text-xs font-semibold text-[var(--portal-text)]">{c.authorLabel}</span>
                  <time className="text-[10px] text-[var(--portal-text-soft)]">
                    {new Date(c.createdAt).toLocaleString('ru', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-[var(--portal-text)] text-sm leading-snug">
                  {c.body}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      {canPost && (
        <form onSubmit={submit} className="pt-1 space-y-2 border-t border-[#E2E8F0]">
          <Label htmlFor={`vtc-${verificationId}`} className="text-xs">
            Ваш комментарий
          </Label>
          <textarea
            id={`vtc-${verificationId}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            maxLength={VERIFICATION_THREAD_COMMENT_MAX_LEN}
            placeholder="Вопрос проверяющему или уточнение к заданию…"
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-sm min-h-[64px]"
          />
          <Button type="submit" size="sm" variant="secondary" disabled={submitting} className="min-h-9 gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden /> : null}
            {submitting ? 'Отправка…' : 'Отправить'}
          </Button>
        </form>
      )}
    </div>
  );
}
