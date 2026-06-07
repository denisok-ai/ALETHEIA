<!--
@file: Tasktracker.md
@description: Трекер задач проекта Avaterra Telegram SMM Bot по спринтам и приоритетам
@dependencies: docs/Project.md, docs/Security.md, docs/Diary.md, docs/qa.md
@created: 2026-05-07
-->

# Avaterra Telegram SMM Bot - Task Tracker

## Правила статусов
- **Не начата**
- **В процессе**
- **Завершена**
- **Заблокирована**

## Hotfix - 2026-05-07 (надёжность публикации и ссылок)

## Задача: Антигаллюцинация URL в постах
- **Приоритет**: Критический
- **Статус**: Завершена
- **Описание**: Исключить публикацию несуществующих ссылок и разрешить только официальные URL бренда.
- **Шаги выполнения**:
  - [x] Найдена причина: LLM иногда подставляет `/store` по смыслу «каталог».
  - [x] В `quality gates` добавлен контроль URL whitelist (`url_not_whitelisted`).
  - [x] Усилен системный промпт генератора явным запретом выдумывать ссылки.
  - [x] Добавлены тесты на блокировку невалидной ссылки.
  - [x] Закрыта дыра «домен без `https://`» (Telegram автодетектит) — gate теперь ищет упоминания хоста бренда без схемы.
  - [x] Добавлена защита от `http://` вариантов и игнорирование email.
- **Зависимости**: KB (`products`, `cta_library`, `quick_links`)

## Задача: Гарантировать паузу между картинкой и текстом
- **Приоритет**: Высокий
- **Статус**: Завершена
- **Описание**: Перед текстом после фото выдерживать минимум 10 секунд, независимо от значения в env.
- **Шаги выполнения**:
  - [x] Проверена текущая логика `send_photo -> sleep -> send_message`.
  - [x] Enforce минимального порога 10 секунд в коде публикатора.
  - [x] Default `PUBLISH_TEXT_DELAY_SECONDS=10` в `config.py` и `.env.example`.
  - [x] На сервере `.env` обновлен на `PUBLISH_TEXT_DELAY_SECONDS=10`.
  - [x] Тесты на минимальный порог задержки обновлены.
  - [x] Деплой выполнен, бот healthy.
- **Зависимости**: `services/publisher/channel_publisher.py`

## Задача: Диагностика и профилактика SSH-сбоев
- **Приоритет**: Высокий
- **Статус**: Завершена
- **Описание**: Разобрать причину зависаний SSH/SCP и исключить повтор.
- **Шаги выполнения**:
  - [x] Найдены зависшие локальные `ssh/scp` процессы, выполнена очистка.
  - [x] Подготовлен runbook серверной диагностики (`sshd`, fail2ban, ufw, веб-консоль).
  - [x] После восстановления сети выполнить валидацию и зафиксировать RCA в `Diary.md`.
  - [x] Добавить безопасный регламент деплоя с таймаутами и обязательной проверкой health.
- **Зависимости**: Доступ к серверу/веб-консоли провайдера

## Спринт 0 - Hardening Setup

## Задача: Security baseline и удаление открытых секретов
- **Приоритет**: Критический
- **Статус**: Завершена
- **Описание**: Зафиксировать правила хранения ключей, логирования и ротации; убрать секреты из рабочих файлов.
- **Шаги выполнения**:
  - [x] Добавлен `docs/Security.md`.
  - [x] Добавлен `.env.example`.
  - [x] Очищен `Avaterra.pro.txt` от секретных значений.
  - [x] Добавлен pre-production security checklist.
- **Зависимости**: Нет

## Задача: Обновить архитектурный документ под Avaterra
- **Приоритет**: Критический
- **Статус**: Завершена
- **Описание**: Полностью переписать `docs/Project.md` под новое ТЗ с архитектурой Telegram SMM-бота.
- **Шаги выполнения**:
  - [x] Зафиксированы роли и сценарии.
  - [x] Добавлены модули, требования и acceptance criteria.
  - [x] Добавлена архитектурная схема и NFR.
