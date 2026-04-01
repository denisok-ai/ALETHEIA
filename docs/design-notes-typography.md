# Типографика и референс Netlify

## Фаза 0 (аудит)

- Автоматическая загрузка HTML/CSS с `https://cerulean-arithmetic-777b2e.netlify.app/` в среде сборки недоступна; точные `font-family` из бандла референса при необходимости снимаются вручную (DevTools → Computed / Network → `.css`).
- Для визуального сходства с референсом и устойчивой кириллицы: **Lora** (заголовки, редакторский serif) + **Inter** (тело и UI). Раньше использовались Fraunces + DM Sans.
- Акцент портала унифицирован с брендом: **plum** вместо indigo в CSS‑переменных `--portal-*` (см. `app/globals.css`).

## Подключение

- Google Fonts URL в `app/layout.tsx` (`GOOGLE_FONTS_STYLESHEET`).
- Переменные `--font-heading` / `--font-body` в `app/globals.css`; Tailwind `font-heading` / `font-body` в `tailwind.config.ts`.
