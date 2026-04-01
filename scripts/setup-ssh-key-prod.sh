#!/usr/bin/env bash
# Настройка входа по SSH-ключу на прод (WSL / Linux).
# Запуск: bash scripts/setup-ssh-key-prod.sh
# Пароль root вводится один раз (не хранится в файлах и не передаётся в репозиторий).
# Не отключает парольный вход и не трогает sshd_config — только добавляет ключ в authorized_keys.

set -euo pipefail

HOST="${SSH_PROD_HOST:-95.181.224.70}"
USER="${SSH_PROD_USER:-root}"
KEY_NAME="${SSH_PROD_KEY_NAME:-avaterra_pro_root}"
SSH_DIR="${HOME}/.ssh"
KEY_PATH="${SSH_DIR}/${KEY_NAME}"
# Только указанный ключ — иначе ssh перебирает ключи из ssh-agent и может получить «Too many auth failures» / отказ до нужного ключа.
SSH_BASE_OPTS=(-o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new)

mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"
chmod 600 "$KEY_PATH" 2>/dev/null || true

if [[ ! -f "$KEY_PATH" ]]; then
  echo "Создаю ключ: $KEY_PATH"
  ssh-keygen -t ed25519 -f "$KEY_PATH" -C "deploy-avaterra-${HOST}" -N ""
  chmod 600 "$KEY_PATH"
else
  echo "Ключ уже есть: $KEY_PATH"
  echo "(Если при ssh просит passphrase — сервер ключ уже принимает; введите пароль от КЛЮЧА или: ssh-add $KEY_PATH)"
fi

echo ""
echo "Публичный ключ (должен оказаться на сервере в ~/.ssh/authorized_keys):"
echo "-------------------------------------------------------------------"
cat "${KEY_PATH}.pub"
echo "-------------------------------------------------------------------"
echo ""

# ssh-copy-id спросит пароль один раз (stdin = tty)
if command -v ssh-copy-id >/dev/null 2>&1; then
  echo "Копирую ключ на ${USER}@${HOST} (введите пароль при запросе)..."
  ssh-copy-id -i "${KEY_PATH}.pub" "${SSH_BASE_OPTS[@]}" "${USER}@${HOST}"
else
  echo "ssh-copy-id не найден. Выполните вручную на сервере:"
  echo "  mkdir -p ~/.ssh && chmod 700 ~/.ssh"
  echo "  echo '$(cat "${KEY_PATH}.pub")' >> ~/.ssh/authorized_keys"
  echo "  chmod 600 ~/.ssh/authorized_keys"
  exit 1
fi

echo ""
echo "Проверка входа только по ключу (IdentitiesOnly + BatchMode):"
if ssh -i "$KEY_PATH" "${SSH_BASE_OPTS[@]}" -o BatchMode=yes -o ConnectTimeout=15 "${USER}@${HOST}" "echo OK: подключение по ключу работает; uname -a"; then
  :
else
  echo ""
  echo "Если снова Permission denied — на СЕРВЕРЕ под паролем проверьте права (частая причина):"
  echo "  chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys && chown root:root ~/.ssh ~/.ssh/authorized_keys"
  echo "Локально для отладки: ssh -vvv -i \"$KEY_PATH\" -o IdentitiesOnly=yes ${USER}@${HOST}"
  exit 1
fi

echo ""
echo "Дальше в ~/.ssh/config на этой машине можно добавить:"
echo "Host avaterra-prod"
echo "    HostName ${HOST}"
echo "    User ${USER}"
echo "    IdentityFile ${KEY_PATH}"
echo "    IdentitiesOnly yes"
echo ""
echo "GitHub Actions: в DEPLOY_SSH_KEY нужен приватный ключ БЕЗ passphrase (отдельный ключ + ssh-copy-id), иначе CI не сможет подписать сессию."
