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

## Задача: Hotfix — AmbiguousParameterError $7 (неделя 0/7)
- **Приоритет**: Высокий
- **Статус**: В процессе
- **Описание**: План 24.08–30.08: все посты `failed` из-за NULL `$7` в `update_item_text`.
- **Шаги выполнения**:
  - [x] Документация
  - [x] Касты `$7::text` / `$8::boolean`
  - [ ] Выкат и повторная генерация
- **Зависимости**: `db/repositories/content.py`

## Задача: Hotfix — weekly pipeline падает на каждом прогоне
- **Приоритет**: Высокий
- **Статус**: Завершена
- **Описание**: Даже после retry `draft` недельный план регулярно собирается частично (гейты CTA/URL/длина, мало extra passes, пустой `last_error`).
- **Шаги выполнения**:
  - [x] Документация: Diary, changelog, Project, qa
  - [x] `salvage_text` + вызов из `text_generator`
  - [x] Pass1=`quality_failed`, extra_passes=2, max_tokens=2048, last_error коды
  - [x] Тесты гейтов и weekly pipeline
  - [x] Локальный pytest
  - [x] Прод-выкат + `.env` (`DEEPSEEK_MAX_TOKENS=2048`, `WEEKLY_PIPELINE_EXTRA_PASSES=2`)
- **Зависимости**: `gates.py`, `text_generator.py`, `weekly_orchestrator.py`, `config.py`

## Задача: Hotfix — weekly pipeline 6/7 (draft без retry)
- **Приоритет**: Высокий
- **Статус**: Завершена
- **Описание**: Прогон 27.07 оставил Tue `[pain]` в `draft` (6/7). Exception в pass1 не менял статус; pass2 не ретраил `draft`.
- **Шаги выполнения**:
  - [x] Разбор уведомления и кода `weekly_orchestrator` / `weekly_notify` / DeepSeek
  - [x] Документация: Diary, changelog, Project, qa
  - [x] Код: retry `draft`, mark-failed на exception, DeepSeek TimeoutError→DeepSeekError
  - [x] Тесты `test_weekly_pipeline_passes.py`
  - [x] Локальный `pytest` — 6 passed
- **Зависимости**: `weekly_orchestrator.py`, `deepseek.py`

## Задача: Handoff и логи ≤ 7 дней
- **Приоритет**: Средний
- **Статус**: Завершена
- **Описание**: Зафиксировать контекст admin_preview для следующих доработок; сократить хранение файловых логов до 1 недели.
- **Шаги выполнения**:
  - [x] `docs/Session-Handoff-2026-05-22.md`
  - [x] `docs/Logging.md`, `LOG_RETENTION_DAYS=7`, logrotate 7/7
  - [x] `.cursorrules`, `README.md`, `Project.md`, `changelog.md`, `Diary.md`

## Hotfix - 2026-05-20 (предпросмотр админам вместо канала)

## Задача: Временный режим admin_preview + отключение генерации фото
- **Приоритет**: Высокий
- **Статус**: Завершена
- **Описание**: Посты в 11:00 отправлять администраторам в личку для ручной проверки; генерацию изображений отключить. Откат — сменой env без правок кода.
- **Шаги выполнения**:
  - [x] Документация: `Project.md`, `changelog.md`, `Diary.md`, `.env.example`.
  - [x] `config.py`: `PUBLISH_MODE`, `IMAGE_GENERATION_ENABLED`, `is_admin_preview_mode`.
  - [x] `image_generator.py`: early exit при отключённой генерации.
  - [x] `channel_publisher.py`: `_send_admin_preview`, ветвление в `publish_item`.
  - [x] `content_worker.py`, `admin.py`: логи и текст `/publish_now`.
  - [x] Тесты `test_image_generation_disabled.py`, `test_publisher_admin_preview.py`.
  - [x] Прод-выкат 2026-05-20: `deploy/deploy.sh`, `.env` обновлён, `docker compose up -d --force-recreate bot`. В логах `publish_mode=admin_preview`, `admin_ids` — три ID.
