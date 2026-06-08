#!/usr/bin/env bash
# Локальный helper: копирует загруженные пользователем фото-референсы из assets Cursor в public/images/probuzhdenie.
# Запускать на ПК в WSL: bash scripts/local-copy-probuzhdenie-images.sh
set -euo pipefail
SRC=${SRC:-"/mnt/c/Users/Denisok/.cursor/projects/wsl-localhost-Ubuntu-home-denisok-projects-AVATERRA/assets"}
DST="$(cd "$(dirname "$0")/.." && pwd)/public/images/probuzhdenie"
mkdir -p "$DST"

declare -A MAP=(
  ["c__Users_HIPER_AppData_Roaming_Cursor_User_workspaceStorage_0a115afbe2a243b8348e6d0150b56696_images_photo_2026-05-03_11-43-40-47ab60fb-07c3-492a-96a4-ab4f932fa919.png"]="sunset-dance.png"
  ["c__Users_HIPER_AppData_Roaming_Cursor_User_workspaceStorage_bba87faecd1c42f889130e19b9e96f80_images_photo_2026-05-03_11-43-40-8f0c73d3-d7e0-4b37-9340-e45c8692e8c0.png"]="week3-bird-shadow.png"
  ["c__Users_HIPER_AppData_Roaming_Cursor_User_workspaceStorage_0a115afbe2a243b8348e6d0150b56696_images_photo_2026-05-03_11-43-34-a83cefa4-fef9-498b-abf8-7f88e16161e8.png"]="week1-meditation.png"
  ["c__Users_HIPER_AppData_Roaming_Cursor_User_workspaceStorage_bba87faecd1c42f889130e19b9e96f80_images_photo_2026-05-03_11-43-38-34c41cc2-0bc2-4e17-936d-d1c2834953d3.png"]="week2-cleansing.png"
  ["c__Users_HIPER_AppData_Roaming_Cursor_User_workspaceStorage_bba87faecd1c42f889130e19b9e96f80_images_photo_2026-05-03_11-43-17-4c61bf7e-cf26-4dd3-beab-f838e61bd51b.png"]="autopilot-robots.png"
  ["c__Users_HIPER_AppData_Roaming_Cursor_User_workspaceStorage_0a115afbe2a243b8348e6d0150b56696_images_photo_2026-05-03_11-43-26-ea783ac2-29c2-4c2f-b2f3-8ba777cfcfe4.png"]="pain-stuck.png"
  ["c__Users_HIPER_AppData_Roaming_Cursor_User_workspaceStorage_bba87faecd1c42f889130e19b9e96f80_images_photo_2026-05-03_11-43-34-623d8227-425f-4c9a-8d09-6a1b85bdc3f9.png"]="hero-awakening.png"
  ["c__Users_HIPER_AppData_Roaming_Cursor_User_workspaceStorage_bba87faecd1c42f889130e19b9e96f80_images_photo_2026-05-03_11-43-20-29b72c90-3d00-43fa-981a-cb5521fc2e04.png"]="hero-berlinska-key.png"
  ["c__Users_HIPER_AppData_Roaming_Cursor_User_workspaceStorage_0a115afbe2a243b8348e6d0150b56696_images_photo_2026-05-03_11-43-38-0e88c626-9c69-4bae-aefc-5f8361e68133.png"]="cover-touch.png"
)

for src in "${!MAP[@]}"; do
  if [[ -f "$SRC/$src" ]]; then
    cp "$SRC/$src" "$DST/${MAP[$src]}"
    echo "ok: ${MAP[$src]}"
  else
    echo "skip (нет файла): $src"
  fi
done

echo "готово, см. $DST"
