'use client';

/**
 * View count increment, rating stars, comments for publication page.
 */
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Star, MessageCircle } from 'lucide-react';

interface PublicationViewClientProps {
  publicationId: string;
  initialViewsCount: number;
  allowRating: boolean;
  ratingSum: number;
  ratingCount: number;
  allowComments: boolean;
}

export function PublicationViewClient({
  publicationId,
  initialViewsCount,
  allowRating,
  ratingSum,
  ratingCount,
  allowComments,
}: PublicationViewClientProps) {
  const [viewsCount, setViewsCount] = useState(initialViewsCount);
  const [rated, setRated] = useState(false);
  const [currentRatingSum, setCurrentRatingSum] = useState(ratingSum);
  const [currentRatingCount, setCurrentRatingCount] = useState(ratingCount);
  const [commentValue, setCommentValue] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [comments, setComments] = useState<{ id: string; content: string; authorName: string; createdAt: string }[]>([]);
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    fetch(`/api/publications/${publicationId}?view=1`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.publication?.viewsCount != null) setViewsCount(d.publication.viewsCount);
      })
      .catch(() => {});
  }, [publicationId]);

  useEffect(() => {
    if (!allowComments) return;
    fetch(`/api/publications/${publicationId}/comments`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setComments(d?.comments ?? []))
      .catch(() => {});
  }, [publicationId, allowComments]);

  async function handleRate(value: number) {
    if (rated || !allowRating) return;
    const r = await fetch(`/api/publications/${publicationId}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
    if (r.ok) {
      const d = await r.json();
      setCurrentRatingSum(d.ratingSum);
      setCurrentRatingCount(d.ratingCount);
      setRated(true);
    }
  }

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentValue.trim()) return;
    setSubmittingComment(true);
    try {
      const r = await fetch(`/api/publications/${publicationId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentValue.trim(), authorName: authorName.trim() || undefined }),
      });
      if (r.ok) {
        const d = await r.json();
        setComments((prev) => [...prev, { id: d.comment.id, content: d.comment.content, authorName: d.comment.authorName ?? 'Гость', createdAt: d.comment.createdAt }]);
        setCommentValue('');
      }
    } finally {
      setSubmittingComment(false);
    }
  }

  const avgRating = currentRatingCount > 0 ? (currentRatingSum / currentRatingCount).toFixed(1) : null;

  return (
    <div className="mt-8 space-y-6 border-t border-border pt-6">
      <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted">
        <span>Просмотров: {viewsCount}</span>
        {allowRating && (
          <span className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => handleRate(v)}
                disabled={rated}
                className="text-secondary hover:opacity-80 disabled:opacity-60"
                aria-label={`Оценка ${v}`}
              >
                <Star className="h-5 w-5" />
              </button>
            ))}
            {avgRating && <span className="ml-1">({avgRating})</span>}
          </span>
        )}
      </div>

      {allowComments && (
        <section>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-dark">
            <MessageCircle className="h-5 w-5" /> Комментарии
          </h2>
          <form onSubmit={handleSubmitComment} className="mt-3 space-y-2">
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Ваше имя (необязательно)"
              className="w-full max-w-xs rounded-lg border border-border px-3 py-2 text-sm"
            />
            <textarea
              value={commentValue}
              onChange={(e) => setCommentValue(e.target.value)}
              placeholder="Текст комментария"
              rows={3}
              required
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
            <Button type="submit" size="sm" disabled={submittingComment}>
              {submittingComment ? 'Отправка…' : 'Отправить'}
            </Button>
          </form>
          <ul className="mt-4 space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="rounded-lg border border-border bg-bg-soft/50 p-3 text-sm">
                <p className="font-medium text-dark">{c.authorName}</p>
                <p className="mt-0.5 text-text-muted">{c.content}</p>
                <time className="text-xs text-text-soft">
                  {new Date(c.createdAt).toLocaleString('ru')}
                </time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
