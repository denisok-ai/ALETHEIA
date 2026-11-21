# Каталог scripts/

Скрипты лежат в одной папке без подпапок **намеренно**: крон и systemd на сервере вызывают их по путям
`/opt/ALETHEIA/scripts/<имя>` (`/etc/cron.d/aletheia-*`, юниты в `infra/systemd/`), CI — по путям из
`.github/workflows/deploy.yml`. Перенос файла ломает прод. Новый скрипт — кладите сюда же, с говорящим
префиксом из таблиц ниже и комментарием в первых строках (из него собран этот каталог).

Разовые скрипты после использования удаляйте — они остаются в истории git. 21.11.2026 удалено 32
разовых/мёртвых скрипта (`_tmp-*`, `patch-*`, `fix-*` …), см. docs/Diary.md.

Пересобрать каталог: описание берётся из первого комментария файла; при добавлении скрипта допишите строку вручную.

## Деплой и релиз (9)

| Скрипт | Назначение |
|---|---|
| `clean-next.mjs` | Удаляет каталог .next (кроссплатформенно). Нужен, чтобы не смешивать артефакты |
| `deploy-pull.sh` | Выгрузка с гита на сервере: pull → install → migrate → build → restart → очистка proxy_cache nginx. |
| `deploy-push.sh` | Загрузка на гит с сервера: add → commit → push. |
| `deploy-remote.sh` | Деплой на прод по SSH (WSL/Linux). Соответствует docs/Production-Server.md: |
| `deploy-rsync-from-local.sh` | Деплой без Git: локальная next build → rsync артефактов на VPS → npm ci, prisma generate, |
| `deploy-telegram-about.sh` | Деплой /about в меню Telegram: копирование sources, build на VPS, systemd, setMyCommands. |
| `deploy-telegram-prod.sh` | Commit telegram changes, push, deploy, register webhook. Logs to scripts/.deploy-telegram.log |
| `deploy-telegram-systemic-fix.sh` | Деплой Telegram-бота (long-polling): код, systemd, без webhook. |
| `push-and-deploy-prod.sh` | Отправка main на GitHub и деплой на VPS (см. docs/Production-Server.md). |

## Прод: диагностика и обслуживание (70)

