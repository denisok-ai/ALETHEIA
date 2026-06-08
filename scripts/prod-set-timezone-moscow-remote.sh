#!/usr/bin/env bash
# Устанавливает московское время на VPS (Europe/Moscow), сохраняется после перезагрузки.
# Локально: bash scripts/prod-set-timezone-moscow-remote.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=/dev/null
source "$ROOT/scripts/.deploy.env"

SSH=(ssh -i "$DEPLOY_SSH_KEY" -o StrictHostKeyChecking=accept-new "${DEPLOY_USER}@${DEPLOY_HOST}")

"${SSH[@]}" bash -s <<'REMOTE'
set -euo pipefail

TZ_NAME="Europe/Moscow"
UNIT="/etc/systemd/system/aletheia.service"

echo "[timezone] before:"
timedatectl status | sed -n '1,4p'

if ! timedatectl list-timezones | grep -qx "$TZ_NAME"; then
  echo "[timezone] ERROR: timezone $TZ_NAME not found" >&2
  exit 1
fi

timedatectl set-timezone "$TZ_NAME"
echo "$TZ_NAME" > /etc/timezone
DEBIAN_FRONTEND=noninteractive dpkg-reconfigure -f noninteractive tzdata >/dev/null 2>&1 || true

if grep -q '^TZ=' /etc/environment 2>/dev/null; then
  sed -i "s|^TZ=.*|TZ=$TZ_NAME|" /etc/environment
else
  echo "TZ=$TZ_NAME" >> /etc/environment
fi

if [[ -f "$UNIT" ]]; then
  if grep -q '^Environment=TZ=' "$UNIT"; then
    sed -i "s|^Environment=TZ=.*|Environment=TZ=$TZ_NAME|" "$UNIT"
  else
    awk -v tz="Environment=TZ=$TZ_NAME" '
      /^\[Service\]/ { print; print tz; next }
      { print }
    ' "$UNIT" > "${UNIT}.tmp" && mv "${UNIT}.tmp" "$UNIT"
  fi
  systemctl daemon-reload
  systemctl restart aletheia.service
fi

echo "[timezone] after:"
timedatectl status | sed -n '1,4p'
echo "[timezone] /etc/timezone: $(cat /etc/timezone 2>/dev/null || echo n/a)"
echo "[timezone] /etc/localtime -> $(readlink -f /etc/localtime)"
echo "[timezone] date: $(date '+%Y-%m-%d %H:%M:%S %Z %z')"
if [[ -f "$UNIT" ]]; then
  echo "[timezone] aletheia TZ: $(systemctl show aletheia.service -p Environment --value | tr ' ' '\n' | grep '^TZ=' || echo missing)"
  curl -sf http://127.0.0.1:3000/api/health >/dev/null && echo "[timezone] health: ok" || echo "[timezone] health: FAIL"
fi
REMOTE

echo "[timezone] Done."
