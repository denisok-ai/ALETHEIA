#!/bin/bash
# Ротация Reality-ключа xray (запускать ЛОКАЛЬНО при SSH на VPN-сервер 103.110.64.230).
# НЕ трогает прод VPS avaterra (95.181.224.70) и SSH :22.
#
# Использование:
#   ssh -i ~/.ssh/id_ed25519 root@103.110.64.230
#   bash vpn-reality-rotate-local.sh   # интерактивный чеклист на VPN-сервере
#
# После ротации на VPN обновите /usr/local/etc/xray-avaterra.json на 95.181.224.70
# и: systemctl restart xray-avaterra && systemctl restart aletheia-telegram-poll

set -euo pipefail

echo "=== VPN Reality rotate checklist ==="
echo "1. В x-ui: удалить/пересоздать inbound VLESS Reality (порт 443)"
echo "2. Убедиться что старый /usr/local/etc/xray-vless.json отключён:"
echo "   pgrep -af xray-vless || echo 'OK: no duplicate xray'"
echo "3. Записать новый publicKey, shortId, uuid из x-ui"
echo "4. На VPS avaterra.pro (95.181.224.70) обновить /usr/local/etc/xray-avaterra.json"
echo "5. systemctl restart xray-avaterra"
echo "6. systemctl restart aletheia-telegram-poll"
echo "7. Тест (на avaterra VPS):"
echo '   source /opt/ALETHEIA/.env'
echo '   curl -s --proxy http://127.0.0.1:10809 --max-time 20 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"'
echo ""
echo "Текущие процессы xray на ЭТОМ хосте:"
pgrep -af xray || echo "(нет xray)"
echo ""
echo "Панель x-ui: только через SSH-туннель, не публиковать в git."
