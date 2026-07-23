# DNS для домена avaterra.pro (почта)

Значения **примерные** — подставьте ваш хост почтового стека после деплоя (например `mail.avaterra.pro`).

## Обязательные записи

| Тип | Имя | Значение | Комментарий |
|-----|-----|----------|-------------|
| A | `mail` | `<IP_VPS>` | Хост, где работает Mailcow/MX (часто тот же IP, что и сайт, если один VPS). |
| MX | `@` (корень) | `mail.avaterra.pro.` приоритет `10` | Куда мир доставляет почту для `@avaterra.pro`. |

## SPF (TXT)

Один TXT на `@`:

```
v=spf1 mx a ip4:95.181.224.70 ~all
```

Уточните синтаксис под ваш стек: если отправка только с MX-хоста, часто достаточно `v=spf1 mx ~all`. После смены IP обновите запись.

## DKIM

Селектор Mailcow (прод, 2026-07-23): **`dkim`**. TXT-имя: `dkim._domainkey`.

Значение из Mailcow API (одна строка; не перегенерировать без обновления DNS):

```
v=DKIM1;k=rsa;t=s;s=email;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtm5XC70DOPuIT/HcAQ1Ppq/OjsMmzQDgaPJ+HwClJBcpdO+3W5q/A5QPbag/R2+LhGhFObFldhSsItcYrWl8XeIBLWBCpJ2mYJCTPUhRr1avUeXvYGetqLi34tig8TtjMd7gY+XS+I+k++4ar/PJrsXwU/9//cpD3aGHglDzwlfrRHidwUxeJQBCPiSczrM+sVDE3aNuF45oey3Ha0qi4Lj+ABqkuLvHB/U1RcLPAShxECojkDN8yjehpfmAoXNOWpBRJXSqX7pRSySBSGh7/oVR5o2VoIBp6exkeyQhi8NSpDcZzBKhY8m/3J4Ggt9u3QvL0eUpapS8jLQIDAQAB
```

В nic.ru DNS-premium имя записи обычно: `dkim._domainkey` (зона `avaterra.pro`). Сверьте `p=` с тем, что уже внесли — если совпадает с префиксом выше, перегенерировать ключ **не нужно**.

## DMARC (TXT)

На `_dmarc.avaterra.pro`:

```
v=DMARC1; p=none; rua=mailto:dmarc@avaterra.pro
```

Начните с `p=none`, проанализируйте отчёты, затем усильте до `quarantine` / `reject`.

На проде (2026-07-23) создан alias **`dmarc@avaterra.pro` → `admin@avaterra.pro`**, чтобы RUA-отчёты принимались.

## Дополнительно

| Запись | Назначение |
|--------|------------|
| PTR/rDNS | У провайдера VPS для IP → имя HELO (часто `mail.avaterra.pro`). См. [Mail-VPS-Audit-Checklist.md](Mail-VPS-Audit-Checklist.md). |

## Статус публикации (2026-07-23)

| Запись | В DNS? |
|--------|--------|
| A `mail` → `95.181.224.70` | да |
| PTR `95.181.224.70` → `mail.avaterra.pro` | да (IHC) |
| MX / SPF / DKIM / DMARC | ещё нет на auth NS nic.ru — внести в DNS-premium |

Актуальный чеклист также в [Mail-Current-State.md](Mail-Current-State.md#dns--mailcow-checklist-2026-07-23).

## Взаимодействие с сайтом

Запись **A** для корня `@` или `www` может указывать на тот же IP, что и веб-сайт — это нормально: разные сервисы слушают разные порты и виртуальные хосты (nginx vs postfix).
