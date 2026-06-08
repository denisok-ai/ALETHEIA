#!/usr/bin/env python3
"""Ресайз обложки до 1536×1024 (3:2) под блок тарифа. Требует: pip install pillow."""
from pathlib import Path

try:
    from PIL import Image, ImageFilter
except ImportError:
    raise SystemExit("Установи Pillow: pip install pillow") from None

ROOT = Path(__file__).resolve().parents[1]
# Полноразмерный исходник обложки (в репо: assets/probuzhdenie-card-cover-source.png).
SRC = ROOT / "assets/probuzhdenie-card-cover-source.png"
OUT = ROOT / "public/images/probuzhdenie/card-cover.png"
TARGET = (1536, 1024)


def cover_resize(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    tw, th = size
    sw, sh = im.size
    scale = max(tw / sw, th / sh)
    nw, nh = int(sw * scale + 0.5), int(sh * scale + 0.5)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return im.crop((left, top, left + tw, top + th))


def main() -> None:
    if not SRC.is_file():
        raise SystemExit(f"Нет исходника: {SRC}")
    im = Image.open(SRC).convert("RGB")
    out_im = cover_resize(im, TARGET)
    # Лёгкая резкость после даунскейла (генератор часто отдаёт 1536×1024 — без этого картинка «мыльная»).
    out_im = out_im.filter(ImageFilter.UnsharpMask(radius=1.0, percent=130, threshold=2))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out_im.save(OUT, "PNG", optimize=True)
    print("written", OUT, out_im.size)


if __name__ == "__main__":
    main()
