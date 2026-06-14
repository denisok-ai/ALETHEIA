#!/bin/bash
set -euo pipefail
KEY="$HOME/.ssh/avaterra_deploy_nopass"
HOST="root@95.181.224.70"
LOG="/tmp/prod-audit-$(date +%Y%m%d-%H%M%S).log"
PHASE="${1:-all}"

chmod 600 "$KEY"
scp -i "$KEY" -o StrictHostKeyChecking=accept-new \
  "$HOME/projects/AVATERRA/scripts/prod-audit-remote.sh" \
  "$HOST:/tmp/prod-audit-remote.sh"

ssh -i "$KEY" -o ConnectTimeout=30 "$HOST" "bash /tmp/prod-audit-remote.sh $PHASE" 2>&1 | tee "$LOG"
echo "LOG_SAVED=$LOG"
