/**
 * Общая ошибка публикации для всех коннекторов (Telegram, MAX).
 *
 * Планировщик смотрит только на kind === 'flood' (лимит площадки — попытку не засчитываем)
 * и на ambiguous (исход неизвестен — автоматического повтора нет), поэтому эти поля общие.
 */
export class SocialPublishError extends Error {
  readonly kind: string;
  /** Сколько секунд просит подождать площадка (только для flood). */
  readonly retryAfterSec?: number;
  /**
   * Исход неизвестен: запрос могло получить, но ответа не дождались.
   * Такой пост нельзя повторять автоматически — в канале может уже лежать.
   */
  readonly ambiguous: boolean;

  constructor(kind: string, message: string, opts: { retryAfterSec?: number; ambiguous?: boolean } = {}) {
    super(message);
    this.name = 'SocialPublishError';
    this.kind = kind;
    this.retryAfterSec = opts.retryAfterSec;
    this.ambiguous = opts.ambiguous ?? false;
  }
}

/** Результат публикации в любой сети. */
export type SocialPublished = {
  messageId: string;
  /** Публичная ссылка на пост, если площадка её отдаёт. */
  url: string | null;
};
