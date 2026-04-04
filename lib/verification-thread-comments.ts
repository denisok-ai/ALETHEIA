/**
 * Комментарии к заданию на верификацию (слушатель ↔ проверяющий).
 */
export const VERIFICATION_THREAD_COMMENT_MAX_LEN = 4000;

export type ThreadCommentSerialized = {
  id: string;
  authorUserId: string;
  body: string;
  createdAt: string;
  /** Подпись в UI: слушатель или проверяющий (менеджер/админ). */
  authorLabel: 'Слушатель' | 'Проверяющий';
};

export function threadCommentLabel(
  authorUserId: string,
  verificationOwnerUserId: string
): ThreadCommentSerialized['authorLabel'] {
  return authorUserId === verificationOwnerUserId ? 'Слушатель' : 'Проверяющий';
}

export function serializeThreadComment(
  row: { id: string; authorUserId: string; body: string; createdAt: Date },
  verificationOwnerUserId: string
): ThreadCommentSerialized {
  return {
    id: row.id,
    authorUserId: row.authorUserId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    authorLabel: threadCommentLabel(row.authorUserId, verificationOwnerUserId),
  };
}
