/**
 * Срок доступа к курсу, купленному как товар с `Service.accessDays`.
 *
 * Правила:
 * - accessDays = null → доступ бессрочный (Enrollment.expiresAt = null), как и раньше;
 * - accessDays = N → expiresAt = дата оплаты + N дней;
 * - при повторной покупке зачисление продлевается, но никогда не укорачивается:
 *   бессрочный доступ (null) считается «самым поздним», поэтому с ним не сужаемся;
 * - accessClosed этим модулем не меняется (закрытие — отдельное админское действие).
 *
 * Все места, где выдаётся доступ по оплате (вебхук, сверка, привязка при входе),
 * должны идти через grantPaidEnrollment — иначе срок не применится.
 */
import type { Prisma } from '@prisma/client';

type EnrollmentDb = Pick<Prisma.TransactionClient, 'enrollment'>;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Дата окончания доступа для оплаты в момент paidAt; null — бессрочно. */
export function accessExpiryFor(paidAt: Date, accessDays: number | null | undefined): Date | null {
  if (accessDays == null || !Number.isFinite(accessDays) || accessDays <= 0) return null;
  return new Date(paidAt.getTime() + Math.round(accessDays) * DAY_MS);
}

/** Более поздний из двух сроков; null (бессрочно) побеждает любую дату. */
export function laterExpiry(current: Date | null, next: Date | null): Date | null {
  if (current === null || next === null) return null;
  return next.getTime() > current.getTime() ? next : current;
}

/**
 * Создаёт зачисление или продлевает существующее (без укорачивания).
 * Возвращает итоговый expiresAt.
 */
export async function grantPaidEnrollment(
  db: EnrollmentDb,
  args: { userId: string; courseId: string; paidAt: Date; accessDays: number | null | undefined }
): Promise<Date | null> {
  const next = accessExpiryFor(args.paidAt, args.accessDays);
  const where = { userId_courseId: { userId: args.userId, courseId: args.courseId } };
  const existing = await db.enrollment.findUnique({ where, select: { expiresAt: true } });

  if (!existing) {
    await db.enrollment.upsert({
      where,
      create: { userId: args.userId, courseId: args.courseId, expiresAt: next },
      update: {},
    });
    return next;
  }

  const result = laterExpiry(existing.expiresAt, next);
  const changed =
    (result?.getTime() ?? null) !== (existing.expiresAt?.getTime() ?? null);
  if (changed) {
    await db.enrollment.update({ where, data: { expiresAt: result } });
  }
  return result;
}

/** Зачисление с истёкшим сроком не даёт доступа. */
export function isEnrollmentExpired(
  enrollment: { expiresAt: Date | null } | null | undefined,
  now: Date = new Date()
): boolean {
  return !!enrollment?.expiresAt && enrollment.expiresAt.getTime() < now.getTime();
}

/**
 * Разбор поля accessDays из запроса админки: пусто/null → бессрочно (null),
 * целое от 1 до 3650 → дни. Иное значение — `undefined` (ошибка ввода).
 */
export function parseAccessDaysInput(raw: unknown): number | null | undefined {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isInteger(n) || n < 1 || n > 3650) return undefined;
  return n;
}
