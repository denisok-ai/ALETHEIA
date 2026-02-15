# Развёртывание ALETHEIA на арендованном сервере

Инструкция: как выложить сайт на VPS (Linux) и открыть его по IP-адресу без домена (тестовый доступ).

---

## Что нужно

- Арендованный сервер (VPS) с Linux (Ubuntu/Debian) и доступ по SSH.
- IP-адрес сервера — по нему будет открываться сайт до покупки домена.

---

## Шаг 1. Собрать сайт

Проект на **Next.js**. Два варианта.

### Вариант A: Node-сервер на VPS (рекомендуется)

На компьютере только коммитим и пушим в GitHub. Сборка — на сервере:

```bash
cd ~/projects/ALETHEIA
npm install
npm run build
# Артефакт в .next/ — на сервер не копируем, собираем на сервере из Git
```

На сервере после `git pull` делают `npm install && npm run build && pm2 restart aletheia` (см. ниже).

### Вариант B: Статический экспорт (если настроен)

Если в `next.config.mjs` указано `output: 'export'`, то после `npm run build` появится папка **`out/`** (HTML, CSS, JS, изображения). Её можно отдавать через Nginx как статику (см. шаг 2–3).

---

## Шаг 2. Перенести сайт на сервер

### Вариант A: через SCP (статический экспорт, папка `out/`)

Если используете `output: 'export'` в Next.js:

```bash
cd ~/projects/ALETHEIA
npm run build
scp -r out/* root@IP_СЕРВЕРА:/var/www/aletheia/
```

Папку `/var/www/aletheia/` на сервере создайте заранее (шаг 3).

### Вариант B: через Git (сборка на сервере)

На сервере по SSH:

```bash
ssh root@IP_СЕРВЕРА

sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/ВАШ_ЛОГИН/ALETHEIA.git
cd ALETHEIA
sudo npm install
sudo npm run build
# Дальше — запуск через Node (pm2) или настройка Nginx на прокси к Next (шаг 3)
```

---

## Шаг 3. Установить Nginx и отдать папку с сайтом

Подключитесь к серверу по SSH и выполните команды по порядку.

### 3.1 Установка Nginx

```bash
sudo apt update
sudo apt install -y nginx
```

### 3.2 Папка с сайтом

- Если переносили через **SCP** (статический экспорт): папка `/var/www/aletheia/` с содержимым `out/` (index.html, _next/, images/ и т.д.).
- Если через **Git** и Node: Nginx проксирует запросы на Next.js (порт 3000), см. ниже.

Создайте папку (если используете SCP и ещё не создали):

```bash
sudo mkdir -p /var/www/aletheia
# После копирования с вашего ПК сюда должны лежать index.html, assets/, images/
```

### 3.3 Конфиг Nginx для теста по IP

Создайте конфиг:

```bash
sudo nano /etc/nginx/sites-available/aletheia
```

Вставьте (замените `ВАШ_IP` на реальный IP сервера или оставьте `_` — тогда будет слушать все адреса):

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    root /var/www/ALETHEIA/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff2)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

Если сайт лежит в `/var/www/aletheia/` (без подпапки dist), замените строку `root` на:

```nginx
root /var/www/aletheia;
```

Сохраните файл (в nano: Ctrl+O, Enter, Ctrl+X).

### 3.4 Включить сайт и перезапустить Nginx

```bash
sudo ln -sf /etc/nginx/sites-available/aletheia /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 3.5 Открыть порт 80 в файрволе

```bash
sudo ufw allow 80/tcp
sudo ufw status
sudo ufw enable
```

При запросе подтверждения нажмите `y`.

---

## Шаг 4. Тестовый адрес без домена

Домена пока нет — сайт открывается по **IP-адресу сервера**:

```
http://IP_СЕРВЕРА
```

Пример: если IP сервера `185.100.50.25`, в браузере вводите:

```
http://185.100.50.25
```

Это и есть бесплатный тестовый адрес: платить за домен не нужно, пока вы тестируете по IP.

---

## Удобный тестовый адрес с «именем» (опционально)

Если хочется адрес вида `aletheia.185.100.50.25.sslip.io` (читается проще, чем голый IP), можно использовать бесплатный сервис **sslip.io** (или **nip.io**):

- Подставьте свой IP вместо `IP`:
  - `http://IP.sslip.io` — открывает ваш сервер по IP.
  - `http://aletheia.IP.sslip.io` — тоже ведёт на тот же IP (Nginx отдаёт тот же сайт, т.к. `server_name _`).

Пример для IP `185.100.50.25`:

```
http://185.100.50.25.sslip.io
http://aletheia.185.100.50.25.sslip.io
```

Регистрация не нужна: sslip.io и nip.io по имени сразу отдают ваш IP.

---

## Проверка (тест)

1. На сервере: `curl -I http://127.0.0.1` — должен вернуться ответ с `200 OK` или `304`.
2. С вашего компьютера или телефона откройте в браузере: `http://IP_СЕРВЕРА`.
3. Должна открыться главная страница ALETHEIA; проверьте разделы и картинки.

---

## Когда появится домен

1. В панели регистратора домена укажите A-запись: ваш домен → IP сервера.
2. В конфиге Nginx замените `server_name _;` на `server_name yourdomain.ru www.yourdomain.ru;`.
3. Выполните: `sudo nginx -t && sudo systemctl reload nginx`.
4. (Опционально) Поставьте SSL (Let's Encrypt): `sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx -d yourdomain.ru -d www.yourdomain.ru`.

---

## Краткий чек-лист

- [ ] Локально: код в GitHub, на сервере — клонирован или обновлён через `git pull`.
- [ ] На сервере: `npm install && npm run build` (или скопирована папка `out/` при статике).
- [ ] Установлен Nginx (и при необходимости PM2 для Next.js), конфиг с `root` или proxy.
- [ ] Конфиг включён в `sites-enabled`, `nginx -t`, `systemctl reload nginx`.
- [ ] Порт 80 открыт в ufw.
- [ ] Сайт открывается по `http://IP_СЕРВЕРА`.

---

## Как обновить сборку на сервере

После правок в коде вы пушите в GitHub. Чтобы подтянуть изменения на сервер и пересобрать сайт:

### 1. Подключиться к серверу по SSH

```bash
ssh root@IP_СЕРВЕРА
# или ssh ubuntu@IP_СЕРВЕРА
```

### 2. Перейти в папку проекта и подтянуть код

```bash
cd /var/www/ALETHEIA
sudo git pull origin main
```

(Если ветка называется `master`, замените на `git pull origin master`.)

### 3. Установить зависимости (если изменился package.json) и собрать

```bash
sudo npm install
sudo npm run build
```

### 4. Перезапустить приложение

- **Если Next.js запущен через PM2:**

  ```bash
  sudo pm2 restart aletheia
  # или как назвали процесс: pm2 list
  ```

- **Если отдаёте статику из папки `out/`:** после `npm run build` новые файлы уже в `out/`, Nginx отдаёт их автоматически — перезапуск не нужен.

- **Если Next.js запущен через systemd:**  
  `sudo systemctl restart aletheia` (или как назван ваш сервис).

Готово. Проверьте сайт в браузере по IP или домену.
