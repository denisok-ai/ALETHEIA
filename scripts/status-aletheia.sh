#!/usr/bin/env bash
# One-off prod diagnostics for Telegram bot
set -euo pipefail
SSH_KEY="${DEPLOY_SSH_KEY:-/home/denisok/.ssh/avaterra_deploy_nopass}"
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"

ssh -i -o StrictHostKeyChecking=no denisok@ systemctl status aletheia --no-pager
ssh -i -o StrictHostKeyChecking=no denisok@ journalctl -u aletheia -n 40 --no-pager
