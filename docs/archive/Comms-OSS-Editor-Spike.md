# Spike: визуальный редактор для «Коммуникаций»

**Дата:** 2026-04-28  
**Решение:** на текущем этапе **не внедрять** полноценный внешний редактор (Maily, Unlayer, MJML). Использовать **встроенное превью HTML** и сырой HTML/текст в форме; дальнейшая эволюция — через **React Email** (`@react-email/components`, уже в проекте): либо хранить скомпилированный HTML как сейчас, либо добавить поле `editorJson` и экспорт в HTML.

| Вариант | Лицензия | Бандл | Вывод |
|---------|----------|-------|--------|
| Maily ([arikchakma/maily.to](https://github.com/arikchakma/maily.to)) | MIT | Тяжёлый (TipTap, пакеты редактора) | Лучший UX; отложено до отдельной задачи на хранение JSON + миграцию шаблонов |
| email-builder-wysiwyg | MIT | Средний | Меньше экосистема; риск устаревания зависимостей |
| @react-email/editor | MIT | Зависит от версии react-email | Согласуется с `react-email` в `package.json`; проверить совместимость с Next 14 при внедрении |
| Unlayer | Проприетарный/API | Средний | Не выбран из-за vendor lock-in |

**Следующий шаг (вне этого релиза):** POC ветка с `@react-email/editor` или Maily + поле `CommsTemplate.editorDocument` (JSON) и кэш `htmlBody`.
