/** Человекочитаемые подписи источника события заряда (GamificationXpEvent.source). */
export function gamificationSourceLabelRu(source: string): string {
  switch (source) {
    case 'lesson_complete':
      return 'Урок завершён';
    case 'verification_approved':
      return 'Домашнее задание одобрено';
    case 'admin_delta':
      return 'Корректировка';
    case 'admin_set':
      return 'Установка администратором';
    default:
      return source;
  }
}
