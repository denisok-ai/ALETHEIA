<!--
@file: Security-Audit-2026-08-31.md
@description: Независимый аудит безопасности (код + прод, изнутри и снаружи) от 31.08.2026
@created: 2026-08-31
-->

# Аудит безопасности — 31.08.2026

Независимая проверка всех модулей: статический разбор кода и живой прод
(95.181.224.70 / avaterra.pro), изнутри (SSH) и снаружи (внешние пробы).

## Исправлено и выкачено на прод (commit `ba1a11b`)

| # | Severity | Находка | Фикс | Проверка |
|---|---|---|---|---|
| 1 | **Critical** | `next-auth` 4.24.13 уязвим к GHSA-7rqj-j65f-68wh: email нормализуется до Unicode-нормализации → обход через омоглиф «@». Прямо касается credentials-входа. | → 4.24.15 | `npm audit`: critical 1→0; на проде `commit=ba1a11b` |
| 2 | Low | `nanoid` 5.1.6 — GHSA-28wg-ghj8-5hjv (зацикливание при size<0). nanoid генерирует токены платёжных ссылок и сброса пароля. | → 5.1.16 | прямой `nanoid@5.1.16` |
| 3 | Info | Заголовок `X-Powered-By: Next.js` раскрывал стек и версию сканерам. | `poweredByHeader:false` | на проде заголовок отсутствует |

## Исправлено на проде — почтовые порты (после подтверждения владельца)

**MEDIUM — почтовые порты были открыты наружу в обход ufw.** Docker публикует
порты mailcow на `0.0.0.0` и вставляет правила iptables ПЕРЕД фильтром ufw
(классический обход ufw Докером). ufw разрешал только 22/80/443/25/587/993, но
снаружи реально отвечали также 4190 (ManageSieve), 143 (IMAP cleartext), 110
(POP3), 995 (POP3S). В логах dovecot видно, что их уже щупал сканер (внешний IP
177.3.214.0, «no auth attempts»).

**Владелец подтвердил: на почту заходят только через браузер (вебмейл SOGo,
внутренняя docker-сеть).** Значит внешние POP3/IMAP-cleartext/ManageSieve не
нужны никому. Закрыты правилами DROP в цепочке `DOCKER-USER` (бэкап
`iptables-save` → `/root/backups/iptables/`, персист в `/etc/iptables/rules.v4`,
идемпотентно зафиксировано в `scripts/security-hardening-prod.sh`):

- **Закрыты наружу:** 110, 143, 995, 4190 — с сохранением localhost и
  docker-подсетей (172.16/12).
- **Оставлены открытыми:** 25 (приём почты), 587 (submission — приложение шлёт
  письма), 465 (SMTPS), 993 (IMAPS — синхронизация ящиков).

**Проверка:** внешне 25 отдаёт баннер `220 mail.avaterra.pro`, 587/465/993
проходят TLS-хендшейк; 143/110/995/4190 не отвечают, счётчики DROP растут
(143: 18 пакетов, 4190: 11 и т.д.).

**Связка почта ↔ админка проверена — НЕ пострадала.** Все 5 ящиков
(`InboundMailbox`: admin/support/info/yarik/tatyana) настроены на IMAP
`mail.avaterra.pro:993` (TLS) и SMTP `:587`; провижининг ящиков — mailcow API по
HTTPS/443. Ни одного использования 143/110/995/4190. Живой прогон
`inmail-sync` ПОСЛЕ фикса: `processed:5, failed:0, HTTP 200`. POP3 в коде не
используется вовсе (синхронизация только через `ImapFlow`).

## Исправлено — TLS-сертификат почты (01.09)

Было: dovecot/postfix отдавали **самоподписанный snakeoil** mailcow (issuer `O=mailcow`),
а приложение обходило проверку `MAIL_IMAP_TLS_REJECT_UNAUTHORIZED=false`.

Причина: mailcow стоит за хостовым nginx (`SKIP_LETS_ENCRYPT=y`, HTTP/HTTPS на 127.0.0.1:8088/8448).
На хосте уже был валидный Let's Encrypt для `mail.avaterra.pro` (certbot, авто-обновление),
но в SSL-ассеты mailcow он не копировался — почтовые протоколы (993/587/25) терминируют TLS
внутри mailcow, а там лежал snakeoil.

