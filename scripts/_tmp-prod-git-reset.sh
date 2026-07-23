#!/usr/bin/env bash
set -euo pipefail
cd /opt/ALETHEIA
git fetch origin main
git reset --hard origin/main
git clean -fd --exclude=prisma/dev.db --exclude=.env --exclude=public/uploads --exclude=node_modules || true
git log -1 --oneline
