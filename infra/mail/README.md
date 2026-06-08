# infra/mail — памятка для оператора

Официальная установка **Mailcow** выполняется клонированием репозитория на сервер — см. [docs/Mail-Server.md](../../docs/Mail-Server.md).

Этот каталог содержит вспомогательные файлы:

- `check-mail-ports.sh` — проверка TCP-портов почты на указанном хосте.
- `mailcow-brand/` — CSS и логотипы для веб-UI Mailcow (`0081-custom-mailcow.css`, PNG как на сайте `public/images/LOGO.png` при выкладке, запасной `avaterra-login-logo.svg`); на сервер — `npm run mailcow:apply-branding` (см. [docs/Mail-Server.md](../../docs/Mail-Server.md)).

Не храните здесь секреты API и пароли.
