#!/usr/bin/env bash
# Outline (Shadowsocks) на VPS + HTTP-прокси для Telegram API. Ключ: OUTLINE_ACCESS_KEY или OUTLINE_KEY_FILE.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -f "$ROOT/scripts/.deploy.env" ]] && source "$ROOT/scripts/.deploy.env"
SSH_KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/avaterra_deploy_nopass}"
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
ACCESS_KEY="${OUTLINE_ACCESS_KEY:-}"
if [[ -z "$ACCESS_KEY" && -n "${OUTLINE_KEY_FILE:-}" && -f "${OUTLINE_KEY_FILE}" ]]; then
  ACCESS_KEY="$(<"${OUTLINE_KEY_FILE}")"
fi
if [[ -z "$ACCESS_KEY" ]]; then
  echo "Нужен OUTLINE_ACCESS_KEY (ss://) или OUTLINE_KEY_FILE с ключом" >&2
  exit 1
fi
KEY_B64=$(printf '%s' "$ACCESS_KEY" | base64 -w0 2>/dev/null || printf '%s' "$ACCESS_KEY" | base64 | tr -d '\n')
scp -i "$SSH_KEY" "$ROOT/scripts/outline_gen_singbox_config.py" "$ROOT/scripts/vps-install-outline-proxy.sh" "${USER}@${HOST}:/tmp/"
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "${USER}@${HOST}" "bash -s" <<REMOTE
set -euo pipefail
mkdir -p /etc/aletheia
printf '%s' "$KEY_B64" | base64 -d > /etc/aletheia/outline-access.key.tmp
mv /etc/aletheia/outline-access.key.tmp /etc/aletheia/outline-access.key
chmod 700 /etc/aletheia && chmod 600 /etc/aletheia/outline-access.key
bash /tmp/vps-install-outline-proxy.sh
REMOTE
echo "WSL-туннель больше не нужен: bash scripts/telegram-proxy-tunnel-stop.sh"
