#!/usr/bin/env bash
set -uo pipefail
cd /opt/ALETHEIA
export DEPLOY_ROOT=/opt/ALETHEIA
{
  echo "=== deploy-pull start $(date -Is) ==="
  bash scripts/deploy-pull.sh
  echo "=== deploy-pull end $(date -Is) ==="
  curl -sS https://avaterra.pro/api/health
} >> /tmp/deploy.log 2>&1
