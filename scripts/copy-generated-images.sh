#!/bin/bash
# Копирует сгенерированные картинки из папки Cursor assets в public/images.
# Запуск из корня проекта: bash scripts/copy-generated-images.sh

set -e
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Папка Cursor assets (Windows — в WSL доступна как /mnt/c/...)
ASSETS_WIN="$HOME/.cursor/projects/wsl-localhost-Ubuntu-24-04-home-denisok-projects-ALETHEIA/assets"
ASSETS_MNT="/mnt/c/Users/$USER/.cursor/projects/wsl-localhost-Ubuntu-24-04-home-denisok-projects-ALETHEIA/assets"

if [ -d "$ASSETS_WIN" ]; then
  SRC="$ASSETS_WIN"
elif [ -d "$ASSETS_MNT" ]; then
  SRC="$ASSETS_MNT"
else
  echo "Папка с картинками не найдена. Скопируйте вручную из:"
  echo "  Windows: C:\\Users\\%USERNAME%\\.cursor\\projects\\wsl-localhost-Ubuntu-24-04-home-denisok-projects-ALETHEIA\\assets"
  echo "в public/images/ (см. public/images/COPY-GENERATED-IMAGES.md)"
  exit 1
fi

mkdir -p public/images/hero public/images/thematic public/images/author

for name in hero-bg hero-banner about-path program-energy author-bg; do
  case $name in
    hero-bg)      dest="public/images/hero/hero-bg.png" ;;
    hero-banner)  dest="public/images/thematic/hero-banner.png" ;;
    about-path)   dest="public/images/thematic/about-path.png" ;;
    program-energy) dest="public/images/thematic/program-energy.png" ;;
    author-bg)    dest="public/images/author/author-bg.png" ;;
  esac
  if [ -f "$SRC/${name}.png" ]; then
    cp "$SRC/${name}.png" "$dest"
    echo "OK: $dest"
  else
    echo "Пропуск (нет файла): $SRC/${name}.png"
  fi
done

echo "Готово. Перезапустите dev-сервер и обновите страницу с полным обновлением (Ctrl+Shift+R)."
