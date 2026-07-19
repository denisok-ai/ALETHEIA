/**
 * Статьи блога сайта.
 *
 * Источник правды — таблица BlogPost. Прежние статьи жили в файле кода
 * (lib/content/course-lynda-teaser.ts), из-за чего блог нельзя было пополнить
 * без правки исходников и деплоя — это и было главным ограничением роста
 * поискового трафика.
 *
 * Пока в базе пусто, читаем из файла: тогда переключение страниц на базу
 * безопасно даже в момент, когда перенос ещё не выполнен, и блог не исчезает
 * с сайта. После переноса запасной вариант просто перестаёт срабатывать.
 */
import { prisma } from '@/lib/db';
import {
  BLOG_DEFAULT_OG_IMAGE,
  blogArticleBodies,
  blogPostsMeta,
} from '@/lib/content/course-lynda-teaser';

/**
 * Тело статьи в одном из двух видов. Оба поддерживаются намеренно: страница
 * рисует абзацы и markdown разной разметкой, и сведение к одному формату
 * незаметно изменило бы вид уже опубликованных статей.
 */
export type BlogPostBody = { kind: 'paragraphs'; paragraphs: string[] } | { kind: 'markdown'; markdown: string };

export type BlogPostView = {
  slug: string;
  title: string;
  h1: string;
  description: string;
  body: BlogPostBody;
  ogImage: string;
  /** Иллюстрация в теле статьи и в карточке списка. null — показывать нечего. */
  coverImage: string | null;
  publishedAt: string;
};

function parseBody(raw: string, format: string): BlogPostBody {
  if (format === 'paragraphs') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return { kind: 'paragraphs', paragraphs: parsed.filter((p): p is string => typeof p === 'string') };
      }
    } catch {
      /* испорченный JSON — ниже разберём как текст */
    }
    return {
      kind: 'paragraphs',
      paragraphs: raw.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
    };
  }
  return { kind: 'markdown', markdown: raw };
}

/** Статьи из файла кода — запасной источник, пока база не заполнена. */
function staticPosts(): BlogPostView[] {
  return blogPostsMeta.map((meta) => {
    const body = blogArticleBodies[meta.slug as keyof typeof blogArticleBodies];
    const view: BlogPostBody =
      body && 'markdown' in body
        ? { kind: 'markdown', markdown: body.markdown }
        : { kind: 'paragraphs', paragraphs: body && 'paragraphs' in body ? [...body.paragraphs] : [] };
    return {
      slug: meta.slug,
      title: meta.title,
      h1: body?.h1 ?? meta.title,
      description: meta.description,
      body: view,
      ogImage: meta.ogImage ?? BLOG_DEFAULT_OG_IMAGE,
      // У статей из файла иллюстрации нет — только карточка для соцсетей.
      coverImage: null,
      publishedAt: meta.publishedAt,
    };
  });
}

/** Опубликованные статьи, новые сверху. При ошибке БД — статьи из файла. */
export async function getPublishedBlogPosts(): Promise<BlogPostView[]> {
  try {
    const rows = await prisma.blogPost.findMany({
      where: { status: 'published' },
      orderBy: { publishedAt: 'desc' },
    });
    if (rows.length === 0) return staticPosts();
    return rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      h1: r.h1,
      description: r.description,
      body: parseBody(r.body, r.bodyFormat),
      ogImage: r.ogImage ?? BLOG_DEFAULT_OG_IMAGE,
      coverImage: r.coverImage,
      publishedAt: (r.publishedAt ?? r.createdAt).toISOString(),
    }));
  } catch (e) {
    console.error('[blog] БД недоступна, отдаю статьи из файла:', e);
    return staticPosts();
  }
}

/** Одна опубликованная статья по slug. null — страницы нет (отдаём 404). */
export async function getBlogPostBySlug(slug: string): Promise<BlogPostView | null> {
  const posts = await getPublishedBlogPosts();
  return posts.find((p) => p.slug === slug) ?? null;
}
