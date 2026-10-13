# План: SEO-модуль и соцсети по опыту Magic Master

Дата: 2026-10-12. Источник опыта: `~/projects/audio-mastering-web` (Magic Master, FastAPI/Python):
`backend/app/seo/` (коннекторы Метрики, Вебмастера, GSC, GA4, анализ, AI-агент, ~15 кронов) и
`backend/app/social/` (один материал → посты во все сети, планировщик, подписи, трекинг ссылок).
Связь с экспериментом «Тысяча» (практикум «Тело знает всё», ролики из курса) — см. docs/Diary.md 12.10.

## Принципы

- **Переносим логику и уроки, а не код.** Стек разный (Python → Next.js/TS, SQLite через Prisma). Код Magic Master — справочник, каждая задача ссылается на файл-образец.
- **Исполнитель задач — Haiku 5.5** (субагенты по карточкам ниже). Ревью диффа, `npx tsc --noEmit`, `npm run build`, тесты — до коммита, по CLAUDE.md. Одна карточка = один коммит.
- **Хост параметризуется с первого дня.** В Magic Master домен захардкожен в 6 местах (gsc.py L22/L37, gsc_domain.py L19, webmaster.py L52, router.py /recrawl, indexnow.py L18) — у нас `SITE_URL`/настройка, данные с колонкой `host`.
- **Секреты — только в `/opt/ALETHEIA/secrets/seo.env` (root, 600) или зашифрованно в SystemSetting** (`lib/encrypt`). В Magic Master токены Google и CrUX лежат открытым текстом в БД — не повторяем.
- **Кроны — только через `scripts/install-aletheia-http-cron.sh`** (он перезаписывает `/etc/cron.d/aletheia-http-cron` целиком). Урок MM: кроны в `/etc/cron.d`, не в crontab.
- **«Отправлено» пишем после подтверждения доставки.** Урок MM: дайджест 4 недели падал с Permission denied, а лог писал «отправлено».
- Контент-правила школы (`content/knowledge/avaterra.yaml`) и правило Татьяны «без „не“ в названиях и заголовках» действуют для всех генерируемых текстов.

## Что уже есть у AVATERRA

- SEO: `lib/seo/yandex-webmaster.ts` (`YANDEX_WEBMASTER_TOKEN` / `SEO_SECRETS_FILE`), `lib/indexnow.ts`, `lib/seo/sitemap-recrawl.ts`, `scripts/seo-audit-live.ts`, `scripts/indexnow-submit-all.ts`, sitemap/robots/llms.txt, JSON-LD, еженедельный SEO-цикл и дайджест. Метрика 108390990 на сайте.
- Нет: API Google Search Console, Метрики, GA4, CrUX; хранилища метрик по дням; анализа позиций/регрессий; доступа к GSC вообще (не передан с 30.08).
- Соцсети: только ссылки (`lib/social-links.ts`: Instagram, YouTube, Telegram-канал), импорт канала в блог (`lib/content/telegram-channel-import.ts`). SMM-бот @AvaterraBot (`DenisBot1/`) с сервера удалён 03.10. Автопубликации нет.

## Этап 0. Ключи и доступы (блокер)

Один Google OAuth-клиент + refresh-токен и один Яндекс-токен Magic Master подходят для любого сайта, на который у аккаунтов есть права. Переносим в SystemSetting AVATERRA (зашифрованно):

| Что | Ключи в MM (`system_settings`) | Для чего |
|---|---|---|
| Google OAuth | `seo_gsc_client_id`, `seo_gsc_client_secret`, `seo_gsc_refresh_token` | GSC + GA4 |
| Яндекс OAuth | `seo_metrika_oauth_token` (Fernet, ключ `MAGIC_MASTER_SETTINGS_SECRET`; приоритет у env `MAGIC_MASTER_METRIKA_TOKEN`) | Метрика + Вебмастер (scope `webmaster:read`, `webmaster:verify`) |
| CrUX | `seo_crux_api_key` | Core Web Vitals |

Предусловия (владелец):
1. Разрешить Claude чтение с сервера Magic Master `91.218.244.146` (правило в настройках Claude Code) — или выполнить перенос самому.
2. **Добавить avaterra.pro в Search Console того же Google-аккаунта**, лучше доменным ресурсом `sc-domain:avaterra.pro` (урок MM: префиксный ресурс терял 63 % кликов). Это и закрывает давний хвост «доступ к GSC».
3. Проверить, что у Яндекс-аккаунта MM есть доступ к счётчику 108390990 и к avaterra.pro в Вебмастере (иначе выдать гостевой доступ).
4. Проверить статус OAuth-приложения Google: в режиме Testing refresh-токен истекает через 7 дней.

