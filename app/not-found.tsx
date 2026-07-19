/**
 * Кастомная 404 для публичного сайта (портал использует свои страницы).
 *
 * Серверный компонент — иначе нельзя экспортировать metadata. Раньше файл был
 * клиентским и метаданные наследовал от корневого layout, то есть страница
 * «не найдено» уходила с `robots: index, follow` и заголовком главной.
 *
 * Почему это важно: /blog/[slug] и /services/[slug] вызывают notFound() на
 * несуществующем slug, но из-за стриминга Next 14 статус остаётся 200 —
 * единственным сигналом поисковику остаётся мета-тег. Без noindex любой
 * выдуманный адрес вида /blog/что-угодно был индексируемой страницей с
 * шаблонным содержимым, и таких адресов бесконечно много.
 * Обнаружено 19.07.2026 живой проверкой: /blog/rss.xml отдавал index, follow.
 */
import type { Metadata } from 'next';
import NotFoundContent from './NotFoundContent';

export const metadata: Metadata = {
  title: 'Страница не найдена',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <NotFoundContent />;
}
