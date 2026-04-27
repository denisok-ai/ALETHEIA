/**
 * Статические проверки цепочки оплаты без PayKeeper: товары, ключи заказа, привязка к курсу.
 * Запуск: npm run test:payment-flow
 */
import {
  assertServiceLinkedToCourse,
  orderTariffIdForStorage,
  type ServiceForOrderTariff,
} from '../lib/order-service';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const sample: ServiceForOrderTariff = {
  id: 'c1',
  courseId: 'course-1',
  paykeeperTariffId: 'pk-99',
  slug: 'my-slug',
  name: 'Тест',
  price: 1000,
};

assert(orderTariffIdForStorage(sample) === 'pk-99', 'orderTariffIdForStorage prefers paykeeperTariffId');

const noPk: ServiceForOrderTariff = { ...sample, paykeeperTariffId: null };
assert(orderTariffIdForStorage(noPk) === 'my-slug', 'orderTariffIdForStorage falls back to slug');

const a1 = assertServiceLinkedToCourse(null);
assert(!a1.ok && a1.error.length > 0, 'null service → error');

const a2 = assertServiceLinkedToCourse({ ...sample, courseId: null });
assert(!a2.ok, 'no courseId → error');

const a3 = assertServiceLinkedToCourse(sample);
assert(a3.ok && a3.courseId === 'course-1', 'valid service → courseId');

console.log('payment-flow-check: OK');
