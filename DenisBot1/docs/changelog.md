<!--
@file: changelog.md
@description: Хронологический журнал изменений проекта FindThePuppy
@dependencies: docs/Project.md, docs/Tasktracker.md, docs/Diary.md, docs/qa.md
@created: 2026-05-07
-->

# Changelog

## [2026-05-07] - Hotfix: URL gate теперь ловит ссылки без `https://`

### Исправлено
- `_check_urls` теперь обнаруживает упоминания whitelisted-хоста **без схемы** (например, `avaterra.pro/store`). Telegram-клиенты автоматически делают такие домены кликабельными, поэтому без этой защиты модель могла обойти URL-валидацию.
- Также блокирует `http://...` варианты, если whitelist содержит только `https://`.
- Учитываются email-формы (`support@avaterra.pro`) и не путают их с URL.
- Добавлены 4 регрессионных теста: bare-domain, домашняя страница без слеша, email, http-схема.

### Валидация
- 83 теста зелёные.
- Деплой выкатан на сервер, контейнеры healthy.

## [2026-05-07] - Update: пауза между картинкой и текстом увеличена до 10 секунд

### Изменено
- Минимальная и дефолтная задержка между картинкой и текстом в публикаторе поднята с 5/8 секунд до **10 секунд**.
- Обновлены `config.py` (`PUBLISH_TEXT_DELAY_SECONDS` default=10), `.env.example` и тесты на минимальный порог.
- На сервере `PUBLISH_TEXT_DELAY_SECONDS=10` зафиксировано в `.env`.

### Валидация
- `_effective_photo_to_text_delay(0|5|9)=10.0`, `_effective_photo_to_text_delay(12)=12.0` подтверждены тестами.
- Деплой выполнен, контейнер `avaterra-bot` `Up/healthy`.

## [2026-05-07] - Hotfix: валидность ссылок + минимальная пауза после картинки + устойчивость к SSH-сбоям

### Исправлено
- Найдена первопричина битой ссылки `https://avaterra.pro/store`: модель иногда галлюцинировала URL по слову «каталог», даже когда в KB уже был корректный адрес.
- В `quality gates` добавлена проверка `url_not_whitelisted`: любая ссылка в тексте должна входить в whitelist из `products`, `cta_library`, `quick_links`; иначе пост уходит в `quality_failed` и не публикуется.
- Усилен system prompt генератора: запрещено выдумывать URL, разрешены только явные ссылки бренда.
- Для публикатора зафиксирована минимальная задержка между фото и текстом: не меньше 5 секунд даже при ошибочной конфигурации.

### Добавлено
- Тесты на контроль ссылок: блокировка `https://avaterra.pro/store` и прохождение только whitelisted URL.
- Операционный runbook диагностики SSH-отказов (проверка локальной сети, зависших ssh/scp процессов, `sshd`/fail2ban/ufw на сервере, аварийный доступ через веб-консоль провайдера).

### Валидация
- Деплой на `avaterra` успешен, контейнеры `avaterra-bot/postgres/redis` в `Up/healthy`.
- Повторно перегенерированы и опубликованы 4 тестовых поста недели (`msg_id`: 21, 23, 25, 27).
- В БД подтверждено отсутствие `https://avaterra.pro/store` во всех 4 `final_text`.
- На сервере подтверждено правило минимальной паузы: `_effective_photo_to_text_delay(0|3)=5.0`, `_effective_photo_to_text_delay(8)=8.0`.

## [2026-05-07] - Hotfix: публикация без caption на фото (картинка отдельно, потом текст)

