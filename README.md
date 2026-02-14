# ALETHEIA — Школа подсознания и мышечного тестирования

Одностраничный лендинг школы. Прототип: [aletheia--6eat7ck.gamma.site](https://aletheia--6eat7ck.gamma.site/).

## Как запустить

Нужен [Node.js](https://nodejs.org/) (LTS).

```bash
cd ALETHEIA
npm install
npm run dev
```

Откроется локальный сервер (обычно http://localhost:5173). Откройте этот адрес в браузере.

## Сборка для продакшена

```bash
npm run build
```

Готовый сайт будет в папке `dist/`. Её можно загрузить на любой статический хостинг (Vercel, Netlify, nginx и т.д.).

## Структура

- `index.html` — все секции страницы (Hero, история, услуги, мастер, партнёры, отзывы, FAQ, контакты, футер).
- `src/style.css` — стили (цвета и типографика по docs/Media.md).
- `src/main.js` — мобильное меню, поведение формы.
- `public/images/` — изображения (фото Татьяны Стрельцовой положить в `public/images/tatiana/` по инструкции в docs/Media.md).
- `docs/` — описание проекта, контент, задачи: Project.md, Content.md, Media.md, Tasktracker.md, Diary.md, qa.md.

## Форма заявки

Сейчас форма в блоке «Контакты» только имитирует отправку. Чтобы заявки реально приходили, нужно подключить сервис (например [Formspree](https://formspree.io/)) или свой backend — см. этап 3 в docs/Tasktracker.md.
