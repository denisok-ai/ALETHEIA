/**
 * Telegram bot webhook: receive updates, reply to commands, register admin chat IDs.
 * Validates X-Telegram-Bot-Api-Secret-Token when TELEGRAM_WEBHOOK_SECRET is set.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getEnvOverrides } from '@/lib/settings';
import { sendTelegramMessage } from '@/lib/telegram';
import { parseTelegramChatIds } from '@/lib/telegram-admin-notify';

const ADMIN_CHAT_IDS_KEY = 'telegram_admin_chat_ids';

async function appendAdminChatId(chatId: number): Promise<boolean> {
  const idStr = String(chatId);
  const row = await prisma.systemSetting.findUnique({ where: { key: ADMIN_CHAT_IDS_KEY } });
  const existing = parseTelegramChatIds(row?.value);
  if (existing.includes(idStr)) return false;
  const next = [...existing, idStr].join(',');
  await prisma.systemSetting.upsert({
    where: { key: ADMIN_CHAT_IDS_KEY },
    create: { key: ADMIN_CHAT_IDS_KEY, value: next, category: 'env' },
    update: { value: next },
  });
  return true;
}

export async function POST(request: NextRequest) {
  const overrides = await getEnvOverrides();
  const token = overrides.telegram_bot_token;
  if (!token) return NextResponse.json({ ok: false }, { status: 503 });

  const webhookSecret = overrides.telegram_webhook_secret;
  if (webhookSecret) {
    const headerSecret = request.headers.get('x-telegram-bot-api-secret-token');
    if (headerSecret !== webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const body = await request.json();
    const message = body?.message;
    const chatId = message?.chat?.id;
    const text = message?.text?.trim();
    if (!chatId || !text) return NextResponse.json({ ok: true });

    const cmd = text.split(/\s+/)[0]?.toLowerCase();

    if (cmd === '/start') {
      await sendTelegramMessage(
        chatId,
        'Добро пожаловать в AVATERRA.\n\nКоманды:\n/progress — прогресс по курсам\n/cert — сертификаты\n/help — поддержка\n/myid — ваш Chat ID для оповещений админов\n/admin_on — подписаться на оповещения администратора'
      );
      return NextResponse.json({ ok: true });
    }
    if (cmd === '/myid') {
      await sendTelegramMessage(
        chatId,
        `Ваш Chat ID: <code>${chatId}</code>\n\nСкопируйте его в Портал → Настройки → Интеграции → «Chat ID админов» или отправьте /admin_on для автоподписки.`
      );
      return NextResponse.json({ ok: true });
    }
    if (cmd === '/admin_on' || cmd === '/admin_subscribe') {
      const added = await appendAdminChatId(Number(chatId));
      await sendTelegramMessage(
        chatId,
        added
          ? `Вы подписаны на оповещения администратора (Chat ID: <code>${chatId}</code>).`
          : `Chat ID <code>${chatId}</code> уже в списке оповещений.`
      );
      return NextResponse.json({ ok: true });
    }
    if (cmd === '/progress') {
      await sendTelegramMessage(chatId, 'Откройте личный кабинет на сайте для просмотра прогресса по курсам.');
      return NextResponse.json({ ok: true });
    }
    if (cmd === '/cert') {
      await sendTelegramMessage(chatId, 'Сертификаты доступны в личном кабинете в разделе «Сертификаты».');
      return NextResponse.json({ ok: true });
    }
    if (cmd === '/help') {
      await sendTelegramMessage(chatId, 'Напишите в поддержку через личный кабинет или на email.');
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
