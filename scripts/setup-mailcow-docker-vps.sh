#!/usr/bin/env bash
# Первичная подготовка VPS под Mailcow (Ubuntu): Docker Engine + клон репозитория mailcow-dockerized.
# Запускать на сервере от root:  sudo bash scripts/setup-mailcow-docker-vps.sh
# Полная настройка домена, DNS и TLS — вручную: ./generate_config.sh, см. docs/Mail-Server.md
#
# Сертификат HTTPS для сайта (nginx + certbot для avaterra.pro) и HTTPS для Mailcow
# (обычно встроенный ACME в Mailcow для MAILCOW_HOSTNAME, например mail.avaterra.pro) — разные сущности.

set -euo pipefail

MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Запустите от root: sudo bash $0"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y ca-certificates curl git gnupg

if ! command -v docker &>/dev/null; then
  echo "=== Установка Docker Engine (официальный скрипт get.docker.com) ==="
  curl -fsSL https://get.docker.com | sh
fi

systemctl enable docker --now 2>/dev/null || true

if ! docker compose version &>/dev/null; then
  echo "=== Docker Compose v2 (apt: docker-compose-v2) — нужен для актуального docker-compose.yml Mailcow ==="
  apt-get install -y docker-compose-v2
fi

if [[ ! -d "$MAILCOW_DIR/.git" ]]; then
  echo "=== Клонирование Mailcow в $MAILCOW_DIR ==="
  mkdir -p "$(dirname "$MAILCOW_DIR")"
  git clone --depth 1 https://github.com/mailcow/mailcow-dockerized.git "$MAILCOW_DIR"
else
  echo "Уже есть $MAILCOW_DIR — пропуск clone."
fi

echo ""
echo "=== Дальше вручную на сервере ==="
echo "1) DNS: A-запись для почтового хоста (например mail.avaterra.pro) → IP этого VPS."
echo "2) cd $MAILCOW_DIR && ln -sf mailcow.conf .env && ./generate_config.sh   # FQDN почтового хоста"
echo "3) Если на этом VPS уже nginx слушает :80/:443 (сайт), до первого запуска задайте в mailcow.conf"
echo "   привязку UI к loopback и порты (или reverse-proxy), иначе конфликт портов — см. docs/Mail-Server.md."
echo "4) cd $MAILCOW_DIR && docker compose pull && docker compose up -d"
echo "5) HTTPS UI: ACME внутри Mailcow или сертификат/reverse-proxy на хосте nginx для mail.* — docs/Mail-DNS-avaterra.pro.md"
echo "6) В /opt/ALETHEIA/.env задать MAIL_* и MAILCOW_API_* — см. .env.example и docs/Mail-Server.md"
