# Текущее состояние почтового модуля AVATERRA

Документ фиксирует возможности и ограничения кода на момент внедрения автономной почты `avaterra.pro`. См. также [Mail-Server.md](Mail-Server.md).

## Что умеет приложение

| Компонент | Назначение |
|-----------|------------|
| [`lib/email.ts`](../lib/email.ts) | Исходящая почта: **Resend API** или **SMTP-клиент** к **внешнему** серверу (настройки в БД / `.env`). |
| [`lib/email-service.ts`](../lib/email-service.ts) | Обёртка `sendTransactionalEmail` + журнал `EmailDeliveryLog`. |
| [`lib/inmail-sync.ts`](../lib/inmail-sync.ts) | **Клиент IMAP**: импорт писем в `InboundMessage` через `imapflow`. |
| [`lib/inmail-smtp.ts`](../lib/inmail-smtp.ts) | **Клиент SMTP** для ответов из интерфейса «Входящие» с параметров конкретного ящика. |
| [`prisma/schema.prisma`](../prisma/schema.prisma) | Модели `InboundMailbox`, `InboundMessage`, `EmailDeliveryLog`. |

## Чего приложение не делает само по себе

- Не слушает порт **25** (не является MX и не принимает почту из интернета).
- Не поднимает **Dovecot/IMAP-сервер** и **Postfix/SMTP-сервер** — только подключается к уже существующим хостам и портам.
- Не создаёт системные учётные записи ящиков на ОС; провижининг своих ящиков `@avaterra.pro` добавлен отдельно через **mail-stack** (например Mailcow) и модуль **«Ящики домена»** в админке.

## Связь с новым модулем

После развёртывания почтового стека на VPS записи `InboundMailbox` должны указывать на ваш MX-хост (например `mail.avaterra.pro`). Модель `DomainMailbox` связывает созданный на сервере ящик с записью `InboundMailbox` для IMAP-синхронизации и ответов через SMTP.
