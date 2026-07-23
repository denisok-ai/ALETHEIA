#!/usr/bin/env bash
set -euo pipefail
REDIS_PASS=$(grep -E '^REDISPASS=' /opt/mailcow-dockerized/mailcow.conf | cut -d= -f2-)
check_dns() {
  local name="$1" type="$2"
  echo "--- $type $name ---"
  curl -sS "https://dns.google/resolve?name=${name}&type=${type}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('Answer', d.get('Status', d)), ensure_ascii=False)[:800])" 2>/dev/null || curl -sS "https://dns.google/resolve?name=${name}&type=${type}"
  echo
}
check_dns avaterra.pro 16
check_dns avaterra.pro 15
check_dns dkim._domainkey.avaterra.pro 16
check_dns _dmarc.avaterra.pro 16
check_dns avaterra.pro 2
echo "=== nic.ru grep ==="
grep -riE 'nic\.ru|NIC_|dns\.nic|reg\.ru|REGRU|cloudflare|CLOUDFLARE' /opt/ALETHEIA/.env /opt/ALETHEIA/scripts /root/.bash_history /root 2>/dev/null | grep -v Binary | head -20 || echo "(none found)"
echo "=== Mailcow DKIM ==="
docker exec mailcowdockerized-redis-mailcow-1 redis-cli -a "$REDIS_PASS" HGET DKIM_SELECTORS avaterra.pro 2>/dev/null || echo no_selector
PUB=$(docker exec mailcowdockerized-redis-mailcow-1 redis-cli -a "$REDIS_PASS" HGET DKIM_PUB_KEYS avaterra.pro 2>/dev/null || true)
echo "pub_key_len=${#PUB}"
echo "=== git ==="
cd /opt/ALETHEIA && git status -sb && git log -1 --oneline
