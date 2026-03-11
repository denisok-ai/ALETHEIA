# Состояние продуктивного сервера AVATERRA

Документ фиксирует текущую инфраструктуру продакшен-сервера для Cursor и разработки.

---

## Сервер

- **IP:** `95.181.224.70`
- **ОС:** Ubuntu
- **Домен:** https://avaterra.pro
- **Приложение:** Next.js (ALETHEIA), путь на сервере: `/opt/ALETHEIA`

---

## Выполненные изменения инфраструктуры

### 1. Установка корневого сертификата

- На сервер добавлен корневой сертификат **GlobalSign** (`root_pem_globalsign_ssl_dv_free_1.pem`).
- Сертификат установлен в системное хранилище Ubuntu:
  - Файл скопирован в `/usr/local/share/ca-certificates/`.
  - Выполнена команда `update-ca-certificates`, создан симлинк в `/etc/ssl/certs/`.
- Системные утилиты и Node.js (приложение в `/opt/ALETHEIA`) доверяют цепочке GlobalSign.

### 2. NGINX как reverse proxy для Next.js

- Установлен и включён **nginx**.
- Приложение Next.js (проект ALETHEIA) запущено под **PM2** на `127.0.0.1:3000`.
- Настроен виртуальный хост **avaterra.pro**:
  - **HTTP** (порт 80) → редирект на HTTPS.
  - **HTTPS** (порт 443) → прокси на `http://127.0.0.1:3000`.
- Конфиг: `/etc/nginx/sites-available/aletheia`  
  Симлинк: `/etc/nginx/sites-enabled/aletheia`.

### 3. SSL-сертификат для avaterra.pro

- Используется **Let's Encrypt**, установка через:
  ```bash
  certbot --nginx -d avaterra.pro -d www.avaterra.pro
  ```
- Сертификаты:
  - `ssl_certificate /etc/letsencrypt/live/avaterra.pro/fullchain.pem;`
  - `ssl_certificate_key /etc/letsencrypt/live/avaterra.pro/privkey.pem;`
- **Certbot** настроил автоматическое продление сертификата.

### 4. Базовая оптимизация и защита

- NGINX:
  - reverse proxy на Next.js;
  - редиректы HTTP → HTTPS.
- Дополнительно:
  - настройки для работы под нагрузкой (proxy buffering);
  - **limit_req** для защиты от простых DDoS/флуд-атак;
  - кэширование статики `.next/static` через **proxy_cache**.

---

## Итоговая схема

```
Пользователь
    → https://avaterra.pro:443 (NGINX + Let's Encrypt)
    → http://127.0.0.1:3000 (Next.js под PM2)
```

Система и приложение доверяют сертификатам GlobalSign через системное CA-хранилище.

---

## Полезные команды на сервере

- Перезапуск приложения: `cd /opt/ALETHEIA && pm2 restart <name>`
- Логи: `pm2 logs <name>`
- Статус NGINX: `sudo systemctl status nginx`
- Проверка конфига NGINX: `sudo nginx -t`
- Обновление кода и пересборка: `git pull`, `npm install`, `npm run build`, `pm2 restart <name>`