- **Зависимости**: Security baseline

## Задача: Каркас Python/aiogram + Docker
- **Приоритет**: Критический
- **Статус**: Завершена
- **Описание**: Подготовить рабочий скелет приложения, контейнеризацию и базовые команды бота.
- **Шаги выполнения**:
  - [x] `pyproject.toml`, `.gitignore`, `README.md`.
  - [x] Точка входа `src/avaterra_bot/__main__.py`, конфиг через pydantic-settings.
  - [x] Скелет aiogram (`/start`, `/help`, `/status`) и middleware ACL.
  - [x] `Dockerfile` и `docker-compose.yml` с Postgres и Redis.
  - [x] Базовые миграции БД.
- **Зависимости**: Security baseline

## Задача: Логирование с ротацией и маскированием секретов
- **Приоритет**: Критический
- **Статус**: Завершена
- **Описание**: Настроить структурное JSON-логирование, ротацию ≤14 дней и фильтр секретов.
- **Шаги выполнения**:
  - [x] `logging_setup.py` с TimedRotatingFileHandler (`backupCount=14`).
  - [x] `SecretMaskingFilter` для токенов и API-ключей.
  - [x] Конфигурация `logrotate` для ОС-уровня.
  - [x] Лимиты Docker json-file driver в compose.
- **Зависимости**: Каркас Python

## Задача: Деплой и автоматические бэкапы
- **Приоритет**: Высокий
- **Статус**: Завершена
- **Описание**: Скрипты выкатки на сервер, бэкап перед каждым обновлением и ротация ≤7 дней.
- **Шаги выполнения**:
  - [x] `deploy/deploy.sh` (rsync + remote build).
  - [x] `deploy/backup.sh` (app tarball + pg_dump).
  - [x] `deploy/restore.sh` (откат по timestamp).
  - [x] systemd unit и backup timer (ежедневно 03:30).
  - [x] `deploy/install-on-server.sh` для первичной настройки сервера.
- **Зависимости**: Docker

## Задача: Антидубли контента (MinHash + ключевые слова + SHA-256)
- **Приоритет**: Высокий
- **Статус**: Завершена (модуль и схема)
- **Описание**: Гарантировать отсутствие 100% повторов и близких переформулировок.
- **Шаги выполнения**:
  - [x] Модуль `services/deduplication.py` (MinHash, ключевые слова, SHA через text_sha256).
  - [x] Миграция `002_content_fingerprints.sql`.
  - [x] Тесты `tests/test_deduplication.py`.
  - [ ] Интеграция в pipeline генерации (Спринт 1).
- **Зависимости**: Спринт 1 (Content Planner)

## Спринт 1.5 - Site Radar (базовый каркас, до DoD из Спринта 5)

## Задача: Сбор и категоризация страниц
- **Приоритет**: Высокий
- **Статус**: Завершена
- **Описание**: Регулярный обход sitemap.xml и приоритетных страниц с учетом robots.txt.
- **Шаги выполнения**:
  - [x] Парсер `sitemap.xml` и `robots.txt` (`services/site_radar/sitemap.py`).
  - [x] HTTP-клиент с rate limit (`SiteRadarHttpClient`, ~1 RPS, conditional GET, retry).
  - [x] Категоризация URL (`services/site_radar/categorizer.py`).
  - [x] Расписания через APScheduler (полный 6 ч, приоритетный 1 ч, jitter).
- **Зависимости**: Sprint 0 (готов)

## Задача: Версионирование страниц и нормализация
- **Приоритет**: Высокий
- **Статус**: Завершена
- **Описание**: Хранить очищенные версии страниц и значимые блоки.
- **Шаги выполнения**:
  - [x] Миграции `003_site_pages.sql`, `004_site_signals.sql`, `005_theme_pool.sql`.
  - [x] Нормализатор (BeautifulSoup, удаление navbar/footer/scripts/таймеров/баннеров).
  - [x] Извлечение блоков: title, meta, headings, sections, CTA, FAQ, цены.