### Исправлено
- При публикации поста с картинкой Telegram обрезал caption до 1024 символов (на скриншоте: «Попробуйте сегодня простой шаг. К» — обрыв ровно на 1024 знаке), а потом второе сообщение приходило с полным текстом — получалось дублирование первой части и плохое чтение в канале.
- Публикатор теперь отправляет картинку **без caption** отдельным сообщением, делает паузу `PUBLISH_TEXT_DELAY_SECONDS` (по умолчанию 8 сек) и отправляет полный текст одним сообщением. `tg_message_id` фиксируется по тексту - это естественный объект для реакций и `/stat`.
- Если текст превышает Telegram-лимит 4096 символов, новая утилита `_split_text_for_telegram` режет его по абзацам (а очень длинные абзацы - по символам), без обрыва середины предложения.

### Добавлено
- Настройка `PUBLISH_TEXT_DELAY_SECONDS` в `config.py` и `.env.example` (default `8`).
- `tests/test_publisher_text_split.py` (5 тестов): короткий текст, пустой, разбиение по абзацам, длинный абзац без границ, типовой пост целиком влезает.

### Валидация
- 75 тестов зелёные локально.
- Деплой выкатан, новый формат подтверждён ручной публикацией.

## [2026-05-07] - Спринт 5: Site Radar DoD + Telegram admin console

### Добавлено
- Дорожка A (Site Radar):
  - `CycleStats` обогащён `signals_high/medium/low`, `noise_blocks`, `noise_share`, `themes_rejected_dup`; метрики каждого цикла пишутся в `integration_logs` (`provider='site_radar'`).
  - `services/site_radar/strategist.py` теперь маппит сигналы на 7 типов AVATERRA (educational/pain/practice/author/faq/course/reflection) и возвращает audience + rubric.
  - Репозиторий `db/repositories/site_signals.py` - `SiteSignalListItem`, `list_signals_audit`, `count_signals_audit`; `insert_theme` принимает `source/audience/rubric` (по умолчанию `source='radar'`).
  - Команда `/radar_signals [high|medium|all] [page]` с inline-фильтрами severity и пагинацией.
  - `/radar_now` показывает `noise_share` и распределение severity.
  - `tests/test_site_radar_strategist.py` (8 параметризованных проверок 7 post_types).
- Дорожка B (Telegram admin):
  - Команда `/admin` - inline-меню «План недели», «Очередь качества», «Радар», «Статус», тумблеры авто-публикации и dry_run.
  - Команды `/quality_queue`, `/regenerate <id>`; функции репозитория `get_current_week_plan`, `list_items_by_status`, `latest_quality_codes`, `reset_item_for_regeneration`.
  - Callback'и под префиксом `adm:` для всех действий меню (план недели, очередь качества, радар, переключатели).

### Изменено
- `AdminOnlyMiddleware` теперь обрабатывает и `Message`, и `CallbackQuery` (alert «Доступ ограничен» при отказе).
- `services/site_radar/orchestrator.py` логирует метрики цикла в `integration_logs` после каждого full/priority прохода.
- `bot/handlers/admin.py` расширен новыми командами и callback-обработчиками; `/admin_help` обновлён со ссылками на `/admin`, `/quality_queue`, `/regenerate`, `/radar_signals`.

### Документация
- `docs/Project.md` - новая секция «14. Администрирование (Telegram-only)» с описанием потоков плана недели, очереди качества, Site Radar и контроля авто-публикации/dry_run.
- `docs/Roadmap.md` - Спринт 5 разделён на дорожки A (Site Radar DoD) и B (Telegram admin), описаны DoD и acceptance criteria, A/B-гипотезы вынесены в Спринт 6.
- `docs/Tasktracker.md` - добавлены задачи Спринта 5, секция Спринт 6 для будущих A/B гипотез.
- `docs/qa.md` - зафиксировано: админ-панель = только Telegram, MTProto не используем, Site Radar уведомляет только в Telegram.

### Валидация
- Локально: 70 тестов зелёные (62 + 8 новых параметризованных проверок strategist).
- Прод-деплой: бэкап БД, rsync, перебилд образа, рестарт. Бот поднялся чисто (`avaterra_bot_starting` → `kb_bootstrap_done` → `bot_polling_start`); APScheduler зарегистрировал site_radar full/priority и публикатор `mon,tue,wed,thu,fri,sat,sun 11:00`.
- Метрика Site Radar в проде: первый `priority_cycle` записал `noise_share=0.0`, `pages_seen=5`, `signals_total=0` в `integration_logs` — сайт стабилен с момента предыдущего цикла, баг не воспроизводится.

