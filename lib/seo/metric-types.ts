/**
 * Общий формат строки SEO-метрики (план docs/Plan-SEO-Social-2026-10.md, этап 1).
 *
 * Коннекторы (GSC, Метрика, Вебмастер) только возвращают такие строки — без БД.
 * Запись в SeoMetric делает lib/seo/store.ts, оркестрация — lib/seo/sync.ts.
 *
 * Правило из decision-rules MM: цифры разных источников не смешиваем — source
 * входит в ключ, сравнения и суммы делаются только внутри одного source.
 */

/** Откуда цифра. */
export type SeoSource = 'gsc' | 'metrika' | 'webmaster';

/**
 * Разрез:
 *  - total   — итог за день по сайту (key = имя показателя: clicks, impressions, visits…);
 *  - query   — поисковый запрос (key = текст запроса);
 *  - page    — страница (key = URL);
 *  - traffic_source — источник трафика Метрики (key = organic, direct, social…);
 *  - goal    — цель Метрики (key = id цели);
 *  - indexing — индексация Вебмастера (key = searchable, excluded…).
 */
export type SeoDimension = 'total' | 'query' | 'page' | 'traffic_source' | 'goal' | 'indexing';

/** Имя показателя. Для query/page у GSC — по строке на показатель. */
export type SeoMeasure =
  | 'clicks'
  | 'impressions'
  | 'ctr'
  | 'position'
  | 'visits'
  | 'users'
  | 'pageviews'
  | 'bounce_rate'
  | 'reaches'
  | 'pages';

export type SeoMetricRow = {
  /** Хост без протокола: avaterra.pro. */
  host: string;
  source: SeoSource;
  /** День по Москве, YYYY-MM-DD. */
  date: string;
  dimension: SeoDimension;
  /** Значение разреза: запрос, URL, источник; для total — пустая строка. */
  key: string;
  measure: SeoMeasure;
  value: number;
};

/** Состояние коннектора — как в MM: не настроен / ошибка / ок. */
export type SeoConnectorStatus =
  | { state: 'not_configured'; reason: string }
  | { state: 'error'; reason: string }
  | { state: 'ok' };

export const SEO_HOST = 'avaterra.pro';
