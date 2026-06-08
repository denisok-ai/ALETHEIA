#!/usr/bin/env bash
# Выпуск Let's Encrypt для mail.avaterra.pro и nginx → Mailcow (127.0.0.1:8448).
# Запуск на VPS от root: bash mail-nginx-le-on-vps.sh
set -euo pipefail

WEBROOT=/var/www/certbot
SITE_AV=/etc/nginx/sites-available/mail-avaterra.conf
SITE_EN=/etc/nginx/sites-enabled/mail-avaterra.conf

mkdir -p "$WEBROOT/.well-known/acme-challenge"

# --- этап A: только HTTP + ACME webroot (до выпуска сертификата) ---
cat > "$SITE_AV" <<'NGINX'
# Временный HTTP для ACME; после certbot будет добавлен HTTPS блок ниже в этом же файле.
server {
    listen 80;
    listen [::]:80;
    server_name mail.avaterra.pro;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 404;
    }
}
NGINX

ln -sf "$SITE_AV" "$SITE_EN"
nginx -t
systemctl reload nginx

# Email для Let's Encrypt: возьмём из переменной окружения или безопасный дефолт хостинга.
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@avaterra.pro}"

certbot certonly \
  --webroot \
  -w "$WEBROOT" \
  -d mail.avaterra.pro \
  --non-interactive \
  --agree-tos \
  --email "$CERTBOT_EMAIL" \
  --key-type ecdsa || {
    echo "certbot failed — проверьте DNS mail.avaterra.pro → этот сервер и доступность порта 80 снаружи."
    exit 1
  }

# --- этап B: HTTPS reverse-proxy на Mailcow ---
cat > "$SITE_AV" <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name mail.avaterra.pro;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name mail.avaterra.pro;

    ssl_certificate     /etc/letsencrypt/live/mail.avaterra.pro/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mail.avaterra.pro/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 50m;

    location / {
        proxy_pass https://127.0.0.1:8448;
        proxy_ssl_verify off;
        proxy_ssl_server_name on;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }
}
NGINX

nginx -t
systemctl reload nginx

echo ""
echo "=== Проверка локально на сервере ==="
curl -skI --resolve mail.avaterra.pro:443:127.0.0.1 https://mail.avaterra.pro/ | head -8 || true

echo ""
echo "Готово. renewal: certbot renew должен подхватить mail.avaterra.pro автоматически (отдельная запись в renewal)."