## [2026-05-07] - Hotfix: Quality Gates обходились через image_generator

### Исправлено
- Критичный баг: `services/generator/pipeline.py` шёл в `generate_image_for_item` даже после `quality_failed`, а `image_generator` безусловно перезаписывал статус item на `ready`. В результате тексты, отклонённые quality gates, попадали в выборку публикатора (`statuses=("approved","ready")`) и публиковались в канал из `generated_text` (final_text оставался NULL). Импакт: бренд-риск - в канал могли уходить посты с "мы вылечим", без дисклеймера на медицинских темах и т.п.
- Pipeline теперь делает ранний выход при `quality_passed=False` и возвращает `PreparationOutcome(status="quality_failed")` без вызова KIE.
- Defense-in-depth: `image_generator.generate_image_for_item` теперь skip-ит работу для item.status в `{quality_failed, dedup_blocked, failed}` и возвращает `ImageGenerationOutcome(skipped=True)` без обращения к KIE и без обновления БД.
- `weekly_orchestrator` теперь считает `quality_failed` как `blocked`, а не как `prepared`.

### Добавлено
- `tests/test_pipeline_quality_gate.py` (4 регрессионных теста): KIE не дёргается на quality_failed; контрольный сценарий для quality_passed; защита image_generator для quality_failed и dedup_blocked.

### Валидация
- Локально: 62 теста зелёные (58 + 4 новых).
- Прод-смоук: stub-DeepSeek с фразой "мы вылечим" → `db.status='quality_failed'`, `image_url` не обновлён, `published_at=NULL`, `StubKie.generate_image` не вызвался; в логах `content_item_quality_failed`.

## [2026-05-07] - Спринт 4: Brand DNA, Quality Gates и 7-дневный ритм

### Добавлено
- `knowledge/avaterra.yaml` - исполняемая база знаний бренда (brand, audiences, products, author, rubrics, post_types, cta_library, prohibited_phrases, safe_replacements, disclaimer, theme_bank).
- `services/knowledge/loader.py` - YAML -> `brand_profiles` JSONB-поля + `theme_pool` (source='kb', идемпотентно).
- `services/quality/gates.py` - 5 проверок: prohibited_phrases, latin_word, length_window, cta_present, disclaimer_required + QualityReport с фидбеком на повтор.
- `services/storage/image_backup.py` - скачивание картинки KIE в S3 (boto3) или в `/app/runtime/images/{item_id}.jpg`.
- 7 шаблонов промптов в `services/generator/prompts.py` (educational/pain/practice/author/faq/course/reflection) с подстановкой аудитории, CTA из `cta_library`, дисклеймером по триггерам.
- Команды админа `/kb_load` и `/kb_show`.
- 4 новых тест-файла: `test_knowledge_loader.py`, `test_quality_gates.py`, `test_planner_7days.py`, `test_prompts_templates.py` (24 новых ассерта). Всего 58 тестов.