- **Откат**: `PUBLISH_MODE=channel`, `IMAGE_GENERATION_ENABLED=true`, `ENABLE_AUTO_PUBLISH=true`, `DRY_RUN=false`, `TARGET_CHANNEL_ID=<канал>`, `docker compose up -d --force-recreate bot`.
- **Зависимости**: `config.py`, `channel_publisher.py`, `image_generator.py`, `content_worker.py`, `admin.py`

## Hotfix - 2026-05-18 (слово «метод» во всех падежах)

## Задача: Закрыть лазейку для падежных форм слова «метод» в постах
- **Приоритет**: Высокий
- **Статус**: Завершена
- **Описание**: В опубликованном 18.05 посте (`5a8e95ad…`, `educational`) вышло «**В методе** Аватэрра», хотя гейт `method_word` существует с 09.05. Причина: `\\bметод\\b` ловит только именительный «метод», а падежные формы с окончанием (методе/методу/методом/метода/методы/методов/методам/методами/методах) проходят сквозь границу слова. На 21.05 в БД уже лежал `ready`-пост (`8edb0cb8…`, `author`) с «методы регресса» — он бы тоже вышел.
- **Шаги выполнения**:
  - [x] `services/quality/gates.py`: `_METHOD_WORD_PATTERN` расширён до `\\bметод(?:а|у|ом|е|ы|ов|ам|ами|ах)?\\b` (IGNORECASE). Все падежи ловятся, производные `методик-/методическ-/методист-/методолог-` — нет.
  - [x] `services/quality/gates.py`: новый `scan_publish_blockers(text)` — подмножество «красных» гейтов (FAQ, «калибр…», «метод», латиница Avaterra), без brand profile.
  - [x] `services/publisher/channel_publisher.py`: в `publish_item` после `normalize_post_lexicon` запускается `scan_publish_blockers`. При находке — `quality_failed`, ERROR `publisher_blocked_by_red_gate`, `integration_logs.status=blocked`, ничего не уходит в канал.
  - [x] `workers/content_worker.py`: `run_publisher_preflight` дополнительно сканирует `ready/approved` через `scan_publish_blockers`, сбрасывает в `draft` и переподготавливает (`reset_item_for_regeneration` + `prepare_item`); в отчёте — поле `forced_reset`.
  - [x] `services/generator/prompts.py`: правило для LLM явно перечисляет все запрещённые падежные формы и даёт позитивные подсказки («школа Аватэрра», «по подходу школы»).
  - [x] Тесты `tests/test_quality_gates.py`: 11 параметризованных кейсов на все падежи «метод», 7 на разрешённые производные, 3 на `scan_publish_blockers`. `PYTHONPATH=src pytest tests/test_quality_gates.py tests/test_publisher_dry_run_reasons.py tests/test_publisher_autonomy.py -q` — 58 passed.
  - [x] Выкат: файлы скопированы в `/opt/avaterra-bot/...`, образ пересобран, контейнер перезапущен. Сегодняшний `startup_catchup` отработал штатно (`publisher_run_empty` со `status_counts={"published":1}`). Пост 21.05 сброшен в `draft` через SQL.
  - [x] Live-проверка `scan_publish_blockers` в проде: «методе»/«методы регресса» → `['method_word']`, «школе Аватэрра»/«Методика мышечного тестирования» → `OK`.
- **Зависимости**: `services/quality/gates.py`, `services/publisher/channel_publisher.py`, `workers/content_worker.py`, `services/generator/prompts.py`, `tests/test_quality_gates.py`

## Hotfix - 2026-05-18 (автономность ежедневной публикации)

