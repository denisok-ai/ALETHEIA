<!--
@file: changelog.md
@description: Хронологический журнал изменений проекта FindThePuppy
@dependencies: docs/Project.md, docs/Tasktracker.md, docs/Diary.md, docs/qa.md
@created: 2026-05-07
-->

# Changelog

## [2026-08-18] - Hotfix: AmbiguousParameterError $7 при записи текста

### Исправлено
- `update_item_text`: явные касты `$7::text` и `$8::boolean`. asyncpg не выводил тип `last_error=NULL` на успешном `text_ready` → все 7 постов недели 24.08–30.08 падали с `AmbiguousParameterError`.

### Прод
- Выкат на `/opt/avaterra-bot` и перезапуск `bot`; повторная генерация плана `dc3aa5c8-…`.

## [2026-08-18] - Weekly pipeline: salvage гейтов и устойчивые ретраи

### Исправлено
- После LLM-попытки текст прогоняется через `salvage_text` (лексика, CTA, дисклеймер, URL whitelist, обрезка длины) — типичные `quality_failed` закрываются без ручного рестарта.
- `quality_failed` обрабатывается уже на pass1; extra passes default **2**; `last_error` хранит коды гейтов.
- `DEEPSEEK_MAX_TOKENS` default **2048**, чтобы course/educational не обрывались без CTA.
- Сверка 7/7 считает `admin_preview_sent` готовым днём.
- `latin_word` больше не цепляет токены из URL/email.

### Тесты
- `tests/test_quality_gates.py`: salvage CTA/URL/too_long/FAQ.
- `tests/test_weekly_pipeline_passes.py`: pass1 подхватывает `quality_failed`.

### Прод
- Выкат `deploy/deploy.sh` на `avaterra` (`/opt/avaterra-bot`).
- В `.env`: `DEEPSEEK_MAX_TOKENS=2048`, `WEEKLY_PIPELINE_EXTRA_PASSES=2`.
- Контейнер `bot` пересобран (`docker compose up -d --build`).

## [2026-07-27] - Weekly pipeline: retry draft и mark-failed при exception

### Исправлено
- `weekly_orchestrator`: доп. проходы снова обрабатывают `draft`; при exception item помечается `failed` с `last_error`.
- `_verify_plan`: `missing` только для дней без item (без дубля с уже перечисленным non-ready).
- `deepseek`: retry `TimeoutError`; исчерпанные сетевые ошибки → `DeepSeekError` (текст-генератор пишет `failed`).

### Тесты
- `tests/test_weekly_pipeline_passes.py`: retry draft на pass2, mark-failed при exception, отсутствие дубля `missing`.

## [2026-05-22] - Handoff, журнал проекта, логи ≤ 7 дней

### Документация
- Новый `docs/Session-Handoff-2026-05-22.md` — полный контекст режима `admin_preview` для следующих доработок.
- `docs/Logging.md`: политика хранения **7 дней**, таблица проектных журналов (`Diary`, `changelog`, `Tasktracker`, handoff).
- `README.md`, `.cursorrules`, `docs/Project.md` — ссылки на handoff и 7-дневные логи.

### Логирование (retention)
- `LOG_RETENTION_DAYS` default **7** (`config.py`, `.env.example`).
- `deploy/logrotate/avaterra-bot`: `rotate 7`, `maxage 7`.

## [2026-05-22] - Упрощение предпросмотра и исключение PostX/Avaterra

### Изменено
- Предпросмотр без футера «Опубликуйте в канале…» и `/stat`.
- `ADMIN_PREVIEW_EXCLUDE_IDS`: по умолчанию `8660626182` (бот), `7679088857` (PostX); предпросмотр идёт только на `admin_preview_recipient_ids`.

## [2026-05-22] - Исправление дублей и «старых» постов в admin_preview

### Исправлено
- `channel_publisher.py`: не отправлять повторно при `admin_preview_sent`; проверка `publish_date == сегодня`; лог `publisher_due_items`; уведомление доставленным админам о недоставке (нужен /start).
- `send_admin_preview_test.py`: тест только на пост **сегодняшней** даты, не ближайший `ready` из будущего.

