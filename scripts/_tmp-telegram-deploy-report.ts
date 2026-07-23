/**
 * Одноразовое Telegram-оповещение админам о деплое и почте.
 */
import { notifyAdminsTelegram } from '../lib/telegram-admin-notify';

const lines = process.argv.slice(2);
if (lines.length === 0) {
  console.error('Usage: npx tsx scripts/_tmp-telegram-deploy-report.ts "line1" "line2" ...');
  process.exit(1);
}

notifyAdminsTelegram('payment_needs_attention', lines)
  .then((r) => {
    console.log(JSON.stringify(r));
    process.exit(r.sent > 0 ? 0 : 1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