## Задача: Автономный публикатор — посты выходят ежедневно в 11:00 МСК без вмешательства
- **Приоритет**: Критический
- **Статус**: Завершена
- **Описание**: Гарантировать ежедневный выход поста в 11:00 МСК без ручных действий. Закрыть три класса сбоев: тихое включение `dry_run` (in-memory toggle), даунтайм >1 ч около слота (`misfire_grace_time=3600`) и застрявшие в `draft/text_ready/quality_failed/...` item'ы (Publisher молча пропускает день).
- **Шаги выполнения**:
  - [x] `workers/content_worker.py`: `_reconcile_publisher_flags(settings)` + хелпер `_env_bool` — перед каждым слотом откатываем `dry_run`/`enable_auto_publish` к окружению; drift пишем WARNING `publisher_flags_reverted`.
  - [x] `workers/content_worker.py`: `run_publisher_preflight(...)` — тянет сегодняшние item'ы `draft/text_ready/quality_failed/failed/dedup_blocked` через `complete_image_for_item`/`reset_item_for_regeneration`+`prepare_item`. Отчёт `publisher_preflight_outcome`/`publisher_preflight_item_failed`.
  - [x] `workers/content_worker.py`: общий путь `_run_publisher_slot(*, source)` — reconcile → state → preflight → `publish_due_today` → итог; `_publisher_job` — обёртка с `source="cron"`.
  - [x] `workers/content_worker.py`: `_maybe_schedule_startup_catchup(...)` — `DateTrigger` через 60 с после старта, если уже после `PUBLISH_HOUR:PUBLISH_MINUTE` в `settings.timezone` и сегодня публикационный день.
  - [x] `workers/content_worker.py`: `misfire_grace_time` для `content_publisher_daily` поднят с 3600 до 21600 (6 часов).
  - [x] Тесты `tests/test_publisher_autonomy.py` (9 кейсов на `_env_bool` и `_reconcile_publisher_flags`); `PYTHONPATH=src pytest -q` — 139 passed.
- **Зависимости**: `workers/content_worker.py`, `services/generator/pipeline.py`, `db/repositories/content.py`, APScheduler

## Hotfix - 2026-05-18 (тихий `dry_run` и пустой день)

## Задача: Аудит runtime-флагов и расшифровка причин `publisher_dry_run`
- **Приоритет**: Критический
- **Статус**: Завершена
- **Описание**: 15.05 не вышел `faq`-пост (остался в `draft`), 16.05 и 17.05 посты ушли в `dry_run` без видимой причины. Корень — inline-кнопка `adm:dry` (и аналог для `auto`) меняли `settings` в памяти процесса без лога и без уведомления. По решению заказчика пропущенные посты не публикуем; задача — закрыть «слепые зоны», чтобы повторение было видно сразу.
- **Шаги выполнения**:
  - [x] `services/publisher/channel_publisher.py`: чистая функция `_dry_run_reasons(settings)` (`dry_run_flag`, `auto_publish_disabled`, `no_channel`), её результат пишется в `publisher_dry_run` (WARNING) и в `integration_logs.response_meta`.
  - [x] `services/publisher/channel_publisher.py`: новая функция `today_in_timezone(tz)`, `publish_due_today` использует «сегодня» из `settings.timezone`, а не из локальной TZ контейнера.
  - [x] `workers/content_worker.py`: `_publisher_job` пишет `publisher_run_state` перед каждым слотом, обёрнут в `try/except` (`publisher_job_crashed`), а при пустой выборке тянет `list_items_for_date` и логирует `status_counts` + превью первых 10 item'ов.
  - [x] `workers/content_worker.py`: стартовый лог `content_jobs_scheduled` теперь включает `dry_run`/`enable_auto_publish`/`has_channel`/`dry_run_reasons`.
  - [x] `bot/handlers/admin.py`: общая функция `_audit_runtime_toggle` для всех точек входа (команды `/dry_run`, `/auto`, `/pause`, `/resume` и inline-кнопки `adm:dry`, `adm:auto`) — WARNING `runtime_toggle` + Telegram-уведомление всем `ADMIN_TELEGRAM_IDS`.
  - [x] `db/repositories/content.py`: новая функция `list_items_for_date(...)`.
  - [x] Тесты: `tests/test_publisher_dry_run_reasons.py` (8 кейсов); `PYTHONPATH=src pytest -q` — 130 passed.
- **Зависимости**: `services/publisher/channel_publisher.py`, `workers/content_worker.py`, `bot/handlers/admin.py`, `db/repositories/content.py`

## Sprint 6 - 2026-05-12 (автономный недельный пайплайн)

