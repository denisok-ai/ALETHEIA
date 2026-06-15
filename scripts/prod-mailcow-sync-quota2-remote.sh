#!/usr/bin/env bash
# Синхронизировать quota2 и пересобрать кэш Mailcow для ящиков, созданных через SQL.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then set -a; source "$SCRIPT_DIR/.deploy.env"; set +a; fi
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
[[ -n "${DEPLOY_SSH_KEY:-}" ]] && KEY="$DEPLOY_SSH_KEY" || KEY="${HOME}/.ssh/avaterra_deploy_nopass"
MAILBOXES="${*:-info@avaterra.pro yarik@avaterra.pro support@avaterra.pro}"
MAILBOXES_B64=$(printf '%s' "$MAILBOXES" | base64 -w0 2>/dev/null || printf '%s' "$MAILBOXES" | base64)

ssh -i "$KEY" -o BatchMode=yes "${USER}@${HOST}" bash -se "$MAILBOXES_B64" <<'REMOTE'
set -euo pipefail
MAILBOXES=$(printf '%s' "$1" | base64 -d)
cd /opt/mailcow-dockerized
set -a; . ./mailcow.conf; set +a
M=$(docker ps --format '{{.Names}}' | awk '/mysql-mailcow/{print;exit}')
DV=$(docker ps --format '{{.Names}}' | awk '/dovecot-mailcow/{print;exit}')

echo "=== quota2 BEFORE ==="
docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e "SELECT * FROM quota2 WHERE username LIKE '%@avaterra.pro';"

echo ""
echo "=== doveadm quota recalc ==="
for u in $MAILBOXES; do
  echo "-- $u --"
  docker exec "$DV" doveadm quota recalc -u "$u" 2>&1 || true
  docker exec "$DV" doveadm quota get -u "$u" 2>&1 || true
done

echo ""
echo "=== quota2 upsert fallback ==="
for u in $MAILBOXES; do
  EXISTS=$(docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -Nse "SELECT COUNT(*) FROM quota2 WHERE username='$u'")
  if [[ "$EXISTS" == "0" ]]; then
    BYTES=$(docker exec "$DV" doveadm quota get -u "$u" 2>/dev/null | awk '/STORAGE/ {print $3}' | head -1)
    MSGS=$(docker exec "$DV" doveadm mailbox status -u "$u" ALL 2>/dev/null | awk '/messages=/ {sum+=$2} END {print sum+0}')
    [[ -z "$BYTES" || "$BYTES" == "-" ]] && BYTES=0
    docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e \
      "INSERT INTO quota2 (username, bytes, messages) VALUES ('$u', $BYTES, ${MSGS:-0}) ON DUPLICATE KEY UPDATE bytes=VALUES(bytes), messages=VALUES(messages);"
    echo "inserted quota2 for $u bytes=$BYTES msgs=${MSGS:-0}"
  fi
done

echo ""
echo "=== quota2 AFTER ==="
docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e "SELECT * FROM quota2 WHERE username LIKE '%@avaterra.pro';"

echo ""
echo "=== API get/mailbox/all avaterra.pro ==="
node <<'NODE'
const fs=require('fs');
const env={};
for(const l of fs.readFileSync('/opt/ALETHEIA/.env','utf8').split(/\n/)){
  const i=l.indexOf('='); if(i<1)continue; env[l.slice(0,i).trim()]=l.slice(i+1).trim().replace(/^"|"$/g,'');
}
(async()=>{
  const base=(env.MAILCOW_API_URL||'https://mail.avaterra.pro').replace(/\/+$/,'');
  const r=await fetch(base+'/api/v1/get/mailbox/all',{headers:{'X-API-Key':env.MAILCOW_API_KEY}});
  const j=await r.json();
  for(const m of j) {
    if(m && m.username) console.log(m.username, 'quota=', m.quota, 'sogo=', m.sogo_access, 'imap=', m.imap_access);
    else console.log('NULL ENTRY', JSON.stringify(m).slice(0,120));
  }
})();
NODE

echo ""
docker compose restart php-fpm-mailcow >/dev/null
echo OK
REMOTE
