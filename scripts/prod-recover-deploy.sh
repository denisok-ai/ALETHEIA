#!/bin/bash
set -euo pipefail
cd /home/denisok/projects/AVATERRA
SCRIPT_DIR=scripts
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then
  set -a
  source "$SCRIPT_DIR/.deploy.env"
  set +a
fi
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
  KEY="$DEPLOY_SSH_KEY"
elif [[ -f "$HOME/.ssh/avaterra_deploy_nopass" ]]; then
  KEY="$HOME/.ssh/avaterra_deploy_nopass"
else
  KEY="$HOME/.ssh/avaterra_pro_root"
fi
ssh -i "$KEY" -o IdentitiesOnly=yes -o ConnectTimeout=30 "${USER}@${HOST}" "cd /opt/ALETHEIA && sudo bash scripts/deploy-pull.sh"
