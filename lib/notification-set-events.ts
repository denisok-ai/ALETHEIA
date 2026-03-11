/**
 * Названия типов событий для наборов уведомлений (вкладка Уведомления).
 */
export const NOTIFICATION_SET_EVENT_LABELS: Record<string, string> = {
  enrollment: 'Запись на курс',
  certificate_issued: 'Выдача сертификата',
  enrollment_excluded: 'Отчисление участника с мероприятия',
  access_opened: 'Открытие слушателю доступа к мероприятию',
  access_closed: 'Закрытие доступа слушателю к мероприятию',
  event_cancelled: 'Отмена мероприятия',
  event_completed: 'Завершение мероприятия',
  training_start: 'Наступление даты начала обучения слушателя на мероприятии',
};

export function getNotificationSetEventLabel(eventType: string): string {
  return NOTIFICATION_SET_EVENT_LABELS[eventType] ?? eventType;
}
