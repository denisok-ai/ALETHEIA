#!/usr/bin/env bash
# @file: yookassa-install-key.sh
# @description: Сохраняет секретный ключ ЮKassa в настройки прода (SystemSetting, зашифрован как из админки)
#   и проверяет подключение запросом GET /v3/me. Ключ не печатается: идёт потоком файл → ssh → stdin скрипта.
# @usage: bash scripts/yookassa-install-key.sh <файл-с-ключом> <shopId> test|live [--delete-file]
#   test — тестовый магазин (yookassa_test_*, yookassa_use_test=1); live — рабочий (yookassa_*, use_test=0).
set -euo pipefail

KEY_FILE=${1:?файл с ключом}
SHOP_ID=${2:?shopId}
MODE=${3:?test или live}
DELETE=${4:-}
AV=root@95.181.224.70

[ -s "$KEY_FILE" ] || { echo "Файл пуст или не найден: $KEY_FILE"; exit 1; }
case "$MODE" in test|live) ;; *) echo "Режим: test или live"; exit 1 ;; esac
[[ "$SHOP_ID" =~ ^[0-9]+$ ]] || { echo "shopId — только цифры"; exit 1; }

read -r -d '' TS <<'TS' || true
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encrypt';
import { fetchYooKassaAccount } from '@/lib/yookassa/client';

async function main() {
  const [shopId, mode] = process.argv.slice(2);
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  const secretKey = Buffer.concat(chunks).toString('utf8').trim();
  if (!secretKey) throw new Error('пустой ключ');
  const isTest = mode === 'test';
  if (isTest !== secretKey.startsWith('test_')) {
    throw new Error(`ключ ${secretKey.startsWith('test_') ? 'тестовый' : 'боевой'}, а режим ${mode} — проверьте файл`);
  }

  const account = await fetchYooKassaAccount({ shopId, secretKey });
  console.log(`Подключение: ok, account_id=${account.account_id}, test=${String(account.test)}, status=${account.status ?? '—'}`);
  if (String(account.account_id) !== shopId) throw new Error(`ключ от магазина ${account.account_id}, а не ${shopId}`);

  const set = async (key: string, value: string) =>
    prisma.systemSetting.upsert({ where: { key }, create: { key, value, category: 'payments' }, update: { value } });
  if (isTest) {
    await set('yookassa_test_shop_id', shopId);
    await set('yookassa_test_secret_key', encrypt(secretKey));
    await set('yookassa_use_test', '1');
  } else {
    await set('yookassa_shop_id', shopId);
    await set('yookassa_secret_key', encrypt(secretKey));
    await set('yookassa_use_test', '0');
  }
  console.log(`Сохранено: ${isTest ? 'тестовый' : 'рабочий'} магазин ${shopId} (ключ зашифрован).`);
  await prisma.$disconnect();
}
main().catch(async (e) => {
  console.error('Ошибка:', e instanceof Error ? e.message : String(e));
  await prisma.$disconnect();
  process.exit(1);
});
TS

TS_B64=$(printf '%s' "$TS" | base64 -w0)
tr -d ' \r\n' < "$KEY_FILE" | ssh "$AV" "cd /opt/ALETHEIA && f=scripts/.tmp-yk-install.ts && echo $TS_B64 | base64 -d > \$f && npx tsx --env-file=.env \$f $SHOP_ID $MODE; rc=\$?; rm -f \$f; exit \$rc"

if [ "$DELETE" = "--delete-file" ]; then
  shred -u "$KEY_FILE" 2>/dev/null || rm -f "$KEY_FILE"
  echo "Файл с ключом удалён: $KEY_FILE"
fi
