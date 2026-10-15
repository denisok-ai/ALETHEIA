/**
 * Подпись поста для Telegram-канала школы (HTML, parse_mode=HTML).
 *
 * Формат (план T3.2/T3.5):
 *   <b>{title}</b>
 *
 *   {body}
 *
 *   <a href="{trackedUrl}">Практикум «Тело знает всё» →</a>
 *
 *   {hashtags}
 *
 * Проверки правил школы и трекинг ?ref= — из lib/social/captions.ts (buildCaption),
 * здесь только HTML-сборка. Лимит 1024 знака считаем по итоговой HTML-строке:
 * это строже, чем видимый текст после разбора тегов, и безопаснее.
 */
import { normalizePostLexicon } from '@/lib/content/quality-gates';
import { buildCaption, captionLimitFor } from './captions';

/** Страница практикума: куда ведёт ссылка из подписи. */
export const SCHOOL_COURSE_URL = 'https://avaterra.pro/course/navyki-myshechnogo-testirovaniya';
export const SCHOOL_LINK_TEXT = 'Практикум «Тело знает всё» →';
export const TELEGRAM_DEFAULT_HASHTAGS = '#мышечноетестирование #кинезиология #аватэрра';

/** Лимит подписи к медиа в Telegram (Bot API, знаков). */
export const TELEGRAM_CAPTION_LIMIT = 1024;
/** Лимит текста поста без медиа в Telegram (sendMessage, знаков). */
export const TELEGRAM_TEXT_LIMIT = 4096;
/** Лимит текста поста в MAX (знаков): подпись к видео — это текст сообщения. */
export const MAX_CAPTION_LIMIT = 4000;

/** Экранирование для parse_mode=HTML: достаточно &, <, >. */
export function escapeTelegramHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export type TelegramCaptionInput = {
  /**
   * Канал, для которого собираем подпись. MAX понимает то же HTML-подмножество (b, i, a),
   * отличается только лимит длины. По умолчанию telegram.
   */
  networkCode?: 'telegram' | 'max';
  title: string;
  body?: string;
  /** Метка ?ref=, например tg-01 (для MAX — mx-01). */
  refCode: string;
  /** Ссылка без метки; по умолчанию страница практикума. */
  url?: string;
  /** Строка хештегов; по умолчанию TELEGRAM_DEFAULT_HASHTAGS. */
  hashtags?: string;
  prohibitedPhrases?: readonly string[];
  /** Есть ли медиа. По умолчанию true (подпись к видео). false — текстовый пост: лимит длиннее. */
  hasMedia?: boolean;
};

export type TelegramCaptionResult = {
  /** Итоговая HTML-подпись: её и храним в SocialPost.caption и отправляем в Telegram. */
  caption: string;
  /** Пусто — подпись можно публиковать. Любое предупреждение = причина не публиковать как есть. */
  warnings: string[];
};

/** Подпись для Telegram и MAX: проверки правил, экранирование, ссылка с ?ref=. */
export function buildTelegramCaption(input: TelegramCaptionInput): TelegramCaptionResult {
  const networkCode = input.networkCode ?? 'telegram';
  const hasMedia = input.hasMedia !== false;
  const limit = captionLimitFor(networkCode, hasMedia);
  const url = input.url ?? SCHOOL_COURSE_URL;
  const hashtags = input.hashtags ?? TELEGRAM_DEFAULT_HASHTAGS;
  // Плоская версия прогоняет все проверки buildCaption (заголовок, запрещённые слова, стоп-слова).
  const plain = buildCaption({
    networkCode,
    title: input.title,
    body: input.body,
    url,
    refCode: input.refCode,
    hashtags,
    template: '{title}\n\n{body}\n\n{link}\n{hashtags}',
    prohibitedPhrases: input.prohibitedPhrases,
    hasMedia,
  });

  const title = normalizePostLexicon((input.title ?? '').trim());
  const body = normalizePostLexicon((input.body ?? '').trim());
  const parts = [
    title ? `<b>${escapeTelegramHtml(title)}</b>` : '',
    body ? escapeTelegramHtml(body) : '',
    `<a href="${escapeTelegramHtml(plain.link)}">${escapeTelegramHtml(SCHOOL_LINK_TEXT)}</a>`,
    hashtags ? escapeTelegramHtml(hashtags.trim()) : '',
  ].filter(Boolean);
  const caption = parts.join('\n\n');

  const warnings = [...plain.warnings];
  if (caption.length > limit) {
    const what = hasMedia ? 'подпись' : 'текст поста';
    warnings.push(
      `${what} длиннее ${limit} знаков после HTML-экранирования (сейчас ${caption.length}): сократите текст`,
    );
  }
  return { caption, warnings: [...new Set(warnings)] };
}
