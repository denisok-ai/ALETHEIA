#!/bin/bash
set -e
CFG=/etc/nginx/sites-enabled/aletheia
if grep -q 'proxy_redirect http://localhost:3000/' ""; then
  echo already_patched
  exit 0
fi
sed -i '/location \/ {/,/^    }/{
  /proxy_pass http:\/\/127.0.0.1:3000;/r /tmp/nginx-proxy-redirect.snippet
}' ""
nginx -t
systemctl reload nginx
echo nginx_reloaded
