/**
 * Валидация пароля: минимум 8 символов, хотя бы 1 цифра и 1 буква.
 */
const MIN_LENGTH = 8;

export function validatePassword(password: string): { ok: true } | { ok: false; error: string } {
  if (typeof password !== 'string') {
    return { ok: false, error: 'Пароль обязателен' };
  }
  const p = password.trim();
  if (p.length < MIN_LENGTH) {
    return { ok: false, error: `Пароль не менее ${MIN_LENGTH} символов` };
  }
  if (!/\d/.test(p)) {
    return { ok: false, error: 'Пароль должен содержать хотя бы одну цифру' };
  }
  if (!/[a-zA-Zа-яА-ЯёЁ]/.test(p)) {
    return { ok: false, error: 'Пароль должен содержать хотя бы одну букву' };
  }
  return { ok: true };
}

export const PASSWORD_MIN_LENGTH = MIN_LENGTH;
