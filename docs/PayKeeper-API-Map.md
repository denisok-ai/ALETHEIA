# Карта PayKeeper JSON API ↔ AVATERRA

Краткая схема для разработчиков. Полная документация: [JSON API PayKeeper](https://docs.paykeeper.ru/dokumentatsiya-json-api/).

## Авторизация

| Что | Как |
|-----|-----|
| Все запросы | `Authorization: Basic base64(login:password)` |
| POST с изменением данных | В теле `application/x-www-form-urlencoded` обязателен `token` (см. [токен безопасности](https://docs.paykeeper.ru/dokumentatsiya-json-api/token-bezopasnosti/)) |
| Ошибки протокола | JSON `{ "result": "fail", "msg": "..." }` при HTTP 200 |
| Ошибка входа | Часто HTML вместо JSON — клиент должен это распознавать |

## Поток оплаты в проекте

1. **Создание заказа** — `POST /api/payment/create` → запись `Order` (`pending`).
2. **Счёт** — `POST /change/invoice/preview/` → в ответе `invoice_id`, `invoice_url`, `invoice` (HTML). Пользователю отдаём **`invoice_url`** (не собирать URL вручную).
3. **Оплата** — браузер на стороне PayKeeper.
4. **Результат** — `POST /api/webhook/paykeeper` (POST-оповещение): подпись `md5(id + sum + clientid + orderid + secret)`, ответ `OK md5(id + secret)`.
5. **Сверка** — админка: `GET /info/payments/byid/`, `GET /info/payments/search/`, при необходимости `GET /info/payments/bydate/`.

## Таблица endpoint’ов (используемые в коде)

| Метод | Путь | Назначение в AVATERRA |
|-------|------|------------------------|
| GET | `/info/settings/token/` | Получение `token` для POST (кэш ~23 ч в приложении). |
| POST | `/change/invoice/preview/` | Создание счёта, `invoice_url`. |
| GET | `/info/payments/byid/?id=` | Сверка платежа по id PayKeeper. |
| GET | `/info/payments/search/?query=&beg_date=&end_date=` | Поиск платежа по подстроке (номер заказа и т.д.). |
| GET | `/info/payments/bydate/` | Реестр за период (массовая сверка). |
| POST | `/change/payment/repeatcnt/` | Сброс счётчика оповещений → повтор webhook. |
| POST | `/change/payment/reverse/` | Возврат (`id`, `amount`, `partial` true/false, `token`, опц. `refund_cart`). |
| GET | `/info/refunds/bypaymentid/?id=` | Статус возвратов по платежу. |
| GET | `/info/receipts/bypaymentid/?id=` | Чеки по платежу (если доступно на стороне PayKeeper). |
| POST | `/change/receipt/print/` | Печать/генерация чека (если включено в кабинете). |
| GET | `/info/systems/list/` | Диагностика: список платёжных систем. |
| GET | `/info/errors/total/` | Диагностика: счётчик ошибок (если метод доступен). |

## Статусы платежей (сверка)

Средства считаются поступившими при статусах в терминах PayKeeper: **`success`**, **`obtained`**, **`stuck`** (уточнять по актуальной доке «Платежи»).

## Счёт и 54-ФЗ

Поле `service_name` может быть **JSON-объектом** с полями `service_name`, `cart`, `receipt_properties`, `lang`, `user_result_callback` — см. раздел «Счета» в документации.

## SBP / QR

К URL счёта (из `invoice_url`) добавляются query-параметры: `pstype=sbp_default&returnFormat=json` — ответ JSON с данными QR (не смешивать с обычным редиректом на оплату без `returnFormat=json`).

## Webhook URL для кабинета PayKeeper

Указать публичный URL вида: `https://<ваш-домен>/api/webhook/paykeeper`.

## Ограничение среды

Если домен сервера из настроек **не резолвится** (DNS) из WSL/сервера — это сетевая проблема, не протокола. В админке раздел «Здоровье PayKeeper» показывает понятную диагностику.
