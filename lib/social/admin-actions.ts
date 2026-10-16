/**
 * Действия админа над очередью соцсетей (T3.8): чистая часть — без БД и сети.
 * Клиентские компоненты импортируют этот файл, поэтому здесь нет импорта prisma.
 * Запись в БД — в lib/social/admin-apply.ts.
 */

/** Смещение Москвы от UTC (без перехода на летнее время с 2014 года). */
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

const DATETIME_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** datetime-local («YYYY-MM-DDTHH:mm», время по Москве) → Date; null, если строка не разобрана. */
export function parseMskInput(raw: string): Date | null {
  const m = DATETIME_LOCAL_RE.exec((raw ?? '').trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (h > 23 || mi > 59) return null;
  const utc = Date.UTC(y, mo - 1, d, h, mi) - MSK_OFFSET_MS;
  const date = new Date(utc);
  // Отсекаем даты вроде 31.02: при обратном разборе поля не совпадут.
  return toMskInputValue(date) === `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` ? date : null;
}

export const POST_STATUS_LABEL: Readonly<Record<string, string>> = {
  draft: 'черновик',
  scheduled: 'в очереди',
  publishing: 'публикуется',
  published: 'опубликован',
  ready_post_sent: 'готовый пост отправлен',
  failed: 'ошибка',
  skipped: 'пропущен',
};

export const MODE_LABEL: Readonly<Record<string, string>> = {
  auto: 'автопубликация',
  ready_post: 'только готовый пост',
};

export const postStatusLabel = (status: string): string => POST_STATUS_LABEL[status] ?? status;

export type PostAction = 'requeue' | 'skip' | 'reschedule';

export const POST_ACTIONS: readonly PostAction[] = ['requeue', 'skip', 'reschedule'];

export function isPostAction(value: unknown): value is PostAction {
  return typeof value === 'string' && (POST_ACTIONS as readonly string[]).includes(value);
}

/** Из какого статуса допустимо действие. Остальные переходы запрещены. */
const ALLOWED_FROM: Readonly<Record<PostAction, readonly string[]>> = {
  requeue: ['failed'],
  skip: ['scheduled'],
  reschedule: ['scheduled'],
};

export type CheckResult = { ok: true } | { ok: false; error: string };

const ACTION_WHAT: Readonly<Record<PostAction, string>> = {
  requeue: 'Вернуть в очередь можно только пост со статусом «ошибка»',
  skip: 'Пропустить можно только пост в очереди',
  reschedule: 'Перенести можно только пост в очереди',
};

/** Проверка перехода статуса. Публикующийся пост не трогаем никаким действием. */
export function checkPostAction(action: PostAction, status: string): CheckResult {
  if (ALLOWED_FROM[action].includes(status)) return { ok: true };
  const hint =
    status === 'publishing'
      ? 'Пост сейчас публикуется; менять его нельзя.'
      : `Сейчас статус: «${postStatusLabel(status)}».`;
  return { ok: false, error: `${ACTION_WHAT[action]}. ${hint}` };
}

/**
 * Время для возврата в очередь: если запланированный момент уже прошёл (или его нет),
 * пост уйдёт на ближайшем проходе планировщика, иначе сохраняем запланированное время.
 */
export function requeueScheduledAt(scheduledAt: Date | null, now: Date): Date {
  if (!scheduledAt || scheduledAt.getTime() < now.getTime()) return now;
  return scheduledAt;
}

/**
 * Разбор поля datetime-local (время по Москве, «YYYY-MM-DDTHH:mm»).
 * Прошедшее время отклоняем: иначе пост уйдёт на ближайшем проходе, а не «по расписанию».
 */
export function parseRescheduleInput(raw: string, now: Date): { ok: true; date: Date } | { ok: false; error: string } {
  const date = parseMskInput(raw);
  if (!date) {
    return { ok: false, error: 'Укажите дату и время по Москве.' };
  }
  if (date.getTime() < now.getTime()) {
    return { ok: false, error: 'Время уже прошло: укажите момент в будущем.' };
  }
  return { ok: true, date };
}

/** Значение для datetime-local (МСК, без секунд). Пусто, если времени нет. */
export function toMskInputValue(date: Date | null): string {
  if (!date) return '';
  return new Date(date.getTime() + MSK_OFFSET_MS).toISOString().slice(0, 16);
}

/** Поля SocialNetwork при включении/выключении. Включение сбрасывает счётчик ошибок и текст последней. */
export function networkEnableData(enabled: boolean): { enabled: boolean; failStreak?: number; lastError?: null } {
  return enabled ? { enabled: true, failStreak: 0, lastError: null } : { enabled: false };
}

/** Значение SocialRule paused_all: планировщик смотрит только на '1'. */
export function pauseRuleValue(paused: boolean): '1' | '0' {
  return paused ? '1' : '0';
}
