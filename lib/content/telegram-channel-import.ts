/**
 * Импорт постов из публичного Telegram-канала в черновики блога.
 *
 * Источник — веб-версия канала (t.me/s/<канал>): она отдаётся обычным HTML без
 * авторизации и токена бота. Забираются текст, фотография и дата поста.
 *
 * Фотографии скачиваются к себе, а не подставляются ссылкой на CDN телеграма:
 * такие ссылки живут не вечно, и однажды в статьях остались бы битые картинки.
 *
 * Посты создаются ЧЕРНОВИКАМИ — ничего не появляется на сайте само. Публикация
 * остаётся решением человека.
 */
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/db';
import { telegramWebFetch } from '@/lib/telegram-fetch';

export type ImportedPost = {
  sourceUrl: string;
  text: string;
  photoUrl: string | null;
  date: Date | null;
};

export type ImportResult = {
  found: number;
  created: number;
  skipped: number;
  photosSaved: number;
  errors: string[];
  createdSlugs: string[];
};

const UPLOAD_SUBDIR = path.join('public', 'uploads', 'blog');
const PUBLIC_PREFIX = '/uploads/blog';
/** Ограничение на картинку — защита от неожиданно большого файла. */
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** HTML поста → текст с абзацами. <br> в телеграме разделяет строки. */
function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
  )
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Разбор веб-версии канала. Формат HTML телеграма может измениться — тогда
 *  вернётся пустой список, и это видно по found: 0 в отчёте. */
export function parseChannelHtml(html: string): ImportedPost[] {
  const posts: ImportedPost[] = [];
  const blocks = html.split('tgme_widget_message_wrap').slice(1);

  /**
   * Фото и текст в канале — РАЗНЫЕ сообщения, идущие парами (26 картинка,
   * 27 текст, 28 картинка, 29 текст…). Проверено на avaterrapro: из 20
   * сообщений 10 содержат только фото и 10 только текст, совмещённых нет.
   * Поэтому картинка запоминается и присоединяется к следующему тексту.
   */
  let pendingPhoto: string | null = null;

  for (const block of blocks) {
    const idMatch = block.match(/data-post="([^"]+)"/);
    if (!idMatch) continue;
    const sourceUrl = `https://t.me/${idMatch[1]}`;

    const photoMatch = block.match(
      /tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/
    );
    const textMatch = block.match(
      /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/
    );
    const text = textMatch ? htmlToText(textMatch[1]) : '';

    if (!text) {
      // Сообщение без текста: если в нём картинка — придержим её для следующего.
      if (photoMatch) pendingPhoto = photoMatch[1];
      continue;
    }

    const dateMatch = block.match(/datetime="([^"]+)"/);
    posts.push({
      sourceUrl,
      text,
      // Своя картинка (если пост с подписью) важнее придержанной.
      photoUrl: photoMatch ? photoMatch[1] : pendingPhoto,
      date: dateMatch ? new Date(dateMatch[1]) : null,
    });
    pendingPhoto = null;
  }

  return posts;
}

/** Транслитерация для адреса статьи: он попадает в URL и должен быть латиницей. */
const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
};