Сделано (бэкапы в `/root/backups/`):
- Deploy-hook `/etc/letsencrypt/renewal-hooks/deploy/mailcow-cert.sh`: копирует LE-сертификат
  `mail.avaterra.pro` в `mailcow/data/assets/ssl/{cert,key}.pem` и перезапускает dovecot/postfix.
  Реагирует только на свою линию (`RENEWED_LINEAGE`) — на будущих обновлениях сертификат
  сам доедет до почты. Прогнан вручную для первичной установки.
- Приложение переведено на строгую проверку: `MAIL_IMAP_TLS_REJECT_UNAUTHORIZED=true` (IMAP+SMTP),
  рестарт `aletheia`.

Проверка: 993/587/25 снаружи отдают LE-сертификат, `Verify return code: 0 (ok)`; живой
`inmail-sync` при строгом TLS — `processed:5, failed:0`.

## Принятый риск / крупные апгрейды (осознанно не форсировал)

- **CSP `script-src 'unsafe-inline'`** в боевом режиме. Уже работает строгая
  политика в Report-Only (`/api/csp-report`) — миграция на nonce идёт по плану.
  Слепое удаление сломало бы JSON-LD и счётчики (Метрика/GA/Clarity).
- **Транзитивные npm-advisory** (13 high / 4 moderate): mail-парсинг
  (mailparser → html-to-text → deepmerge-ts), `xlsx` (SheetJS prototype
  pollution — фикса в npm НЕТ, используется только в админском экспорте
  `lib/export-xlsx.ts`), socket.io-parser, js-yaml, brace-expansion, fast-uri,
  ip-address, undici + moderate DoS в `next` (Image Optimizer, фикс только в
  Next 15.x). Форсить мажор 14→15 на платёжном проде без прогонов нельзя —
  рекомендация: отдельная задача на тестируемый апгрейд Next 15.

## Проверено и ЧИСТО (позитивное подтверждение)

- **Авторизация API:** все 140 admin-маршрутов требуют `role==='admin'` через
  `requireAdminSession` (JWT-fallback тоже проверяет роль). IDOR / пропущенных
  проверок не найдено. Публичных маршрутов 9 — все обоснованы.
- **PayKeeper webhook:** timing-safe MD5-подпись, сумма и клиент сверяются ДО
  мутаций, идемпотентность, самолечение зачисления.
- **SQL:** только два безопасных `PRAGMA` через `$queryRawUnsafe`; остальное —
  Prisma. Инъекций нет. Python-бот — параметризованные запросы.
- **XSS:** все `dangerouslySetInnerHTML` идут через безопасный `jsonLdString`,
  кроме тела публикаций → `sanitize-html` (белый список тегов, схемы только
  http/https/mailto).
- **Сброс/установка пароля:** rate-limit, одноразовые nanoid-токены с TTL 48ч,
  общие тексты ошибок (без энумерации).
- **Rate-limit** на всех auth/публичных/LLM-эндпоинтах.
- **Middleware RBAC** корректен; приложение слушает только `127.0.0.1:3000`
  (внешняя проба портов 3000/5432/6379 — артефакт ACK-then-drop фаервола, не
  живой сервис); Postgres/Redis — только localhost.
- **SSH:** эффективно keys-only (`passwordauthentication no`, root
  `prohibit-password`), 4 jail fail2ban активны. Секреты `.env` — режим 600.
- **Секреты в git:** hardcoded-секретов не найдено (совпадения regex — имена
  полей, env-чтение, тестовые фикстуры seed).
- **Внешний периметр:** `/.env`, `/.git`, `/uploads/*`, admin-API, cron —
  отдают 401/403/404.

## Скрипты проверки
- `npm audit --omit=dev` — зависимости
- `bash scripts/security-verify-prod.sh` — read-only аудит прода
- `ss -tlnp` на проде — слушающие сокеты (проверка bind на 127.0.0.1)
