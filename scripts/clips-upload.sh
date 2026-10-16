#!/usr/bin/env bash
# Заливка роликов и постеров на прод: AVATERRA-private/clips/ → /opt/ALETHEIA/public/uploads/clips/.
# Видео в git не кладём (репозиторий публичный): файлы отдаёт nginx из /uploads/ (alias на public/uploads/).
#
# Что заливается: только файлы, перечисленные в lib/content/videos.ts (поля file и poster):
#   <file>.mp4 → uploads/clips/<file>.mp4
#   posters/<poster>.jpg → uploads/clips/posters/<poster>.jpg (обязательно)
#   posters/<poster>.webp → uploads/clips/posters/<poster>.webp (если есть локально)
# Перед заливкой проверяется, что все эти файлы есть локально. Если нет — ничего не грузим.
#
# Права: файлы 644, каталоги 755. Флаг --delete НЕ используется: удалённые на сервере файлы не трогаем.
#
# Запуск (с машины владельца, из корня репозитория):
#   bash scripts/clips-upload.sh            # реальная заливка
#   CLIPS_DRY_RUN=1 bash scripts/clips-upload.sh   # только проверка и показ того, что уйдёт
#
# Переменные окружения:
#   CLIPS_LOCAL_DIR      локальный каталог роликов (по умолчанию ~/projects/AVATERRA-private/clips)
#   DEPLOY_SSH           user@host (по умолчанию root@95.181.224.70)
#   DEPLOY_SSH_IDENTITY  приватный ключ SSH (по умолчанию как в deploy-rsync-from-local.sh)
#   CLIPS_REMOTE_DIR     каталог на сервере (по умолчанию /opt/ALETHEIA/public/uploads/clips)
#   CLIPS_DRY_RUN=1      ничего не копировать, только проверить локальные файлы и вывести план

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CATALOG="$ROOT_DIR/lib/content/videos.ts"

LOCAL_DIR="${CLIPS_LOCAL_DIR:-$HOME/projects/AVATERRA-private/clips}"
DEPLOY_SSH="${DEPLOY_SSH:-root@95.181.224.70}"
REMOTE_DIR="${CLIPS_REMOTE_DIR:-/opt/ALETHEIA/public/uploads/clips}"
DRY_RUN="${CLIPS_DRY_RUN:-0}"

if [[ -z "${DEPLOY_SSH_IDENTITY:-}" ]]; then
  if [[ -f "$HOME/.ssh/avaterra_deploy_nopass" ]]; then
    DEPLOY_SSH_IDENTITY="$HOME/.ssh/avaterra_deploy_nopass"
  elif [[ -f "$HOME/.ssh/avaterra_pro_root" ]]; then
    DEPLOY_SSH_IDENTITY="$HOME/.ssh/avaterra_pro_root"
  fi
fi

SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20)
if [[ -n "${DEPLOY_SSH_IDENTITY:-}" ]]; then
  SSH_OPTS+=(-i "$DEPLOY_SSH_IDENTITY")
fi
RSYNC_RSH="ssh ${SSH_OPTS[*]}"

if [[ ! -f "$CATALOG" ]]; then
  echo "Ошибка: нет каталога роликов $CATALOG" >&2
  exit 1
fi
if [[ ! -d "$LOCAL_DIR" ]]; then
  echo "Ошибка: нет локального каталога $LOCAL_DIR (задайте CLIPS_LOCAL_DIR)." >&2
  exit 1
fi

# Имена файлов берём из каталога: поля file: '...' и poster: '...'.
# Закомментированные записи (// …) пропускаем: они в заливку не входят.
ACTIVE_CATALOG="$(grep -vE '^[[:space:]]*//' "$CATALOG")"
mapfile -t VIDEO_FILES < <(printf '%s\n' "$ACTIVE_CATALOG" | grep -oE "file: '[^']+'" | sed -E "s/^file: '//; s/'$//")
mapfile -t POSTER_NAMES < <(printf '%s\n' "$ACTIVE_CATALOG" | grep -oE "poster: '[^']+'" | sed -E "s/^poster: '//; s/'$//")

