/**
 * Записывает типовые шаблоны писем об оплате в SystemSetting, если ключ отсутствует или значение пустое.
 * Запуск: npm run db:upsert-payment-email-templates
 */
import { prisma } from '../lib/db';
import { DEFAULT_PAYMENT_EMAIL_TEMPLATES, clearPaymentEmailTemplatesCache } from '../lib/settings';

const ENTRIES: [string, string][] = [
  ['email_payment_course_subject', DEFAULT_PAYMENT_EMAIL_TEMPLATES.courseSubject],
  ['email_payment_course_body', DEFAULT_PAYMENT_EMAIL_TEMPLATES.courseBody],
  ['email_payment_generic_subject', DEFAULT_PAYMENT_EMAIL_TEMPLATES.genericSubject],
  ['email_payment_generic_body', DEFAULT_PAYMENT_EMAIL_TEMPLATES.genericBody],
];

async function main() {
  let wrote = 0;
  for (const [key, value] of ENTRIES) {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    if (!row || !row.value.trim()) {
      await prisma.systemSetting.upsert({
        where: { key },
        create: { key, value, category: 'payment_email' },
        update: { value },
      });
      wrote += 1;
    }
  }
  clearPaymentEmailTemplatesCache();
  console.log(`[upsert-payment-email-templates] обновлено ключей: ${wrote} из ${ENTRIES.length}`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