## Задача: Запрет «калибр…», «метод» и правка уже опубликованных постов в канале
- **Приоритет**: Высокий
- **Статус**: Завершена
- **Описание**: Полностью убрать из лексики постов семейство «калибр…» (правильная замена — «замер через баланс тела» / «сверить ответ с балансом»), запретить целое слово «метод» в текстах постов (вместо — «школа Аватэрра» / «подход школы»), не допускать публикации с такими нарушениями и привести уже опубликованные посты в канале к корректной лексике.
- **Шаги выполнения**:
  - [x] `knowledge/avaterra.yaml`: `safe_replacements` со всеми формами калибровки, `brand.goals`, `theme_bank`, `prohibited_phrases` без слова «метод».
  - [x] `services/generator/prompts.py` `COMMON_RULES_RU`: явный запрет «калибр…» и `\bметод\b`, перечисление допустимых формулировок.
  - [x] `services/quality/gates.py`: расширенный `_CALIBRATION_PATTERN`, новый гейт `method_word`, чистая функция `normalize_post_lexicon`.
  - [x] `services/publisher/channel_publisher.py`: страховочная нормализация перед `send_message` + JSON-лог `publisher_lexicon_normalized`.
  - [x] `scripts/fix_published_lexicon.py` — правка опубликованных через `edit_message_text` (с dry-run и отчётом по multi-chunk).
  - [x] `scripts/fix_prepared_lexicon.py` — нормализация или сброс на регенерацию для `ready/approved/text_ready`.
  - [x] Тесты: `tests/test_quality_gates.py`, `tests/test_prompts_templates.py`, новый `tests/test_lexicon_normalization.py`. Полный прогон 122 passed.
- **Зависимости**: `knowledge/avaterra.yaml`, `services/quality/gates.py`, `services/publisher/channel_publisher.py`, `scripts/`