### Прод
- Выкат + `force-recreate`; слот 11:00 22.05 отправил `faq` на 2026-05-22 двум админам (третий без /start).

## [2026-05-20] - Временный режим предпросмотра админам + отключение генерации изображений

### Изменено — Конфигурация
- `config.py`: `PUBLISH_MODE` (`channel` | `admin_preview`), `IMAGE_GENERATION_ENABLED`, property `is_admin_preview_mode`.
- `.env.example`: новые переменные и блок «Откат к каналу».

### Изменено — Image Generator
- `image_generator.py`: при `IMAGE_GENERATION_ENABLED=false` пропуск KIE, item переводится в `ready` без `image_url`.

### Изменено — Publisher
- `channel_publisher.py`: в режиме `admin_preview` пост (только текст) отправляется каждому admin_id; статус `admin_preview_sent`; `integration_logs.operation=admin.preview`. Режим `channel` без изменений.

### Изменено — Worker / Admin
- `content_worker.py`: логи `publish_mode`, счётчик `admin_preview_sent` в `publisher_run_done`.
- `admin.py`: `/publish_now` различает «отправлено админам» и «опубликовано в канал».

### Тесты
- `tests/test_image_generation_disabled.py`, `tests/test_publisher_admin_preview.py`.

## [2026-05-18] - Гейт «метод» во всех падежах + страховка в публикаторе

### Контекст
- В опубликованном 18.05 посте (id `5a8e95ad…`, `educational`) пролезло «**В методе** Аватэрра». Гейт `method_word` стоял `\\bметод\\b` и не ловил формы с буквенным окончанием (методе/методу/методом/метода/методы/...). На 21.05 (`author`, id `8edb0cb8…`) в БД лежал ready-пост с «методы регресса» — он бы вышел в канал с той же проблемой.

### Изменено — Quality gates
- `src/avaterra_bot/services/quality/gates.py`:
  - `_METHOD_WORD_PATTERN` расширён до `\\bметод(?:а|у|ом|е|ы|ов|ам|ами|ах)?\\b` (IGNORECASE). Покрывает все падежи ед. и мн. числа, не задевая производные `методик-`, `методическ-`, `методист-`, `методолог-` (после стема обязательно одно из окончаний, иначе граница слова не сходится).
  - Новый `scan_publish_blockers(text) -> list[QualityIssue]` — подмножество «красных» проверок (FAQ, «калибр…», «метод» во всех падежах, латиница Avaterra) без brand profile. Используется как страховка на этапе публикации.

### Изменено — Publisher
- `src/avaterra_bot/services/publisher/channel_publisher.py`:
  - `publish_item` после `normalize_post_lexicon` вызывает `scan_publish_blockers`. При находке item уходит в `quality_failed` с `last_error=publisher_blocked:<codes>`, в лог летит `ERROR publisher_blocked_by_red_gate` с `item_id/post_type/publish_date/issues`, в `integration_logs` — `status=blocked` с `error_code=publisher_blocked:...`. В канал ничего не отправляется. Возвращает `PublishOutcome(status="quality_failed")`.

### Изменено — Worker preflight
- `src/avaterra_bot/workers/content_worker.py`:
  - `run_publisher_preflight` дополнительно сканирует уже `ready/approved` item'ы через `scan_publish_blockers`. При нарушении логирует `WARNING publisher_preflight_ready_blocked`, делает `reset_item_for_regeneration`, перечитывает item и кладёт его в общую очередь восстановления. В отчёте появилось поле `forced_reset: list[str]` с id принудительно сброшенных постов.

### Изменено — Prompts
- `src/avaterra_bot/services/generator/prompts.py`:
  - В `COMMON_RULES_RU` правило про слово «метод» развернуто: явно перечислены все запрещённые падежные формы (`метод`/`метода`/`методу`/`методом`/`методе`/`методы`/`методов`/`методам`/`методами`/`методах`) и даны позитивные подсказки («школа Аватэрра», «подход школы Аватэрра», «практика школы», «в школе Аватэрра», «по подходу школы»). «Методика» остаётся разрешённой.