export function slugFromText(text: string, fallback: string): string {
  const firstLine = text.split('\n')[0] ?? '';
  const full = firstLine
    .toLowerCase()
    .split('')
    .map((ch) => (TRANSLIT[ch] !== undefined ? TRANSLIT[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (full.length <= 60) return full || fallback;

  // Обрезаем по границе слова, а не посреди него: адрес видно в поисковой
  // выдаче, и «...eto-zhe-oc» читается как ошибка.
  const cut = full.slice(0, 60);
  const lastDash = cut.lastIndexOf('-');
  const slug = (lastDash > 20 ? cut.slice(0, lastDash) : cut).replace(/-+$/g, '');
  return slug || fallback;
}

/** Заголовок — первое предложение поста: в канале заголовков нет. */
export function titleFromText(text: string): string {
  const firstLine = (text.split('\n')[0] ?? '').trim();
  const sentence = firstLine.split(/(?<=[.!?])\s/)[0] ?? firstLine;
  const t = (sentence || firstLine).trim();
  return t.length > 200 ? `${t.slice(0, 197)}…` : t;
}

/** Описание для выдачи — начало текста без заголовка. */
export function descriptionFromText(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 300 ? `${flat.slice(0, 297)}…` : flat;
}

/**
 * Скачивает фотографию поста в public/uploads/blog и возвращает публичный путь.
 * При любой неудаче — null: статья импортируется и без картинки.
 */
export async function savePhoto(photoUrl: string, slug: string): Promise<string | null> {
  try {
    const res = await telegramWebFetch(photoUrl, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;

    const len = Number(res.headers.get('content-length') ?? '0');
    if (len > MAX_PHOTO_BYTES) {
      console.warn(`[telegram-import] картинка слишком велика (${len} байт): ${slug}`);
      return null;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_PHOTO_BYTES) return null;

    const dir = path.join(process.cwd(), UPLOAD_SUBDIR);
    await mkdir(dir, { recursive: true });
    const fileName = `${slug}.jpg`;
    await writeFile(path.join(dir, fileName), buf);
    return `${PUBLIC_PREFIX}/${fileName}`;
  } catch (e) {
    console.error(`[telegram-import] не удалось сохранить картинку для ${slug}:`, e);
    return null;
  }
}

/**
 * Забирает посты канала и создаёт черновики.
 *
 * Повторный запуск безопасен: посты сопоставляются по ссылке на оригинал
 * (BlogPost.sourceUrl уникален), уже импортированные пропускаются.
 */
export async function importChannelPosts(
  channel: string,
  options: { limit?: number; dryRun?: boolean } = {}
): Promise<ImportResult> {
  const result: ImportResult = {
    found: 0,
    created: 0,
    skipped: 0,
    photosSaved: 0,
    errors: [],
    createdSlugs: [],
  };

  const res = await telegramWebFetch(`https://t.me/s/${channel}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AvaterraBlogImport/1.0)' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    result.errors.push(`Канал недоступен: HTTP ${res.status}`);
    return result;
  }

  const posts = parseChannelHtml(await res.text());
  result.found = posts.length;
  if (posts.length === 0) {
    result.errors.push('В канале не найдено постов — возможно, изменилась вёрстка Telegram.');
    return result;
  }

  const limited = options.limit ? posts.slice(0, options.limit) : posts;

  for (const post of limited) {
    try {
      const already = await prisma.blogPost.findUnique({ where: { sourceUrl: post.sourceUrl } });
      if (already) {
        result.skipped++;
        continue;
      }

      const messageId = post.sourceUrl.split('/').pop() ?? 'post';
      let slug = slugFromText(post.text, `tg-${messageId}`);
      // Адрес мог совпасть с уже существующей статьёй — добавляем номер поста.
      const clash = await prisma.blogPost.findUnique({ where: { slug } });
      if (clash) slug = `${slug}-${messageId}`.slice(0, 120);

      if (options.dryRun) {
        result.created++;
        result.createdSlugs.push(slug);
        continue;
      }

      let ogImage: string | null = null;
      if (post.photoUrl) {
        ogImage = await savePhoto(post.photoUrl, slug);
        if (ogImage) result.photosSaved++;
      }

      await prisma.blogPost.create({
        data: {
          slug,
          title: titleFromText(post.text),
          h1: titleFromText(post.text),
          description: descriptionFromText(post.text),
          body: post.text,
          bodyFormat: 'markdown',
          ogImage,
          // Фото поста годится и как превью, и как иллюстрация статьи.
          coverImage: ogImage,
          // Черновик: перенесённый пост не должен появляться на сайте сам.
          status: 'draft',
          publishedAt: null,
          source: 'telegram',
          sourceUrl: post.sourceUrl,
          createdAt: post.date ?? new Date(),
        },
      });

      result.created++;
      result.createdSlugs.push(slug);
    } catch (e) {
      result.errors.push(`${post.sourceUrl}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return result;
}
