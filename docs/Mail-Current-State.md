# Текущее состояние почтового модуля AVATERRA

Документ фиксирует возможности и ограничения кода на момент внедрения автономной почты `avaterra.pro`. См. также [Mail-Server.md](Mail-Server.md).

## Что умеет приложение

| Компонент | Назначение |
|-----------|------------|
| [`lib/email.ts`](../lib/email.ts) | Исходящая почта: **Resend API** или **SMTP-клиент** к **внешнему** серверу (настройки в БД / `.env`). |
| [`lib/email-service.ts`](../lib/email-service.ts) | Обёртка `sendTransactionalEmail` + журнал `EmailDeliveryLog`. |
| [`lib/inmail-sync.ts`](../lib/inmail-sync.ts) | **Клиент IMAP**: импорт писем в `InboundMessage` через `imapflow`. |
| [`lib/inmail-smtp.ts`](../lib/inmail-smtp.ts) | **Клиент SMTP** для ответов из интерфейса «Входящие» с параметров конкретного ящика. |
| [`lib/domain-mailbox-service.ts`](../lib/domain-mailbox-service.ts) | Создание/смена пароля ящиков `@avaterra.pro`: Mailcow API, связь с `InboundMailbox`; `alignMailcowPasswordAndVerifyImap` (retry + задержка); предупреждения при `MAIL_PROVISIONING_MODE=none`. |
| [`lib/mail-provisioning/verify-imap.ts`](../lib/mail-provisioning/verify-imap.ts) | Проверка IMAP-аутентификации (Dovecot) сразу после create/смены пароля. |
| [`lib/mail-provisioning/mailcow.ts`](../lib/mail-provisioning/mailcow.ts) | REST-клиент Mailcow (`add/edit/mailbox`). |
| [`prisma/schema.prisma`](../prisma/schema.prisma) | Модели `DomainMailbox`, `InboundMailbox`, `InboundMessage`, `EmailDeliveryLog`. |

## Чего приложение не делает само по себе

- Не слушает порт **25** (не является MX и не принимает почту из интернета).
- Не поднимает **Dovecot/IMAP-сервер** и **Postfix/SMTP-сервер** — только подключается к уже существующим хостам и портам.
- Не создаёт системные учётные записи ящиков на ОС; провижининг своих ящиков `@avaterra.pro` добавлен отдельно через **mail-stack** (например Mailcow) и модуль **«Ящики домена»** в админке.

## Связь с новым модулем

После развёртывания почтового стека на VPS записи `InboundMailbox` должны указывать на ваш MX-хост (например `mail.avaterra.pro`). Модель `DomainMailbox` связывает созданный на сервере ящик с записью `InboundMailbox` для IMAP-синхронизации и ответов через SMTP.

**Прод (2026-06-14):** включён `MAIL_PROVISIONING_MODE=mailcow` + `MAILCOW_API_KEY`; ящики `info@`, `yarik@`, `support@`, `admin@` — IMAP OK. Если ящик создавали **прямым SQL** (без Mailcow API), обязательны строки в **`quota2`** и **`_sogo_static_view`**: без `quota2` Mailcow API/UI показывают «пустой» ящик (quota 0/∞, красные крестики); без SOGo sync — 401/Unauthorized в webmail. Починка: `scripts/prod-mailcow-sync-quota2-remote.sh` → `scripts/prod-mailcow-fix-mailbox-attrs-remote.sh` (quota2 + API edit + SOGo rebuild).

**Прод (2026-07-13):** исходящая доставка Postfix восстановлена — `DISABLE_NETFILTER_ISOLATION_RULE=y` в Mailcow (nft isolation ломала SMTP из контейнера после ufw-инцидентов), рестарт unbound/postfix/netfilter, очередь пуста. Аудит: `scripts/prod-mailcow-outbound-check-remote.sh`; см. [Mail-Server.md — исходящая доставка](Mail-Server.md#исходящая-доставка-delayed-mail--mx--timeout).

## DNS / Mailcow checklist (2026-07-23)

**Статус доставки: ✅ проверено (working)** — DNS (MX/SPF/DKIM/DMARC/PTR) live; welcome-письма доставлены в Gmail и Mail.ru без bounce. Подтверждено пользователем: «почта заработало».

Проверка сервера Mailcow + публичного DNS (resolvers 8.8.8.8 / DoH dns.google и auth NS nic.ru).

| Пункт | Статус | Детали |
|-------|--------|--------|
| Mailcow hostname | OK | `mail.avaterra.pro` |
| Домен в Mailcow | OK | `avaterra.pro` active |
| DKIM signing | OK | selector **`dkim`**, 2048-bit; Redis `DKIM_SELECTORS[avaterra.pro]=dkim`, privkey `dkim.avaterra.pro` |
| DKIM pubkey prefix | OK | `p=` начинается с `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8…` (ключ не перегенерировали) |
| Alias `dmarc@avaterra.pro` | OK | создан → `admin@avaterra.pro` (для RUA DMARC) |
| A `mail.avaterra.pro` | **OK (live)** | `95.181.224.70` — видно у Google DoH и auth NS nic.ru |
| PTR `95.181.224.70` | **OK (live)** | `mail.avaterra.pro.` (IHC) — видно у Google DoH |
| MX `@` → `mail.avaterra.pro` | **OK (live)** | `10 mail.avaterra.pro.` — Google DoH + nic.ru |
| TXT SPF `@` | **OK (live)** | единственный `v=spf1 mx a ip4:95.181.224.70 ~all` |
| TXT DKIM `dkim._domainkey` | **OK (live)** | `v=DKIM1;k=rsa;t=s;s=email;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8…` |
| TXT DMARC `_dmarc` | **OK (live)** | `v=DMARC1; p=none; rua=mailto:dmarc@avaterra.pro.` |

**Повторная проверка 2026-07-23 (~после добавления nic.ru support):** все почтовые записи уже отдаются публичным резолвером Google (dns.google / 8.8.8.8, TTL MX/TXT ~300s) и auth NS nic.ru (`ns*-l2.nic.ru` / `ns*-cloud.nic.ru`). Пропагация завершена — ждать час не нужно.

**Повторная отправка welcome/access (2026-07-23 ~11:33–11:34 MSK)** после того, как DNS стал live: `rudenkoelena7667@gmail.com` и `sev-2101@mail.ru` — `EmailDeliveryLog.status=sent` (SMTP), Postfix `status=sent` / DSN 2.0.0 (Gmail gsmtp + Mail.ru), очередь пуста, bounce не зафиксирован. Пароли клиентов не менялись. Админам ушло краткое Telegram-оповещение.

NS домена: `ns3-l2.nic.ru` / `ns4-l2.nic.ru` / `ns8-l2.nic.ru` / `ns*-cloud.nic.ru`. Точные значения записей — [Mail-DNS-avaterra.pro.md](Mail-DNS-avaterra.pro.md).
