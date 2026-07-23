# SEO и GEO / AEO — AVATERRA (avaterra.pro)

**Дата:** 2026-07-22  
**Цель:** сделать сайт находимым и цитируемым в Google, Яндекс и ИИ-ответах (Perplexity, ChatGPT Search, Gemini и др.).  
**Реализм:** топ-1 «завтра» невозможен без внешних ссылок, времени в индексе и ручной верификации в вебмастерах. Здесь — максимум технической + контентной базы.

---

## 1. Почему прошлые SEO-работы дали ~0 видимости (факты)

| Проблема | Доказательство | Влияние |
|----------|----------------|---------|
| **Sitemap указывал на localhost** | В `app/robots.txt/route.ts` зафиксировано: на прод уехал `Sitemap: http://localhost:3000/sitemap.xml` (сборка без `force-dynamic`). По логам Google **не запросил** карту сайта ~2 недели. | Поисковики не получали карту URL — индексация шла «вслепую» и медленно. |
| **Только мета-теги** | Ранние коммиты (Diary 2025-03): title/description + минимальный sitemap с login/register. | Метаданные без индексации, контента и внешних сигналов не дают трафика. |
| **Нет подтверждения Google Search Console** | Live HTML главной: есть `yandex-verification`, **нет** `google-site-verification` (env `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` пуст). | Нельзя надёжно отправить sitemap, смотреть покрытие и ошибки Google. |
| **Внешние сигналы** | Сайт молодой/узкий; без цитирований на отраслевых площадках, каталогах, соцсетях LLM редко рекомендуют бренд. | GEO/AEO опирается на упоминания в открытом вебе, не только на свой HTML. |
| **Нестабильность sitemap** | Внешний fetch иногда получал HTTP 500 на `/sitemap.xml` (браузерный fetch — 200). | Краулеры при 500 откладывают обход. |

**Вывод:** провал был не «из-за недостатка keywords», а из-за **сломанной/неполной индексации + отсутствия вебмастер-контуров + слабых внешних сигналов**. К июлю 2026 технический слой на проде уже сильный (robots, JSON-LD, llms.txt, SSR) — его нужно **не ломать**, укрепить и **подключить руками** в GSC/Вебмастере.

---

## 2. Исследование 2025–2026 (кратко)

### Google (Search + AI Overviews / AI Mode)
- Оптимизация под generative AI features — **это всё ещё SEO** (официальный гайд Google, 2026): индекс, сниппет-eligible контент, полезность, E-E-A-T.
- Google явно говорит: **не полагаться** на `llms.txt`, «особый» schema только для AI, chunking и AI-rewrites как на отдельные рычаги.
- Нужны: crawlability, indexability, уникальный опыт/данные, ясная структура (H1/H2, FAQ), нормальный page experience.

### Яндекс (RU)
- Обязательны: **Яндекс Вебмастер**, sitemap, регион сайта (или «Россия» для онлайн-школы), корректный `robots.txt`, schema.org.
- Полезно: **Яндекс Бизнес** (если есть юр./контактные данные), IndexNow (уже в проекте — `lib/indexnow.ts`), Clean-param (уже в robots для UTM).
- Турбо-страницы для учебного лендинга не приоритет; важнее региональность и качество сниппета.

### Perplexity / ChatGPT / Gemini / Claude (GEO / AEO)
- Кутируют страницы с **чётким определением сущности**, фактами, FAQ, авторитетным about, цитируемыми формулировками в первых абзацах.
- Технически: разрешить ботов (GPTBot, OAI-SearchBot, PerplexityBot…) в robots — **сделано**.
- `llms.txt` / `llms-full.txt` — полезный манифест для агентов; **не замена** HTML и индекса.
- Внешние упоминания (статьи, каталоги, интервью, соцсети) критичны для рекомендаций.

---

## 3. Что реализовано в коде (текущее состояние)

