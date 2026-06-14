#!/usr/bin/env bash
# Commit telegram changes, push, deploy, register webhook. Logs to scripts/.deploy-telegram.log
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
LOG="$ROOT/scripts/.deploy-telegram.log"
exec > >(tee -a "$LOG") 2>&1
echo "=== $(date -Iseconds) deploy telegram ==="

FILES=(
  .env.example
  CHANGELOG.md
  package.json
  app/api/auth/register/route.ts
  app/api/contact/route.ts
  app/api/portal/admin/settings/import-env/route.ts
  app/api/portal/admin/settings/route.ts
  app/api/portal/admin/settings/telegram-webhook
  app/api/portal/admin/settings/test-telegram-notify
  app/api/portal/telegram/webhook/route.ts
  app/api/portal/tickets/route.ts
  app/api/webhook/paykeeper/route.ts
  app/portal/admin/settings/SettingsForms.tsx
  docs/Diary.md
  docs/Env-Config.md
  docs/Project.md
  docs/Production-Server.md
  docs/Support.md
  docs/Tasktracker.md
  lib/paykeeper-webhook-process.ts
  lib/settings-import-env.ts
  lib/telegram-admin-notify.ts
  lib/telegram-webhook-setup.ts
  scripts/setup-telegram-webhook.ts
  scripts/activate-telegram-prod.sh
  scripts/check-telegram-prod.sh
)

git add "${FILES[@]}"
if git diff --cached --quiet; then
  echo "Nothing to commit (already committed?)"
else
  git commit -m "$(cat <<'EOF'
feat(telegram): admin notifications, webhook setup, settings UI

Opoveshcheniya adminov o zayavkah, registraciyah, oplatah i tiketah;
registraciya webhook iz adminki; bump 3.5.4.
EOF
)"
fi
echo "HEAD=$(git rev-parse HEAD)"
git push origin main
npm run deploy:remote
ssh -i "${DEPLOY_SSH_KEY:-$HOME/.ssh/avaterra_deploy_nopass}" -o StrictHostKeyChecking=no \
  "${DEPLOY_USER:-root}@${DEPLOY_HOST:-95.181.224.70}" \
  'cd /opt/ALETHEIA && npx tsx scripts/setup-telegram-webhook.ts' || echo "webhook setup warning"
curl -sI https://avaterra.pro/api/health | head -5
echo "=== done ==="