if [[ ${#VIDEO_FILES[@]} -eq 0 ]]; then
  echo "Ошибка: в $CATALOG не найдено ни одного поля file." >&2
  exit 1
fi
if [[ ${#VIDEO_FILES[@]} -ne ${#POSTER_NAMES[@]} ]]; then
  echo "Ошибка: число полей file (${#VIDEO_FILES[@]}) не равно числу полей poster (${#POSTER_NAMES[@]})." >&2
  exit 1
fi

# Проверка локальных файлов — до любого соединения с сервером.
MISSING=0
for f in "${VIDEO_FILES[@]}"; do
  if [[ ! -s "$LOCAL_DIR/$f" ]]; then
    echo "НЕТ ЛОКАЛЬНО: $LOCAL_DIR/$f" >&2
    MISSING=1
  fi
done
for p in "${POSTER_NAMES[@]}"; do
  if [[ ! -s "$LOCAL_DIR/posters/$p.jpg" ]]; then
    echo "НЕТ ЛОКАЛЬНО: $LOCAL_DIR/posters/$p.jpg" >&2
    MISSING=1
  fi
done
if [[ "$MISSING" -ne 0 ]]; then
  echo "Заливка отменена: не все файлы из lib/content/videos.ts есть локально." >&2
  exit 1
fi

VIDEO_PATHS=()
for f in "${VIDEO_FILES[@]}"; do VIDEO_PATHS+=("$LOCAL_DIR/$f"); done
POSTER_JPG=()
POSTER_WEBP=()
for p in "${POSTER_NAMES[@]}"; do
  POSTER_JPG+=("$LOCAL_DIR/posters/$p.jpg")
  if [[ -s "$LOCAL_DIR/posters/$p.webp" ]]; then
    POSTER_WEBP+=("$LOCAL_DIR/posters/$p.webp")
  fi
done

echo "План заливки → $DEPLOY_SSH:$REMOTE_DIR"
echo "  роликов: ${#VIDEO_PATHS[@]}, постеров jpg: ${#POSTER_JPG[@]}, постеров webp: ${#POSTER_WEBP[@]}"
for f in "${VIDEO_PATHS[@]}" "${POSTER_JPG[@]}" "${POSTER_WEBP[@]}"; do
  echo "  $(basename "$f")"
done

if [[ "$DRY_RUN" == "1" ]]; then
  echo "CLIPS_DRY_RUN=1 — копирование пропущено."
  exit 0
fi

echo "=== Каталоги на сервере (755) ==="
ssh "${SSH_OPTS[@]}" "$DEPLOY_SSH" "mkdir -p '$REMOTE_DIR/posters' && chmod 755 '$REMOTE_DIR' '$REMOTE_DIR/posters'"

echo "=== Ролики ==="
rsync -av --chmod=D755,F644 -e "$RSYNC_RSH" "${VIDEO_PATHS[@]}" "$DEPLOY_SSH:$REMOTE_DIR/"

echo "=== Постеры ==="
rsync -av --chmod=D755,F644 -e "$RSYNC_RSH" "${POSTER_JPG[@]}" "${POSTER_WEBP[@]}" "$DEPLOY_SSH:$REMOTE_DIR/posters/"

echo "=== Проверка на сервере ==="
REMOTE_LIST=""
for f in "${VIDEO_FILES[@]}"; do REMOTE_LIST+=" '$REMOTE_DIR/$f'"; done
for p in "${POSTER_NAMES[@]}"; do REMOTE_LIST+=" '$REMOTE_DIR/posters/$p.jpg'"; done
ssh "${SSH_OPTS[@]}" "$DEPLOY_SSH" "ls -l $REMOTE_LIST"

echo "Готово. Ролики доступны по /uploads/clips/ (nginx alias на public/uploads/)."
