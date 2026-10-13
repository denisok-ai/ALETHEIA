/**
 * Метка первого касания для серверных компонентов: читает httpOnly cookie av_ref.
 *
 * Вызов cookies() делает маршрут динамическим. Поэтому звать его только там,
 * где страница и так динамическая (корневой layout — force-dynamic), либо в
 * серверной странице, которую не нужно держать статичной.
 */
import { cookies } from 'next/headers';
import { REF_COOKIE_NAME, refFromValue } from './refs';

export async function currentAcqRef(): Promise<string | null> {
  const store = await cookies();
  return refFromValue(store.get(REF_COOKIE_NAME)?.value);
}
