# Источники аудита трафика (2026-08-30)

Все числовые факты — первичные замеры, воспроизводимые командами на сервере.

| Факт | Источник | Как проверить |
|---|---|---|
| Переходы из поиска: 8 за 13 дней | /var/log/nginx/access.log* (18–30.08) | grep referer `google.|yandex.` без ботов |
| YandexBot: 168 хитов, только `/` и robots | те же логи | grep YandexBot, awk по пути/коду |
| Googlebot 4996, bingbot 382 | те же логи | grep по UA |
| ИИ-агенты: GPTBot 1066, ChatGPT-User 1209 (из них большинство — сканер-маскировка на /.env, /fetch?…169.254.169.254), настоящие 200-фетчи контента есть | те же логи | grep UA + путь + код |
| 503 настоящим OpenAI-агентам ~340, всплесками (277 хитов в 23:36 29.08) | те же логи | awk $9==503 |
| sitemap 126×200, сейчас 200/17мс/10,8КБ | логи + curl localhost:3000/sitemap.xml | curl -w |
| robots.txt: явные Allow для GPTBot/OAI-SearchBot/ChatGPT-User и др. | https://avaterra.pro/robots.txt | curl |
| llms.txt 21,8КБ; llms-full.txt 173КБ — оба 200 | https://avaterra.pro/llms.txt, /llms-full.txt | curl -w |
| fail2ban: 4 jail, banned=0 во всех | fail2ban-client status на сервере | ssh |
| «avaterra.pro» не находится точным запросом; выдачу ниши занимают конкуренты | WebSearch `"avaterra.pro" мышечное тестирование школа Аватэрра` (2026-08-30) | повторить запрос; примеры выдачи: fs-school.ru/blog/1101360, webinars.kinesioprofi.ru/mmt, magistra-school.ru/edu/events/mmt/ |
| IndexNow: переподача всех URL принята (HTTP 200) | scripts/indexnow-submit-all.ts на проде, 2026-08-30 | вывод скрипта |

Ограничения инструментов: WebSearch US-центричен — Яндекс-выдача не
проверялась; оператор `site:` в нём не работает (см. «-отклонено»).
