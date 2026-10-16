/**
 * Подписи постов по сетям (T3.2): шаблон → текст с ссылкой ?ref=, хештегами и проверкой правил.
 *
 * Правила школы берём из существующих модулей, не дублируем:
 *  - normalizePostLexicon — замены «калибровка» и т. п. (lib/content/quality-gates.ts);
 *  - scanPublishBlockers — стоп-слова публикации (FAQ, «калибр…», «метод», латинская Avaterra, чужой домен);
 *  - запрещённые формулировки — передаёт вызывающий код из content/knowledge/avaterra.yaml
 *    (prohibited_phrases), чтобы этот модуль оставался без чтения файлов.
 *
 * Ничего не бросает на проверках контента: возвращаем warnings, решает вызывающий код
 * (планировщик не публикует пост с предупреждениями). Исключение — некорректная метка:
 * ссылка всё равно собирается, но с предупреждением.
 */
import { normalizePostLexicon, scanPublishBlockers } from '@/lib/content/quality-gates';
import { isValidRefCode, trackedUrl } from './refs';

/** Шаблон по умолчанию. Плейсхолдеры: {title} {body} {link} {hashtags}. Пустые строки схлопываются. */
export const DEFAULT_CAPTION_TEMPLATE = '{title}\n\n{body}\n\n{link}\n{hashtags}';

/** В Instagram ссылка в подписи не нажимается: вместо неё текст «Ссылка в профиле». */
const LINK_IN_BIO_NETWORKS = new Set(['instagram']);
const LINK_IN_BIO_TEXT = 'Ссылка в профиле';

/**
 * Предел подписи: наш, не лимит площадки. Telegram ограничивает подпись к видео/фото 1024 знаками.
 */
const CAPTION_LIMIT_DEFAULT = 2200;
const CAPTION_LIMITS: Readonly<Record<string, number>> = { telegram: 1024, max: 4000 };
/** Текст поста без медиа (sendMessage): у Telegram лимит 4096, у MAX тот же 4000. */
const TEXT_LIMITS: Readonly<Record<string, number>> = { telegram: 4096, max: 4000 };

const PLACEHOLDER_RE = /\{(title|body|link|hashtags)\}/g;

/** Хештеги из строки в порядке записи, без повторов (без учёта регистра). */
export function hashtagsOf(line: string): string[] {
  const seen: string[] = [];
  for (const token of (line ?? '').split(/\s+/)) {
    if (!token.startsWith('#') || token.length < 2) continue;
    if (seen.some((t) => t.toLowerCase() === token.toLowerCase())) continue;
    seen.push(token);
  }
  return seen;
}

/** Хештеги для конкретной сети: в YouTube Shorts добавляем #shorts. */
export function hashtagsFor(networkCode: string, line: string): string[] {
  const tags = hashtagsOf(line);
  if (networkCode === 'youtube' && !tags.some((t) => t.toLowerCase() === '#shorts')) {
    tags.push('#shorts');
  }
  return tags;
}

/** Ссылка в тексте подписи для сети: либо ссылка с меткой, либо «Ссылка в профиле». */
export function linkTextFor(networkCode: string, trackedLink: string): string {
  return LINK_IN_BIO_NETWORKS.has(networkCode) ? LINK_IN_BIO_TEXT : trackedLink;
}

/**
 * Частица «не» в заголовке (правило Татьяны: без «не» в названиях и заголовках).
 * Считается отдельным словом: «не» внутри «нет», «новый» не срабатывает.
 */
export function titleProblems(title: string): string[] {
  const standalone = /(^|[^\p{L}\p{N}])не(?![\p{L}\p{N}])/iu;
  if (!standalone.test(title ?? '')) return [];
  return ['В заголовке есть частица «не». По правилу Татьяны в названиях и заголовках её не пишем: переформулируйте утверждением.'];
}

/** Запрещённые формулировки из базы знаний. Строка — регулярное выражение; если не разбирается — поиск подстроки. */
export function prohibitedWarnings(text: string, phrases: readonly string[] = []): string[] {
  const warnings: string[] = [];
  for (const phrase of phrases) {
    let hit: boolean;
    try {
      hit = new RegExp(phrase, 'i').test(text);
    } catch {
      hit = text.toLowerCase().includes(phrase.toLowerCase());
    }
    if (hit) warnings.push(`запрещённая формулировка: «${phrase}»`);
  }
  return warnings;
}

/** Лимит знаков для сети: подпись к медиа или текст поста без медиа. */
export function captionLimitFor(networkCode: string, hasMedia: boolean): number {
  if (!hasMedia) return TEXT_LIMITS[networkCode] ?? CAPTION_LIMIT_DEFAULT;
  return CAPTION_LIMITS[networkCode] ?? CAPTION_LIMIT_DEFAULT;
}

/** Ссылка с меткой ?ref=: при ошибке возвращаем исходный URL и предупреждение. */
function linkWithRef(url: string, refCode: string, warnings: string[]): string {
  if (!isValidRefCode(refCode)) {
    warnings.push(`метка «${refCode}» некорректна: ссылка без ?ref=`);
    return url;
  }
  try {
    return trackedUrl(url, refCode);
  } catch (e) {
    warnings.push(`ссылка не разобрана: ${(e as Error).message}`);
    return url;
  }
}

