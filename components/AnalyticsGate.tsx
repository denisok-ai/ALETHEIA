'use client';

import { usePathname } from 'next/navigation';
import { isPrivateToolPage } from '@/lib/public-shell-paths';

/**
 * Счётчики (Метрика, GA, Clarity) рендерятся внутри: на служебной странице согласования их нет —
 * адрес страницы содержит секретный токен, а запись сессий видела бы правки текстов.
 * usePathname работает и при серверном рендере: тегов <script> счётчиков в HTML страницы нет.
 * Текст скриптов остаётся в служебных данных React (дети серверного компонента), но не монтируется
 * и не исполняется — запросов к счётчикам со страницы нет.
 */
export function AnalyticsGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isPrivateToolPage(pathname)) return null;
  return <>{children}</>;
}
