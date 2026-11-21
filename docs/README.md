# Документация AVATERRA

Указатель живых документов. Завершённые планы модулей, датированные аудиты, отчёты и разовые
передачи дел — в [archive/](archive/) (история, не руководство к действию).

## С чего начать

| Документ | Зачем |
|---|---|
| [Project.md](Project.md) | Что это за проект |
| [Spec.md](Spec.md) | Техническое задание v3.0 |
| [Development-Standards.md](Development-Standards.md) | Стандарты разработки: структура, проверки, коммиты |
| [Diary.md](Diary.md) | Дневник решений (новые записи сверху) |
| [Tasktracker.md](Tasktracker.md) | Трекер задач; [Backlog-Optional.md](Backlog-Optional.md) — опциональные идеи |
| [Plan-2026-Q4.md](Plan-2026-Q4.md) | Текущий план квартала |

## Разработка и окружение

| Документ | Зачем |
|---|---|
| [Local-Prisma.md](Local-Prisma.md) | Локальный запуск (Prisma + SQLite) |
| [Env-Config.md](Env-Config.md) | БД и переменные окружения |
| [manual-qa-checklist.md](manual-qa-checklist.md), [manual-testing-form.md](manual-testing-form.md) | Ручное тестирование |
| [qa.md](qa.md) | Вопросы по архитектуре и требованиям |
| [design-notes-typography.md](design-notes-typography.md) | Типографика |

## Прод и эксплуатация

| Документ | Зачем |
|---|---|
| [Deploy.md](Deploy.md) | Развёртывание (CI и rsync) |
| [Production-Server.md](Production-Server.md) | Прод-сервер: службы, пути, крон |
| [Server-Setup.md](Server-Setup.md), [Server-Debug.md](Server-Debug.md) | Первая настройка сервера, отладка сборки |
| [Support.md](Support.md) | Руководство по поддержке |
| [Personal-Data-RKN-Checklist.md](Personal-Data-RKN-Checklist.md) | ПДн, 152-ФЗ |

## Почта

[Mail-Current-State.md](Mail-Current-State.md) — текущее состояние ·
[Mail-Server.md](Mail-Server.md) — развёртывание Mailcow ·
[Mail-DNS-avaterra.pro.md](Mail-DNS-avaterra.pro.md) — DNS ·
[Mail-VPS-Audit-Checklist.md](Mail-VPS-Audit-Checklist.md) — чеклист VPS

## Платежи и модули

[PayKeeper-API-Map.md](PayKeeper-API-Map.md) — карта API PayKeeper ·
[Verification-Module.md](Verification-Module.md) — верификация заданий

## Контент, SEO и соцсети

| Документ | Зачем |
|---|---|
| [Content.md](Content.md), [Media.md](Media.md), [ImagePrompts.md](ImagePrompts.md) | Контент, медиа, генерация изображений |
| [SEO.md](SEO.md), [seo/](seo/) | SEO/GEO; плейбуки Google |
| [Plan-SEO-Social-2026-10.md](Plan-SEO-Social-2026-10.md), [External-Links-Plan.md](External-Links-Plan.md) | SEO-модуль, соцсети, внешние ссылки |
| [Telegram-Content-Knowledge-Base.md](Telegram-Content-Knowledge-Base.md) | База знаний Telegram-канала |
| [Dzen-Drafts.md](Dzen-Drafts.md), [VC-Drafts.md](VC-Drafts.md) | Черновики для площадок |
| [marketing/](marketing/), [research/](research/) | Маркетинг, исследования площадок и рынка |

## Прочие папки

`notes/`, `prompts/`, `superpowers/` — рабочие заметки и промпты; `Probujd/`, `scorm/` — материалы курсов
(SCORM-архивы в git не хранятся, только локально). Платный контент, ПДн и расшифровки — только в
`private/` (вне git, репозиторий публичный).