/** Схлопываем пустые строки, которые оставили пустые плейсхолдеры, и обрезаем края. */
function collapseBlankLines(text: string): string {
  const out: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (line === '' && (out.length === 0 || out[out.length - 1] === '')) continue;
    out.push(line);
  }
  return out.join('\n').trim();
}

export type CaptionInput = {
  networkCode: string;
  title: string;
  body?: string;
  /** Ссылка на страницу сайта без метки. */
  url: string;
  /** Метка ?ref=, например tg-01. */
  refCode: string;
  /** Строка хештегов из правил: «#suno #aimusic». */
  hashtags?: string;
  /** Шаблон подписи; по умолчанию DEFAULT_CAPTION_TEMPLATE. */
  template?: string;
  /** Запрещённые формулировки (prohibited_phrases из avaterra.yaml). */
  prohibitedPhrases?: readonly string[];
  /** Есть ли медиа (ролик, картинка). По умолчанию true: подпись к медиа, лимит короче. false — текст поста. */
  hasMedia?: boolean;
};

export type CaptionResult = {
  caption: string;
  /** Ссылка, которая попала в подпись (с ?ref=, если метка корректна). */
  link: string;
  /** Пусто — подпись можно публиковать. Иначе — причины, по которым её не стоит публиковать как есть. */
  warnings: string[];
};

/** Подпись для одной сети по шаблону. Проверки контента — только в warnings. */
export function buildCaption(input: CaptionInput): CaptionResult {
  const warnings: string[] = [];
  const network = input.networkCode;
  const title = (input.title ?? '').trim();
  const body = (input.body ?? '').trim();
  const link = linkWithRef(input.url, input.refCode, warnings);

  const values: Record<string, string> = {
    title,
    body,
    link: linkTextFor(network, link),
    hashtags: hashtagsFor(network, input.hashtags ?? '').join(' '),
  };
  // Одним проходом: значение подстановки не попадает под следующую замену.
  const filled = (input.template ?? DEFAULT_CAPTION_TEMPLATE).replace(
    PLACEHOLDER_RE,
    (_match, key: string) => values[key] ?? '',
  );
  const caption = normalizePostLexicon(collapseBlankLines(filled));

  if (!caption) warnings.push('подпись пустая');
  const limit = captionLimitFor(network, input.hasMedia !== false);
  if (caption.length > limit) {
    warnings.push(`подпись длиннее ${limit} знаков (сейчас ${caption.length})`);
  }

  warnings.push(...titleProblems(title));
  warnings.push(...prohibitedWarnings(caption, input.prohibitedPhrases));
  warnings.push(...scanPublishBlockers(caption).map((issue) => issue.message));

  return { caption, link, warnings };
}

/** Сети «готовых постов»: владелец публикует вручную, подпись хранится плоским текстом (не HTML). */
export const READY_POST_NETWORKS = ['vk', 'dzen', 'rutube', 'youtube'] as const;
export type ReadyPostNetwork = (typeof READY_POST_NETWORKS)[number];

/** Хештеги по умолчанию для плоских подписей (без Telegram-HTML). */
export const PLAIN_DEFAULT_HASHTAGS = '#мышечноетестирование #кинезиология #аватэрра';
/** VK: не больше трёх хештегов в подписи (скил avaterra-post-writer). */
const VK_MAX_HASHTAGS = 3;
/** VK: короткий текст к клипу или ссылке, 300–600 знаков. */
const VK_CAPTION_MAX = 600;

export type PlainCaptionInput = {
  networkCode: ReadyPostNetwork;
  title: string;
  body?: string;
  /** Ссылка на страницу (без метки); метка добавится из refCode. */
  url: string;
  refCode: string;
  /** Строка хештегов; для VK обрежется до трёх, для Дзена не используется. */
  hashtags?: string;
  prohibitedPhrases?: readonly string[];
  /** Есть ли ролик (по умолчанию true). */
  hasMedia?: boolean;
};

/**
 * Плоская подпись для готового поста (VK, Дзен, Rutube, YouTube Shorts).
 * Шаблон по площадке: VK — текст + ссылка + до 3 хештегов; Дзен — текст + ссылка, без хештегов;
 * Rutube и YouTube — текст + ссылка + хештеги (#shorts для YouTube добавляет hashtagsFor).
 * Все проверки правил — в buildCaption; здесь только выбор шаблона и лимит VK.
 */
export function buildPlainCaption(input: PlainCaptionInput): CaptionResult {
  const network = input.networkCode;
  let hashtags = input.hashtags ?? PLAIN_DEFAULT_HASHTAGS;
  if (network === 'dzen') {
    hashtags = '';
  } else if (network === 'vk') {
    hashtags = hashtagsOf(hashtags).slice(0, VK_MAX_HASHTAGS).join(' ');
  }

  const template = network === 'dzen' ? '{title}\n\n{body}\n\n{link}' : DEFAULT_CAPTION_TEMPLATE;
  const result = buildCaption({
    networkCode: network,
    title: input.title,
    body: input.body,
    url: input.url,
    refCode: input.refCode,
    hashtags,
    template,
    prohibitedPhrases: input.prohibitedPhrases,
    hasMedia: input.hasMedia,
  });

  if (network === 'vk' && result.caption.length > VK_CAPTION_MAX) {
    result.warnings.push(`VK: подпись длиннее ${VK_CAPTION_MAX} знаков (сейчас ${result.caption.length}): сократите текст`);
  }
  return result;
}
