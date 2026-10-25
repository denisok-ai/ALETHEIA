import { articleDates } from '@/lib/content/article-dates';

/**
 * Даты существенной переработки статей блога (ручные, для статей базы знаний).
 *
 * Для lastmod в sitemap берётся только эта дата: `BlogPost.updatedAt` меняется и от
 * технических правок (обложка, пересохранение в админке), и поисковик увидел бы
 * «обновление» без нового текста. Сюда дата вносится вручную, когда текст статьи
 * действительно расширен (см. `--refresh` в blog-publish-kb-articles).
 *
 * dateModified и строка «Обновлено» на странице статьи учитывают и `updatedAt`,
 * см. lib/content/article-dates.ts.
 */
export const KB_REVISED: Record<string, string> = {
  'myshechnoe-testirovanie-dlya-psihologov': '2026-10-18',
  'myshechnoe-testirovanie-obuchenie': '2026-10-18',
  // 13.10.2026: практикум «Тело знает всё» (самостоятельно, без кураторов и сертификата)
  'chem-otlichaetsya-ot-kursov-samorazvitiya': '2026-10-25',
  'gruppovoy-ili-individualnyy-format': '2026-10-18',
  'zhivye-sessii-v-onlayn-obuchenii': '2026-10-18',
  'ponimayu-no-nichego-ne-menyaetsya': '2026-10-18',
  'vnutrenniy-konflikt-i-telo': '2026-10-18',
  'sverka-balansa-pered-testom': '2026-10-18',
  'ustalost-ne-prohodit-posle-otdyha': '2026-10-25',
  'tatyana-streltsova': '2026-10-18',
  'myshechnoe-testirovanie-pravda-ili-samovnushenie': '2026-10-18',
  'chto-takoe-myshechnoe-testirovanie': '2026-10-18',
  'prikladnaya-kineziologiya-prostymi-slovami': '2026-10-18',
  'kto-takoy-kineziolog': '2026-10-18',
  'stress-nakaplivaetsya-v-tele': '2026-10-25',
  'karta-emotsiy': '2026-10-18',
  'kak-vybrat-kurs-avaterra': '2026-10-18',
  'emotsionalnyy-zaryad': '2026-10-18',
  'dengi-i-telesnye-ubezhdeniya': '2026-10-18',
  'strah-proyavlyatsya': '2026-10-18',
  'myshechnoe-testirovanie-na-sebe': '2026-10-16',
  // 16.10.2026: переработка под запросы «мышечный тест самостоятельно» и «жизнь на автопилоте»
  'zhizn-na-avtopilote': '2026-10-18',
  'lobnyy-obhvat': '2026-10-18',
  'starye-obidy-i-otnosheniya': '2026-10-18',
  'myshechnoe-testirovanie-komu-podhodit-i-kogda-nuzhen-vrach': '2026-10-18',
  // 18.10.2026: правки по независимой экспертной проверке (юрист, клинический психолог, редактор)
  'praktiki-osoznannosti-s-chego-nachat': '2026-10-18',
};

/** Дата последнего изменения статьи для dateModified и modifiedTime (ISO). Логика — в article-dates. */
export function blogModifiedAt(slug: string, publishedAt: string | Date, updatedAt?: string | Date | null): string {
  return articleDates({ publishedAt, updatedAt, kbRevised: KB_REVISED[slug] ?? null }).modified;
}
