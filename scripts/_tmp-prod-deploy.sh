#!/usr/bin/env bash
set -euo pipefail
cd /opt/ALETHEIA
echo "=== deploy start $(date -Is) ===" | tee /tmp/deploy.log
git fetch origin main
git reset --hard origin/main
git clean -fd --exclude=prisma/dev.db --exclude=.env --exclude=public/uploads --exclude=node_modules || true
echo "commit: $(git log -1 --oneline)" | tee -a /tmp/deploy.log
export DEPLOY_ROOT=/opt/ALETHEIA
bash scripts/deploy-pull.sh >> /tmp/deploy.log 2>&1
echo "=== deploy end $(date -Is) ===" | tee -a /tmp/deploy.log
curl -sS https://avaterra.pro/api/health | tee -a /tmp/deploy.log
