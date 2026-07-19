/**
 * Актуальные тарифы из БД в виде текста для контекста LLM.
 *
 * База знаний в админке — статичный текст, и цены/состав тарифов в неё обычно не
 * попадают: бот отвечал «такой тариф не описан» на прямой вопрос о тарифе
 * (обнаружено на проде 2026-07-19). Этот блок добавляется к базе знаний на лету,
 * поэтому цены в ответах бота всегда совпадают с витриной.
 */
import { getPublicProducts } from '@/lib/shop/public-products';

/** Кэш: тарифы меняются редко, а чат вызывается часто. */
let cache: { at: number; value: string } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

function formatPrice(price: number): string {
  return price <= 0 ? 'бесплатно' : `${price.toLocaleString('ru-RU')} ₽`;
}

/**
 * Текстовый блок с тарифами (название, цена, состав, рассрочка, ссылка).
 * Пустая строка, если товаров нет или БД недоступна — вызывающий код это переживает.
 */
export async function buildLiveCatalogBlock(siteBase: string): Promise<string> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.value;

  let value = '';
  try {
    const products = await getPublicProducts();
    if (products.length) {
      const base = siteBase.replace(/\/$/, '');
      const lines = products.map((p) => {
        const installment =
          p.installmentEnabled && p.price >= 100 && p.maxInstallments >= 2
            ? ` Рассрочка: от ${Math.ceil(p.price / p.maxInstallments).toLocaleString('ru-RU')} ₽/мес.`
            : '';
        const features = p.features.length ? ` Что входит: ${p.features.join('; ')}.` : '';
        return [
          `— «${p.name}» — ${formatPrice(p.price)}.${installment}`,
          `  ${p.cardDescription}${features}`,
          `  Страница тарифа: ${base}/services/${p.slug}`,
        ].join('\n');
      });
      const names = products.map((p) => `«${p.name}»`).join(', ');
      value = [
        'АКТУАЛЬНЫЕ ТАРИФЫ И ЦЕНЫ (данные из витрины школы).',
        'ЭТОТ СПИСОК — ЕДИНСТВЕННЫЙ ИСТОЧНИК ПРАВДЫ О ТАРИФАХ.',
        `Существуют только эти тарифы: ${names}.`,
        'Если в тексте выше упоминаются другие названия тарифов — они устарели, ' +
          'НЕ упоминай их и не придумывай новые. Цены называй только отсюда.',
        '',
        ...lines,
        `Все тарифы: ${base}/services`,
      ].join('\n');
    }
  } catch {
    // БД недоступна — работаем без блока тарифов
    value = '';
  }

  cache = { at: now, value };
  return value;
}

/** Сброс кэша (после изменения товаров в админке). */
export function clearLiveCatalogCache(): void {
  cache = null;
}
