#!/bin/bash
FILE=/home/denisok/projects/AVATERRA/scripts/deploy-telegram-systemic-fix.sh
LINE=$(sed -n "12p" "$FILE")
if echo "$LINE" | grep -q "^scp"; then
  sed -i "11a ssh -i \"\$KEY\" -o StrictHostKeyChecking=no \"\$HOST\" \"mkdir -p /tmp/tg-fix\"" "$FILE"
  echo patched
else
  echo already_ok_or_changed
  sed -n "11,14p" "$FILE"
fi