### Изменено
- `services/planner/content_planner.py` - 7 постов в неделю (Пн edu / Вт pain / Ср practice / Чт author / Пт faq / Сб course / Вс reflection); подбор темы с фильтрами по `(post_type, rubric, audience)`; fallback при пустом theme_pool.
- `services/generator/text_generator.py` - quality gates после DeepSeek + до 2 ретраев с фидбеком; статус `quality_failed` при провале.
- `services/generator/image_generator.py` - после KIE-генерации скачивает картинку и сохраняет `image_url_backup` (`ok:s3` / `ok:local` / `failed`).
- `services/publisher/channel_publisher.py` - публикует из `image_url_backup` (включая `file://` через `FSInputFile`).
- `db/repositories/brand.py` - `BrandProfile` расширен 12 JSONB-полями; добавлены `upsert_kb_into_brand_profile` и `get_brand_profile`.
- `db/repositories/content.py` - `ContentItemRecord` хранит `image_url_backup`/`image_backup_status`; добавлен `update_item_image_backup`.
- `db/repositories/theme_pool.py` - выборка с фильтрами `post_type/rubric/audience`.
- `workers/content_worker.py` - cron публикатора `mon,tue,wed,thu,fri,sat,sun` при `POSTS_PER_WEEK=7`.
- `bot/main.py` - на старте бот гарантирует проект, brand-профиль и автозагружает `knowledge/avaterra.yaml`.
- `Dockerfile` копирует `knowledge/`; в `.env.example` добавлены `KB_YAML_PATH`, `POSTS_PER_WEEK`, `QUALITY_*`, `IMAGE_BACKUP_*`.
- Миграции `009_brand_kb_and_post_types.sql` и `010_image_backup.sql` применены на проде.

### Исправлено
- 7 типов постов теперь поддерживаются `CHECK`-ограничениями в `content_items` и `theme_pool` (старые `info`/`sales` оставлены для совместимости).
- На проде очищены устаревшие `content_items`/`content_plans` старого ритма Пн/Ср/Пт - бот при ребилде автоматически собрал свежий план на 04-10.05 из YAML.

### Результат на проде
- `kb_version=88f00730c4c89a55`, 5 audiences / 8 rubrics / 7 templates / 14 prohibited phrases загружены.
- `theme_pool` source='kb': educational 7, pain 5, practice 2, author 4, faq 5, course 4, reflection 3.
- Боевой smoke `build_week_plan` -> 7 уникальных тем по типам (educational на 04.05, reflection на 10.05).
- Боевой smoke генерации educational-поста: 1286 знаков, quality gates пройден с первой попытки.
- Cron публикатора в логах: `mon,tue,wed,thu,fri,sat,sun 11:00 Europe/Moscow`.

## [2026-05-07] - Инициализация архитектурной документации

### Добавлено
- Создан файл правил `/.cursorrules` для дисциплины процесса разработки.
- Добавлен `docs/Project.md` с детальным описанием целей, архитектуры, этапов и стандартов.
- Добавлен `docs/Tasktracker.md` с начальными задачами, статусами и приоритетами.
- Добавлен `docs/Diary.md` для фиксации наблюдений, решений и проблем.
- Добавлен `docs/qa.md` с перечнем архитектурных и продуктовых вопросов.

### Изменено
- В проекте создана структура документации `docs/` для централизованного ведения контекста.

### Исправлено
- Не применимо на этапе инициализации.

## [2026-05-07] - Перепрофилирование под Avaterra SMM-бота

### Добавлено
- Добавлен `docs/Security.md` с политикой хранения секретов, ротации ключей и правилами логирования.
- Добавлен `.env.example` как безопасный шаблон конфигурации окружения.
- Добавлен `docs/API-spec.md` с контрактами внутренних модулей и интеграций Telegram/DeepSeak/KIE.
- Добавлен `docs/ER-diagram.md` с ER-моделью, ограничениями и индексами MVP.
- Добавлен `docs/Roadmap.md` с пошаговым планом спринтов и критериями приемки.

### Изменено
- Полностью обновлен `docs/Project.md` под новое ТЗ Avaterra Telegram SMM Bot.
- Полностью пересобран `docs/Tasktracker.md` по спринтам и приоритетам.
- Обновлен `docs/Diary.md` с фиксированием архитектурных решений и рисков.
- Обновлен `docs/qa.md` на актуальные вопросы для запуска и эксплуатации.
- Файл `Avaterra.pro.txt` очищен от секретов и переведен в безопасный информационный формат.

### Исправлено
- Устранен риск хранения секретов в открытом виде в рабочей директории проекта.

## [2026-05-07] - Спринт 0: каркас, инфраструктура, антидубли

