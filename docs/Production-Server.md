# Состояние продуктивного сервера AVATERRA

Документ фиксирует текущую инфраструктуру продакшен-сервера для Cursor и разработки.

---

## Сервер

- **IP:** `95.181.224.70`
- **ОС:** Ubuntu
- **Домен:** https://avaterra.pro
- **Приложение:** Next.js (ALETHEIA), путь на сервере: `/opt/ALETHEIA`

### Быстрые команды (копирование)

```bash
# SSH на прод
ssh root@95.181.224.70

# Полный деплой на сервере (после git push): pull → install → prisma → build → restart → кеш nginx
cd /opt/ALETHEIA && sudo bash scripts/deploy-pull.sh

# Сброс локальных правок на сервере и выравнивание под origin/main (осторожно: теряются незакоммиченные правки в репо)
cd /opt/ALETHEIA && sudo git fetch origin && sudo git reset --hard origin/main && sudo git clean -fd && sudo bash scripts/deploy-pull.sh
```

**Деплой без git на сервере** (сборка у вас в **WSL на ПК**, не на VPS; на `95.181.224.70` только принимает rsync):

```bash
# Только на рабочей машине (DenisOk / WSL), не под root@95.181.224.70:
cd ~/projects/ALETHEIA
# при необходимости: export DEPLOY_SSH_IDENTITY="$HOME/.ssh/ваш_ключ"
npm run deploy:rsync
```

По умолчанию `deploy:rsync` использует `DEPLOY_SSH=root@95.181.224.70` и `DEPLOY_ROOT=/opt/ALETHEIA`. На сервере команда `npm run deploy:rsync` не сработает — это нормально.

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

## Один каталог сборки и одна точка запуска

Чтобы не крутилась **старая** админка при «успешном» деплое:

1. **Один рабочий каталог** с актуальным кодом и `.next` — по документу это **`/opt/ALETHEIA`**. Не параллельно поднимайте второй экземпляр из `/var/www/...` или старой копии: nginx всегда должен проксировать на **тот** процесс, чей `WorkingDirectory` совпадает с каталогом, где выполняли `npm run build`.
2. **systemd или PM2 — что-то одно** на порт `3000`. Если перешли на `aletheia.service`, отключите старый PM2-процесс (`pm2 delete aletheia`, `pm2 save`), чтобы не было двух Node с разными `cwd`.
3. Пример unit для systemd: **`scripts/systemd/aletheia.service.example`** — поля `WorkingDirectory` и `ExecStart` должны указывать на **тот же** `/opt/ALETHEIA`.
4. Версия на проде без гаданий по UI: **`curl -s https://avaterra.pro/api/health`** — поля `version` и `commit` (и заголовки `X-App-Version` / `X-Build-Commit`). В админке/менеджере версия также выводится **внизу бокового меню** после деплоя с актуальным `next build` (commit берётся из `git` при сборке или из `BUILD_COMMIT` / CI).

Деплой: **`bash scripts/deploy-pull.sh`** (на сервере) или CI с переменной **`VPS_DEPLOY`** и секретом **`VPS_SSH_PRIVATE_KEY`** (см. `.github/workflows/build.yml`).

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
