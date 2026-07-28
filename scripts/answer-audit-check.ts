/**
 * Проверки сверки ответа бота с каталогом (lib/ai/answer-audit.ts).
 * Запуск: npx tsx scripts/answer-audit-check.ts
 *
 * Половина проверок — на ЛОЖНЫЕ срабатывания: детектор, который шумит,
 * админы перестанут читать, и он станет бесполезен.
 */
import assert from 'node:assert';
import { auditAnswerAgainstCatalog } from '../lib/ai/answer-audit';
import type { PublicProduct } from '../lib/shop/public-products';

// courseTitle совпадает с полным именем тарифа — как на проде: «Аватера»: Практик,
// а НЕ голое «Аватера». Прежняя фикстура с courseTitle:'Аватера' маскировала
// ложную тревогу на упоминание линейки (инцидент 2026-07-28).
const product = (over: Partial<PublicProduct>): PublicProduct => ({
  slug: 'praktik',
  name: 'Аватера: Практик',
  price: 25000,
  cardDescription: '',
  fullDescription: '',
  features: [],
  imageUrl: null,
  courseId: 'c1',
  courseTitle: 'Аватера: Практик',
  courseDescription: null,
  installmentEnabled: false,
  maxInstallments: 1,
  updatedAt: new Date(),
  ...over,
});

const CATALOG: PublicProduct[] = [
  product({}),
  product({
    slug: 'master',
    name: 'Аватера: Мастер',
    price: 60000,
    courseTitle: 'Аватера: Мастер',
    installmentEnabled: true,
    maxInstallments: 4,
  }),
];

let failed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}\n     ${(e as Error).message}`);
  }
}

// --- Должен находить ---

check('выдуманная цена', () => {
  const f = auditAnswerAgainstCatalog('Тариф «Аватера: Практик» стоит 19 900 ₽.', CATALOG);
  assert.deepStrictEqual(f, [{ kind: 'unknown_price', value: '19 900 ₽' }]);
});

check('выдуманный тариф', () => {
  const f = auditAnswerAgainstCatalog('Есть тариф «Премиум Плюс» для продвинутых.', CATALOG);
  assert.deepStrictEqual(f, [{ kind: 'unknown_tariff', value: 'Премиум Плюс' }]);
});

check('цена в формате «руб.»', () => {
  const f = auditAnswerAgainstCatalog('Стоимость — 12000 руб.', CATALOG);
  assert.strictEqual(f.length, 1);
  assert.strictEqual(f[0].kind, 'unknown_price');
});

check('повтор одной ошибки не дублируется', () => {
  const f = auditAnswerAgainstCatalog('Цена 19 900 ₽. Да, именно 19 900 ₽.', CATALOG);
  assert.strictEqual(f.length, 1);
});

// --- Не должен находить (ложные срабатывания) ---

check('верная цена из каталога', () => {
  assert.deepStrictEqual(
    auditAnswerAgainstCatalog('Тариф «Аватера: Практик» — 25 000 ₽.', CATALOG),
    []
  );
});

check('верный платёж по рассрочке', () => {
  // 60000 / 4 = 15000
  assert.deepStrictEqual(
    auditAnswerAgainstCatalog('«Аватера: Мастер» — от 15 000 ₽ в месяц.', CATALOG),
    []
  );
});

check('рассрочка на 3 месяца (60000/3 = 20000)', () => {
  assert.deepStrictEqual(auditAnswerAgainstCatalog('Можно платить 20 000 ₽ ×3.', CATALOG), []);
});

check('голая линейка «Аватера» в контексте тарифа — не ложная тревога', () => {
  // Реальные тарифы — «Аватера: Практик»/«Аватера: Мастер»; «Аватера» это линейка.
  assert.deepStrictEqual(
    auditAnswerAgainstCatalog('Тариф «Аватера» — это линейка: есть «Аватера: Практик» и «Аватера: Мастер».', CATALOG),
    []
  );
});

check('ведущий сегмент до разделителя — не тариф даже при слове «стоимость»', () => {
  const withDash = product({ slug: 'grp', name: 'Пробуждение — групповой формат', courseTitle: 'Пробуждение', price: 22000 });
  assert.deepStrictEqual(
    auditAnswerAgainstCatalog('Стоимость тарифа «Пробуждение» — уточните на сайте.', [...CATALOG, withDash]),
    []
  );
});

check('название курса в кавычках — не тариф', () => {
  assert.deepStrictEqual(
    auditAnswerAgainstCatalog('Курс «Аватера» посвящён телесным практикам.', CATALOG),
    []
  );
});

check('цитата в кавычках без контекста цены', () => {
  assert.deepStrictEqual(
    auditAnswerAgainstCatalog('Мы говорим: «тело не врёт» — и это основа метода.', CATALOG),
    []
  );
});

check('мелкие числа с рублями не считаются ценой тарифа', () => {
  assert.deepStrictEqual(auditAnswerAgainstCatalog('Округление до 1 рубля.', CATALOG), []);
});

check('числа без валюты игнорируются', () => {
  assert.deepStrictEqual(
    auditAnswerAgainstCatalog('Курс идёт 8 недель, стартовал в 2026 году, 300 участников.', CATALOG),
    []
  );
});

check('пустой каталог — молчим (нет источника правды)', () => {
  assert.deepStrictEqual(auditAnswerAgainstCatalog('Тариф «Что угодно» — 1 ₽.', []), []);
});

check('ответ без цен и тарифов', () => {
  assert.deepStrictEqual(
    auditAnswerAgainstCatalog('Мышечный тест помогает найти телесный отклик.', CATALOG),
    []
  );
});

console.log(failed ? `\n${failed} проверок упало` : '\nВсе проверки пройдены');
process.exit(failed ? 1 : 0);
