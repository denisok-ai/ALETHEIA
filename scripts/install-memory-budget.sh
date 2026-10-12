#!/bin/bash
# Бюджет памяти сервера: потолок у каждого компонента (mailcow-контейнеры и
# службы сайта). Запуск на VPS от root: bash scripts/install-memory-budget.sh
#
# Зачем (12.10.2026): VPS 4 ГБ при рекомендованных mailcow 6 ГБ. Без потолков
# любой компонент — прожорливый (ofelia ~230 МБ), забытая служба (WARP, 480 МБ),
# утечка, всплеск — растёт за счёт всех, и итог виден только как «swap 86 %». С потолком
# утечка упирается в свой лимит, ядро убивает процесс внутри его cgroup, Docker/
# systemd перезапускают компонент — остальной сервер не страдает. Алерт
# server-health видит компонент у потолка и называет его.
#
# Потолки — не резервы: в сумме они больше RAM (так и задумано), обычное
# потребление ~2.2 ГБ. Значения — по memory.peak за 9–20 дней с запасом ×1.5–3.
# rspamd/sogo подняты: прежние 256/384 МБ были в упор к пику, и прижатый к
# лимиту контейнер уходил в swap.
#
# Идемпотентен. Перед заменой override mailcow делает копию рядом.
set -euo pipefail

MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
OVERRIDE="$MAILCOW_DIR/docker-compose.override.yml"

# --- 1. Службы сайта (systemd drop-in) -------------------------------------
# MemoryHigh — мягкий порог (ядро начинает отбирать кэш и тормозит рост),
# MemoryMax — жёсткий (OOM внутри службы → Restart=always поднимает её).
write_dropin() {
  local unit="$1" high="$2" max="$3"
  mkdir -p "/etc/systemd/system/${unit}.service.d"
  cat > "/etc/systemd/system/${unit}.service.d/memory-budget.conf" <<EOF
# scripts/install-memory-budget.sh — не править вручную
[Service]
MemoryHigh=${high}
MemoryMax=${max}
EOF
}
write_dropin aletheia 800M 1G                 # Next.js, пик 631 МБ
write_dropin aletheia-jobs 256M 384M          # пик 126 МБ
write_dropin aletheia-telegram-poll 256M 384M # пик 183 МБ
systemctl daemon-reload   # лимиты cgroup применяются без рестарта служб

# --- 2. mailcow (docker-compose.override.yml) ------------------------------
# override — штатный способ кастомизации mailcow, update.sh его не трогает.
if [ -d "$MAILCOW_DIR" ]; then
  [ -f "$OVERRIDE" ] && cp -a "$OVERRIDE" "$OVERRIDE.bak-$(date +%Y%m%d-%H%M%S)"
  cat > "$OVERRIDE" <<'EOF'
# Бюджет памяти mailcow — генерируется scripts/install-memory-budget.sh
# (репозиторий ALETHEIA). Правки вносить в установщик, иначе перезапишутся.
# SOGo ДОЛЖЕН оставаться включённым.
services:
  mysql-mailcow:
    mem_limit: 512m        # пик 212
  sogo-mailcow:
    mem_limit: 512m        # пик 380 — прежние 384 были в упор
  rspamd-mailcow:
    mem_limit: 384m        # пик 256 — прежние 256 были в упор, уходил в swap
  clamd-mailcow:
    mem_limit: 256m        # SKIP_CLAMD=y
  dovecot-mailcow:
    mem_limit: 256m        # пик 113
  php-fpm-mailcow:
    mem_limit: 256m        # пик 180
  postfix-mailcow:
    mem_limit: 192m        # пик 114
  postfix-tlspol-mailcow:
    mem_limit: 128m        # пик 79
  dockerapi-mailcow:
    mem_limit: 160m        # пик 93
  netfilter-mailcow:
    mem_limit: 128m        # пик 60
  unbound-mailcow:
    mem_limit: 128m        # пик 71
  watchdog-mailcow:
    mem_limit: 128m        # пик 52
  redis-mailcow:
    mem_limit: 128m        # пик 22
  acme-mailcow:
    mem_limit: 128m        # продление сертификатов — с запасом
  olefy-mailcow:
    mem_limit: 96m         # пик 28
  nginx-mailcow:
    mem_limit: 96m         # пик 25
  memcached-mailcow:
    mem_limit: 64m         # пик 12
  ofelia-mailcow:
    # Планировщик задач mailcow (Go). Без ограничения кучи держит ~230 МБ уже
    # через 6 минут после старта — Go не отдаёт память. С GOMEMLIMIT=48MiB
    # (замер 12.10): обычно ~43 МБ, пики до ~170 МБ в минуту запуска пачки
    # задач, все задачи без ошибок. Swap запрещён (memswap = mem): упор → рестарт.
    environment:
      - GOMEMLIMIT=48MiB
    mem_limit: 256m
    memswap_limit: 256m
EOF
  cd "$MAILCOW_DIR"
  docker compose config -q
  # Пересоздаются только контейнеры с изменённым конфигом (секунды простоя каждого).
  docker compose up -d
fi

echo "Бюджет памяти применён:"
for u in aletheia aletheia-jobs aletheia-telegram-poll; do
  echo "  $u: $(systemctl show "$u" -p MemoryHigh --value) / $(systemctl show "$u" -p MemoryMax --value)"
done
docker ps --format '{{.Names}}' | sort | while read -r n; do
  echo "  $n: $(( $(docker inspect "$n" --format '{{.HostConfig.Memory}}') / 1048576 )) МБ"
done