- **Зависимости**: Сбор страниц

## Задача: Дифф, классификация и значимость
- **Приоритет**: Высокий
- **Статус**: Завершена
- **Описание**: Вычислять изменения между версиями и оценивать их вес.
- **Шаги выполнения**:
  - [x] Дифф по блокам (`block_key + sha256`) в `services/site_radar/diff.py`.
  - [x] Сравнение по ключевым словам (`extract_keywords` + Jaccard).
  - [x] Классификация `change_type` (`new_url/updated_block/price_changed/cta_changed/...`).
  - [x] Пороги значимости (high/medium/low) и запись в `site_signals`.
- **Зависимости**: Версионирование

## Задача: Стратегия адаптации и `theme_pool`
- **Приоритет**: Высокий
- **Статус**: Завершена
- **Описание**: Превращать сигналы в идеи контента и связывать с планировщиком.
- **Шаги выполнения**:
  - [x] Маппинг `signal_type -> post_type` с шаблонами тем и ракурсов (`strategist.py`).
  - [x] Проверка тем через `DuplicateChecker` за 90 дней (исключая `new_url`).
  - [x] Запись идей в `theme_pool` с приоритетами и сроками.
  - [x] Уведомления админу для high-сигналов через `notifier.py`.
- **Зависимости**: Дифф/значимость, Антидубли

## Спринт 1 - Core MVP

## Задача: Онбординг проекта и профиль бренда
- **Приоритет**: Высокий
- **Статус**: Завершена
- **Описание**: Базовый профиль бренда Avaterra с TOV, стоп-темами, ЦА и целями.
- **Шаги выполнения**:
  - [x] Дефолтный TOV и `style_rules` (`db/repositories/brand.py`).
  - [x] Стоп-темы (медицинские заявления, эзотерический хайп и т.п.).
  - [x] Профиль аудитории (pains/goals).
  - [ ] Telegram-онбординг для смены параметров (отложено).
- **Зависимости**: DB schema

## Задача: Модуль анализа сайта
- **Приоритет**: Высокий
- **Статус**: Завершена
- **Описание**: Покрыт Site Radar (Спринт 5) - страницы, версии, сигналы, `theme_pool`.
- **Шаги выполнения**:
  - [x] Краулер ключевых страниц (sitemap + priority list).
  - [x] Парсер смысловых блоков (`normalizer.py`).
  - [x] Сохранение в `site_pages`, `site_page_versions`, `site_signals` (вместо общих `sources`).
- **Зависимости**: Онбординг проекта

## Задача: Генерация недельного контент-плана
- **Приоритет**: Высокий
- **Статус**: Завершена
- **Описание**: Недельный план Пн/Ср = info, Пт = sales, темы из `theme_pool`.
- **Шаги выполнения**:
  - [x] `services/planner/content_planner.py` (распределение Пн/Ср/Пт).
  - [x] Антидубли тем через `DuplicateChecker` за 90 дней.
  - [x] Upsert `content_plans` и `content_items` (`db/repositories/content.py`).
- **Зависимости**: Модуль анализа сайта

## Спринт 2 - Publishing

## Задача: Генерация текста через DeepSeek
- **Приоритет**: Высокий
- **Статус**: Завершена
- **Описание**: Клиент DeepSeek + PromptBuilder + антидубли по последним публикациям.
- **Шаги выполнения**:
  - [x] Клиент `services/external/deepseek.py` с retry/timeout/dry-run.
  - [x] Шаблоны info/sales (`services/generator/prompts.py`).
  - [x] Quality-check через антидубли (`text_generator.py`).
  - [x] Логирование всех вызовов в `prompts` и `integration_logs`.
- **Зависимости**: Контент-план

