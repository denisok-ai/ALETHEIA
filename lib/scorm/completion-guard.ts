/**
 * Серверный рубеж против ложного завершения SCORM-урока.
 *
 * Инцидент 09.2026: студент «зашёл-вышел», клиент прислал 'completed' без
 * реального состояния CMI — курс стал 100 %, авто-выдался сертификат.
 * Реальные SCORM-коммиты всегда несут полный CMI (sendFullCommit); 'completed'
 * / 'passed' с пустым CMI — синтетический коммит (fallback плеера, баг
 * клиента или подделка). Понижаем до 'incomplete'.
 *
 * Чистая функция — покрыта юнит-тестом, роут только вызывает её.
 */

/** SCORM 1.2/2004: "passed" и "completed" считаем завершённым уроком. */
export function isLessonCompleted(status: string | null | undefined): boolean {
  return status === 'completed' || status === 'passed';
}

export type CompletionGuardResult = { status: string; downgraded: boolean };

export function guardCompletionStatus(
  completionStatus: string,
  cmiData: Record<string, unknown> | null | undefined
): CompletionGuardResult {
  const hasCmi = !!cmiData && Object.keys(cmiData).length > 0;
  if (isLessonCompleted(completionStatus) && !hasCmi) {
    return { status: 'incomplete', downgraded: true };
  }
  return { status: completionStatus, downgraded: false };
}
