# Расхождение миграций, схемы Prisma и боевой БД (октябрь 2026)

Дата анализа: 16.10.2026. Ветка `worktree-agent-a7de2d0f9d9986f2b`.
Версия Prisma в проекте по `package.json` — 6.12.0 (не 5.22, как было в задаче).

## Методика

- (а) миграции → `prisma/schema.prisma`: `prisma migrate diff --from-migrations … --to-schema-datamodel … --script`.
- (б) боевая БД → схема: DDL копии прода (`.schema`, без данных) загружен в локальную пустую SQLite; `--from-url`.
- (в) миграции → боевая БД: то же, `--to-url`.
- Дополнительно: попарное сравнение по `PRAGMA table_info / index_list / foreign_key_list` (колонки, типы, NOT NULL, дефолты, PK, индексы, FK), чтобы отделить реальные расхождения от пересоздания таблиц, которое Prisma делает из-за мелочей.
- Копия боевой БД: `.backup` на сервере, `_prisma_migrations` — 70 миграций применены, последняя `20261015210000_seo_metrics`. Миграции с `rolled_back_at` — повторно применённые неудачные попытки (`email_delivery_log`, `password_token`, `lead_last_order_number`, `ticket_order_number`), на схему не влияют.

## Что расходилось

Сравнение (а) даёт 5 таблиц для пересоздания, (б) — 4 (без LlmSetting), (в) — только LlmSetting. Колонки, которые лишь меняют порядок (BlogPost, Course, Order, Ticket и др.), в diff не попадают: это косметика, Prisma на неё не реагирует.

| Таблица | Что различается | Где расходится | Класс | Строк в проде |
|---|---|---|---|---|
| `Lead` | Колонка `telegramChatId INTEGER` осталась в таблице после миграции `20260923120000` (перевод на BIGINT через `telegramChatIdBig`). В схеме её нет | миграции = прод ≠ схема | Реальное: колонка с данными, которой нет в схеме | 2 значения, все продублированы в `telegramChatIdBig` (расхождений 0) |
| `LlmSetting` | FK `apiKeyId → LlmApiKey` (ON DELETE SET NULL, ON UPDATE CASCADE) есть в проде и в схеме, в миграциях нет (миграция `20260312100000` пишет «SQLite: no FK in ALTER») | миграции ≠ прод = схема | Ручное/`db push` изменение, миграция его не отражает | 2 |
| `DomainMailbox` | FK `inboundMailboxId → InboundMailbox` (ON DELETE SET NULL) есть в схеме, в миграциях и в проде нет | схема ≠ миграции = прод | Схема опережает БД: FK никогда не создавался | 5, висячих ссылок 0 |
| `BrandProfile` | Дефолт `slug = 'avaterra'` есть в схеме, в БД нет | схема ≠ миграции = прод | Дефолт, без влияния на данные | 0 |
| `PaykeeperRefundRecord` | `partial`: в БД `INTEGER NOT NULL DEFAULT 0`, в схеме `BOOLEAN NOT NULL DEFAULT false` | схема ≠ миграции = прод | Косметика типа: в SQLite оба хранят 0/1, но Prisma видит разницу | 0 |

Косметика (не вызывает diff, не требует действий): порядок колонок в ~15 таблицах (`BlogPost`, `Course`, `Order`, `Ticket`, `Media`, `Service` и др.) — миграции добавляли колонки через `ALTER TABLE ADD COLUMN`, схема задаёт порядок по-своему; имена индексов совпадают во всех трёх сравнениях.

Итог по группам:
- расхождение схемы с БД и миграциями (FK, дефолт, тип): `DomainMailbox`, `BrandProfile`, `PaykeeperRefundRecord`;
- расхождение миграций с БД (FK, которого нет в миграциях, но есть в проде): `LlmSetting`;
- колонка, которой нет в схеме: `Lead.telegramChatId`;
- косметика: порядок колонок.

Отдельно: `BrandProfile` в прод-БД пуста, `PaykeeperRefundRecord` тоже пуста — их перестройка безопасна.

## Что сделано

