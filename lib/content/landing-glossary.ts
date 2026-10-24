/**
 * Блок «Словарь телесных практик» на главной: карточки терминов глоссария.
 *
 * Зачем (аудит Google 24.10.2026, docs/seo/google-seo-playbook-2026-10-24.md):
 * Google показывает почти только страницы глоссария, а хаб `/glossary` и
 * страница курса почти не получают ссылок из содержимого сильных страниц.
 * Главная — самая сильная страница сайта, поэтому ссылки с неё на термины,
 * которые уже получают показы, — быстрый сигнал для краулера.
 *
 * Порядок и состав — по показам Search Console за 3 месяца на 24.10:
 * avtopilot (48 показов, поз. 8), myshechnoe-testirovanie (30), emotsionalnyy-zaryad
 * и telesnaya-pamyat (по 22), samotestirovanie (9), otvet-tela (6); praktika-prisutstviya —
 * поз. 3,4 с одним кликом; kineziolog — кластер «кинезиолог…» (≈11 показов).
 */
import { getGlossaryTerm, type GlossaryTerm } from './glossary';

export const LANDING_GLOSSARY_SLUGS = [
  'avtopilot',
  'telesnaya-pamyat',
  'emotsionalnyy-zaryad',
  'myshechnoe-testirovanie',
  'samotestirovanie',
  'otvet-tela',
  'kineziolog',
  'praktika-prisutstviya',
] as const;

/** Предельная длина определения на карточке (знаков, с многоточием — чуть больше). */
export const LANDING_GLOSSARY_EXCERPT_MAX = 140;

/**
 * Короткий текст для карточки: целые слова, без обрыва посреди слова.
 * Если обрезать не по чему (одно длинное слово) — режем жёстко.
 */
export function glossaryExcerpt(text: string, max = LANDING_GLOSSARY_EXCERPT_MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,;:.!?—–-]+$/u, '')}…`;
}

export type LandingGlossaryCard = { slug: string; term: string; excerpt: string };

/** Карточки для главной в порядке LANDING_GLOSSARY_SLUGS. Неизвестный slug пропускаем, не падаем. */
export function landingGlossaryCards(): LandingGlossaryCard[] {
  return LANDING_GLOSSARY_SLUGS.flatMap((slug) => {
    const t: GlossaryTerm | undefined = getGlossaryTerm(slug);
    if (!t) return [];
    return [{ slug: t.slug, term: t.term, excerpt: glossaryExcerpt(t.short) }];
  });
}
