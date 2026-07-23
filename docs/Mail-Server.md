# Развёртывание автономной почты для avaterra.pro

Почтовый стек работает **отдельно** от каталога Next.js приложения (`/opt/ALETHEIA` на VPS — см. [Production-Server.md](Production-Server.md)). Сайт подключается к нему как **SMTP/IMAP-клиент**.

## Документы по теме

| Файл | Содержание |
|------|------------|
| [Mail-Current-State.md](Mail-Current-State.md) | Код приложения + [чеклист DNS/DKIM/dmarc@](Mail-Current-State.md#dns--mailcow-checklist-2026-07-23) (2026-07-23) |
| [Mail-VPS-Audit-Checklist.md](Mail-VPS-Audit-Checklist.md) | Порты, PTR, ресурсы |
| [Mail-Stack-Decision.md](Mail-Stack-Decision.md) | Выбор Mailcow vs альтернативы |
| [Mail-DNS-avaterra.pro.md](Mail-DNS-avaterra.pro.md) | MX, SPF, DKIM, DMARC (значения + статус публикации) |

## Рекомендуемый стек: Mailcow

1. Пройдите [Mail-VPS-Audit-Checklist.md](Mail-VPS-Audit-Checklist.md).
2. На VPS установите Docker Engine и Docker Compose (по официальной документации Mailcow).
3. На VPS клонируйте Mailcow в **отдельный** каталог, не внутрь `/opt/ALETHEIA`:

   ```bash
   cd /opt
   sudo git clone https://github.com/mailcow/mailcow-dockerized.git
   cd mailcow-dockerized
   ```

4. Сгенерируйте конфигурацию (`./generate_config.sh`), укажите FQDN почтового хоста (например `mail.avaterra.pro`).
5. Запустите: `docker compose pull && docker compose up -d`.
6. В веб-интерфейсе Mailcow добавьте домен **avaterra.pro**, включите DKIM и скопируйте DNS-записи — см. [Mail-DNS-avaterra.pro.md](Mail-DNS-avaterra.pro.md).

Подробные шаги всегда сверяйте с [официальной документацией Mailcow](https://docs.mailcow.email/).

## HTTPS для сайта и для почтового хоста

- **Сайт `https://avaterra.pro`** — сертификат обычно выдаётся **certbot + nginx** на этом же VPS (или у провайдера). Это не заменяет TLS для почтового стека.
- **Веб-интерфейс и API Mailcow** (`https://mail.example.ru`) — нужен **отдельный** доверенный сертификат на FQDN почтового хоста. В типовой установке Mailcow использует **встроенный ACME** (Let's Encrypt) для `MAILCOW_HOSTNAME`; порты **80/443** должны быть доступны с интернета для прохождения проверки (или используйте DNS-challenge по документации Mailcow).
- **Приложение Next.js** подключается к Mailcow по **HTTPS** (`MAILCOW_API_URL=https://mail.avaterra.pro`), поэтому на клиенте Node должны быть актуальные CA (на VPS см. [Production-Server.md §4](Production-Server.md) про корневые сертификаты).

## Связка с приложением AVATERRA

### Переменные окружения процесса Next.js

На VPS в `.env` приложения задайте параметры подключения к MX-хосту и API Mailcow. См. [`.env.example`](../.env.example) — блок «Автономная почта / Mailcow».

| Переменная | Назначение |
|------------|------------|
| `MAIL_PROVISIONING_MODE` | `mailcow` — создание ящиков через API; `none` — только записи в БД (ящик уже создан в Mailcow вручную). |
| `MAIL_IMAP_HOST` | Хост IMAP (часто `mail.avaterra.pro`). |
| `MAIL_SMTP_HOST` | Хост SMTP submission (часто тот же). |
| `MAIL_SMTP_PORT` | Обычно `587`. |
| `MAIL_DOMAIN` | `avaterra.pro`. |
| `MAILCOW_API_URL` | Базовый URL Mailcow с HTTPS, например `https://mail.avaterra.pro`. |
| `MAILCOW_API_KEY` | Ключ API из Mailcow (не коммитить). |
| `MAIL_SMTP_USER` / `MAIL_SMTP_PASSWORD` | Учётная запись на вашем MX (напр. `notifications@avaterra.pro`) для отправки транзакционной почты. Вместе с `MAIL_SMTP_HOST`. |
| `MAIL_USE_OWN_SMTP` | `true` — брать SMTP **только** из `MAIL_SMTP_*` в `.env`, даже если в админке остались старые `smtp_*` или ключ Resend; транспорт по умолчанию SMTP (если не задан `EMAIL_TRANSPORT`). |
| `EMAIL_TRANSPORT` | `smtp` \| `resend` \| пусто (авто). При `MAIL_USE_OWN_SMTP=true` без этого ключа подставляется `smtp`. |
| `MAIL_IMAP_TLS_REJECT_UNAUTHORIZED` | По умолчанию включена проверка TLS-сертификата IMAP/SMTP. Если Dovecot отдаёт **самоподписанный** сертификат (часто при `SKIP_LETS_ENCRYPT` на Mailcow на том же VPS), задайте **`false`** — иначе синхронизация «Входящих» в админке падает с `self-signed certificate`. |

### Ошибка `[NO] Authentication failed` при IMAP

Корневая причина — **пароль в зашифрованном поле `InboundMailbox` не совпадает с паролем того же ящика в Mailcow/Dovecot.** Частые сценарии:

1. На VPS не заданы **`MAIL_PROVISIONING_MODE=mailcow`** и **`MAILCOW_API_KEY`** — ящик создаётся только в БД приложения, а в Dovecot пароль другой или ящика нет. Выполните на сервере: `bash scripts/setup-mailcow-api-prod.sh`.
2. После `add/mailbox` в Mailcow API хеш пароля иногда не совпадает с тем, что ожидает Dovecot — код приложения повторно пишет пароль через `edit/mailbox` и проверяет IMAP.

Обновите пароль через **Портал → Ящики домена → Пароль** (или вручную синхронизируйте пароль в Mailcow и в приложении). Без совпадения Dovecot отвечает `AUTHENTICATIONFAILED`.

При создании ящика через приложение код сразу вызывает **`edit/mailbox` с тем же паролём** после успешного `add/mailbox`, затем **проверяет IMAP** через `lib/mail-provisioning/verify-imap.ts` (с повтором и задержкой ~2,5 с). Если уже созданный ящик «молчит» с ошибкой авторизации — для разового исправления на сервере: `MAILBOX_EMAIL=адрес bash scripts/prod-mailcow-create-domain-mailbox-remote.sh` (MySQL hash в Mailcow) или `MAILBOX_EMAIL=адрес bash scripts/prod-mailcow-align-password-remote.sh` (если в `.env` заданы `MAILCOW_API_*`). Обновить статус «Входящих» в UI: `bash scripts/prod-inmail-sync-all-remote.sh`.

**Первичная настройка API на проде (один раз):** если таблица `api` в Mailcow пуста — `sudo bash scripts/setup-mailcow-api-prod.sh` на VPS. Полная E2E-проверка цепочки (создание тестового ящика → IMAP → SMTP → sync → cleanup): с WSL **`npm run mail:e2e-selfcheck`** (скрипт `scripts/mail-e2e-selfcheck-remote.sh`). На проде 2026-06-14 — **PASS**.

### Админка

Раздел **Портал → Ящики домена** (`/portal/admin/domain-mailboxes`): создание ящика создаёт запись в Mailcow (если включён режим `mailcow`) и связанный `InboundMailbox` для модуля «Входящие». Кнопка **«Пароль»** в списке вызывает API смены пароля: при `MAIL_PROVISIONING_MODE=mailcow` пароль обновляется в Mailcow (`POST /api/v1/edit/mailbox`) и в БД; при `none` меняется только шифр в приложении — выставьте тот же пароль в Mailcow вручную.

### Исходящая почта сайта

Чтобы транзакционные письма шли через ваш SMTP, в **Настройки → Исходящая почта** включите **Только SMTP** и укажите учётную запись на вашем сервере (или отдельный технический ящик). Либо задайте `MAIL_SMTP_*` в `.env` (см. таблицу выше), чтобы не дублировать учётку в БД.

### Cron IMAP-синхронизации

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" "https://avaterra.pro/api/cron/inmail-sync"
```

Секрет — как для других cron-маршрутов ([Env-Config.md](Env-Config.md)).

## Бэкапы и обновления

- Данные Mailcow — в Docker volumes; включите в резервное копирование сервера.
- Обновление Mailcow: следуйте разделу *Update* в документации Mailcow.

## Брендинг веб-интерфейса Mailcow (логотип и стили)

Официально поддерживаемый способ — свой CSS в каталоге установки Mailcow: файл **`data/web/css/build/0081-custom-mailcow.css`** (см. [документацию Mailcow по UI CSS](https://docs.mailcow.email/manual-guides/mailcow-UI/u_e-mailcow_ui-css/)). Такие файлы в `data/` обычно **не затираются** при обновлении стека через `update.sh`, но после больших обновлений имеет смысл проверить страницу входа и при необходимости заново скопировать артефакты.

В репозитории AVATERRA лежат готовые файлы:

- [`infra/mail/mailcow-brand/0081-custom-mailcow.css`](../infra/mail/mailcow-brand/0081-custom-mailcow.css) — палитра как у портала и лендинга (plum `#856B92`, rose `#CE8FB0`, фон `#F6F4F9`), карточка входа, кнопки и шапка; вместо `cow_mailcow` на странице входа показывается **тот же PNG, что на сайте** — `public/images/LOGO.png` копируется на сервер Mailcow как **`/img/avaterra-login-logo.png`** (плюс запасной SVG).
- [`infra/mail/mailcow-brand/avaterra-login-logo.svg`](../infra/mail/mailcow-brand/avaterra-login-logo.svg) — резерв для ручной подстановки; в CSS на странице входа используется **только PNG**, чтобы текст в SVG не накладывался на эмблему.

**Выкладка на VPS** (с вашего ПК в WSL, с настроенным SSH-ключом как для `deploy:remote`):

```bash
npm run mailcow:apply-branding
```

Переменные (опционально): `MAILCOW_ROOT` (по умолчанию `/opt/mailcow-dockerized`), `DEPLOY_SSH` (`root@хост`), ключ — через `scripts/.deploy.env` или `DEPLOY_SSH_KEY`. Скрипт создаёт каталоги, копирует CSS, PNG (логотип сайта) и SVG, выполняет **`docker compose restart nginx-mailcow`** в каталоге Mailcow.

Если что-то выглядит не так после обновления Mailcow, временно переименуйте свой `0081-custom-mailcow.css`, перезапустите `nginx-mailcow` и убедитесь, что проблема в кастомизации; затем верните файл и сужайте селекторы в CSS.

**SOGo** (веб-почта) оформляется отдельно — темы и логотип там в своих конфигурациях; этот CSS относится к UI Mailcow (вход и админ-панель стека).

## Вход пользователя ящика (не администратора Mailcow)

После входа на **https://mail.avaterra.pro** логином ящика (например `info@avaterra.pro`) открывается **пользовательская панель Mailcow** («Обзор»: квота, история входов, список протоколов) — это **нормальное поведение**, не ошибка. Это не веб-почта.

**Как открыть веб-почту (SOGo):**

1. На странице «Обзор» нажать синюю кнопку **«веб-почту →»**, или  
2. Перейти напрямую: **https://mail.avaterra.pro/SOGo/** (тот же логин и пароль ящика).

Если протоколы (IMAP, SMTP, SOGo и т.д.) отображаются с **красным крестиком** и квота **0 / ∞**, а IMAP с сервера при этом работает — проверьте не только `mailbox.attributes`, но и:

1. **Таблица `quota2`** — без строки Mailcow API/UI не видят ящик (quota 0, красные крестики). Исправление: `bash scripts/prod-mailcow-sync-quota2-remote.sh`, затем `bash scripts/prod-mailcow-apply-mailbox-defaults-api-remote.sh`.
2. **Таблица `_sogo_static_view`** — без записи SOGo отвечает **401 Unauthorized** на `/SOGo/`. Исправление: `bash scripts/prod-mailcow-fix-mailbox-attrs-remote.sh` (quota2 → API edit → rebuild SOGo) или `bash scripts/prod-mailcow-apply-sogo-sync-remote.sh`.

Пустой `mailbox.attributes` (`{}`) после SQL-создания ящика — отдельная частая причина; пакетно: `bash scripts/prod-mailcow-fix-mailbox-attrs-remote.sh`. Не открывайте **`/SOGo/so/`** напрямую — это API без сессии; используйте **`/SOGo/`**. После правок — жёсткое обновление страницы (Ctrl+Shift+R).

## Исходящая доставка (Delayed Mail / MX / timeout)

Сообщения **MAILER-DAEMON** «Delayed Mail (still being retried)» — это Postfix на `mail.avaterra.pro`, не приложение Next.js.

| Симптом в bounce | Вероятная причина | Действие |
|------------------|-------------------|----------|
| `type=MX: Host not found, try again` | **`unbound-mailcow`** недоступен или ещё стартует; Postfix резолвит через `@unbound` (172.22.1.254) | `docker compose ps unbound-mailcow`; логи `docker compose logs unbound-mailcow`; `docker compose up -d unbound-mailcow && docker compose restart postfix-mailcow` |
| MX резолвится, `connect to …:25: Connection timed out` **из контейнера**, с хоста порт 25 открыт | Правило **nft MAILCOW isolation** блокирует **return TCP** в Docker bridge после инцидентов ufw/iptables | В `mailcow.conf`: **`DISABLE_NETFILTER_ISOLATION_RULE=y`**; рестарт `netfilter-mailcow`, `nft flush chain ip filter MAILCOW`, рестарт postfix; см. [Diary.md — 2026-07-13](Diary.md) |
| Всё резолвится, очередь не пустеет | Отложенные письма в defer | `docker compose exec -T postfix-mailcow postqueue -f` и `mailq` |

**Быстрая проверка с WSL:**

```bash
bash scripts/prod-mailcow-outbound-check-remote.sh
# при подтверждённой регрессии:
bash scripts/prod-mailcow-outbound-check-remote.sh --fix
```

Ручная проверка на VPS (`/opt/mailcow-dockerized`):

```bash
docker compose exec -T postfix-mailcow dig +short MX list.ru @unbound
docker compose exec -T postfix-mailcow bash -lc 'echo QUIT | nc -w5 mxs.mail.ru 25'
docker compose exec -T postfix-mailcow mailq
nft list chain ip filter MAILCOW
```

Не подменяйте резолвер Postfix на `8.8.8.8`, пока не включён осознанный режим **`SKIP_UNBOUND=y`** по документации Mailcow.

## Инструменты в репозитории

| Путь | Назначение |
|------|------------|
| [`infra/mail/README.md`](../infra/mail/README.md) | Памятка по каталогу |
| [`infra/mail/mailcow-brand/`](../infra/mail/mailcow-brand/) | CSS и логотипы брендинга Mailcow (PNG + SVG) |
| [`infra/mail/check-mail-ports.sh`](../infra/mail/check-mail-ports.sh) | Проверка портов почты |
| [`scripts/mailcow-apply-branding-remote.sh`](../scripts/mailcow-apply-branding-remote.sh) | Копирование брендинга на VPS и рестарт `nginx-mailcow` |
| [`scripts/append-mail-stack-hosts-prod.sh`](../scripts/append-mail-stack-hosts-prod.sh) | Дописать в `.env` хосты `MAIL_*`, `MAIL_PROVISIONING_MODE=mailcow`, `MAILCOW_API_URL` (на VPS от root; ключ API — отдельно) |
| [`scripts/setup-mailcow-api-prod.sh`](../scripts/setup-mailcow-api-prod.sh) | **Один раз на VPS:** создать ключ Mailcow REST API (rw), прописать `MAILCOW_API_KEY` и режим `mailcow` в `.env`, рестарт aletheia |
| [`scripts/prod-mailcow-create-domain-mailbox-remote.sh`](../scripts/prod-mailcow-create-domain-mailbox-remote.sh) | С WSL: выровнять пароль существующего ящика в MySQL Mailcow (`MAILBOX_EMAIL=…`) |
| [`scripts/prod-mailcow-align-password-remote.sh`](../scripts/prod-mailcow-align-password-remote.sh) | С WSL: выровнять пароль через Mailcow API (`MAILBOX_EMAIL=…`, нужны `MAILCOW_API_*` в `.env` на VPS) |
| [`scripts/prod-mailcow-fix-mailbox-attrs-remote.sh`](../scripts/prod-mailcow-fix-mailbox-attrs-remote.sh) | С WSL: quota2 + API defaults + rebuild SOGo (красные крестики, SOGo 401) |
| [`scripts/prod-mailcow-sync-quota2-remote.sh`](../scripts/prod-mailcow-sync-quota2-remote.sh) | С WSL: создать строки `quota2` для ящиков без квоты в Mailcow |
| [`scripts/prod-mailcow-apply-mailbox-defaults-api-remote.sh`](../scripts/prod-mailcow-apply-mailbox-defaults-api-remote.sh) | С WSL: протоколы + quota через Mailcow API (`MAILBOX_EMAIL=…`) |
| [`scripts/prod-mailcow-test-sogo-imap-remote.sh`](../scripts/prod-mailcow-test-sogo-imap-remote.sh) | С WSL: IMAP/SOGo smoke для ящика |
| [`scripts/prod-inmail-sync-all-remote.sh`](../scripts/prod-inmail-sync-all-remote.sh) | С WSL: IMAP-sync всех включённых `InboundMailbox`, обновление `lastSyncStatus` в UI |
| [`scripts/mail-e2e-selfcheck-remote.sh`](../scripts/mail-e2e-selfcheck-remote.sh) | С WSL: полный E2E (тестовый ящик → IMAP → SMTP на admin@ → sync → cleanup); **`npm run mail:e2e-selfcheck`** |
| [`scripts/prod-mailcow-outbound-check-remote.sh`](../scripts/prod-mailcow-outbound-check-remote.sh) | С WSL: DNS/unbound, nft MAILCOW, очередь Postfix; **`--fix`** — стандартное восстановление исходящей доставки |
| [`scripts/append-own-smtp-env-prod.sh`](../scripts/append-own-smtp-env-prod.sh) | Включить `MAIL_USE_OWN_SMTP` + `EMAIL_TRANSPORT=smtp` на проде |