### Добавлено
- `pyproject.toml`, `.gitignore`, `README.md`.
- Каркас Python-приложения: `src/avaterra_bot/` (config, logging_setup, bot, db, services).
- Скелет aiogram-бота с командами `/start`, `/help`, `/status` и admin ACL middleware.
- Структурное JSON-логирование, маскирование секретов и TimedRotatingFileHandler (14 дней).
- `Dockerfile` и `docker-compose.yml` с Postgres 16 и Redis 7.
- SQL-миграции `001_init.sql` и `002_content_fingerprints.sql`.
- Модуль антидублей `services/deduplication.py` (MinHash + ключевые слова + SHA-256).
- Тесты дедубликации `tests/test_deduplication.py`.
- Скрипты эксплуатации `deploy/`: `deploy.sh`, `backup.sh`, `restore.sh`, `install-on-server.sh`.
- systemd units: `avaterra-bot.service`, `avaterra-backup.service`, `avaterra-backup.timer` (03:30 daily).
- `logrotate` конфигурация (`deploy/logrotate/avaterra-bot`) с ротацией 14 дней.
- Документация: `docs/Deployment.md`, `docs/Logging.md`, `docs/Deduplication.md`.

### Изменено
- Расширен `docs/Project.md` ссылками на эксплуатационную документацию.
- Дополнен `docs/Tasktracker.md` задачами Спринта 0 со статусом "Завершена".
- Дополнен `docs/Diary.md` решениями по стеку, логированию и антидублям.
- Расширен `.env.example` блоком Postgres, логирования и параметров дедубликации.

### Исправлено
- Зафиксирован пороговый алгоритм против повторных публикаций (исключение 100% совпадений и близких переформулировок).

## [2026-05-07] - Первый деплой Avaterra-бота на сервер

### Добавлено
- Сгенерирован отдельный SSH-ключ для агента: `~/.ssh/avaterra_deploy_ed25519`.
- В `~/.ssh/config` добавлен алиас `avaterra` (root@server, IdentitiesOnly=yes).
- На сервере развернуты: `/opt/avaterra-bot`, `/var/backups/avaterra-bot`.
- Установлены systemd-юниты `avaterra-bot.service`, `avaterra-backup.service`,
  таймер `avaterra-backup.timer` (ежедневно 03:30).
- Установлен пакет `logrotate` и конфигурация ротации логов на 14 дней.
- Запущена docker-compose инфраструктура (PostgreSQL 16, Redis 7, бот).
- Применены миграции 001/002, в БД 12 таблиц включая `content_fingerprints`.
- Создан первый бэкап `/var/backups/avaterra-bot/<timestamp>/` (app + pg_dump).

### Изменено
- `Dockerfile`: COPY всех артефактов до `pip install`, корректная сборка пакета.
- `Avaterra.pro.txt` оставлен только в безопасном виде; `Ssh.txt` удалён.
- POSTGRES_PASSWORD сгенерирован случайным образом, хранится только в `.env` сервера (chmod 600).

### Исправлено
- Бот `@AvaterraBot` корректно стартует и подключается к Telegram (`getMe.ok=true`).
- Контейнеры в healthy-состоянии, systemd unit активен, таймер запланирован.

## [2026-05-07] - Расширение архитектуры: Site Radar

### Добавлено
- Новый документ `docs/SiteMonitoring.md` с архитектурой и правилами Site Radar.
- Раздел "Site Radar" в `docs/ER-diagram.md`: `site_pages`, `site_page_versions`, `site_signals`, `theme_pool`.
- Спринт 5 "Site Radar" в `docs/Roadmap.md` с scope и Definition of Done.
- Задачи в `docs/Tasktracker.md` для Спринта 5.
- Открытые вопросы по частоте обхода и каналам уведомлений в `docs/qa.md`.

### Изменено
- В `docs/Project.md` модуль Site Analyzer переименован в Site Analyzer / Site Radar и расширен непрерывным мониторингом.
- В разделе сопутствующей документации добавлена ссылка на `SiteMonitoring.md`.