## Задача: Генерация изображений через KIE
- **Приоритет**: Высокий
- **Статус**: Завершена
- **Описание**: KIE API, polling task_id, сохранение URL и task_id.
- **Шаги выполнения**:
  - [x] Submit/polling flow (`services/external/kie.py`).
  - [x] Промпт-правила: запрет text/logos/watermarks (`build_image_prompt`).
  - [x] Запись `image_url`, `image_prompt`, `image_task_id` в `content_items`.
  - [ ] Бэкап картинок в S3 (отложено - сейчас используем прямой URL).
- **Зависимости**: Контент-план

## Задача: Планировщик публикаций и автопостинг
- **Приоритет**: Критический
- **Статус**: Завершена
- **Описание**: Cron Пн/Ср/Пт 11:00 МСК, dry-run и `enable_auto_publish`-флаг.
- **Шаги выполнения**:
  - [x] APScheduler `content_publisher_daily` cron Mon/Wed/Fri 11:00.
  - [x] Идемпотентность через `request_id` в `integration_logs`.
  - [x] Состояния `dry_run / failed / published`, статус `last_error`.
  - [x] Админ-команды `/publish_now`, `/dry_run`, `/auto`.
- **Зависимости**: Генерация текста и изображений

## Спринт 3 - Funnel + Analytics

## Задача: Базовая воронка лидов
- **Приоритет**: Средний
- **Статус**: Завершена
- **Описание**: Обработка CTA, квалифицирующие вопросы, сегментация лида.
- **Шаги выполнения**:
  - [x] Сценарий диалога и ветвление (`services/funnel/funnel_flow.py`).
  - [x] Сохранение событий в `lead_events` с полями `segment`, `username`, `first_name`, `source_item_id`.
  - [x] Уведомление администратору о горячих лидах (`bot/handlers/funnel.py`).
  - [x] Сегментация: info / warm / hot.
  - [x] Free-form ответы пользователя пересылаются админам с привязкой к сегменту.
- **Зависимости**: Автопостинг

## Задача: Сбор статистики и недельные отчеты
- **Приоритет**: Средний
- **Статус**: Завершена (MVP - ручной ввод; авто-сбор отложен)
- **Описание**: Собирать метрики постов и показывать эффективность тем.
- **Шаги выполнения**:
  - [x] Команда `/stat <id> <views> <reactions> ...` для ручного ввода.
  - [x] Команды `/stats` (сводка 7 дней) и `/stats_full` (детально 14 дней).
  - [x] Сегментная сводка по воронке внутри `/stats`.
  - [x] После публикации админу приходит подсказка `/stat ...` с item_id.
  - [x] Сохраняем `tg_message_id` и `tg_chat_id` для будущего автосбора (MTProto).
  - [ ] Автоматический сбор views/reactions (требует MTProto-аккаунта; вынесено в Спринт 4).
- **Зависимости**: Автопостинг

## Задача: Безопасный перенос боевых ключей и онбординг проекта
- **Приоритет**: Критический
- **Статус**: Завершена
- **Описание**: Перенести боевые ключи DeepSeek/KIE и Admin IDs в server `.env`, очистить локальные plaintext-источники, выполнить смоук-тест с живыми API.
- **Шаги выполнения**:
  - [x] Перенос `DEEPSEAK_API_KEY`, `KIE_API_KEY`, `BOT_TOKEN`, `TARGET_CHANNEL_ID`, `ADMIN_TELEGRAM_IDS` в `/opt/avaterra-bot/.env` (chmod 600).
  - [x] `Avaterra.pro.txt` очищен от plaintext-секретов.
  - [x] Смоук-прогон: 3 поста сгенерированы реальными DeepSeek + KIE Flux Kontext (latency 8-13s текст / 21-59s картинка).
  - [x] Публикатор переключён в `ENABLE_AUTO_PUBLISH=true` после успешного смоука.
- **Зависимости**: Спринт 1+2

