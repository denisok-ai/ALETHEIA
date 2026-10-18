/**
 * Проверка заголовка Next-Action (server action ID) до рендера.
 *
 * Next 16 (node_modules/next/dist/esm/shared/lib/server-reference-info.js):
 * ID — hex-строка длиной 42 символа (SERVER_REFERENCE_ID_LENGTH, mightBeServerReferenceId).
 * Первые два hex-символа — байт-маска аргументов. Всё, что не совпадает, Next отклоняет
 * ошибкой «The Server Reference ID did not match the expected format» (E1442) — после
 * рендера, с шумом в журнале. Сканеры шлют POST с мусорным `Next-Action: x`.
 */
export const SERVER_ACTION_ID_LENGTH = 42;

const SERVER_ACTION_ID_RE = /^[0-9a-f]{42}$/i;

/** Похоже ли значение заголовка Next-Action на настоящий ID серверного действия. */
export function isValidServerActionId(value: string): boolean {
  return value.length === SERVER_ACTION_ID_LENGTH && SERVER_ACTION_ID_RE.test(value);
}