| Компонент | Где |
|-----------|-----|
| `robots.txt` (dynamic, AI bots, Yandex Clean-param, ссылки на llms) | `app/robots.txt/route.ts` |
| `sitemap.xml` (force-dynamic, безопасные даты, fallback без 500, `/news`) | `app/sitemap.ts` |
| Metadata (title/description/OG/Twitter), `lang=ru` | `app/layout.tsx`, `lib/seo/*`, публичные `page.tsx` |
| Canonical **только на страницах** (не в корневом layout) | публичные `generateMetadata` |
| JSON-LD: Organization, WebSite, Course, FAQ, Product, Person, Blog… | `components/JsonLd*.tsx` |
| `llms.txt` / `llms-full.txt` | `app/llms.txt/route.ts`, `app/llms-full.txt/route.ts` |
| Entity-тексты (определение школы) | `lib/seo/entity.ts`, `/about`, блок «О школе» на главной |
| IndexNow | `lib/indexnow.ts` |
| Yandex verification meta | `NEXT_PUBLIC_YANDEX_VERIFICATION` / default в layout |

---

## 4. Чеклист проверки после деплоя

```bash
curl -sS https://avaterra.pro/robots.txt | head -40
# Ожидание: Allow /, Disallow /portal /api /auth, Sitemap: https://avaterra.pro/sitemap.xml
# НЕ должно быть localhost

curl -sS -o /dev/null -w "%{http_code}\n" https://avaterra.pro/sitemap.xml
# Ожидание: 200

curl -sS https://avaterra.pro/llms.txt | head -20
curl -sS https://avaterra.pro/ | tr '\n' ' ' | grep -oE '<title>[^<]+|canonical" href="[^"]+|application/ld\+json|yandex-verification|noindex' | head -40
```

Ручная проверка:
1. Просмотр исходного HTML главной и `/course/navyki-myshechnogo-testirovaniya` — title, description, JSON-LD, **нет** noindex.
2. [Google Rich Results Test](https://search.google.com/test/rich-results) — Organization / Course / FAQ.
3. [Яндекс.Вебмастер → Индексирование → Файлы Sitemap](https://webmaster.yandex.ru/).

---

## 5. Ручные шаги владельца (обязательны для роста)

### Google Search Console
1. Добавить ресурс `https://avaterra.pro`.
2. Подтвердить владение (HTML-тег → положить код в env `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` на VPS → редеплой, **или** DNS TXT).
3. Отправить sitemap: `https://avaterra.pro/sitemap.xml`.
4. Запросить индексирование ключевых URL: `/`, `/course/navyki-myshechnogo-testirovaniya`, `/about`, `/services`, 3–5 сильных статей блога.
5. Следить за «Страницы» / покрытие 4–8 недель.

### Яндекс Вебмастер
1. Добавить сайт (если ещё не добавлен) — meta `yandex-verification` уже на сайте.
2. Указать sitemap.
3. Регион: **Россия** (онлайн-школа) или город юр. адреса — согласовать с контактами на сайте.
4. При наличии организации — карточка в **Яндекс Бизнес**.

### Внешние сигналы (GEO)
- Единый NAP/описание школы на 2ГИС / Яндекс Бизнес / соцсетях (как в `sameAs` JSON-LD).
- 3–5 экспертных материалов вне сайта (гостевые посты, подкасты, каталоги школ/курсов).
- Не покупать «пакеты упоминаний» — Google прямо предупреждает о неаутентичных mentions.

### Контент
- Усилить 5–10 статей блога под реальные запросы («что такое мышечное тестирование», «обучение кинезиологии онлайн») — без набивки.
- Избегать массовой публикации тонких «авто-slug» заметок без уникальной пользы — вредят E-E-A-T.

---

## 6. Метрики успеха (90 дней)

| Метрика | Ориентир |
|---------|----------|
| URL в индексе Google/Яндекс | Рост с единиц до десятков (sitemap ~40+ URL) |
| Показы по бренду «авaterra / мышечное тестирование стрельцова» | Появление в GSC/Вебмастере |
| Цитирование в ИИ | Ручной прогон 10 промптов раз в месяц (ChatGPT/Perplexity/Нейро) |
| Органический трафик | Рост с ~0; коммерческий топ — месяцы, не дни |

---

## Связанные документы

- [Support.md](Support.md) — где лежат robots/sitemap/llms  
- [Diary.md](Diary.md) — история инцидентов (localhost sitemap)  
- [Content.md](Content.md) — тексты  
- [Production-Server.md](Production-Server.md) — деплой  
