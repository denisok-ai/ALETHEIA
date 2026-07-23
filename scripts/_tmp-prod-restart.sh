#!/usr/bin/env bash
set -euo pipefail
systemctl restart aletheia.service
sleep 3
systemctl is-active aletheia.service
curl -sS https://avaterra.pro/api/health
cd /opt/ALETHEIA && git log -1 --oneline
