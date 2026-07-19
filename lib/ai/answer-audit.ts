/**
 * Сверка ответа бота с живым каталогом: цены и названия тарифов.
 *
 * Зачем: 2026-07-19 на проде бот назвал тарифы, которых нет в витрине. Инструкция
 * в промпте («этот список — единственный источник правды») снижает вероятность,
 * но не даёт гарантии — модель всё равно может назвать цену из устаревшей базы
 * знаний или выдумать пакет. Раньше такое уходило клиенту молча.
 *
 * Модуль НЕ правит и НЕ блокирует ответ: подмена текста на лету рискованнее самой
 * ошибки (легко испортить корректный ответ). Он только фиксирует расхождение,
 * чтобы админ узнал и починил базу знаний.
 */
import type { PublicProduct } from '@/lib/shop/public-products';

export type AnswerAuditFinding =
  | { kind: 'unknown_price'; value: string }
  | { kind: 'unknown_tariff'; value: string };

/** Суммы в рублях: «25 000 ₽», «25000 руб.», «3 500 рублей». */
const PRICE_RE = /(\d[\d\s ]{0,12}\d|\d)\s*(?:₽|руб\.?|рублей|рубля)/gi;

/** Названия в кавычках-ёлочках — так в каталоге и промпте оформлены тарифы. */
const QUOTED_RE = /«([^»]{2,60})»/g;

function digits(raw: string): number {
  return Number(raw.replace(/[\s ]/g, ''));
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[\s ]+/g, ' ').replace(/[«»"']/g, '').trim();
}

/**
 * Допустимые суммы: цена тарифа и любой платёж по рассрочке (цена / n, n = 2..max).
 * Рассрочка считается через ceil — как в блоке каталога и на витрине.
 */
function allowedPrices(products: PublicProduct[]): Set<number> {
  const set = new Set<number>();
  for (const p of products) {
    set.add(p.price);
    if (p.installmentEnabled && p.maxInstallments >= 2) {
      for (let n = 2; n <= p.maxInstallments; n++) {
        set.add(Math.ceil(p.price / n));
      }
    }
  }
  return set;
}

/**
 * Расхождения ответа с каталогом.
 *
 * Пустой каталог (БД недоступна) → пустой результат: без источника правды
 * сверять не с чем, и поднимать ложную тревогу на каждый ответ нельзя.
 */
export function auditAnswerAgainstCatalog(
  answer: string,
  products: PublicProduct[]
): AnswerAuditFinding[] {
  if (!answer.trim() || products.length === 0) return [];

  const findings: AnswerAuditFinding[] = [];
  const prices = allowedPrices(products);

  for (const m of answer.matchAll(PRICE_RE)) {
    const value = digits(m[1]);
    if (!Number.isFinite(value) || value <= 0) continue;
    // Мелкие суммы — это не цена тарифа (номера пунктов, «до 1000 знаков» и т.п.)
    if (value < 100) continue;
    if (!prices.has(value)) {
      findings.push({ kind: 'unknown_price', value: m[0].trim() });
    }
  }

  const known = new Set<string>();
  for (const p of products) {
    known.add(normalizeName(p.name));
    known.add(normalizeName(p.courseTitle));
  }

  for (const m of answer.matchAll(QUOTED_RE)) {
    const raw = m[1].trim();
    const name = normalizeName(raw);
    if (known.has(name)) continue;
    // В кавычках бывают курсы, книги и цитаты — тревожимся только там, где рядом
    // слово «тариф»/«пакет», то есть речь идёт именно о позиции витрины.
    const from = Math.max(0, (m.index ?? 0) - 60);
    const context = answer.slice(from, (m.index ?? 0) + raw.length + 30).toLowerCase();
    if (/тариф|пакет|стоимост|цен[аеуы]/.test(context)) {
      findings.push({ kind: 'unknown_tariff', value: raw });
    }
  }

  // Один и тот же промах часто встречается в ответе дважды — не дублируем
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.kind}:${f.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Тормоз тревог: одна и та же ошибка базы знаний повторится в каждом ответе,
 * и без ограничения админам придёт поток одинаковых сообщений — такие тревоги
 * быстро перестают читать. Не чаще одной на набор находок в 30 минут.
 */
const ALERT_TTL_MS = 30 * 60 * 1000;
const lastAlertAt = new Map<string, number>();

export function shouldAlert(findings: AnswerAuditFinding[], now = Date.now()): boolean {
  if (!findings.length) return false;
  const key = findings
    .map((f) => `${f.kind}:${f.value.toLowerCase()}`)
    .sort()
    .join('|');
  const prev = lastAlertAt.get(key);
  if (prev && now - prev < ALERT_TTL_MS) return false;
  lastAlertAt.set(key, now);
  // Карта не должна расти бесконечно в долгоживущем процессе
  if (lastAlertAt.size > 200) {
    for (const [k, at] of lastAlertAt) {
      if (now - at >= ALERT_TTL_MS) lastAlertAt.delete(k);
    }
  }
  return true;
}

/** Короткое описание для лога и Telegram. */
export function describeFindings(findings: AnswerAuditFinding[]): string {
  return findings
    .map((f) =>
      f.kind === 'unknown_price'
        ? `цена «${f.value}» отсутствует в витрине`
        : `тариф «${f.value}» отсутствует в витрине`
    )
    .join('; ');
}
