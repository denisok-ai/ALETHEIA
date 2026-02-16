# AVATERRA — Phygital школа мышечного тестирования

Современный лендинг на Next.js 14 с 3D-эффектами, анимациями и интеграцией PayKeeper.  
Домен: [avaterra.pro](https://avaterra.pro).

## Стек

- **Next.js 14** (App Router), TypeScript
- **Tailwind CSS**, Framer Motion, React Three Fiber (3D-частицы в Hero)
- **PayKeeper** — приём платежей
- **Supabase** — заказы и заявки (опционально)
- Деплой: **Vercel** или статический экспорт

## Как запустить

Требуется [Node.js](https://nodejs.org/) 18+.

### Проект в WSL (Ubuntu) — терминал в Cursor/Windows

В PowerShell **npm не сработает** (Node стоит в Linux). Запускайте команды **внутри WSL** одной строкой:

```powershell
wsl -e bash -c "cd /home/denisok/projects/AVATERRA && npm install && npm run dev"
```

Либо откройте **терминал WSL** (в Cursor: выберите в выпадающем списке терминала «Ubuntu» / «WSL» или команду **Terminal: Create New Terminal** и выберите WSL), затем:

```bash
cd /home/denisok/projects/AVATERRA
npm install
npm run dev
```

### Обычный запуск (если уже в bash/WSL)

```bash
cd /home/denisok/projects/AVATERRA
npm install
npm run dev
```

Откройте в браузере: **http://localhost:3000**.

## Сборка для продакшена

```bash
npm run build
npm run start
```

Или загрузите проект на Vercel — сборка настроена автоматически.

## Переменные окружения

Скопируйте `.env.example` в `.env.local` и заполните:

- **PayKeeper:** `PAYKEEPER_SERVER`, `PAYKEEPER_LOGIN`, `PAYKEEPER_PASSWORD`, `PAYKEEPER_SECRET` — для приёма оплаты.
- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — для хранения заказов и заявок (таблицы `orders`, `leads`). Без Supabase форма заявки и кнопка «Купить» всё равно работают; данные просто не сохраняются в БД.
- **App:** `NEXT_PUBLIC_URL` — полный URL сайта (для писем и ссылок).

## Структура проекта

- `app/` — страницы (layout, главная, success, oferta, privacy) и API (payment, webhook, contact).
- `components/sections/` — Hero, About, Program, Author, Testimonials, Pricing, FAQ, Contact, Header, Footer.
- `components/ui/` — кнопки, поля ввода, диалоги.
- `components/3d/` — 3D-фон с частицами в Hero.
- `lib/` — paykeeper, supabase, utils.
- `public/images/` — изображения: `tatiana/`, `thematic/`, `hero/`, `author/`, `icons/`, `pricing/`, `decor/`, `success/`. Промпты для генерации (Midjourney/DALL·E/SD) — **docs/ImagePrompts.md**; см. также docs/Media.md.
- `docs/` — Project.md, Content.md, Media.md, **ImagePrompts.md**, Tasktracker.md, Diary.md, qa.md.

## Платежи (PayKeeper)

1. Настройте учётную запись PayKeeper и получите доступ к API.
2. В личном кабинете PayKeeper укажите URL webhook: `https://ваш-домен/api/webhook/paykeeper`.
3. После оплаты пользователь может быть перенаправлен на `/success` (настраивается в PayKeeper).

## GitHub и обновление на сервере

### Выложить проект на GitHub

**Важно:** в PowerShell команда `git` не найдена — Git стоит в WSL. Выполняйте команды **внутри WSL**.

1. Создайте репозиторий на [github.com](https://github.com/new) (имя например `AVATERRA`), без README и .gitignore.
2. **Из PowerShell** одной строкой (подставьте свой логин вместо `denisok-ai`):

```powershell
wsl -e bash -c "cd /home/denisok/projects/AVATERRA && git init && git add . && git commit -m 'Initial commit: AVATERRA landing' && git branch -M main && git remote add origin https://github.com/denisok-ai/AVATERRA.git && git push -u origin main"
```

3. **Либо откройте терминал WSL** (в Cursor: выберите в списке терминалов «Ubuntu» / «WSL») и выполните по шагам:

```bash
cd /home/denisok/projects/AVATERRA
git init
git add .
git commit -m "Initial commit: AVATERRA landing"
git branch -M main
git remote add origin https://github.com/denisok-ai/AVATERRA.git
git push -u origin main
```

При первом `git push` WSL может запросить логин/пароль GitHub; можно использовать [Personal Access Token](https://github.com/settings/tokens) вместо пароля.

### Обновить сборку на сервере после изменений

1. Локально: правки закоммичены и запушены в GitHub (`git add .`, `git commit -m "..."`, `git push`).
2. На сервере по SSH:

```bash
cd /var/www/AVATERRA
sudo git pull origin main
sudo npm install
sudo npm run build
sudo pm2 restart avaterra
```

Подробнее — **docs/Deploy.md** (раздел «Как обновить сборку на сервере»).

## Ребрендинг Aletheia → AVATERRA

Все упоминания бренда в коде и документации заменены на AVATERRA. Если нужно переименовать **корневую папку проекта** с `ALETHEIA` на `AVATERRA`, сделайте это вручную в файловом менеджере или в WSL: `mv /home/denisok/projects/ALETHEIA /home/denisok/projects/AVATERRA` (затем откройте проект из новой папки в Cursor).

## Документация

Подробнее об архитектуре, этапах и контенте — в папке `docs/` (Project.md, Content.md, Media.md, **Deploy.md**).
