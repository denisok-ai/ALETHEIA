/**
 * Единая инициация уведомлений: поиск правила по событию, подстановка в шаблон,
 * запись в ленту (Notification), отправка email, журнал (NotificationLog).
 */
import { prisma } from '@/lib/db';
import { sendTransactionalEmail } from '@/lib/email-service';
import {
  wrapEmailHtml,
  renderNotificationTemplate,
  DEFAULT_NOTIFICATION_TEMPLATES,
} from '@/lib/email-templates';
import { getSystemSettings } from '@/lib/settings';

const SYSTEM_TITLE = 'AVATERRA';

/**
 * Делит displayName на «имя» и «фамилия» по пробелам. Если значение — email
 * (или одиночный токен без пробелов, похожий на логин), возвращает пустые строки,
 * чтобы шаблон выводил нейтральное «Здравствуйте!» без локальной части почты.
 */
function splitDisplayName(displayName: string | null): { recfirstname: string; reclastname: string } {
  const raw = displayName?.trim() ?? '';
  if (!raw || /@/.test(raw)) return { recfirstname: '', reclastname: '' };
  const parts = raw.split(/\s+/);
  if (parts.length === 1 && /^[a-z0-9_.+-]+$/i.test(parts[0]!)) {
    return { recfirstname: '', reclastname: '' };
  }
  return {
    recfirstname: parts[0] ?? '',
    reclastname: parts.slice(1).join(' ') ?? '',
  };
}

export interface TriggerNotificationParams {
  eventType: string;
  userId: string;
  metadata?: Record<string, string | number | boolean>;
  templateOverrides?: { subject?: string; body?: string };
}

/**
 * Находит правило (NotificationSet) по eventType, подставляет данные в шаблон,
 * создаёт запись в Notification (лента), при необходимости отправляет email, пишет в NotificationLog.
 */
export async function triggerNotification(params: TriggerNotificationParams): Promise<void> {
  const { eventType, userId, metadata = {}, templateOverrides } = params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: { select: { displayName: true, email: true } } },
  });
  if (!user) return;

  const displayName = user.profile?.displayName ?? user.displayName ?? user.email ?? '';
  const { recfirstname, reclastname } = splitDisplayName(displayName);
  const dateStr = new Date().toLocaleDateString('ru');
  const objectname = (metadata.objectname as string) ?? (metadata.coursename as string) ?? '';

  const vars: Record<string, string> = {
    recfirstname,
    reclastname,
    date: dateStr,
    systemtitle: SYSTEM_TITLE,
    objectname,
  };
  for (const [k, v] of Object.entries(metadata)) {
    if (v === undefined || v === null) continue;
    vars[k] = String(v);
  }

  let subject: string;
  let body: string;
  let deliveryType: 'internal' | 'email' | 'both' = 'both';

  const set = await prisma.notificationSet.findFirst({
    where: { eventType, isActive: true },
    include: { template: true },
  });

  if (set?.template) {
    subject = templateOverrides?.subject ?? set.template.subject ?? '';
    body = templateOverrides?.body ?? set.template.body;
    deliveryType = set.template.type as 'internal' | 'email' | 'both';
    const rendered = renderNotificationTemplate({ subject, body }, vars);
    subject = rendered.subject;
    body = rendered.body;
  } else {
    const defaultTpl = DEFAULT_NOTIFICATION_TEMPLATES.find((t) => t.eventType === eventType);
    if (!defaultTpl) {
      subject = `Уведомление — ${SYSTEM_TITLE}`;
      body = `<p>Здравствуйте, ${recfirstname} ${reclastname}!</p><p>Событие: ${eventType}. Дата: ${dateStr}.</p>`;
    } else {
      const rendered = renderNotificationTemplate(
        { subject: defaultTpl.subject, body: defaultTpl.body },
        vars
      );
      subject = rendered.subject;
      body = rendered.body;
      deliveryType = defaultTpl.deliveryType ?? 'both';
    }
  }

  const contentJson = JSON.stringify({ subject, body });

  /** Запись в ленте ЛК — только для internal/both; для связи с EmailDeliveryLog при email. */
  let notificationRecord: { id: string } | null = null;

  if (deliveryType === 'internal' || deliveryType === 'both') {
    notificationRecord = await prisma.notification.create({
      data: {
        userId,
        type: eventType,
        content: contentJson,
        isRead: false,
      },
    });
    await prisma.notificationLog.create({
      data: {
        userId,
        eventType,
        subject,
        content: body.replace(/<[^>]*>/g, '').slice(0, 500),
        channel: 'internal',
      },
    });
  }

  if (deliveryType === 'email' || deliveryType === 'both') {
    const emailAddr = user.profile?.email ?? user.email;
    if (emailAddr) {
      const html = wrapEmailHtml(body, { title: subject });
      const settings = await getSystemSettings();
      await sendTransactionalEmail({
        to: emailAddr,
        subject,
        html,
        from: settings?.resend_from || undefined,
        context: {
          module: 'notifications',
          userId,
          entityId: notificationRecord?.id ?? null,
        },
      });
      await prisma.notificationLog.create({
        data: {
          userId,
          eventType,
          subject,
          content: body.replace(/<[^>]*>/g, '').slice(0, 500),
          channel: 'email',
        },
      });
    }
  }
}
