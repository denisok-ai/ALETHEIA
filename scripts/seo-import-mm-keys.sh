#!/usr/bin/env bash
# @file: seo-import-mm-keys.sh
# @description: Переносит SEO-ключи (Google OAuth для GSC/GA4, Яндекс OAuth для Метрики/Вебмастера, CrUX)
#   из Magic Master в /opt/ALETHEIA/secrets/seo.env на проде AVATERRA. Значения нигде не печатаются:
#   идут потоком MM → эта машина → прод, на экран — только имена ключей.
# @usage: bash scripts/seo-import-mm-keys.sh        (запускает владелец со своей машины)
set -euo pipefail

MM=root@91.218.244.146
AV=root@95.181.224.70

# 1. На сервере MM: читаем system_settings, расшифровываем Fernet-значения кодом самого MM.
read -r -d '' EXPORT_PY <<'PY' || true
import sqlite3, sys
from app.services.settings_crypto import decrypt_value, is_encrypted_stored
MAP = {
    "seo_gsc_client_id": "GOOGLE_OAUTH_CLIENT_ID",
    "seo_gsc_client_secret": "GOOGLE_OAUTH_CLIENT_SECRET",
    "seo_gsc_refresh_token": "GOOGLE_OAUTH_REFRESH_TOKEN",
    "seo_metrika_client_id": "YANDEX_OAUTH_CLIENT_ID",
    "seo_metrika_client_secret": "YANDEX_OAUTH_CLIENT_SECRET",
    "seo_metrika_oauth_token": "YANDEX_OAUTH_TOKEN",
    "seo_crux_api_key": "CRUX_API_KEY",
}
db = sqlite3.connect("/opt/magic-master/backend/magic_master.db")
rows = dict(db.execute(
    "SELECT key, value FROM system_settings WHERE key IN (%s)" % ",".join("?" * len(MAP)), list(MAP)))
for src, dst in MAP.items():
    v = (rows.get(src) or "").strip()
    if v and is_encrypted_stored(v):
        v = decrypt_value(v).strip()
    if not v:
        print(f"нет значения: {src}", file=sys.stderr)
        continue
    print(f"{dst}={v}")
PY

# 2. На проде AVATERRA: бэкап seo.env, замена/добавление ключей, права 600. Печатаем только имена.
read -r -d '' MERGE_SH <<'SH' || true
set -euo pipefail
f=/opt/ALETHEIA/secrets/seo.env
mkdir -p "$(dirname "$f")"; touch "$f"
cp -a "$f" "$f.bak-$(date +%F-%H%M%S)"
new=$(mktemp); cat > "$new"
[ -s "$new" ] || { echo "Из Magic Master ничего не пришло — seo.env не менялся"; rm -f "$new"; exit 1; }
keys=$(cut -d= -f1 "$new" | paste -sd'|')
{ grep -v -E "^(${keys})=" "$f" || true; cat "$new"; } > "$f.tmp"
mv "$f.tmp" "$f"; chmod 600 "$f"; chown root:root "$f"; rm -f "$new"
echo "Записано в $f:"; cut -d= -f1 "$f" | sed 's/^/  /'
SH

# Код передаём в base64, чтобы кавычки не ломались; stdin обоих ssh занят потоком ключей.
PY_B64=$(printf '%s' "$EXPORT_PY" | base64 -w0)
SH_B64=$(printf '%s' "$MERGE_SH" | base64 -w0)
ssh "$MM" "cd /opt/magic-master/backend && set -a && . ../.env && set +a && echo $PY_B64 | base64 -d > /tmp/mm-seo-export.py && PYTHONPATH=/opt/magic-master/backend ../venv/bin/python /tmp/mm-seo-export.py; rc=\$?; rm -f /tmp/mm-seo-export.py; exit \$rc" \
  | ssh "$AV" "echo $SH_B64 | base64 -d > /tmp/av-seo-merge.sh && bash /tmp/av-seo-merge.sh; rc=\$?; rm -f /tmp/av-seo-merge.sh; exit \$rc"
