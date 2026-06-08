/**
 * Обновление базы знаний чат-бота на проде без tsx: `node scripts/run-knowledge-update.cjs [путь-к-md]`
 * По умолчанию читает scripts/chatbot-kb-body.md рядом с репозиторием.
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const defaultFile = path.join(__dirname, 'chatbot-kb-body.md');
const file = process.argv[2] ? path.resolve(process.argv[2]) : defaultFile;

const text = fs.readFileSync(file, 'utf8');
const prisma = new PrismaClient();

const KEY = 'chatbot_knowledge_base';

prisma.systemSetting
  .upsert({
    where: { key: KEY },
    create: { key: KEY, value: text, category: 'ai' },
    update: { value: text, category: 'ai' },
  })
  .then(() => {
    console.log(`[run-knowledge-update] Записано ${text.length} символов в SystemSetting.${KEY}.`);
  })
  .catch((e) => {
    console.error('[run-knowledge-update] FAILED:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
