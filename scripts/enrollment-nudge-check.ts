/**
 * Проверки окна напоминаний «записались, но курс не открыли»
 * (lib/enrollment-nudge.ts). Запуск: npx tsx scripts/enrollment-nudge-check.ts
 *
 * Тестируем чистую логику (границы окна, обращение по имени); работа с БД и
 * отправка проверяются dry-run-прогоном cron-роута на живых данных.
 */
import assert from 'node:assert';
import { nudgeWindow, personalGreeting } from '../lib/enrollment-nudge';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = 1_785_000_000_000; // фиксированное «сейчас», чтобы тест был детерминирован

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

// Кандидат подходит, если enrolledAt в [minEnrolled; maxEnrolled].
function inWindow(enrolledAtMs: number): boolean {
  const { minEnrolled, maxEnrolled } = nudgeWindow(NOW);
  return enrolledAtMs >= minEnrolled.getTime() && enrolledAtMs <= maxEnrolled.getTime();
}

check('только что записавшийся (1 ч) — рано, не в окне', () => {
  assert.strictEqual(inWindow(NOW - 1 * HOUR), false);
});

check('ровно 24 ч — уже в окне', () => {
  assert.strictEqual(inWindow(NOW - 24 * HOUR), true);
});

check('23 ч 59 мин — ещё рано', () => {
  assert.strictEqual(inWindow(NOW - (24 * HOUR - 60_000)), false);
});

check('3 дня — в окне', () => {
  assert.strictEqual(inWindow(NOW - 3 * DAY), true);
});

check('ровно 7 дней — ещё в окне', () => {
  assert.strictEqual(inWindow(NOW - 7 * DAY), true);
});

check('8 дней — уже поздно, остывшую запись не будим', () => {
  assert.strictEqual(inWindow(NOW - 8 * DAY), false);
});

check('имя-логин из email — без имени в обращении', () => {
  assert.strictEqual(personalGreeting('e.lelekova1'), 'Здравствуйте!');
  assert.strictEqual(personalGreeting('user@mail.ru'), 'Здравствуйте!');
  assert.strictEqual(personalGreeting(''), 'Здравствуйте!');
  assert.strictEqual(personalGreeting(null), 'Здравствуйте!');
});

check('настоящее имя — с обращением', () => {
  assert.strictEqual(personalGreeting('Елена Лелекова'), 'Здравствуйте, Елена Лелекова!');
});

console.log(failed ? `\n${failed} проверок упало` : '\nВсе проверки пройдены');
process.exit(failed ? 1 : 0);