**Статус 12.10 (вечер):** в MM (`/opt/magic-master/backend/magic_master.db`, таблица `system_settings`) заданы все ключи: `seo_gsc_client_id/secret/refresh_token`, `seo_metrika_client_id/secret/oauth_token`, `seo_crux_api_key` (+ `seo_ga4_property` — это свойство MM, не наше). Владелец: avaterra.pro уже в GSC этого Google-аккаунта; Яндекс-аккаунт имеет доступ к Метрике и Вебмастеру avaterra. Перенос — `scripts/seo-import-mm-keys.sh` (запускает владелец: Claude-классификатор блокирует операции со значениями ключей): MM → `/opt/ALETHEIA/secrets/seo.env` (бэкап, 600), имена `GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN`, `YANDEX_OAUTH_CLIENT_ID/SECRET/TOKEN`, `CRUX_API_KEY`; значения не печатаются. Группы ВКонтакте у школы нет — создаём вместе с владельцем (13.10).

**T0.1 (Haiku):** общий загрузчик `lib/seo/secrets.ts` — читает ключи из `SEO_SECRETS_FILE` (`/opt/ALETHEIA/secrets/seo.env`, как уже делает `yandex-webmaster.ts`), env — запасной путь; `yandex-webmaster.ts` переводится на него (YANDEX_OAUTH_TOKEN как запасной к YANDEX_WEBMASTER_TOKEN). Индикаторы «задан/не задан» в Портал → Настройки (`SettingsEnvIndicators.tsx`). Значения никогда не логируются и не отдаются в API.

## Этап 1. Сбор данных SEO

| # | Задача (Haiku) | Образец MM | Готово, когда |
|---|---|---|---|
| T1.1 | Prisma-модель `SeoMetric` (host, source, date, dimension, key, value) + миграция | `seo/store.py` | миграция применяется, запись/чтение покрыты тестом |
| T1.2 | Google OAuth: обмен refresh → access, кэш, три состояния (`not_configured`/`error`/`ok`) | `connectors/gsc.py` L51-145, `metrika.py` L114-130 | юнит-тест на истёкший токен |
| T1.3 | Коннектор GSC: Search Analytics (запросы, страницы, позиции), Sitemaps (только чтение и отправка), доменный ресурс | `gsc.py` L155-210, L404; `gsc_domain.py` | ночной синк пишет в SeoMetric |
| T1.4 | Коннектор Метрики: визиты, источники, цели | `connectors/metrika.py` L164-177 | синк за вчера, цели видны |
| T1.5 | Вебмастер: дополнить наш модуль индексацией по дням и запросами | `connectors/webmaster.py` L167, L302 | данные в SeoMetric |
| T1.6 | CrUX раз в неделю | `scripts/seo_cwv_tracker.py` | LCP/INP/CLS по главной и практикуму |
| T1.7 | Крон `/api/cron/seo-sync` 03:30 MSK через установщик | `deploy/cron/magic-master-seo-sync` | запись в установщике, проверка на проде |

## Этап 2. Анализ и дайджест

| # | Задача (Haiku) | Образец MM |
|---|---|---|
| T2.1 | Позиции по корзинам, регрессии, CTR-выбросы (показы без кликов) | `analysis.py` L280, L470, L754 |
| T2.2 | «Шахтёр возможностей»: запросы с показами на позициях 6–20 → темы недели (заменяет ручной цикл «Вебмастер → тема») | `scripts/seo_opportunity_miner.py` |
| T2.3 | Недельный дайджест в Telegram владельцу: источники, позиции, регрессии, продажи по каналам; «отправлено» только после `ok:true` | `seo/ai_agent.py` weekly_digest L450, `deploy/seo_weekly_digest.sh` |
| T2.4 | Сторож: падение индексации/кликов, ошибки sitemap — алерт | `scripts/seo_watchdog.py`, `seo_tech_watchdog.py` |
| T2.5 | Страница «SEO» в портале: сводка, запросы, страницы, кнопка переобхода | `frontend/admin.html` L2299-2337 |

