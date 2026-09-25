/**
 * Чистые модули контента: FAQ-матчер бота, markdown→Telegram-HTML,
 * тематическая перелинковка блога. Кейсы — из реальных находок аудита.
 */
import { describe, expect, it } from 'vitest';
import { matchFaqAnswer } from '@/lib/telegram-bot/faq-match';
import { markdownToTelegramHtml } from '@/lib/telegram-bot/ai-answer';
import { computeRelated, topicsOf } from '@/lib/content/blog-related';

describe('faq-match: детерминированный ответ бота', () => {
  it('прямой вопрос из FAQ находит ответ', () => {
    const m = matchFaqAnswer('Нужен ли партнёр для практики?');
    expect(m).not.toBeNull();
    expect(m!.answer.length).toBeGreaterThan(20);
  });

  it('вопрос о границах метода / противопоказаниях (синхронизация баз знаний)', () => {
    const m = matchFaqAnswer('есть ли противопоказания, кому не подходит?');
    expect(m).not.toBeNull();
    expect(m!.answer).toMatch(/врач|психотерапевт/i);
  });

  it('стоп-темы (бесплатно/скидка/промокод) не отвечаются FAQ — уходят человеку', () => {
    expect(matchFaqAnswer('есть ли скидка или промокод?')).toBeNull();
  });

  it('мусор и благодарности — null, без исключений', () => {
    expect(matchFaqAnswer('𐍈𐍈 ;;; test')).toBeNull();
    expect(matchFaqAnswer('спасибо большое')).toBeNull();
  });
});

describe('markdownToTelegramHtml', () => {
  it('экранирует спецсимволы и разворачивает безопасное подмножество', () => {
    const html = markdownToTelegramHtml('**жирно** и *курсив*, `код`, a < b & c');
    expect(html).toContain('<b>жирно</b>');
    expect(html).toContain('<i>курсив</i>');
    expect(html).toContain('<code>код</code>');
    expect(html).toContain('a &lt; b &amp; c');
  });

  it('ссылки markdown → <a>, url не экранируется', () => {
    const html = markdownToTelegramHtml('см. [курс](https://avaterra.pro/course/x?a=1&b=2)');
    expect(html).toContain('<a href="https://avaterra.pro/course/x?a=1&b=2">курс</a>');
  });

  it('сырой HTML пользователя не проходит', () => {
    expect(markdownToTelegramHtml('<script>alert(1)</script>')).not.toContain('<script>');
  });
});

describe('blog-related: тематическая перелинковка', () => {
  const posts = [
    'chto-takoe-myshechnoe-testirovanie',
    'myshechnoe-testirovanie-na-sebe',
    'lobnyy-obhvat',
    'karta-emotsiy',
    'emotsionalnyy-zaryad',
    'dengi-i-telesnye-ubezhdeniya',
    'kak-vybrat-kurs-avaterra',
  ].map((slug, i) => ({ slug, title: slug, publishedAt: `2026-08-${String(20 - i).padStart(2, '0')}` }));

  it('темы выводятся из слага', () => {
    expect(topicsOf('myshechnoe-testirovanie-na-sebe')).toContain('method');
    expect(topicsOf('karta-emotsiy')).toContain('emotions');
  });

  it('статья о методе ссылается на статьи о методе, а не на соседей по дате', () => {
    const rel = computeRelated('myshechnoe-testirovanie-na-sebe', posts, 3).map((p) => p.slug);
    expect(rel).toHaveLength(3);
    expect(rel).not.toContain('myshechnoe-testirovanie-na-sebe');
    // В наборе две другие статьи о методе — они идут первыми, третья добирается соседом.
    expect(topicsOf(rel[0]).has('method')).toBe(true);
    expect(topicsOf(rel[1]).has('method')).toBe(true);
  });

  it('при нехватке тем добирает соседями — каждая статья достижима', () => {
    const rel = computeRelated('dengi-i-telesnye-ubezhdeniya', posts, 3);
    expect(rel).toHaveLength(3);
    expect(new Set(rel.map((p) => p.slug)).size).toBe(3);
  });
});

describe('sitemap-recrawl: разбор sitemap', () => {
  it('достаёт все <loc>, в том числе с пробелами', async () => {
    const { extractSitemapUrls } = await import('@/lib/seo/sitemap-recrawl');
    const xml = '<urlset><url><loc>https://a.ru/</loc></url><url><loc> https://a.ru/glossary/x </loc></url></urlset>';
    expect(extractSitemapUrls(xml)).toEqual(['https://a.ru/', 'https://a.ru/glossary/x']);
  });
});

describe('kb-revisions: дата изменения статьи', () => {
  it('переработанная статья — дата ревизии, прочие — дата публикации', async () => {
    const { blogModifiedAt, KB_REVISED } = await import('@/lib/content/kb-revisions');
    const slug = Object.keys(KB_REVISED)[0];
    expect(blogModifiedAt(slug, '2026-07-20T14:52:15Z').slice(0, 10)).toBe(KB_REVISED[slug]);
    expect(blogModifiedAt('net-takoy-stati', '2026-07-20T14:52:15Z')).toBe('2026-07-20T14:52:15.000Z');
    // Ревизия старше публикации не «омолаживает» статью назад
    expect(blogModifiedAt(slug, '2027-01-01T00:00:00Z')).toBe('2027-01-01T00:00:00.000Z');
  });

  it('у каждой ревизии есть статья в базе знаний', async () => {
    const { KB_REVISED } = await import('@/lib/content/kb-revisions');
    const { KB_SEO_ARTICLES } = await import('@/lib/content/kb-seo-articles');
    for (const slug of Object.keys(KB_REVISED)) expect(KB_SEO_ARTICLES.some((a) => a.slug === slug)).toBe(true);
  });
});
