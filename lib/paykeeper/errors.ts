/**
 * Ошибки подключения и логические ошибки JSON API PayKeeper.
 */

export class PayKeeperApiError extends Error {
  readonly code = 'PAYKEEPER_API_FAIL';

  constructor(
    message: string,
    readonly httpStatus?: number
  ) {
    super(message);
    this.name = 'PayKeeperApiError';
  }
}

export function formatPayKeeperConnectionError(error: unknown, server = ''): string {
  if (!(error instanceof Error)) return 'Ошибка подключения к PayKeeper';
  if (error instanceof PayKeeperApiError) return error.message;
  const cause = error.cause as { code?: string } | undefined;
  if (cause?.code === 'ENOTFOUND') {
    return `Не удалось найти сервер PayKeeper${server ? `: ${server}` : ''}. Проверьте адрес сервера в настройках.`;
  }
  if (cause?.code === 'EAI_AGAIN') {
    return `DNS временно не ответил для PayKeeper${server ? `: ${server}` : ''}. Проверьте адрес сервера и интернет/DNS в WSL.`;
  }
  if (cause?.code === 'ECONNREFUSED') {
    return `Сервер PayKeeper${server ? ` ${server}` : ''} отклонил подключение. Проверьте адрес и доступность API.`;
  }
  if (cause?.code === 'ETIMEDOUT' || cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
    return `Сервер PayKeeper${server ? ` ${server}` : ''} не ответил вовремя. Проверьте сеть или адрес сервера.`;
  }
  if (/token not found/i.test(error.message)) {
    return 'PayKeeper ответил, но токен не найден в ответе. Проверьте логин, пароль и права API-пользователя.';
  }
  if (/не json|HTML вместо JSON|авторизац/i.test(error.message)) {
    return error.message;
  }
  return error.message || 'Ошибка подключения к PayKeeper';
}