## Задача: Привести KIE-клиент к актуальному API (Flux Kontext)
- **Приоритет**: Критический
- **Статус**: Завершена
- **Описание**: Переделать клиент под `POST /api/v1/flux/kontext/generate` и polling `GET /api/v1/flux/kontext/record-info`.
- **Шаги выполнения**:
  - [x] Эндпоинты, тело запроса, parsing `data.successFlag` и `data.response.resultImageUrl`.
  - [x] Default-модель `flux-kontext-pro` в `config.py` и `.env.example`.
  - [x] Тесты прохождения 34/34.
- **Зависимости**: Внешние API

## Спринт 4 - Brand DNA, Quality Gates и 7-дневный ритм

## Задача: Knowledge Base AVATERRA в YAML и в БД
- **Приоритет**: Критический
- **Статус**: Завершена
- **Описание**: Сделать `Telegram-Content-Knowledge-Base.md` исполняемым: вынести в `knowledge/avaterra.yaml`, грузить в `brand_profiles` JSONB-полями, заливать `theme_bank` в `theme_pool` (source='kb').
- **Шаги выполнения**:
  - [x] Создан `knowledge/avaterra.yaml` (brand, audiences, products, author, rubrics, post_types, cta_library, prohibited_phrases, safe_replacements, disclaimer, theme_bank).
  - [x] Миграция `009_brand_kb_and_post_types.sql` расширяет `brand_profiles` 12 JSONB-полями + `kb_version`.
  - [x] `services/knowledge/loader.py` загружает YAML, апсёртит brand_profile, сидит `theme_pool` идемпотентно.
  - [x] `/kb_load` и `/kb_show` в админ-меню; автозагрузка KB при старте бота.
  - [x] Тест `tests/test_knowledge_loader.py` (5 проверок).
- **Зависимости**: Спринт 0-3

## Задача: 7 типов постов и 7-дневный ритм публикаций
- **Приоритет**: Критический
- **Статус**: Завершена
- **Описание**: Перевести канал с 3-постов-в-неделю на 7, по типу под каждый день недели (educational/pain/practice/author/faq/course/reflection).
- **Шаги выполнения**:
  - [x] Миграция 009 ч.2: пересобран `CHECK (post_type IN ...)` в `content_items` и `theme_pool`; в `theme_pool` добавлены `source/audience/rubric` и индексы.
  - [x] `content_planner.py` строит план по `brand.templates`/дефолту WEEKDAY_TO_POST_TYPE_DEFAULT с подбором темы по `(post_type, rubric, audience)`.
  - [x] `content_worker.py` cron публикатора - `mon,tue,wed,thu,fri,sat,sun` при `POSTS_PER_WEEK=7`.
  - [x] Тест `tests/test_planner_7days.py` (5 проверок).
  - [x] Боевой смоук: план на неделю 04-10.05 построен, все 7 типов на разные дни.
- **Зависимости**: Knowledge Base

## Задача: 7 шаблонов промптов AVATERRA
- **Приоритет**: Критический
- **Статус**: Завершена
- **Описание**: В `services/generator/prompts.py` 7 системных промптов: явная structure из YAML, аудитория из `templates.default_audience`, CTA из `cta_library`, продуктовые блоки для course, дисклеймер по триггерам.
- **Шаги выполнения**:
  - [x] `build_text_prompts` собирает system по post_type из brand profile.
  - [x] Для course добавлен product_block с url курсов; для author - author block.
  - [x] При теме с health-маркером system предписывает мягкий дисклеймер.
  - [x] `prohibited_phrases`/`safe_replacements` живут в system prompt.
  - [x] Тест `tests/test_prompts_templates.py` (7 проверок включая parametrize).
- **Зависимости**: Knowledge Base