### Тесты
- `tests/test_quality_gates.py`:
  - Параметризованный `test_method_word_gate_catches_all_inflections` — 11 фраз со всеми падежами «метод».
  - Параметризованный `test_method_word_gate_skips_derivatives` — 7 фраз с `методика`/`методический`/`методически`/`методист`/`методология`.
  - `test_scan_publish_blockers_detects_method_inflection`, `test_scan_publish_blockers_passes_clean_text`, `test_scan_publish_blockers_catches_red_set` — публикаторский страховочный скан.
- `PYTHONPATH=src pytest tests/test_quality_gates.py tests/test_publisher_dry_run_reasons.py tests/test_publisher_autonomy.py -q` — **58 passed**.

### Прод-операции
- Файлы `gates.py`, `channel_publisher.py`, `content_worker.py`, `prompts.py` залиты в `/opt/avaterra-bot/...`, образ пересобран, контейнер `avaterra-bot` перезапущен.
- Пост на 21.05 (id `8edb0cb8-f86a-4f0a-b76d-1842dea09511`, `author`) сброшен в `draft` с `last_error=manual_reset_method_word_2026-05-18` — пересоберётся ближайшим preflight/weekly slot.
- Опубликованный 18.05 пост (id `5a8e95ad…`) не правим: по договорённости 13.05 «метод» не нормализуем автоматически (без падежной морфологии заменa коряво ломает согласования).

### Проверки (после рестарта 11:39 МСК)
- `content_jobs_scheduled`: `dry_run=false`, `enable_auto_publish=true`, `dry_run_reasons=[]`, `publisher_misfire_grace_seconds=21600`, `startup_catchup_scheduled=true`.
- `publisher_startup_catchup_scheduled` сработал в 11:40 МСК → `publisher_run_state(source=startup_catchup)` → `publisher_run_empty` с `status_counts={"published":1}` (сегодняшний пост уже в канале — нечего публиковать).
- Live-сэмпл `scan_publish_blockers` в контейнере: «методе» → `['method_word']`, «методы регресса» → `['method_word']`, чистый «в школе Аватэрра» и «Методика мышечного тестирования» → `OK`.

## [2026-05-18] - Автономный публикатор: env-reconcile, preflight, startup catch-up, 6h misfire grace

### Контекст
- После предыдущего выката (аудит runtime-флагов) стало видно, кто включил `dry_run`. Заказчик попросил гарантировать ежедневный выход постов в 11:00 МСК без вмешательства человека. Слабые места к закрытию: in-memory toggle мог тихо держать «не публиковать» до перезапуска контейнера; `misfire_grace_time=3600` оставлял день без поста при даунтайме >1 ч; деплой сразу после 11:00 не «догонял» слот; недельный пайплайн оставлял `faq/reflection` в `draft/text_ready/quality_failed`, и Publisher молча пропускал день.

### Изменено — Worker
- `src/avaterra_bot/workers/content_worker.py`:
  - Новый `_reconcile_publisher_flags(settings)` — сверяет `dry_run`/`enable_auto_publish` в памяти с `DRY_RUN`/`ENABLE_AUTO_PUBLISH` из окружения и возвращает к окружению, если есть дрейф. Хелпер `_env_bool(name, default)` принимает `true/1/yes/on` (case-insensitive, обрезает пробелы).
  - Новый `run_publisher_preflight(pool, *, project_id, settings, day)` — поднимает сегодняшние item'ы из `draft/text_ready/quality_failed/failed/dedup_blocked` через `complete_image_for_item`/`reset_item_for_regeneration` + `prepare_item`. Логирует `WARNING publisher_preflight_outcome` со списком `from_status`/`to_status`.
  - Новый `_run_publisher_slot(*, source)` — общий путь публикатора: reconcile → state → preflight → `publish_due_today` → итог. Источник пишется полем `source` (`cron` или `startup_catchup`). Если reconcile поменял флаги — отдельный `WARNING publisher_flags_reverted` с `drift`.
  - Новый `_maybe_schedule_startup_catchup(scheduler, *, settings, run_slot)` — если по `settings.timezone` уже после `PUBLISH_HOUR:PUBLISH_MINUTE` и сегодня — публикационный день (`mon..sun` при `POSTS_PER_WEEK>=7`, иначе `mon/wed/fri`), регистрирует одноразовый `DateTrigger` через 60 секунд после старта. Покрывает деплой/рестарт после слота без надежды на misfire.
  - `misfire_grace_time` для `content_publisher_daily` поднят с 3600 до **21600** (6 часов).
  - `content_jobs_scheduled` дополнительно логирует `publisher_misfire_grace_seconds` и `startup_catchup_scheduled`.