Правила решений из `docs/seo/decision-rules.md` MM переносим в `docs/seo-decision-rules.md`: одну страницу в кластере не измерить; цифры разных инструментов не смешивать; не тратить квоту переобхода на уже проиндексированное; не трогать title страниц, которые уже приносят клики.

## Этап 3. Соцсети: «один материал → все площадки»

Ядро MM общее и переносится почти без изменений; аудио-специфика (brand.py, хештеги, /lufs-checker) отбрасывается.

| # | Задача (Haiku) | Образец MM |
|---|---|---|
| T3.1 | Prisma: `SocialNetwork`, `SocialItem` (ролик/новость/статья), `SocialPost` (уникально item+network, статусы), `SocialRule` (время, шаблон подписи, хештеги, пауза), `SocialLinkEvent` | `social/models.py` |
| T3.2 | Подписи по сетям из шаблона + проверка правил школы (запрещённые слова, без «не» в заголовке, дисклеймер «мы не лечим» где нужен) | `captions.py` L71, L102 |
| T3.3 | Трекинг: ссылка `?ref=<сеть>-<NN>` → cookie → источник в Lead и Order. Без этого не посчитать окупаемость рекламы в эксперименте | `captions.tracked_url`, `brand.py` L74 |
| T3.4 | Планировщик: раз в минуту, одна публикация в сеть в день, стоп после 2 ошибок подряд, сеть без доступа → «готовый пост» владельцу в Telegram | `scheduler.py` L32-33, L303-343 |
| T3.5 | Коннектор Telegram-канал школы: sendVideo/sendPhoto/sendMessage через наш прокси; лимит загрузки 50 МБ | `connectors/telegram.py` |
| T3.6 | Готовые посты для площадок без API: YouTube Shorts, Rutube, Дзен, VK (до получения прав), Instagram — текст + файл + ссылка владельцу | `connectors/info.py` |
| T3.7 | Проверка видео ffprobe: профили 9:16 (клипы) и 16:9, размер, длительность | `social/video_check.py` |
| T3.8 | Страница «Соцсети» в портале: материалы, очередь, статусы, «Опубликовать сейчас», «Пауза всех» | дизайн `docs/echoteka/social-autopublish/` |
| T3.9 | VK: истории сообщества; стена и видео — после письма в devsupport (права выдают вручную) | `connectors/vk.py` L118-132 |

Грабли MM: права VK на стену и видео выдают письмом и не всем; приложение VK ID блокируется через 60 дней без бизнес-профиля; Rutube публичного API нет (соглашение запрещает автоматизацию) — только готовый пост; Дзен переносит из Telegram-канала ролики до 20 МБ и без ERID; YouTube из непроверенного API-проекта загружает приватно. Instagram (Meta): реклама в РФ запрещена, автопубликация требует приложения Meta и App Review — отложено.

## Этап 4. Ролики из курса (эксперимент «Тысяча»)

| # | Задача (Haiku) |
|---|---|
| T4.1 | Расшифровка 12 видео курса (≈70 мин, `public/uploads/scorm/courses-course-avaterra-praktik/v3/templates/`) с таймкодами |
| T4.2 | Список фрагментов 30–60 с: законченная мысль или момент теста, без пошаговых протоколов платных модулей; ручной отбор владельцем |
| T4.3 | Нарезка ffmpeg + субтитры + заставка; вертикальные (3 файла) — первыми |
| T4.4 | Ролики → `SocialItem` → публикация по T3.4; на сайте — разметка VideoObject на страницах глоссария и практикума |

## Этап 5. Связка SEO ↔ соцсети

Замкнутый цикл: T2.2 находит запрос с показами → статья/термин глоссария → ролик по теме → посты с `?ref=` → дайджест T2.3 показывает показы, клики, переходы из сетей и продажи по источникам. Образец идеи: `docs/prompts/social-seo-factory-prompt-2026-10-12.md` MM (там это план, не код).

## Порядок работ

1. Этап 0 (ключи) — как только владелец даст доступ.
2. T3.1–T3.6 + T3.3 (трекинг) — нужны эксперименту с первой недели: ролики и учёт источников продаж.
3. T4.1–T4.3 — параллельно, от ключей не зависят.
4. Этап 1 → этап 2.
5. T3.8–T3.9, этап 5.

Параллельно, вне этого плана: ЮKassa и тексты сайта под практикум (без онлайн-оплаты эксперимент не стартует).
