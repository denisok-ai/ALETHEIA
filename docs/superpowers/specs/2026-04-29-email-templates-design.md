# Дизайн: ревизия email-шаблонов AVATERRA

Цель: привести письма к тёплому профессиональному стилю, проверить связку шаблонов с процессами и добавить недостающие fallback-шаблоны без изменения Prisma-схемы.

## Тон

Письмо должно коротко отвечать на три вопроса:

1. Что произошло.
2. Что пользователю делать дальше.
3. Куда обратиться, если есть вопрос.

Стиль: спокойный, заботливый, профессиональный, без лишнего маркетинга.

## Область изменений

- Улучшить `DEFAULT_NOTIFICATION_TEMPLATES` в `lib/email-templates.ts`.
- Добавить fallback-события: `system`, `mailing`, `support_ticket_created`, `support_ticket_reply`, `email_verification`, `password_reset`.
- Улучшить базовый текст рассылки и сохранить совместимость с `%FirstName%`, `%LastName%`, `%date%`, `%unsubscribe%`, `%systemtitle%`.
- Вынести ручные HTML-письма auth/tickets в helper-функции в `lib/email-templates.ts`.
- Подключить helper-функции в `register`, `resend-verification`, `forgot-password`, `tickets`.

## Совместимость

БД и Prisma-схема не меняются. Админские шаблоны, уже сохранённые в БД, не перезаписываются автоматически.

Сохраняются плейсхолдеры уведомлений: `%recfirstname%`, `%reclastname%`, `%date%`, `%systemtitle%`, `%objectname%`, `%coursename%`, `%level%`, `%total_xp%`, `%badgename%`, `%badgeemoji%`.

## Проверка

- Smoke-test helper-функций.
- `npx tsc --noEmit`.
- IDE lints по изменённым файлам.