### Тесты
- `tests/test_publisher_autonomy.py` (новый, 9 кейсов): `_env_bool` (truthy/falsy/missing), `_reconcile_publisher_flags` для пустого drift'а, реверта `dry_run`, реверта `enable_auto_publish`, обоих сразу, случая «`.env` сам в dry_run», и поведения без env vars.
- Полный прогон `PYTHONPATH=src pytest -q` — **139 passed**.

### Эксплуатация
- После выката в стартовых логах появятся новые поля: `publisher_misfire_grace_seconds=21600`, `startup_catchup_scheduled=<bool>`. Если кто-то снова включит `dry_run` в проде, при следующем слоте (или startup-catchup'е) увидим `WARNING publisher_flags_reverted` и продолжим публикацию. Любой застрявший `draft/text_ready/...` за минуты до слота получит ещё одну попытку через `publisher_preflight_outcome`.

## [2026-05-18] - Аудит runtime-флагов, явные причины `publisher_dry_run`, TZ-aware «сегодня» у публикатора

### Контекст
- 15–17 мая 2026 в канале не вышло три поста подряд. По логам и БД: 15.05 — `publisher_run_empty` из-за `faq`-item'а, застрявшего в `status=draft` (quality-гейт `too_long`); 16.05 и 17.05 — `publisher_dry_run`, хотя `.env` штатный (`DRY_RUN=false`, `ENABLE_AUTO_PUBLISH=true`, канал задан). Корень: inline-кнопки `adm:dry`/`adm:auto` и команды `/dry_run on|off`, `/auto on|off` молча меняли `settings` в памяти процесса; ни логи, ни уведомления не подсказывали, что флаг включён до следующего перезапуска контейнера. По решению заказчика пропущенные посты не публикуем; фиксим, чтобы повторений не было.

### Изменено — Публикатор
- `src/avaterra_bot/services/publisher/channel_publisher.py`:
  - Новая чистая функция `_dry_run_reasons(settings) -> list[str]` возвращает список конкретных причин (`dry_run_flag`, `auto_publish_disabled`, `no_channel`). Используется как в условии, так и в логах.
  - Уровень `publisher_dry_run` поднят с `INFO` до `WARNING`, в `extra` добавлено поле `reasons`; в `integration_logs.response_meta` теперь лежат `reason` (строка через запятую) и `reasons` (список).
  - Новая функция `today_in_timezone(tz)`: «сегодня» считается в `settings.timezone`, а не в локальной TZ контейнера, чтобы публикатор и cron видели одну и ту же дату.
  - `publish_due_today` по умолчанию использует `today_in_timezone(settings.timezone)`.

### Изменено — Worker
- `src/avaterra_bot/workers/content_worker.py`:
  - `_publisher_job` перед каждым слотом пишет `INFO publisher_run_state` (`dry_run`, `enable_auto_publish`, `has_channel`, `posts_per_week`, `dry_run_reasons`, `date`, `timezone`).
  - Вызов `publish_due_today` обёрнут в `try/except` с `logger.exception("publisher_job_crashed")`, чтобы краш не оставался безмолвным.
  - При пустой выборке `_log_pending_items_for_date` достаёт `list_items_for_date(...)` и пишет `WARNING publisher_run_empty` с `reason` (`no_items_in_plan` или `no_due_items`), `items_total`, `status_counts` и превью первых 10 item'ов (`item_id`/`post_type`/`status`).
  - В стартовый `content_jobs_scheduled` добавлены `dry_run`, `enable_auto_publish`, `has_channel`, `dry_run_reasons` — сразу после рестарта видно, в каком режиме работает бот.

### Изменено — Админ-команды и inline-кнопки
- `src/avaterra_bot/bot/handlers/admin.py`:
  - Новая функция `_audit_runtime_toggle(bot, *, field, old_value, new_value, source, actor_id)` логирует `WARNING runtime_toggle` и шлёт всем `ADMIN_TELEGRAM_IDS` короткое HTML-уведомление о том, что флаг изменён (без inline-кнопок).
  - Подключена ко всем точкам входа: команды `/dry_run`, `/auto`, `/pause`, `/resume` и callback'и `adm:dry`, `adm:auto`. Источник помечается как `command:/...` или `inline:adm:...`.

### Добавлено — БД
- `src/avaterra_bot/db/repositories/content.py`: новая функция `list_items_for_date(pool, *, project_id, publish_date)` — возвращает все item'ы проекта на дату независимо от статуса. Используется публикатором для диагностики `publisher_run_empty`.

### Тесты
- `tests/test_publisher_dry_run_reasons.py` (новый): 8 кейсов на `_dry_run_reasons` (пустые причины, каждая по отдельности, blank-канал, комбинации) и `today_in_timezone` (валидная TZ + fallback на битой).
- Полный прогон `PYTHONPATH=src pytest -q` — **130 passed**.

### Эксплуатация
- После выката контейнер перезапустится: `settings.dry_run`/`enable_auto_publish` подтянутся из `.env` (значения не менялись с 7 мая). В первом же `publisher_run_state` после рестарта будет видно, что флаги в норме.
- Если кто-то снова включит `dry_run` в проде (намеренно или случайно), в логи прилетит `WARNING runtime_toggle` с `actor_id` и `source`, а все админы получат сообщение в Telegram.

## [2026-05-13] - Запрет «калибр…», «метод», страховочная нормализация на публикации, правка канала

### Контекст
- Заказчик уточнил терминологию: слова из семейства «калибр…» полностью убрать из лексики постов (правильно — «замер через баланс тела», «сверить ответ с балансом»); целое слово «метод» в текстах постов запрещено (вместо него — «школа Аватэрра», «подход школы», «практика школы», слово «методика» допустимо); все уже опубликованные посты с латинской «Avaterra» и «калибр…» нужно поправить прямо в канале.

### Изменено — KB и промпты
- `knowledge/avaterra.yaml`:
  - `safe_replacements`: расширен набор форм «калибр…» («калибровкой», «калибровке» и др.), все ведут к «замеру через баланс» / «сверке с балансом».
  - `brand.goals[0]` теперь без слова «метод» («Объяснять школу Аватэрра…»).
  - `theme_bank`: тема «скептически к методу» перефразирована («скептически к подходу школы Аватэрра»).
  - `prohibited_phrases`: пример «метод гарантирует результат» → «школа Аватэрра гарантирует результат».
- `src/avaterra_bot/services/generator/prompts.py`:
  - `COMMON_RULES_RU` явно запрещает «калибр…» и целое слово «метод» в тексте поста, перечисляет допустимые формулировки.

### Изменено — Quality gates
- `src/avaterra_bot/services/quality/gates.py`:
  - `_CALIBRATION_PATTERN` теперь ловит любое слово на «калибр…» (например, «калиброванный»), не только тройку форм.
  - Новый гейт `_check_no_method_word` со срабатыванием на `\bметод\b` (re.IGNORECASE); слово «методика» проходит благодаря границам слова.
  - Подсказка `calibration_word` обновлена под новые формулировки.
  - Новая чистая функция `normalize_post_lexicon(text)`: детерминированные замены `Avaterra/AVATERRA → Аватэрра` и распространённых форм «калибр…» (URL/email сохраняются как есть). «Метод» намеренно не нормализуется автоматически.

### Изменено — Публикация
- `src/avaterra_bot/services/publisher/channel_publisher.py`: перед отправкой текст прогоняется через `normalize_post_lexicon`. При изменении пишется JSON-лог `publisher_lexicon_normalized` с количеством изменённых символов.

### Добавлено — Скрипты разовой правки
- `scripts/fix_published_lexicon.py`: пробегается по `content_items` со статусом `published`, нормализует текст и редактирует первое текстовое сообщение в канале (`edit_message_text`), обновляет `final_text` в БД. Поддерживает `--apply` (по умолчанию dry-run). Длинные посты (>4096) и multi-chunk случаи выносятся в отчёт «нужна ручная правка».
- `scripts/fix_prepared_lexicon.py`: пробегается по `content_items` со статусами `ready/approved/text_ready`. Где нормализация чинит текст полностью — обновляет `final_text`; где остаются нарушения (в частности «метод») — переводит в `quality_failed` и `reset_item_for_regeneration`, чтобы недельный пайплайн пересобрал пост.

### Тесты
- `tests/test_quality_gates.py`: новые кейсы `test_catches_method_word`, `test_method_word_gate_allows_methodika`, `test_catches_calibration_derivative_word`.
- `tests/test_prompts_templates.py`: проверка, что в system prompt явно запрещено целое слово «метод» и упоминается «школа Аватэрра».
- `tests/test_lexicon_normalization.py` (новый): 7 кейсов на `normalize_post_lexicon` — латиница в обычном тексте/URL/email, склонения «калибр…», неприкосновенность «метод», идемпотентность, пустой вход.
- `PYTHONPATH=src pytest` — **122 passed**.

### Операции на сервере (после деплоя — по запросу)
- `docker compose exec bot python scripts/fix_prepared_lexicon.py` (dry-run) и `--apply` для нормализации/сброса ещё не опубликованных постов.
- `docker compose exec bot python scripts/fix_published_lexicon.py` (dry-run) и `--apply` для правки уже опубликованных сообщений в канале.

## [2026-05-12] - Аватэрра везде, визуалы под сайт avaterra.pro, фикс дубликата проекта по URL

### Контекст
- Заказчик попросил: **везде** в постах и интерфейсах писать «Аватэрра» (кириллица); картинки сделать ближе к материалам [avaterra.pro](https://avaterra.pro/) (контакт → вопрос → ответ, жест O‑кольцо, сессия с руками); добиться того, чтобы посты выходили **ежедневно**.

### Изменено — терминология «Аватэрра» в коде/тестах
- `knowledge/avaterra.yaml`: `brand.name = "Аватэрра"`.
- `src/avaterra_bot/services/planner/content_planner.py`: `DEFAULT_OBJECTIVE_BY_TYPE["faq"]` теперь ведёт в «раздел Описание»; `FALLBACK_TOPICS_BY_TYPE["author"]` без латиницы (`школа Аватэрра`).
- `src/avaterra_bot/db/repositories/brand.py`: `DEFAULT_GOALS` → «канала Аватэрра».
- `src/avaterra_bot/services/funnel/funnel_flow.py`: `WELCOME_TEXT`, `THANKS_AFTER_FREEFORM` — «школа Аватэрра».
- `src/avaterra_bot/bot/handlers/admin.py`, `funnel.py`: заголовки `Аватэрра KB`, `Аватэрра admin`, «Бот школы Аватэрра готов к работе».
- `src/avaterra_bot/services/external/kie.py`: dry-run placeholder URL — кириллица в query.
- `tests/test_deduplication.py`: эталонная строка `POST_B` приведена к «Канал Аватэрра».

### Изменено — image prompts ближе к сайту
- `src/avaterra_bot/services/generator/prompts.py`:
  - `_IMAGE_BASE_STYLE` теперь явно отсылает к сюжету сайта («body knows the answer» как mood, тройка «contact, question, answer», атмосфера онлайн‑школы), запрещает любые буквы/UI на кадре, добавляет ограничения «без лиц/детей/клиники».
  - `_IMAGE_SCENES`: educational — кадры с тремя шагами теста; practice — вода + ладонь на грудине; course — два партнёра теста и **намёк на жест O‑кольцо**; faq — схема трёх кружков и стрелок в блокноте; author/pain/reflection — усилены детали без портрета.
  - `_topic_visual_hint` поднят с 180 до 200 символов.
- `tests/test_prompts_templates.py`: новые проверки `contact/question/answer` в educational, `o-ring` в course, явный запрет текста/букв/логотипов.

### Исправлено — ежедневная публикация (фикс дубликата проекта по URL)
- Корень проблемы 12 мая: в `projects` появились две строки на один сайт с разным `website_url` (`https://avaterra.pro` vs `https://avaterra.pro/`). `ensure_default_project` искал строго по строке, поэтому план недели лёг на «чужой» `project_id`, а cron `publish_due_today` находил 0 элементов.
- `src/avaterra_bot/db/repositories/projects.py`:
  - Чистая функция `normalize_website_url`: нижний регистр scheme/host, обязательный хвостовой `/`, дефолтная схема `https://` для голого хоста.
  - `ensure_default_project` теперь хранит и ищет канонизированный URL, а при отсутствии точного матча делает **fallback** по `host` (через `lower(regexp_replace(..., '^https?://', ''))`).
  - Новое предупреждение `projects_duplicate_host` (JSON-лог) при обнаружении >1 строки на один хост — с id/именами и подсказкой по миграции.
- `tests/test_projects_url_normalization.py`: 11 кейсов канонизации (хвостовой слеш, регистр, пустое значение, идемпотентность, http/https и т.п.).

### Эксплуатация на проде (после деплоя — один раз)
- Сверить `SELECT id, name, website_url FROM projects ORDER BY created_at`; если есть две строки на `avaterra.pro` — оставить рабочую `Avaterra` (`fd05bf87…`), а `content_plans/content_items` с других перевести `UPDATE ... SET project_id = '<основной>'` (в недавней сессии план уже перепривязан).
- После перезапуска бот сам нормализует `website_url` в строке `Avaterra` и логирует предупреждение, если осталась лишняя строка с тем же хостом.

### Валидация
- `PYTHONPATH=src pytest` — **111 passed**.

## [2026-05-12] - Терминология «Аватэрра», без FAQ/«калибровки» в текстах, тематические картинки

### Контекст
- Заказчик попросил: в постах писать школу кириллицей — **«Аватэрра»**; не использовать слова **«метод»**, **«калибровка»** и акроним **«FAQ»** в клиентских формулировках; картинки сделать ближе к теме phygital-школы мышечного тестирования.

### Изменено
- `knowledge/avaterra.yaml`:
  - `tov_dos` явно фиксирует «Аватэрра» (кириллица) и запрет на «Avaterra/AVATERRA» в теле поста; формулировка «связь с методом AVATERRA» → «связь с подходом школы Аватэрра» в шаблонах и `objective` рубрики `faq`.
  - `author.facts`: вместо точной цифры выпускников — «выпустила много готовых мастеров своего дела» (с сохранением 22+ лет и 15 000+ консультаций).
  - `safe_replacements` дополнены парами `калибровка → сверка баланса`, `AVATERRA/Avaterra → Аватэрра`.
  - `theme_bank`, `cta_library.faq/catalog`, `editor_checklist`, `audiences.skeptics.angle`, `products.body_does_not_lie.modules` приведены к новой терминологии (без «метода», «калибровки», «AVATERRA», «FAQ»).
  - `text_whitelist_terms` теперь содержит только `CTA`, `Telegram`, `VIP` — латинская `Avaterra`/`AVATERRA` и акроним `FAQ` больше не маскируют гейты.
- `services/generator/prompts.py`:
  - `COMMON_RULES_RU` явно требует кириллическое написание «Аватэрра», запрещает «FAQ» и «калибровку» в тексте, оставляет латиницу только внутри `avaterra.pro/...`.
  - `_quick_links_block`: ссылка `/faq` подписывается как «раздел Описание» вместо «FAQ:».
  - `system_lines` называют школу «Аватэрра».
  - `build_image_prompt` переписан: новые сцены под мышечное тестирование (две ладони на предплечье, открытая ладонь на грудине, рабочее место мастера без лиц и пр.), запрет на клинические объекты, в финальный промпт KIE добавляется обрезанный фрагмент `request.topic` для тематичности.
- `services/quality/gates.py`:
  - `DEFAULT_WHITELIST` больше не содержит `Avaterra/AVATERRA/FAQ`.
  - Новые гейты `faq_acronym`, `calibration_word`, `latin_brand` с подсказками для перегенерации; перед проверкой бренда URL и `avaterra.pro/...` маскируются, чтобы не давать ложные срабатывания.
  - Подсказка `missing_cta` обновлена: «курс / раздел Описание / каталог».

### Тесты
- `tests/test_quality_gates.py`: эталонный «хороший» пост переписан под новую терминологию, добавлены тесты `test_catches_faq_acronym`, `test_faq_url_does_not_trigger_acronym_gate`, `test_catches_calibration_word`, `test_catches_latin_brand_word`.
- `tests/test_prompts_templates.py`: проверка «Аватэрра» в system prompt, тематичность image prompt (`muscle testing`, `no faces`), внедрение и обрезка `request.topic`, явный запрет FAQ/калибровки в правилах.
- `PYTHONPATH=src pytest` — все 98 локальных тестов зелёные.

## [2026-05-12] - Автономный недельный пайплайн с ретраями и уведомлениями

### Добавлено
- Многоходовая генерация плана недели в `services/planner/weekly_orchestrator.py`:
  - Pass 1 — `draft`, `failed`, `dedup_blocked` (как раньше).
  - Pass 2+ — повтор для `quality_failed` (полный `prepare_item`) и `text_ready` (только догенерация картинки через новую `complete_image_for_item`).
  - Между проходами — пауза `WEEKLY_PIPELINE_PASS_DELAY_SECONDS`, количество доп. проходов — `WEEKLY_PIPELINE_EXTRA_PASSES`.
  - Финальная сверка плана 7/7: на каждый день недели должен быть хотя бы один `ready`/`approved`/`published`. Иначе — список проблемных позиций в `WeeklyOutcome`.
- Модуль `services/planner/weekly_notify.py`: уведомления админам по итогам пайплайна (успех/частично/сбой) с инлайн-кнопками «Очередь качества», «План недели», «Перезапустить генерацию».
- Cron-job в `workers/content_worker.py` теперь:
  - ловит исключения недельного пайплайна и шлёт админам сообщение о сбое;
  - после успешного запуска отправляет краткий отчёт с deep-link на меню админа.
- В `/admin` меню добавлена кнопка «🚀 Подготовить след. неделю» (`adm:genweek`), которая повторяет логику cron и работает с защитой от двойного запуска (`asyncio.Lock`).
- В `config.py` и `.env.example` появились `WEEKLY_PIPELINE_EXTRA_PASSES`, `WEEKLY_PIPELINE_PASS_DELAY_SECONDS`, `WEEKLY_PIPELINE_NOTIFY_ADMINS`.

### Изменено
- `WeeklyOutcome` расширен полями `week_start`, `week_end`, `ready_count`, `passes_run`, `all_ready`, `problem_items`.
- `/plan_now` теперь печатает тот же HTML-отчёт, что приходит админам после автозапуска.

### Валидация
- 90 локальных тестов зелёные, добавлены 4 новых: `tests/test_weekly_pipeline_passes.py` (pass1+pass2 рекавери, частичный успех, сверка плана).

## [2026-05-12] - Hotfix: воскресный планер не создавал план новой недели

### Контекст
- 11 мая (понедельник) поста не было. Причина: cron-планер срабатывает в воскресенье 19:00 и пересчитывал границы недели от `today=Sunday`, получая прошедшую Mon–Sun. На неё план уже был → ничего нового не создавалось, и Publisher 11 мая нашёл 0 элементов.

### Исправлено
- `build_week_plan` принимает явный параметр `target_monday`; при его отсутствии поведение прежнее (текущая неделя — для ручных команд админа).
- `run_weekly_pipeline` пробрасывает `target_monday` дальше.
- В `_planner_job` cron всегда планирует на `upcoming_week_monday(date.today())` — это завтра, если сегодня воскресенье; сегодня, если сегодня понедельник; следующий понедельник иначе.
- Publisher теперь логирует `publisher_run_empty` (WARNING) при 0 due-постов на день — пропуски видны сразу.
- Добавлены юнит-тесты `upcoming_week_monday` для воскресенья, понедельника и середины недели.

### Восстановление пропуска
- Вручную создан план на 2026-05-11..05-17 (`plan_id=c2027aa3-74d9-405d-90de-b14881a7bd87`), 7 постов; 6 ready, 1 регенерирован.
- 12 мая пост в статусе `ready` — Publisher автоматически отправит в 11:00 МСК.

### Валидация
- 86 локальных тестов зелёные.
- Деплой выкатан, контейнеры healthy.

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

