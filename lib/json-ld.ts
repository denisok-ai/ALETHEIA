/**
 * Сериализация JSON-LD для вставки в <script type="application/ld+json">.
 * JSON.stringify не экранирует "<", поэтому строка вида "</script><script>…"
 * в данных из БД (заголовок публикации/курса) закрывала бы тег и давала XSS.
 * Экранируем в \uXXXX — валидный JSON, безопасный внутри <script>.
 */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