| Скрипт | Назначение |
|---|---|
| `prod-audit-remote.sh` | Remote production audit script — run on VPS via SSH |
| `prod-build-only-remote.sh` | Пересборка Next.js на проде без npm ci (после правки tsconfig / выката файлов). |
| `prod-diagnostics.sh` | Расширенная диагностика продуктивного VPS (только чтение, без изменений на диске). |
| `prod-health.sh` | KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/avaterra_deploy_nopass}" |
| `prod-inmail-sync-all-remote.sh` | Синхронизирует все включённые InboundMailbox на проде (обновляет lastSyncStatus в UI). |
| `prod-mail-auth-diagnose-remote.sh` | Диагностика SMTP/IMAP-аутентификации на проде без вывода секретов. |
| `prod-mail-deep-diagnose-remote.sh` | Расширенная диагностика SMTP/IMAP на проде (SSH с локальной машины). |
| `prod-mail-diagnose-remote.sh` | Одноразовая диагностика почты на прод-VPS (запуск с локальной машины: bash scripts/prod-mail-diagnose-remote.sh). |
| `prod-mail-restore-notifications-sender-remote.sh` | SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" |
| `prod-mail-send-smoke-remote.sh` | Проверяет реальную SMTP-отправку через Mailcow с текущими настройками приложения. |
| `prod-mail-set-sender-admin-remote.sh` | SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" |
| `prod-mailcow-align-password-remote.sh` | Синхронизирует пароль admin@avaterra.pro: берёт зашифрованный пароль из БД приложения |
| `prod-mailcow-api-list-mailboxes-remote.sh` | SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" |
| `prod-mailcow-apply-mailbox-defaults-api-remote.sh` | Применить протоколы/SOGo/квоту через Mailcow API edit/mailbox (не raw SQL). |
| `prod-mailcow-apply-sogo-sync-remote.sh` | Пересобрать Mailcow _sogo_static_view штатной функцией update_sogo_static_view(). |
| `prod-mailcow-compare-mailbox-rows-remote.sh` | Полное сравнение строк mailbox (все колонки) для диагностики «есть в MySQL, нет в API». |
| `prod-mailcow-create-domain-mailbox-remote.sh` | Создаёт domain/mailbox в MySQL Mailcow из данных приложения, если Mailcow API не настроен. |
| `prod-mailcow-db-check-remote.sh` | SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" |
| `prod-mailcow-diag-sogo-remote.sh` | Диагностика SOGo/403 на прод-Mailcow (запуск с машины с SSH-ключом). |
| `prod-mailcow-domain-check-remote.sh` | SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" |
| `prod-mailcow-dovecot-vmail-check-remote.sh` | SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" |
| `prod-mailcow-find-sogo-php-remote.sh` | SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" |
| `prod-mailcow-fix-aliases-remote.sh` | SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" |
| `prod-mailcow-fix-mailbox-attrs-remote.sh` | Починить attributes/quota у ящиков info@, yarik@, support@. |
| `prod-mailcow-fix-sender-acl-remote.sh` | SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" |
| `prod-mailcow-grep-sogo-fn-remote.sh` | SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" |
| `prod-mailcow-inspect-mailbox-attrs-remote.sh` | SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" |
| `prod-mailcow-inspect-remote.sh` | SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" |
| `prod-mailcow-outbound-check-remote.sh` | Диагностика исходящей почты Mailcow на проде: DNS (unbound), nft MAILCOW, очередь Postfix. |
| `prod-mailcow-php-hash-snippet-remote.sh` | SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" |
| `prod-mailcow-php-ls-remote.sh` | SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" |
| `prod-mailcow-php-path-snippet-remote.sh` | SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" |
| `prod-mailcow-postfix-map-check-remote.sh` | SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" |
| `prod-mailcow-query-mailboxes-remote.sh` | Сравнить attributes/quota/active у ящиков avaterra.pro |
| `prod-mailcow-quota2-php-get-remote.sh` | SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" |
| `prod-mailcow-redis-mailbox-debug-remote.sh` | SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" |
| `prod-mailcow-related-tables-remote.sh` | SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" |
| `prod-mailcow-sogo-db-remote.sh` | SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" |
| `prod-mailcow-sogo-logs-remote.sh` | Короткие логи Mailcow SOGo/nginx + проверка полей mailbox (kind и т.д.) |
| `prod-mailcow-sogo-schema-remote.sh` | SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" |
| `prod-mailcow-sogo-static-remote.sh` | SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" |
| `prod-mailcow-sogo-view-remote.sh` | SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" |
| `prod-mailcow-sync-quota2-remote.sh` | Синхронизировать quota2 и пересобрать кэш Mailcow для ящиков, созданных через SQL. |
| `prod-mailcow-test-sogo-imap-remote.sh` | Проверка SOGo/IMAP для info@ на проде (без вывода пароля). |
| `prod-manual-build.sh` | SCRIPT_DIR=scripts |
| `prod-playwright-and-build-remote.sh` | Одноразово на проде: добавить devDependency @playwright/test (нужен для next build из‑за playwright.config.ts) и пересобрать. |
| `prod-readiness-check.ts` | Проверка обязательных переменных окружения и типичных проблем перед production-сборкой. |
| `prod-recover-deploy.sh` | SCRIPT_DIR=scripts |
| `prod-send-menu.ts` | ﻿import { sendTelegramMessageWithResult } from "../lib/telegram"; |
| `prod-set-timezone-moscow-remote.sh` | Устанавливает московское время на VPS (Europe/Moscow), сохраняется после перезагрузки. |
| `prod-student-triage-remote.sh` | Триаж «студент оплатил, но видит не тот курс/демо» — ТОЛЬКО ЧТЕНИЕ прод-БД. |
| `prod-system-health-check-remote.sh` | Read-only аудит модулей прода (systemd, cron, nginx, docker, security-verify). |
| `prod-telegram-cron-fix.sh` | SSH_KEY="${DEPLOY_SSH_KEY:-/home/denisok/.ssh/avaterra_deploy_nopass}" |
| `prod-url-fix.sql` | UPDATE SystemSetting SET value='https://avaterra.pro' WHERE key IN ('site_url','nextauth_url') AND value LIKE '%localhost%'; |
| `prod-user-diag.sh` | Одноразовая диагностика почты на прод-VPS (запуск с локальной машины: bash scripts/prod-mail-diagnose-remote.sh). |
| `prod-verify.ts` | Сводная проверка прода одной командой: доступность, SEO-разметка, защиты, |
| `remote-keys.sh` | sqlite3 /opt/ALETHEIA/prisma/dev.db "SELECT key FROM SystemSetting ORDER BY key;" |
| `remote-step1.sh` | echo ========== 1 .env ========== |
| `remote-step2.sh` | echo after_source DBUSER_len=${#DBUSER} DBNAME=$DBNAME |
| `remote-step4.sh` | ENV=/opt/ALETHEIA/.env |
| `remote-step4b.sh` | echo ========== 4b SystemSetting keys ========== |
| `remote-step4c.sh` | echo ========== 4b SystemSetting mail/cron ========== |
| `remote-step5.sh` | echo ========== 5 InboundMailbox sqlite ========== |
| `run-prod-audit.sh` | KEY="$HOME/.ssh/avaterra_deploy_nopass" |
| `run-prod-import-courses-services.sh` | Однократный импорт курсов и витрины на прод (после deploy:rsync). Запуск из WSL: |
| `vps-install-outline-proxy.sh` | ﻿#!/bin/bash |
| `vps-run-gost-test.sh` | ﻿#!/bin/bash |
| `vps-test-singbox.sh` | ﻿#!/bin/bash |
| `vps-test-sslocal.sh` | ﻿#!/bin/bash |
| `vps-verify-telegram-bot.sh` | ﻿#!/bin/bash |

## Крон, сторожа и мониторинг (8)

| Скрипт | Назначение |
|---|---|
| `check-health-log.sh` | One-off prod diagnostics for Telegram bot |
| `cron-heartbeat-watchdog.sh` | Сторож фоновых задач: сообщает, если задача перестала ВЫПОЛНЯТЬСЯ вообще. |
| `cron-http-call.sh` | Вызов защищённого HTTP cron-маршрута Next.js с Bearer CRON_SECRET из .env. |
| `install-aletheia-http-cron.sh` | Установка /etc/cron.d/aletheia-http-cron на VPS (рассылки, IMAP, рассрочка). |
| `setup-cron-secret-prod.sh` | Одноразовая настройка CRON_SECRET на проде (если отсутствует). |
| `telegram-webhook-health.sh` | Мониторинг Telegram на VPS: прокси для исходящих (бот — long-polling, webhook не используется). |
| `tg-tunnel-watchdog.sh` | Сторож туннеля Telegram на проде AVATERRA (tg-tunnel-watchdog.timer, раз в 2 минуты, от root). |
| `uptime-watchdog.sh` | Независимый сторож доступности сайта. |

## Почта и Mailcow (9)

| Скрипт | Назначение |
|---|---|
| `mail-bounce-watch.sh` | Сторож недоставленной почты: ловит отлупы (bounce) исходящих писем и шлёт |
| `mail-e2e-selfcheck-remote.sh` | E2E самопроверка почты на проде: |
| `mail-inbox-notify.py` | Уведомление в Telegram о НОВЫХ входящих письмах в ящиках avaterra.pro, |
| `mail-module-verify.ts` | Лёгкие проверки инвариантов почтового модуля без сети и без ключей API. |
| `mail-nginx-le-on-vps.sh` | Выпуск Let's Encrypt для mail.avaterra.pro и nginx → Mailcow (127.0.0.1:8448). |
| `mailbox-password-set.ts` | Смена пароля ящика через БД (обновляет шифр passwordEnc в DomainMailbox и InboundMailbox). |
| `mailcow-apply-branding-remote.sh` | Копирует брендинг Mailcow (CSS + PNG/ SVG логотипа) на VPS и перезапускает nginx контейнер. |
| `mailcow-cli-update-sogo-static-view.php` | Одноразовый CLI для Mailcow: заполнить _sogo_static_view через штатную PHP-функцию. |
| `smtp-system-password-set.ts` | Запись зашифрованного SMTP-пароля транзакционной почты в SystemSetting (ключ smtp_password). |

## Telegram и боты (16)

| Скрипт | Назначение |
|---|---|
| `max-connect.sh` | @file: max-connect.sh |
| `max-connect.ts` | Подключение канала школы в MAX к автопубликации. |
| `setup-telegram-proxy-prod.sh` | One-off prod diagnostics for Telegram bot |
| `setup-telegram-smm-redirect.ts` | Перевод старого SMM-бота (@AvaterraBot) в режим «редирект в бота портала». |
| `setup-telegram-webhook.ts` | CLI: удалить webhook и зарегистрировать команды (режим long-polling). */ |
| `telegram-connect-proxy.mjs` | Минимальный HTTP CONNECT-прокси ТОЛЬКО для Telegram-доменов. |
| `telegram-delete-webhook.ts` | Удалить webhook Telegram (бот работает через long-polling). */ |
| `telegram-egress-home.sh` | Держит домашний Telegram-мост для прода: CONNECT-прокси (127.0.0.1:3129) и |
| `telegram-poll-daemon.ts` | Единственный long-polling worker Telegram-бота (systemd: aletheia-telegram-poll.service). |
| `telegram-poll-worker.sh` | Гибридный getUpdates fallback (каждые 30s через cron). |
| `telegram-poll-worker.ts` | Одноразовый цикл long-poll (диагностика / cron legacy). |
| `telegram-prod-set-secrets.ts` | Запись telegram_bot_token и telegram_webhook_secret в SystemSetting (AES-GCM). |
| `telegram-proxy-tunnel-stop.sh` | Остановка gost и SSH-туннеля для Telegram-прокси. |
| `telegram-webhook-info.ts` | getWebhookInfo через прокси (токен из БД). */ |
| `telegram-webhook-latency-prod.ts` | Замер latency: webhook ack + sendChatAction через прокси + симуляция /menu. |
| `telegram-webhook-reset-soft.ts` | @deprecated Webhook сброс отключён — бот на long-polling. */ |

## Платежи (6)

| Скрипт | Назначение |
|---|---|
| `paykeeper-debug-flow.ts` | Диагностика PayKeeper по настройкам из БД (без реальной оплаты). |
| `paykeeper-protocol-check.ts` | Быстрая проверка соответствия базовым правилам протокола PayKeeper. |
| `payment-flow-check.ts` | Статические проверки цепочки оплаты без PayKeeper: товары, ключи заказа, привязка к курсу. |
| `payment-webhook-check.ts` | Интеграционные проверки обработки оплаты (lib/paykeeper-webhook-process.ts). |
| `reconcile-enrollments-check.ts` | Проверки сверки «оплачено, но доступа нет» (lib/payments/reconcile-enrollments.ts). |
| `yookassa-install-key.sh` | @file: yookassa-install-key.sh |

## SCORM и курсы (6)

| Скрипт | Назначение |
|---|---|
| `enroll-demo-scorm-student.ts` | Запись тестового студента на курс course-demo-muscle-testing (после scorm:import-demo). |
| `enrollment-nudge-check.ts` | Проверки окна напоминаний «записались, но курс не открыли» |
| `import-demo-scorm.ts` | Импорт SCORM-пакета в курс course-demo-muscle-testing («Пробный 12345», открыт всем в ЛК). |
| `import-scorm-new-course.ts` | Создаёт новый курс и загружает в него SCORM из ZIP (как загрузка в админке). |
| `scorm-install-from-dir.ts` | Установка SCORM-пакета в курс из УЖЕ РАСПАКОВАННОГО каталога (без ZIP). |
| `setup-scorm-probnyy-2.ts` | Полная настройка курса «Пробный 2» из SCORM ZIP (аналог действий в админке): |

## SEO, блог и контент (10)

| Скрипт | Назначение |
|---|---|
| `blog-fix-seo-titles.ts` | SEO-заголовки и описания для статей блога, у которых title обрезается в выдаче. |
| `blog-import-telegram.ts` | Импорт постов Telegram-канала в черновики блога. |
| `blog-publish-kb-articles.ts` | Публикация SEO-статей из базы знаний (lib/content/kb-seo-articles.ts). |
| `content-plan-repair.ts` | Ремонт контент-плана после бага «план на прошедшую неделю» (2026-08-11). |
| `generate-blog-og-images.mjs` | Генерирует индивидуальные OG-баннеры 1200×630 для статей блога: |
| `gsc-audit.ts` | Аудит того, что видит Google: Search Console API + URL Inspection + Search Analytics. |
| `indexnow-submit-all.ts` | Первичная отправка всех публичных URL из sitemap.xml в IndexNow (Яндекс/Bing). |
| `llm-guard-check.ts` | Проверка защиты LLM от prompt injection (lib/llm-guard.ts). |
| `seo-audit-live.ts` | SEO-аудит живого сайта: валидность JSON-LD, метатеги, canonical, alt у картинок, |
| `seo-import-mm-keys.sh` | @file: seo-import-mm-keys.sh |

## Соцсети и ролики (4)

| Скрипт | Назначение |
|---|---|
| `clips-upload.sh` | Заливка роликов и постеров на прод: AVATERRA/private/clips/ → /opt/ALETHEIA/public/uploads/clips/. |
| `social-crosspost.ts` | Кросспостинг очереди: те же материалы из одной сети — в другую (обычно Telegram → MAX). |
| `social-enqueue.ts` | Постановка роликов в очередь канала школы: Telegram (T3.4/T3.5) или MAX. |
| `social-status.ts` | Состояние очереди соцсетей: сети, паузы и посты (время — МСК). |

## База данных и данные (19)

| Скрипт | Назначение |
|---|---|
| `backfill-leads-from-orders.ts` | Восстановление CRM: создаёт лиды из существующих заказов (Order), если контакт ещё не в Lead. |
| `clean-seed-test-data.ts` | Удаление данных старого тестового сида: пользователи @test.local / @avaterra.local, |
| `clear-crm-and-users.ts` | Очистка CRM (все лиды) и пользователей со ролью «студент» (user). |
| `clear-local-test-data-keep-courses-services.ts` | Локальная очистка тестовых данных с сохранением курсов, товаров (Service), |
| `clear-mediateka.ts` | Полная очистка медиатеки: все записи Media (связи MediaGroup удаляются каскадом), |
| `clear-test-data-batch.ts` | Пакетная очистка тестовых данных: |
| `delete-courses-except.ts` | Удаляет все курсы, кроме указанного (по умолчанию — основной SCORM course-demo-muscle-testing). |
| `delete-courses-not-in-services.ts` | Удаляет курсы, не привязанные к товарам витрины (модель Service: courseId). |
| `delete-seed-course-user-groups.ts` | Удаляет тестовые группы курсов и пользователей, созданные prisma/seed.ts |
| `export-courses-and-services-for-prod.ts` | Экспорт курсов (только задействованных в витрине Service) и всех Service для переноса на прод. |
| `export-sample-certificates.ts` | Записывает образцы PDF в public/certificates-samples/ — прямые ссылки без API. |
| `export-services.ts` | Экспорт всех строк Service в JSON (для переноса на прод). |
| `fix-verification-material-urls.ts` | Одноразово исправляет устаревшие videoUrl у видео-заявок на верификацию |
| `import-courses-and-services-merge.ts` | Импорт курсов (upsert по id) и полная замена витрины Service из JSON. |
| `import-services-replace.ts` | Удаляет все Service в текущей БД и создаёт заново из JSON. |
| `patch-existing-scorm-overrides.ts` | Однократно применить CSS-оверрайды ко всем папкам v* в public/uploads/scorm (уже распакованные пакеты). |
| `upsert-default-message-templates.ts` | Создаёт отсутствующие типовые шаблоны CommsTemplate по стабильным именам `[AVATERRA] …`. |
| `upsert-payment-email-templates.ts` | Записывает типовые шаблоны писем об оплате в SystemSetting, если ключ отсутствует или значение пустое. |
| `upsert-showcase-certificate-templates.ts` | Создаёт/обновляет шаблоны сертификатов для курсов витрины с встроенным PDF-макетом (поле pdfLayout в JSON). |

## Установка и настройка сервера (15)

| Скрипт | Назначение |
|---|---|
| `install-memory-budget.sh` | Бюджет памяти сервера: потолок у каждого компонента (mailcow-контейнеры и |
| `nginx-aletheia-http-snippet.conf` | Положить в /etc/nginx/conf.d/aletheia-cache-maps.conf |
| `nginx-aletheia.conf` | Reverse proxy avaterra.pro — кеш только для неизменяемой статики. |
| `nginx-clear-proxy-cache.sh` | Сброс файлового кеша nginx (proxy_cache_path) и безопасный reload. |
| `nginx-proxy-redirect.snippet` | ﻿        proxy_redirect http://localhost:3000/ https://avaterra.pro/; |
| `setup-backup-gdrive-prod.sh` | Установка бэкапа в Google Drive на проде (запускать на сервере из /opt/ALETHEIA). |
| `setup-chatbot-knowledge-base.ts` | Обновляет базу знаний для AI-консультанта (ключ `chatbot_knowledge_base` |
| `setup-mailcow-api-prod.sh` | Создаёт ключ Mailcow REST API (rw) и дописывает MAILCOW_* / MAIL_PROVISIONING_MODE в /opt/ALETHEIA/.env. |
| `setup-mailcow-docker-vps.sh` | Первичная подготовка VPS под Mailcow (Ubuntu): Docker Engine + клон репозитория mailcow-dockerized. |
| `setup-openconnect-telegram.sh` | Постоянный Telegram-egress через OpenConnect/AnyConnect VPN (userspace + ocproxy). |
| `setup-outline-telegram-proxy-prod.sh` | ﻿#!/usr/bin/env bash |
| `setup-probuzhdenie-course.ts` | Создаёт очный курс «Пробуждение» (`courseFormat: 'live_event'`) и связанные |
| `setup-probuzhdenie-remote.sh` | Запускает scripts/setup-probuzhdenie-course.ts на продуктивном VPS |
| `setup-ssh-key-prod.sh` | Настройка входа по SSH-ключу на прод (WSL / Linux). |
| `ssh-safety-guard.sh` | Проверка перед reload sshd: порт 22 и PubkeyAuthentication yes обязательны. |

## Проверки и тесты (15)

| Скрипт | Назначение |
|---|---|
| `_post-deploy-verify-telegram.sh` | H="${DEPLOY_HOST:-95.181.224.70}" |
| `_vps_test_outline.sh` |  |
| `aletheia-daily-selfcheck.sh` | Ежедневная самопроверка прода с тревогой в Telegram. |
| `answer-audit-check.ts` | Проверки сверки ответа бота с каталогом (lib/ai/answer-audit.ts). |
| `check-avaterra-home.mjs` | let hasAppError = false; |
| `check-database-url.sh` | Показать тип БД по DATABASE_URL (без полного URL с паролем) и наличие файла SQLite. |
| `check-home-errors.mjs` | let healthResponse = null; |
| `check-notification-enrollment-config.ts` | Проверка наборов уведомлений для события enrollment (зачисление после оплаты). |
| `check-telegram-prod.sh` | One-off prod diagnostics for Telegram bot |
| `csp-browser-check.ts` | Проверка страниц в реальном браузере: нарушения CSP, ошибки консоли, |
| `email-templates-smoke-test.ts` | DEFAULT_NOTIFICATION_TEMPLATES, |
| `register-test-user.ts` | Регистрация БЕСПЛАТНОГО тестового пользователя на полный дистанционный курс |
| `security-verify-prod.sh` | Read-only аудит безопасности VPS (не меняет sshd/ufw). SSH: порт 22 + ключи. |
| `ua-parse-check.ts` | Проверка lib/ua-parse.ts на реальных User-Agent строках. |
| `verify-telegram-commands.ts` | CLI: проверить getMyCommands (без вывода токена). */ |

## Прочее (56)

| Скрипт | Назначение |
|---|---|
| `.deploy.env` | DEPLOY_SSH_KEY=/home/denisok/.ssh/avaterra_deploy_nopass |
| `.deploy.env.example` | Скопируйте в scripts/.deploy.env (файл в .gitignore — не коммитить). |
| `.remote-ops.sh` | echo === |
| `.rx.txt` | echo === getWebhookInfo === |
| `_vps-install-gost.sh` | URL=https://github.com/go-gost/gost/releases/download/v3.2.6/gost_3.2.6_linux_amd64.tar.gz |
| `activate-telegram-prod.sh` | Полная активация Telegram на VPS после деплоя. |
| `admin-set-user-password.ts` | Установка пароля пользователю вручную (поддержка: студент не может войти). |
| `aletheia-jobs.service` | [Unit] |
| `aletheia-telegram-poll.service` | [Unit] |
| `append-mail-stack-hosts-prod.sh` | Дописывает в /opt/ALETHEIA/.env хосты встроенного почтовика (если строк ещё нет). |
| `append-mail-tls-env-prod.sh` | KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/avaterra_deploy_nopass}" |
| `append-own-smtp-env-prod.sh` | Дописывает в .env прод режим «свой SMTP из MAIL_SMTP_*» (перебивает БД и приоритет Resend). |
| `apply-nginx-scorm-auth-prod.sh` | Патч nginx на проде: auth_request для /uploads/scorm/ (без изменений SSH). |
| `apply-nginx-uploads-auth-prod.sh` | Патч nginx на проде: auth_request для приватной статики /uploads/media/ и |
| `apply-tg-now.sh` | Полная активация Telegram на VPS после деплоя. |
| `backup-gdrive-prod.sh` | Ежедневный бэкап прода в Google Drive (rclone remote "gdrive"). |
| `build-user-diag.mjs` |  |
| `bulk-replace-portal-colors.ps1` | $ErrorActionPreference = 'Stop' |
| `chatbot-kb-body.md` | База знаний AI-консультанта школы AVATERRA |
| `claude-telegram-bridge.mjs` | Telegram-мост к Claude Code НА ЭТОМ КОМПЬЮТЕРЕ. |
| `dev-local.sh` | Локальная отладка: Supabase (PostgreSQL) + Next.js |
| `dev-share-windows.cmd` | @echo off |
| `disable-pm2-aletheia.sh` | Отключить PM2 startup на проде — aletheia только через systemd (избежать EADDRINUSE на :3000). |
| `dump-paykeeper-logs.ts` | Последние записи PaykeeperIntegrationLog (локальная/текущая БД). |
| `extract-chatbot-kb-body.mjs` | if (si === -1) { |
| `format-changed.sh` | Prettier только для изменённых файлов: незакоммиченные правки + коммиты ветки, |
| `generate-favicon.mjs` | Генерирует app/favicon.ico из логотипа бренда (32×32 и 16×16 PNG внутри ICO-контейнера, |
| `generate-og-image.mjs` | Генерирует OG-баннер 1200×630 (public/images/og/og-default.png) из героя лендинга: |
| `investigate-webhook-now.sh` | One-off prod diagnostics for Telegram bot |
| `jobs-daemon.ts` | Фоновый планировщик SMM/Site Radar (systemd: aletheia-jobs.service). |
| `local-stop-services.sh` | Локально (WSL): освободить типичные порты dev/prod Next и остановить prisma studio. |
| `manual-register-student.ts` | Ручная регистрация студента на курс (прод / локально). |
| `merge-fonts.js` | async function mergeFonts(outName, ...files) { |
| `metrika-ensure-goals.ts` | JS-цели Яндекс.Метрики, которые шлёт сайт (lib/analytics-events.ts → ym reachGoal). |
| `optimize-certificate-logo.ts` | Готовит avaterra-gold-logo.png для PDF: trim полей, альфа, ресайз до 640px по длинной стороне (без «мыла» при печати). |
| `outline_gen_singbox_config.py` | ﻿#!/usr/bin/env python3 |
| `outline_gen_sslocal_config.py` | ﻿#!/usr/bin/env python3 |
| `package-certificate-assets.ts` | Собирает ZIP: образцы PDF из public/certificates-samples/ + золотой логотип. |
| `peek-mw.js` | console.log(s.slice(Math.max(0, i - 400), i + 500)); |
| `prepare-for-server.sh` | Подготовка сборки для переноса на Git и запуска на сервере (в т.ч. в режиме отладки). |
| `replace-portal-accent-hex.mjs` | Одноразово: заменить хардкод indigo в className на CSS-переменные портала. |
| `resize_probuzhdenie_card_cover.py` | Ресайз обложки до 1536×1024 (3:2) под блок тарифа. Требует: pip install pillow.""" |
| `restore-telegram-egress.sh` | Восстановление Telegram-канала прода через Cloudflare WARP (WireGuard в sing-box). |
| `restore-ufw-prod.sh` | Восстановление ufw после конфликта с iptables-persistent. SSH: порт 22 + ключи. |
| `run-poll-prod.sh` | One-off prod diagnostics for Telegram bot |
| `security-hardening-prod.sh` | Безопасность VPS avaterra.pro — бэкап, ufw, sshd (порт 22 + ключи), nginx, права файлов. |
| `security-phase2-prod.sh` | Фаза 2 hardening на VPS: localhost-only Next.js, sshd без паролей, Docker DOCKER-USER. |
| `security-post-setup-prod.sh` | Дополнительные шаги безопасности после hardening: ufw 5173, cron, nginx upload location. |
| `send-menu-prod.sh` | Полная активация Telegram на VPS после деплоя. |
| `simulate-paykeeper-webhook.sh` | Симуляция webhook PayKeeper: создаёт заказ через API и вызывает webhook с подписью. |
| `simulate-telegram-webhook-atbot.ts` | Simulate webhook with /start@BotName (menu commands from Telegram). */ |
| `simulate-telegram-webhook.ts` | ﻿import { getEnvOverrides } from '../lib/settings'; |
| `status-aletheia.sh` | One-off prod diagnostics for Telegram bot |
| `sync-telegram-env-to-dotenv.ts` | Синхронизация TELEGRAM_* из БД в /opt/ALETHEIA/.env для быстрого webhook (без decrypt на каждый POST). |
| `upload-mail-scripts-prod-dry-run.sh` | Загрузить скрипты смены паролей на прод и выполнить dry-run (без секретов). |
| `vpn-reality-rotate-local.sh` | Ротация Reality-ключа xray (запускать ЛОКАЛЬНО при SSH на VPN-сервер 103.110.64.230). |
