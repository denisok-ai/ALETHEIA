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
import { buildCaption } from './captions';

/** Страница практикума: куда ведёт ссылка из подписи. */
export const SCHOOL_COURSE_URL = 'https://avaterra.pro/course/navyki-myshechnogo-testirovaniya';
export const SCHOOL_LINK_TEXT = 'Практикум «Тело знает всё» →';
export const TELEGRAM_DEFAULT_HASHTAGS = '#мышечноетестирование #кинезиология #аватэрра';

/** Лимит подписи к медиа в Telegram (Bot API, знаков). */
export const TELEGRAM_CAPTION_LIMIT = 1024;

/** Экранирование для parse_mode=HTML: достаточно &, <, >. */
export function escapeTelegramHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export type TelegramCaptionInput = {
  title: string;
  body?: string;
  /** Метка ?ref=, например tg-01. */
  refCode: string;
  /** Ссылка без метки; по умолчанию страница практикума. */
  url?: string;
  /** Строка хештегов; по умолчанию TELEGRAM_DEFAULT_HASHTAGS. */
  hashtags?: string;
  prohibitedPhrases?: readonly string[];
};

export type TelegramCaptionResult = {
  /** Итоговая HTML-подпись: её и храним в SocialPost.caption и отправляем в Telegram. */
  caption: string;
  /** Пусто — подпись можно публиковать. Любое предупреждение = причина не публиковать как есть. */
  warnings: string[];
};

/** Подпись для Telegram: проверки правил, экранирование, ссылка с ?ref=. */
export function buildTelegramCaption(input: TelegramCaptionInput): TelegramCaptionResult {
  const url = input.url ?? SCHOOL_COURSE_URL;
  const hashtags = input.hashtags ?? TELEGRAM_DEFAULT_HASHTAGS;
  // Плоская версия прогоняет все проверки buildCaption (заголовок, запрещённые слова, стоп-слова).
  const plain = buildCaption({
    networkCode: 'telegram',
    title: input.title,
    body: input.body,
    url,
    refCode: input.refCode,
    hashtags,
    template: '{title}\n\n{body}\n\n{link}\n{hashtags}',
    prohibitedPhrases: input.prohibitedPhrases,
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
  if (caption.length > TELEGRAM_CAPTION_LIMIT) {
    warnings.push(
      `подпись длиннее ${TELEGRAM_CAPTION_LIMIT} знаков после HTML-экранирования (сейчас ${caption.length}): сократите текст`,
    );
  }
  return { caption, warnings: [...new Set(warnings)] };
}