### Исправлено
- Не применимо (документационный шаг).

## [2026-05-07] - Спринты 1+2: автономный pipeline (Planner + DeepSeek + KIE + Publisher)

### Добавлено
- Миграция `006_content_pipeline.sql`: `theme_id`, `image_prompt`, `image_task_id`, `dedup_status`, `retry_count`, `last_error`, `updated_at` в `content_items`; `latency_ms`/`status`/`error_code` в `prompts`; `request_meta`/`response_meta` в `integration_logs`.
- Миграция `007_projects_unique_website.sql`: уникальный индекс `projects(website_url)` против дублей.
- Клиенты `services/external/deepseek.py` (chat completions, retry, dry-run заглушка) и `services/external/kie.py` (create + polling, dry-run).
- Brand profile с дефолтами Avaterra (TOV, ЦА, стоп-темы) - `db/repositories/brand.py`.
- Репозитории `db/repositories/{content.py,theme_pool.py}` с upsert планов/постов и логами `prompts`/`integration_logs`.
- Content Planner `services/planner/content_planner.py` (недельный план Пн/Ср = info, Пт = sales, выбор из `theme_pool` с антидублем тем) и `weekly_orchestrator.py`.
- Generator `services/generator/{prompts.py,text_generator.py,image_generator.py,pipeline.py}` с антидублями по последним 60 опубликованным постам.
- Publisher `services/publisher/channel_publisher.py` с поддержкой dry-run, idempotency через `integration_logs`, статус-флоу `text_ready -> ready -> approved -> published / failed / dedup_blocked / dry_run`.
- Воркер `workers/content_worker.py`: cron Пн/Ср/Пт 11:00 МСК (publisher) + воскресенье 19:00 (planner), оба прикреплены к общему `AsyncIOScheduler`.
- Админ-команды `/plan`, `/plan_now`, `/preview`, `/approve`, `/publish_now`, `/dry_run on|off`, `/auto on|off`.
- Тесты `tests/test_prompts_and_planner.py` (5 кейсов: структура промптов, week_bounds, распределение постов).

### Изменено
- `bot/main.py`: после `start_site_radar` подключает `attach_content_jobs` к тому же scheduler.
- `config.py`/`.env.example`: новые ключи DeepSeek/KIE/публикации, `DRY_RUN=true` и `ENABLE_AUTO_PUBLISH=false` по умолчанию.

### Исправлено
- `ensure_default_project` теперь сначала ищет проект по `website_url`, затем создаёт; устранена утечка дубликатов после каждого рестарта (DELETE 6 на проде).
- `DuplicateChecker` инициализируется правильным аргументом `keyword_threshold`.

### Результат смоук-теста на проде
- 1 проект, 1 план, 3 `content_items` (Пн info, Ср info, Пт sales) - все в статусе `ready` с антидублями `passed`.
- DeepSeek и KIE отрабатывают в dry-run без ключей; в `prompts` логируется тип/модель/латентность/статус, в `integration_logs` - провайдер/операция/request_id.
- Полный pipeline (план + 3 поста + картинки) отрабатывает за < 200 мс в dry-run (без сетевых вызовов).
- Задачи в scheduler: `content_planner_weekly` (Sun 19:00), `content_publisher_daily` (Mon/Wed/Fri 11:00).

## [2026-05-07] - Спринт 5: Site Radar в проде

### Добавлено
- Миграции `003_site_pages.sql`, `004_site_signals.sql`, `005_theme_pool.sql`.
- Модули `services/site_radar/`: `http_client`, `sitemap`, `categorizer`, `normalizer`, `diff`, `scorer`, `strategist`, `notifier`, `orchestrator`.
- Репозитории `db/repositories/site_pages.py`, `db/repositories/site_signals.py`, `db/repositories/projects.py`.
- Воркер `workers/site_radar_worker.py` с APScheduler (полный обход 6ч, приоритетный 1ч).
- Админ-команды `/radar`, `/radar_now`, `/pause`, `/resume` + bind пула и планировщика.
- Тесты: `test_site_radar_sitemap.py`, `test_site_radar_normalizer.py`, `test_site_radar_diff_scorer.py` (16 кейсов).