## Задача: Quality Gates и до 2 повторов
- **Приоритет**: Критический
- **Статус**: Завершена
- **Описание**: До публикации текст проходит 5 проверок: prohibited_phrases / latin_word / length_window / cta_present / disclaimer_required. На fail - повтор с фидбеком, до 2 раз.
- **Шаги выполнения**:
  - [x] `services/quality/gates.py::evaluate_text` (5 проверок, QualityReport).
  - [x] `services/generator/text_generator.py` интегрирован: `attempt1..attempt3`, фидбек инжектится в user prompt.
  - [x] При провале после ретраев item уходит в `quality_failed`, prompts.error_code содержит коды.
  - [x] `prompts` логирует attempt_label для каждой попытки.
  - [x] Тест `tests/test_quality_gates.py` (7 проверок).
- **Зависимости**: 7 шаблонов промптов

## Задача: Бэкап картинок KIE
- **Приоритет**: Высокий
- **Статус**: Завершена
- **Описание**: KIE отдаёт временный URL (~14 дней). После генерации скачиваем картинку, кладём в S3 (если есть ключи) или в `/app/runtime/images/{item_id}.jpg`, публикатор использует `image_url_backup` как приоритетный источник.
- **Шаги выполнения**:
  - [x] Миграция `010_image_backup.sql` (поле `image_url_backup`, `image_backup_status`).
  - [x] `services/storage/image_backup.py` - `boto3` для S3 или локальный диск с volume `bot_runtime`.
  - [x] `image_generator.py` после `update_item_image` запускает backup и пишет статус `ok:{storage}` или `failed`.
  - [x] `channel_publisher.py` использует `image_url_backup`; `file://` -> `FSInputFile`.
  - [x] Параметры в `.env.example` (IMAGE_BACKUP_ENABLED, IMAGE_BACKUP_DIR).
- **Зависимости**: Спринт 2 (KIE)

## Задача: Hotfix - Quality Gates обходились через image_generator
- **Приоритет**: Критический
- **Статус**: Завершена
- **Описание**: Pipeline после `quality_failed` всё равно дёргал `generate_image_for_item`, который перезаписывал статус на `ready`. Публикатор отправлял в канал отклонённый quality gates `generated_text`. Добавлены ранний выход в pipeline и guard в image_generator.
- **Шаги выполнения**:
  - [x] `services/generator/pipeline.py` - ранний возврат `PreparationOutcome(status='quality_failed')` без вызова KIE.
  - [x] `services/generator/image_generator.py` - guard на `item.status in {quality_failed, dedup_blocked, failed}` -> возвращаем `skipped=True`, KIE не дёргаем.
  - [x] `services/planner/weekly_orchestrator.py` - `quality_failed` считается в счётчике `blocked`.
  - [x] `tests/test_pipeline_quality_gate.py` - 4 регрессионных теста (mock + реальная цепочка).
  - [x] Деплой на прод; smoke с stub-DeepSeek и фразой "мы вылечим" подтвердил `db.status='quality_failed'`, `published_at=NULL`, KIE не вызывался.
- **Зависимости**: Спринт 4

## Задача: Деплой Спринта 4 на боевой сервер
- **Приоритет**: Критический
- **Статус**: Завершена
- **Описание**: Бэкап БД, выкатка кода, миграции 009 и 010, очистка старых планов, перевод бота на 7-дневный ритм с автозагрузкой KB.
- **Шаги выполнения**:
  - [x] `deploy/backup.sh` -> `/var/backups/avaterra-bot/20260507T090526Z`.
  - [x] `deploy/deploy.sh` синкает `knowledge/`, перебилдил образ.
  - [x] Применены миграции 009 и 010 на проде.
  - [x] Очищены старые `content_items`/`content_plans`/`prompts`/`post_statistics`.
  - [x] Бот после рестарта автозагрузил KB (kb_version=88f00730c4c89a55, 30 тем в theme_pool, 5 audiences, 7 templates, 14 prohibited phrases).
  - [x] Смоук `build_week_plan` собрал 7 разных типов на 04-10.05; smoke `/generate` дал 1286 знаков educational с прохождением quality gates с первой попытки.
