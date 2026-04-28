/**
 * Диагностика PayKeeper по настройкам из БД (без реальной оплаты).
 * Запуск из корня: npm run paykeeper:debug
 * Требуется DATABASE_URL и заполненные ключи в SystemSetting (Портал → Настройки → Платежи).
 */
import { testPayKeeperConnection } from '../lib/paykeeper';

async function main() {
  console.log('PayKeeper debug: запрос токена (как «Проверить PayKeeper» в админке)…');
  const r = await testPayKeeperConnection();
  if (r.ok) {
    console.log('OK: PayKeeper ответил, токен извлечён. Следующий шаг — POST /api/payment/create или оплата на сайте.');
    process.exit(0);
  }
  console.error('FAIL:', r.error);
  console.error('Проверьте server/login/password/secret в админке и POST-оповещение в кабинете PayKeeper.');
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
