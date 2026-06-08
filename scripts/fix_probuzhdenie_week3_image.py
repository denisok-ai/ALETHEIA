#!/usr/bin/env python3
"""Если week3-bird-shadow.png — дубликат sunset-dance.png, подставляет cover-touch.png."""
from __future__ import annotations

import hashlib
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "public/images/probuzhdenie"
WEEK3 = IMG / "week3-bird-shadow.png"
SUNSET = IMG / "sunset-dance.png"
COVER = IMG / "cover-touch.png"


def md5(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def main() -> None:
    for p in (WEEK3, SUNSET, COVER):
        if not p.is_file():
            raise SystemExit(f"Нет файла: {p}")
    if md5(WEEK3) == md5(SUNSET):
        shutil.copy2(COVER, WEEK3)
        print("fixed: cover-touch.png -> week3-bird-shadow.png")
    else:
        print("skip: week3-bird-shadow.png уже отличается от sunset-dance.png")


if __name__ == "__main__":
    main()
