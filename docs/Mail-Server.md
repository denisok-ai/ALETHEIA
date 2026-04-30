# Развёртывание автономной почты для avaterra.pro

Почтовый стек работает **отдельно** от каталога Next.js приложения (`/opt/ALETHEIA` на VPS — см. [Production-Server.md](Production-Server.md)). Сайт подключается к нему как **SMTP/IMAP-клиент**.

## Документы по теме

| Файл | Содержание |
|------|------------|
| [Mail-Current-State.md](Mail-Current-State.md) | Что уже есть в коде приложения |
| [Mail-VPS-Audit-Checklist.md](Mail-VPS-Audit-Checklist.md) | Порты, PTR, ресурсы |
| [Mail-Stack-Decision.md](Mail-Stack-Decision.md) | Выбор Mailcow vs альтернативы |
| [Mail-DNS-avaterra.pro.md](Mail-DNS-avaterra.pro.md) | MX, SPF, DKIM, DMARC |

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

Корневая причина — **пароль в зашифрованном поле `InboundMailbox` не совпадает с паролем того же ящика в Mailcow/Dovecot.** Обновите пароль через **Портал → Ящики домена → Пароль** (или вручную синхронизируйте пароль в Mailcow и в приложении). Без совпадения Dovecot отвечает `AUTHENTICATIONFAILED`.

При создании ящика через приложение код сразу вызывает **`edit/mailbox` с тем же паролём** после успешного `add/mailbox`, чтобы Dovecot получил корректный хеш (тот же эффект, что у скрипта `scripts/prod-mailcow-align-password-remote.sh`). Если уже созданный ящик «молчит» с ошибкой авторизации — для разового исправления на сервере: `MAILBOX_EMAIL=адрес bash scripts/prod-mailcow-create-domain-mailbox-remote.sh` (без ключа Mailcow API) или `MAILBOX_EMAIL=адрес bash scripts/prod-mailcow-align-password-remote.sh` (если в `.env` заданы `MAILCOW_API_*`).

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

## Инструменты в репозитории

| Путь | Назначение |
|------|------------|
| [`infra/mail/README.md`](../infra/mail/README.md) | Памятка по каталогу |
| [`infra/mail/mailcow-brand/`](../infra/mail/mailcow-brand/) | CSS и логотипы брендинга Mailcow (PNG + SVG) |
| [`infra/mail/check-mail-ports.sh`](../infra/mail/check-mail-ports.sh) | Проверка портов почты |
| [`scripts/mailcow-apply-branding-remote.sh`](../scripts/mailcow-apply-branding-remote.sh) | Копирование брендинга на VPS и рестарт `nginx-mailcow` |
| [`scripts/append-mail-stack-hosts-prod.sh`](../scripts/append-mail-stack-hosts-prod.sh) | Дописать в `.env` хосты `MAIL_*` (на VPS от root) |
| [`scripts/append-own-smtp-env-prod.sh`](../scripts/append-own-smtp-env-prod.sh) | Включить `MAIL_USE_OWN_SMTP` + `EMAIL_TRANSPORT=smtp` на проде |
