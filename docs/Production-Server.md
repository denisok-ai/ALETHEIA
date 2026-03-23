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

- Перезапуск приложения: `cd /opt/ALETHEIA && pm2 restart aletheia` (или имя из `pm2 list`)
- Логи: `pm2 logs aletheia`
- Статус NGINX: `sudo systemctl status nginx`
- Проверка конфига NGINX: `sudo nginx -t`
- **Полный деплой с Git** (миграции без сброса БД): `cd /opt/ALETHEIA && bash scripts/deploy-pull.sh`
- **Деплой + сброс БД и тестовый seed** (только для стенда, см. `docs/Deploy.md`):  
  `cd /opt/ALETHEIA && RESET_AND_SEED=1 bash scripts/deploy-pull.sh`

### Если в консоли ChunkLoadError / `GET /_next/static/chunks/... 400`

Обычно это **рассинхрон артефактов** после неполной сборки или **кеш nginx** со старыми ответами. Скрипт `deploy-pull.sh` перед сборкой удаляет каталог `.next` (чистая сборка).

Если проблема уже на проде — по SSH:

1. Очистить сборку и собрать заново, перезапустить приложение:
   ```bash
   cd /opt/ALETHEIA
   git pull origin main
   rm -rf .next
   npm ci
   npm run build:server
   sudo systemctl restart aletheia.service
   ```
   (или `pm2 restart aletheia`, если без systemd.)

2. **Сбросить proxy_cache nginx** (если в конфиге включён `proxy_cache` для прокси на Next): посмотреть путь в `sudo nginx -T | grep proxy_cache_path`, затем очистить этот каталог (например `sudo rm -rf /var/cache/nginx/next-static/*`) и выполнить `sudo nginx -s reload`.

3. Проверка: `curl -sI https://avaterra.pro/ | head -1`, затем из HTML взять путь к любому `/_next/static/chunks/*.js` и убедиться, что `curl -sI` на него даёт **200**.

Вход на сервер — по **SSH-ключу**; пароль root в открытом виде не хранить и не отправлять в мессенджеры.