1. `prisma/schema.prisma`: в модели `Lead` добавлено поле `telegramChatIdLegacy Int? @map("telegramChatId")` с комментарием. Колонка с данными не удалена, схема совпадает с физической таблицей. Альтернатива (удалить колонку через `DROP COLUMN`) отвергнута: правило проекта — не удалять колонки с данными без явной причины, а данные здесь дублируются, поэтому решение за владельцем (см. ниже).
2. Новая миграция `prisma/migrations/20261016120000_reconcile_schema/migration.sql` — сгенерирована самим Prisma (`--from-migrations … --to-schema-datamodel`). Пересоздаёт (RedefineTables с переносом данных): `BrandProfile`, `DomainMailbox` (добавляет FK), `LlmSetting` (добавляет FK, которого не было в миграциях), `PaykeeperRefundRecord` (тип `partial` → BOOLEAN). `Lead` не пересоздаётся.
3. Код вне `prisma/` не менялся.

## Проверки

- Копия прода на сервере (`/tmp/drift-copy.db`), перед миграцией сохранена `/tmp/drift-copy-pre.db`. Применено `DATABASE_URL=file:/tmp/drift-copy.db npx prisma migrate deploy --schema /tmp/drift-prisma/schema.prisma` из `/opt/ALETHEIA`: успешно, `migrate status` — «Database schema is up to date».
- `migrate diff --from-url file:/tmp/drift-copy.db --to-schema-datamodel …` — пусто («This is an empty migration»).
- Локально `migrate diff --from-migrations … --to-schema-datamodel …` — пусто.
- Число строк и контрольная сумма содержимого до/после (`sha256` по `select * order by rowid`) совпали:

| Таблица | Строк до / после | Хеш до / после |
|---|---|---|
| User | 18 / 18 | совпадает |
| Order | 57 / 57 | совпадает |
| Enrollment | 18 / 18 | совпадает |
| Lead | 16 / 16 | совпадает |
| BlogPost | 42 / 42 | совпадает |
| BrandProfile | 0 / 0 | совпадает |
| DomainMailbox | 5 / 5 | совпадает |
| LlmSetting | 2 / 2 | совпадает |
| PaykeeperRefundRecord | 0 / 0 | совпадает |

- `npx prisma validate` — ок. `npx tsc --noEmit` — exit 0.
- `npx vitest run --config vitest.db.config.ts` — 9 файлов, 73 теста, все прошли (миграция проходит на чистой SQLite).
- `npx vitest run` — 28 файлов, 376 тестов, все прошли.
- Prisma client в общем `node_modules` (симлинк на worktree vspomni-proekt) не перегенерировался: поле добавлено аддитивно и в коде не используется, тесты и tsc зелёные без регенерации. При желании `npx prisma generate` выполнить в основном окружении.

## Замечания и решения владельца

1. **Колонка `Lead.telegramChatId`**: сейчас сохранена и объявлена в схеме. Можно удалить через отдельную миграцию (`ALTER TABLE "Lead" DROP COLUMN "telegramChatId"`), данные уже продублированы в `telegramChatIdBig` (проверено на 2 строках, расхождений 0). Решение за владельцем.
2. **Четыре висячие ссылки в проде, существовавшие до миграции** (`pragma foreign_key_check` на копии, до и после одинаково): 1 строка `Notification`, 2 строки `NotificationLog`, 1 строка `PasswordToken` ссылаются на отсутствующих пользователей. Миграция их не трогает. Нужно решить, чистить ли их вручную.
3. Версия Prisma: в проекте 6.12.0 (`package.json`), в задаче указано 5.22 — проверено по факту, использовано 6.12.0.
4. Перед выкатом на прод применять миграцию штатным `prisma migrate deploy` (через деплой). Прод-БД не трогалась: вся проверка выполнялась на копии.

## Временные файлы

На сервере удалены: `/tmp/drift-copy.db`, `/tmp/drift-copy-pre.db`, `/tmp/drift-prisma/`, `/tmp/prod-schema.sql`. Боевая БД `/opt/ALETHEIA/prisma/dev.db` не изменялась.
