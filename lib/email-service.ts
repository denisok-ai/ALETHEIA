/**
 * Единый слой исходящей почты: транспорт + общий журнал доставки.
 * Тело письма в журнал не пишем, чтобы не дублировать персональные данные.
 */
import { prisma } from '@/lib/db';
import { sendEmailWithResult, type EmailAttachment, type SendEmailResult } from '@/lib/email';

export type EmailModule =
  | 'auth'
  | 'contact'
  | 'crm'
  | 'tickets'
  | 'notifications'
  | 'mailings'
  | 'comms'
  | 'payments'
  | 'settings'
  | 'inmail'
  | 'installment'
  // Онбординг-напоминания: «записались, но курс не открыли». entityId = Enrollment.id
  // служит ключом идемпотентности (одно напоминание на зачисление).
  | 'onboarding';

/**
 * Название курса в «ёлочках» — но без задвоения, если кавычки уже есть
 * (напр. «Аватера»: Практик). Иначе в письме выходит ««Аватера»: Практик».
 */
export function quoteTitle(title: string): string {
  const t = title.trim();
  return /^[«"„]/.test(t) ? t : `«${t}»`;
}

export interface EmailDeliveryContext {
  module: EmailModule;
  entityId?: string | null;
  userId?: string | null;
  sentBy?: string | null;
}

export interface SendTransactionalEmailInput {
  to: string;
  subject: string;
  html: string;
  from?: string;
  attachments?: EmailAttachment[];
  context: EmailDeliveryContext;
}

function deliveryLogProvider(
  result: SendEmailResult | { ok: false; error: string; skipped: true }
): string {
  if ('skipped' in result && result.skipped) return 'none';
  if (result.ok) return result.provider;
  const p = 'provider' in result ? result.provider : undefined;
  return (p ?? 'resend') as string;
}

async function writeEmailDeliveryLog(params: {
  input: SendTransactionalEmailInput;
  result: SendEmailResult | { ok: false; error: string; skipped: true };
}): Promise<void> {
  try {
    await prisma.emailDeliveryLog.create({
      data: {
        module: params.input.context.module,
        entityId: params.input.context.entityId ?? null,
        userId: params.input.context.userId ?? null,
        recipient: params.input.to,
        subject: params.input.subject,
        status: params.result.ok ? 'sent' : 'skipped' in params.result ? 'skipped' : 'failed',
        provider: deliveryLogProvider(params.result),
        direction: 'outbound',
        errorMessage: params.result.ok ? null : params.result.error.slice(0, 1000),
        sentBy: params.input.context.sentBy ?? null,
      },
    });
  } catch (e) {
    // Журнал не должен ломать бизнес-процесс отправки.
    console.error('[email-service] delivery log failed', e instanceof Error ? e.message : e);
  }
}

export async function sendTransactionalEmail(input: SendTransactionalEmailInput): Promise<SendEmailResult> {
  const to = input.to.trim();
  if (!to || !to.includes('@')) {
    const skipped = { ok: false as const, error: 'Некорректный email получателя', skipped: true as const };
    await writeEmailDeliveryLog({ input: { ...input, to }, result: skipped });
    return { ok: false, error: skipped.error, provider: 'none' };
  }

  const result = await sendEmailWithResult(to, input.subject, input.html, {
    from: input.from,
    attachments: input.attachments,
  });
  await writeEmailDeliveryLog({ input: { ...input, to }, result });
  return result;
}
