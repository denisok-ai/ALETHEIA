#!/usr/bin/env bash
# Починить attributes/quota у ящиков info@, yarik@, support@.
# 1) quota2 (без строки Mailcow API/UI «не видят» ящик)
# 2) edit/mailbox через API (протоколы, SOGo, квота)
# 3) пересборка _sogo_static_view
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/prod-mailcow-sync-quota2-remote.sh" info@avaterra.pro yarik@avaterra.pro support@avaterra.pro
bash "$SCRIPT_DIR/prod-mailcow-apply-mailbox-defaults-api-remote.sh" \
  info@avaterra.pro yarik@avaterra.pro support@avaterra.pro
echo "All mailboxes fixed."
