# Первая настройка AVATERRA на сервере

Если папки `/var/www/AVATERRA` ещё нет — выполните эти шаги **один раз** на сервере по SSH.

---

## Шаг 1. Установить Git и Node.js (если ещё нет)

```bash
sudo apt update
sudo apt install -y git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

---

## Шаг 2. Клонировать проект и собрать

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/denisok-ai/AVATERRA.git
cd AVATERRA
sudo npm install
sudo npm run build:server
```

Если при сборке появляется **JavaScript heap out of memory**, на сервере мало RAM. Используйте скрипт `build:server` (он увеличивает лимит памяти Node до 1.5 ГБ). Если памяти всё равно не хватает — добавьте swap (см. ниже) или соберите проект локально и залейте на сервер папку `.next`.

После этого в `/var/www/AVATERRA` будет проект, собранный в `.next/`.

---

## Шаг 3. Запустить приложение через PM2

Next.js нужно запускать как процесс (команда `npm run start`). Удобно держать его через PM2:

```bash
sudo npm install -g pm2
cd /var/www/AVATERRA
sudo pm2 start npm --name "avaterra" -- start
sudo pm2 save
sudo pm2 startup
```

Сайт будет работать на порту **3000** внутри сервера (http://127.0.0.1:3000).

---

## Шаг 4. Установить Nginx (если ещё не установлен)

```bash
sudo apt update
sudo apt install -y nginx
```

Проверьте: `nginx -v` и `ls /etc/nginx/sites-enabled/`.

## Шаг 5. Настроить Nginx как прокси на порт 3000

Создайте конфиг:

```bash
sudo nano /etc/nginx/sites-available/avaterra
```

Вставьте (Nginx будет проксировать запросы на Next.js):

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Сохраните (Ctrl+O, Enter, Ctrl+X).

Включите сайт и перезапустите Nginx:

```bash
sudo ln -sf /etc/nginx/sites-available/avaterra /etc/nginx/sites-enabled/avaterra
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## Шаг 6. Открыть порт 80 (если включён firewall)

```bash
sudo ufw allow 80/tcp
sudo ufw status
sudo ufw enable
```

---

## Если 502 Bad Gateway

Nginx работает, но приложение на порту 3000 не запущено. Выполните на сервере:

```bash
cd /var/www/AVATERRA
sudo pm2 list
```

Если процесса `avaterra` нет или статус не **online**:

```bash
cd /var/www/AVATERRA
sudo pm2 start npm --name "avaterra" -- start
sudo pm2 save
```

Проверьте логи при ошибках: `sudo pm2 logs avaterra`. Убедитесь, что сборка есть: `ls .next` (должна быть папка). Если нет — выполните `sudo npm run build`, затем снова `sudo pm2 restart avaterra`.

---

## Проверка

Откройте в браузере: **http://IP_ВАШЕГО_СЕРВЕРА** (например http://p941004 или ваш реальный IP).

---

## Не хватает памяти при сборке (heap out of memory)

На сервере с небольшим объёмом RAM сборка может падать с **JavaScript heap out of memory**. Варианты:

**1. Сборка с увеличенным лимитом памяти (в проекте есть скрипт):**

```bash
cd /var/www/AVATERRA
sudo npm run build:server
```

(Используется `NODE_OPTIONS=--max-old-space-size=1536` — 1.5 ГБ под кучу Node.)

**2. Добавить swap на сервере (1–2 ГБ), затем снова сборка:**

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
cd /var/www/AVATERRA
sudo npm run build:server
```

**3. Собрать локально (на своём ПК) и залить на сервер только результат:**

На своём компьютере: `npm run build`. Затем скопировать папку `.next` и `public` на сервер в `/var/www/AVATERRA/`, после чего на сервере только `pm2 restart avaterra` (без `npm run build`).

---

## Дальше: как обновлять после изменений

Когда пушите новый код в GitHub, на сервере достаточно:

```bash
cd /var/www/AVATERRA
sudo git pull origin main
sudo npm install
sudo npm run build:server
sudo pm2 restart avaterra
```

См. также **Deploy.md** (раздел «Как обновить сборку на сервере»).
