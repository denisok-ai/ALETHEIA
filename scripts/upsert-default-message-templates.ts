/**
 * Создаёт отсутствующие типовые шаблоны CommsTemplate по стабильным именам `[AVATERRA] …`.
 * Записи с тем же именем не перезаписываются, если не передан `--force`.
 *
 * Использование:
 *   npm run db:upsert-comms-templates
 *   npx tsx scripts/upsert-default-message-templates.ts --force
 */
import { prisma } from '../lib/db';
import { DEFAULT_COMMS_TEMPLATE_SEEDS } from '../lib/default-comms-templates';

async function main() {
  const force = process.argv.includes('--force');
  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const seed of DEFAULT_COMMS_TEMPLATE_SEEDS) {
    const existing = await prisma.commsTemplate.findFirst({
      where: { name: seed.name },
    });

    if (existing && !force) {
      skipped += 1;
      continue;
    }

    if (existing && force) {
      await prisma.commsTemplate.update({
        where: { id: existing.id },
        data: {
          channel: seed.channel,
          subject: seed.subject,
          htmlBody: seed.htmlBody,
          variables: seed.variables,
        },
      });
      updated += 1;
      continue;
    }

    await prisma.commsTemplate.create({
      data: {
        name: seed.name,
        channel: seed.channel,
        subject: seed.subject,
        htmlBody: seed.htmlBody,
        variables: seed.variables,
      },
    });
    created += 1;
  }

  console.log(
    `[upsert-default-message-templates] created=${created} skipped=${skipped} updated=${updated} force=${force}`
  );
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
