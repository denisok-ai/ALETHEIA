#!/usr/bin/env bash
set -euo pipefail
cd /opt/ALETHEIA
npx tsx scripts/_tmp-telegram-deploy-report.ts \
  "Деплой и почта — итог $(date +%Y-%m-%d\ %H:%M)" \
  "✅ Деплой: успешно, commit d469cdb (PayKeeper: свежий токен + сериализация POST)" \
  "✅ Сервис: aletheia.service active, /api/health OK" \
  "⚠️ SPF/DKIM: в публичном DNS nic.ru записи MX/SPF/DKIM/DMARC отсутствуют — Gmail отклонял письма" \
  "✅ Mailcow: DKIM-ключи в Redis (selector dkim), rspamd перезапущен ранее" \
  "📋 Нужно вручную в nic.ru: MX mail.avaterra.pro, SPF v=spf1 mx a ip4:95.181.224.70 ~all, TXT dkim._domainkey, DMARC _dmarc" \
  "📧 Письмо rudenkoelena7667@gmail.com (Руденко Елена, «Аватера»: Практик): отправлено повторно, пароль без изменений, статус sent" \
  "⚠️ Доставка в Gmail возможна только после публикации DNS-записей (15–60 мин)"