## Задача: Аватэрра везде, визуалы под сайт и устойчивость к дубликату проекта по URL
- **Приоритет**: Высокий
- **Статус**: Завершена
- **Описание**: Закрепить «Аватэрра» во всех пользовательских строках (KB/код/тесты), переписать промпты картинок в стилистике [avaterra.pro](https://avaterra.pro/) (контакт→вопрос→ответ, O‑кольцо, сессия с руками) и устранить корневую причину пропуска поста 12 мая — два проекта на один сайт с разным `website_url`.
- **Шаги выполнения**:
  - [x] `knowledge/avaterra.yaml` (`brand.name = "Аватэрра"`), `content_planner.py` (objective FAQ + author fallback), `brand.py` (`DEFAULT_GOALS`), `funnel_flow.py`, `admin.py`/`funnel.py` (UI), `external/kie.py` (placeholder), `tests/test_deduplication.py`.
  - [x] `services/generator/prompts.py`: новый `_IMAGE_BASE_STYLE` с сюжетом сайта; сцены `educational/practice/course/faq/author/pain/reflection` под мышечное тестирование с акцентами «контакт-вопрос-ответ» и O‑ring; `_topic_visual_hint` 200 символов.
  - [x] Тесты промптов: `contact/question/answer` в educational, `o-ring` в course, ban букв/логотипов.
  - [x] `db/repositories/projects.py`: `normalize_website_url`, `ensure_default_project` с fallback по хосту, warn `projects_duplicate_host`.
  - [x] `tests/test_projects_url_normalization.py` (11 кейсов).
  - [x] Полный прогон `PYTHONPATH=src pytest` — 111 passed.
- **Зависимости**: `knowledge/avaterra.yaml`, `services/generator/prompts.py`, `db/repositories/projects.py`

## Задача: Терминология «Аватэрра», без FAQ/«калибровки» и тематические картинки
- **Приоритет**: Высокий
- **Статус**: Завершена
- **Описание**: Привести тексты постов к требованиям заказчика (школа «Аватэрра», без «метода»/«калибровки»/акронима «FAQ») и сделать визуалы ближе к теме phygital-школы мышечного тестирования.
- **Шаги выполнения**:
  - [x] `knowledge/avaterra.yaml`: новая терминология (Аватэрра, школа вместо метода, сверка баланса, «раздел Описание» вместо FAQ), обновлены `author.facts`, `theme_bank`, `cta_library`, `safe_replacements`, `editor_checklist`, `text_whitelist_terms`.
  - [x] `services/generator/prompts.py`: `COMMON_RULES_RU`, `_quick_links_block`, `system_lines` под новые правила; `build_image_prompt` с тематическими сценами и обрезанным `request.topic`.
  - [x] `services/quality/gates.py`: убраны `Avaterra/AVATERRA/FAQ` из whitelist, добавлены гейты `faq_acronym`, `calibration_word`, `latin_brand`, обновлена подсказка `missing_cta`.
  - [x] Тесты: расширены `tests/test_quality_gates.py` и `tests/test_prompts_templates.py`; полный прогон `PYTHONPATH=src pytest` — 98 passed.
- **Зависимости**: `knowledge/avaterra.yaml`, `services/generator/prompts.py`, `services/quality/gates.py`

## Задача: Автономная подготовка постов на неделю с ретраями и уведомлениями
- **Приоритет**: Высокий
- **Статус**: Завершена
- **Описание**: Бот должен сам собирать план на следующую неделю, генерировать все 7 постов, повторять попытки при сбоях и отчитываться администраторам. Если что-то всё же не получилось — давать админу кнопку для ручного перезапуска в меню.
- **Шаги выполнения**:
  - [x] `weekly_orchestrator` переделан в многоходовой: pass1 — `draft/failed/dedup_blocked`, pass2 — `quality_failed` и `text_ready` (только картинка).
  - [x] В `pipeline.py` добавлена `complete_image_for_item` для дешёвой починки `text_ready`.
  - [x] `WeeklyOutcome` теперь содержит сводку: `ready_count`, `all_ready`, список `problem_items`, `passes_run`, границы недели.
  - [x] Финальная сверка плана 7/7 с разбивкой по дням.
  - [x] Новые настройки: `WEEKLY_PIPELINE_EXTRA_PASSES`, `WEEKLY_PIPELINE_PASS_DELAY_SECONDS`, `WEEKLY_PIPELINE_NOTIFY_ADMINS`.
  - [x] Модуль `weekly_notify.py`: HTML-отчёт + инлайн-кнопки «Очередь качества», «План недели», «Перезапустить генерацию».
  - [x] В `_planner_job` обёртка с try/except и автоматический отчёт админам после каждого запуска.
  - [x] В `/admin` меню добавлена кнопка «Подготовить след. неделю» с защитой от двойного запуска.
  - [x] Тесты `tests/test_weekly_pipeline_passes.py` (4 кейса).
- **Зависимости**: `services/generator/pipeline.py`, `workers/content_worker.py`, `bot/handlers/admin.py`

## Hotfix - 2026-05-12 (пропуск дня публикации)

## Задача: Воскресный планер не создавал план новой недели
- **Приоритет**: Критический
- **Статус**: Завершена
- **Описание**: 11 мая (понедельник) поста не было. Cron-планер 10 мая в 19:00 пересчитывал границы недели от `today=Sunday` и видел текущий план Mon–Sun → ничего нового не создавал.
- **Шаги выполнения**:
  - [x] Найдена причина: `build_week_plan` без `target_monday` использует `week_bounds(today)`, что в воскресенье даёт прошедшую неделю.
  - [x] Добавлен параметр `target_monday` в `build_week_plan` и `run_weekly_pipeline`.
  - [x] В `_planner_job` cron теперь всегда передаёт `upcoming_week_monday(date.today())` — следующая или текущая неделя в зависимости от дня.
  - [x] Publisher логирует WARNING `publisher_run_empty` при 0 due-постов, чтобы пропуск дня был виден сразу в мониторинге.
  - [x] Добавлены 3 юнит-теста для `upcoming_week_monday`.
  - [x] Вручную создан план на 2026-05-11..05-17, посты подготовлены (6 ready, 1 регенерирован).
- **Зависимости**: APScheduler, `services.planner.content_planner`, `workers.content_worker`

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

ка, минимум 2-4 недели данных

