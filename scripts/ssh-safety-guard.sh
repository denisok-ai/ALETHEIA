#!/bin/bash
# Проверка перед reload sshd: порт 22 и PubkeyAuthentication yes обязательны.
# Использование: source scripts/ssh-safety-guard.sh && assert_sshd_safe_before_reload
set -euo pipefail

assert_sshd_safe_before_reload() {
  sshd -t || { echo "FATAL: sshd -t failed — reload отменён" >&2; return 1; }
  local SSHD_CFG port pubkey
  SSHD_CFG=$(sshd -T 2>/dev/null || true)
  port=$(printf '%s\n' "$SSHD_CFG" | awk '/^port /{print $2; exit}')
  pubkey=$(printf '%s\n' "$SSHD_CFG" | awk '/^pubkeyauthentication /{print $2; exit}')
  if [ "$port" != "22" ]; then
    echo "FATAL: sshd port=$port (ожидался 22) — reload отменён, доступ не трогаем" >&2
    return 1
  fi
  if [ "$pubkey" != "yes" ]; then
    echo "FATAL: PubkeyAuthentication=$pubkey (ожидался yes) — reload отменён" >&2
    return 1
  fi
  echo "sshd safety OK: port=22 PubkeyAuthentication=yes"
}
