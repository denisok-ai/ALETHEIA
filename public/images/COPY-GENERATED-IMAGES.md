# Почему фото не обновились на сайте

**Причина:** картинки лежат в папке **Cursor** (на диске C:), а не в папке проекта **ALETHEIA**. Next.js отдаёт только файлы из `public/` вашего проекта — поэтому пока вы не скопируете файлы сюда, они не появятся на сайте.

Ниже — куда копировать и как скопировать.

## Папка с картинками (Windows)

```
C:\Users\user\.cursor\projects\wsl-localhost-Ubuntu-24-04-home-denisok-projects-ALETHEIA\assets\
```

## Куда копировать

| Файл в assets | Скопировать в |
|---------------|----------------|
| `hero-bg.png` | `public/images/hero/hero-bg.png` |
| `hero-banner.png` | `public/images/thematic/hero-banner.png` |
| `about-path.png` | `public/images/thematic/about-path.png` |
| `program-energy.png` | `public/images/thematic/program-energy.png` |
| `author-bg.png` | `public/images/author/author-bg.png` |

## Быстрое копирование

### Вариант A: PowerShell (копировать в папку проекта WSL)

**Важно:** укажите полный путь к проекту в WSL, иначе файлы могут попасть не туда.

```powershell
$src = "$env:USERPROFILE\.cursor\projects\wsl-localhost-Ubuntu-24-04-home-denisok-projects-ALETHEIA\assets"
$dst = "\\wsl.localhost\Ubuntu-24.04\home\denisok\projects\ALETHEIA\public\images"
Copy-Item "$src\hero-bg.png" "$dst\hero\hero-bg.png" -Force
Copy-Item "$src\hero-banner.png" "$dst\thematic\hero-banner.png" -Force
Copy-Item "$src\about-path.png" "$dst\thematic\about-path.png" -Force
Copy-Item "$src\program-energy.png" "$dst\thematic\program-energy.png" -Force
Copy-Item "$src\author-bg.png" "$dst\author\author-bg.png" -Force
```

### Вариант B: WSL (терминал bash внутри WSL)

Сначала откройте терминал WSL в Cursor, затем:

```bash
SRC="/mnt/c/Users/$USER/.cursor/projects/wsl-localhost-Ubuntu-24-04-home-denisok-projects-ALETHEIA/assets"
DST="/home/denisok/projects/ALETHEIA/public/images"
cp "$SRC/hero-bg.png" "$DST/hero/hero-bg.png"
cp "$SRC/hero-banner.png" "$DST/thematic/hero-banner.png"
cp "$SRC/about-path.png" "$DST/thematic/about-path.png"
cp "$SRC/program-energy.png" "$DST/thematic/program-energy.png"
cp "$SRC/author-bg.png" "$DST/author/author-bg.png"
```

Если папка `assets` не найдена, замените `$USER` на ваше имя пользователя Windows (например `user`).

---

## Вариант 2: Проводник (перетащить мышкой)

1. Откройте папку с картинками (вставьте в адресную строку проводника):
   ```
   %USERPROFILE%\.cursor\projects\wsl-localhost-Ubuntu-24-04-home-denisok-projects-ALETHEIA\assets
   ```
2. Откройте папку проекта (в Cursor: правый клик по `public/images` → «Reveal in File Explorer» или откройте вручную путь к ALETHEIA).
3. Перетащите:
   - `hero-bg.png` → в папку `hero`
   - `hero-banner.png`, `about-path.png`, `program-energy.png` → в папку `thematic`
   - `author-bg.png` → в папку `author`

---

## Вариант 3: Скрипт из WSL

Из корня проекта в терминале WSL:

```bash
bash scripts/copy-generated-images.sh
```

Если скрипт пишет «Папка не найдена» — скопируйте вручную по варианту 1 или 2.

---

## После копирования

1. Остановите dev-сервер (Ctrl+C) и снова запустите: `npm run dev`.
2. В браузере сделайте **жёсткое обновление**: Ctrl+Shift+R (или Cmd+Shift+R на Mac), чтобы сбросить кэш картинок.