### Изменено
- `bot/main.py` подключает Site Radar при старте, корректно завершает scheduler в `finally`.
- `Tasktracker.md` — задачи Спринта 5 переведены в статус "Завершена".

### Исправлено
- Защита нормализатора от detached BeautifulSoup-узлов и от пустых `attrs`.
- Корректная подмена scheme при нормализации хоста sitemap (localhost → https://avaterra.pro).
- Дубликат-проверка тем больше не блокирует уникальные `new_url` сигналы (были 9 ложных rejected).
- Тема для `new_url` собирается через `strategist` без двойного префикса "Новый URL".

### Результат на проде
- 16 страниц `avaterra.pro` обнаружены, нормализованы и записаны в `site_pages` + `site_page_versions`.
- 11 новых URL → 11 сигналов (`status=applied`) → 11 идей в `theme_pool` (5 страниц-разделов / 6 статей блога).
- Полный обход — ~2 минуты, приоритетный — ~5 секунд, при ~1 RPS rate limit.

## [2026-05-07] - Спринт 3: Лид-воронка и аналитика, перевод на боевые ключи

### Добавлено
- Миграция `008_funnel_and_stats.sql` (поля `lead_funnels.slug`, `lead_events.segment/username/first_name/source_item_id`, `post_statistics.source`, `content_items.tg_chat_id/tg_message_id`).
- Репозитории `db/repositories/leads.py` (воронки и события) и `db/repositories/analytics.py` (post_statistics, weekly summary).
- Сервис воронки `services/funnel/funnel_flow.py` с тремя ветками `info / warm / hot`.
- Хендлер `bot/handlers/funnel.py` (без admin middleware): `/start`, inline-кнопки выбора, free-form ответ → уведомление админам.
- Хендлер `bot/handlers/analytics.py`: `/stats` (сводка 7 дней), `/stats_full` (детально 14 дней), `/stat <id> <views> [reactions] ...`.
- Подсказка с item_id админам сразу после успешной публикации.
- Тесты `tests/test_funnel_flow.py` (5 кейсов).

### Изменено
- `bot/main.py` подключает funnel + analytics роутеры (funnel — первым, чтобы не-админы попадали в воронку).
- `services/publisher/channel_publisher.py` сохраняет `tg_message_id` в `content_items` и шлёт админам подсказку для `/stat`.
- `services/external/kie.py` переписан под актуальный Flux Kontext API (`/api/v1/flux/kontext/generate` + polling `record-info`, `successFlag` 0/1/2/3).
- `config.py` и `.env.example` — default `KIE_MODEL=flux-kontext-pro`.
- `Avaterra.pro.txt` — теперь только нечувствительная справка, секреты живут только в `/opt/avaterra-bot/.env` (chmod 600).

### Исправлено
- KIE 404 на старом эндпоинте `/v1/images/generations` (Flux Kontext использует другой путь).
- `docker compose restart` не перечитывал `.env`; для прод-обновлений теперь `up -d --force-recreate bot`.
- `cmd_start` не блокировался admin middleware: воронка работает для всех, админам отдаётся `admin_help`.

### Результат на проде (живые API, 2026-05-07)
- 3 поста сгенерированы реальными DeepSeek (8-13s) + KIE Flux Kontext (21-59s).
- Качество: длина 1631-2404 символа, структура продающего поста выдержана, ToV "Avaterra" соблюдён.
- `ENABLE_AUTO_PUBLISH=true` включён; ближайшая боевая публикация — пятница 11:00 МСК (sales-пост).
- Воронка запускается командой `/start` в боте, callback-кнопки сегментируют пользователя, горячие лиды уведомляют обоих админов.