- **Зависимости**: Все задачи Спринта 4

## Спринт 5 - Site Radar DoD + Telegram admin console

## Задача: Site Radar - DoD из Roadmap (дорожка A)
- **Приоритет**: Высокий
- **Статус**: Завершена
- **Описание**: Закрыть критерии готовности Site Radar - метрика noise, источник `radar` в `theme_pool`, аудит сигналов в Telegram.
- **Шаги выполнения**:
  - [x] `CycleStats` расширен `signals_high/medium/low`, `noise_blocks`, `noise_share`, `themes_rejected_dup`.
  - [x] Метрики каждого цикла пишутся в `integration_logs` (`provider='site_radar'`).
  - [x] `strategist.build_theme` возвращает 7 типов AVATERRA + audience/rubric; `theme_pool.source='radar'` через `insert_theme(source='radar')`.
  - [x] Репозиторий `list_signals_audit` + `count_signals_audit` для пагинации.
  - [x] Команда `/radar_signals [high|medium|all] [page]` с inline-фильтрами и пагинацией.
  - [x] `/radar_now` показывает `noise_share` и распределение severity.
  - [x] Тест `tests/test_site_radar_strategist.py` (8 параметризованных проверок 7 post_types).
- **Зависимости**: Спринты 0-4

## Задача: Telegram admin console (дорожка B)
- **Приоритет**: Высокий
- **Статус**: Завершена
- **Описание**: Снизить когнитивную нагрузку админа, заменить копирование UUID из логов на 3-5 нажатий в боте.
- **Шаги выполнения**:
  - [x] `AdminOnlyMiddleware` теперь обрабатывает и `Message`, и `CallbackQuery` (alert при отказе).
  - [x] Команда `/admin` - inline-меню «План недели», «Очередь качества», «Радар», «Статус», тумблеры авто-публикации и dry_run.
  - [x] `get_current_week_plan` показывает план недели без триггера повторной сборки.
  - [x] `list_items_by_status` + `latest_quality_codes` для очереди `quality_failed`.
  - [x] Команда `/quality_queue` и callback'ы «↻ перегенерировать / text / skip».
  - [x] Команда `/regenerate <id>`: `reset_item_for_regeneration` → `prepare_item` (DeepSeek + KIE).
  - [x] Все callback'и идут под префиксом `adm:` и защищены ACL middleware.
- **Зависимости**: Дорожка A

## Задача: Деплой Спринта 5 на боевой сервер
- **Приоритет**: Критический
- **Статус**: Завершена
- **Описание**: Бэкап БД, выкатка кода, рестарт бота с сохранением миграций 009/010 (новые поля `theme_pool.source/audience/rubric` уже были).
- **Шаги выполнения**:
  - [x] `deploy/backup.sh` отработал перед выкаткой.
  - [x] `deploy/deploy.sh` (rsync + docker compose up -d --build) - образ `avaterra-bot:latest` пересобран, контейнер пересоздан.
  - [x] Бот стартовал: `kb_bootstrap_done` (kb_version=88f00730c4c89a55, 30 тем обновлено), все 4 APScheduler-джобы поднялись.
  - [x] Site Radar `priority_cycle` записал в `integration_logs` метрики (`pages_seen=5`, `noise_share=0`, `signals_total=0`).
- **Зависимости**: Дорожки A и B

## Спринт 6 - Backlog (после 2-4 недель данных)

## Задача: Улучшение качества контента и A/B гипотезы
- **Приоритет**: Низкий
- **Статус**: Не начата
- **Описание**: Системное повышение качества контента на основе статистики и обратной связи.
- **Шаги выполнения**:
  - [ ] Ранжирование тем по эффективности.
  - [ ] A/B вариации CTA и структуры поста.
  - [ ] Коррекция контент-политики.
- **Зависимости**: Аналитика, минимум 2-4 недели данных

