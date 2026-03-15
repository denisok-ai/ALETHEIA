/** Человекочитаемые подписи для типов уведомлений */
const TYPE_LABELS: Record<string, string> = {
  enrollment: 'Запись на курс',
  certificate_issued: 'Сертификат',
  system: 'Системное',
  mailing: 'Рассылка',
  access_opened: 'Доступ открыт',
  access_closed: 'Доступ закрыт',
};

/**
 * Возвращает человекочитаемую подпись для типа уведомления.
 */
export function formatNotificationType(type: string | null | undefined): string {
  if (!type) return '';
  return TYPE_LABELS[type] ?? type;
}

/**
 * Форматирование содержимого уведомления (Notification.content).
 * content хранит JSON: { subject, body } или { title, ref }.
 * Возвращает читаемый текст: subject/title, при отсутствии — body без HTML, fallback — первые 100 символов.
 *
 * @param content - JSON-строка или сырой текст
 * @param type - опционально тип уведомления для специальных случаев (enrollment, certificate_issued)
 */
export function formatNotificationContent(
  content: string | null | undefined,
  type?: string
): string {
  const raw = String(content ?? '').trim();
  if (!raw) return '';

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    if (type === 'enrollment' && parsed.course_id) return 'Запись на курс';
    if (type === 'certificate_issued' && parsed.cert_number != null) {
      return `Сертификат № ${parsed.cert_number}`;
    }

    const subject = parsed.subject;
    const title = parsed.title;
    const body = parsed.body;

    if (typeof subject === 'string' && subject.trim()) return subject.trim();
    if (typeof title === 'string' && title.trim()) return title.trim();
    if (typeof body === 'string' && body.trim()) {
      const stripped = body.replace(/<[^>]+>/g, '').trim();
      return stripped || raw.slice(0, 100);
    }

    return raw.slice(0, 100);
  } catch {
    return raw.slice(0, 100);
  }
}
