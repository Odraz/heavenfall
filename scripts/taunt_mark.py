"""Draws the `!` taunt sprite (M8 §11): a red exclamation mark with a thick dark outline, 128 px tall.

Usage: python scripts/taunt_mark.py  (writes assets/sprites/taunt.png)

It's drawn at 4x and scaled down, so the edges are smooth. The outline matches the enemies' ink
(the soot color of §1) and is thick enough to read against Heaven's bright gold and ivory.
"""
from pathlib import Path

from PIL import Image, ImageDraw

HEIGHT = 128
SCALE = 4
INK = (27, 21, 19, 255)
RED = (224, 48, 30, 255)
HIGHLIGHT = (255, 122, 90, 255)
OUT = Path(__file__).resolve().parent.parent / 'assets' / 'sprites' / 'taunt.png'


def shapes(d: ImageDraw.ImageDraw, grow: float, fill) -> None:
    """The bar (a wedge, wide at the top) and the dot, grown by `grow` px for the outline."""
    s = SCALE
    cx = 32 * s
    top = 8 * s
    bar_bottom = 84 * s
    d.polygon(
        [
            (cx - 17 * s - grow, top - grow),
            (cx + 17 * s + grow, top - grow),
            (cx + 8 * s + grow, bar_bottom + grow),
            (cx - 8 * s - grow, bar_bottom + grow),
        ],
        fill=fill,
    )
    # Round the bar's top corners.
    d.ellipse((cx - 17 * s - grow, top - 6 * s - grow, cx + 17 * s + grow, top + 8 * s + grow), fill=fill)
    r = 12 * s + grow
    cy = 106 * s
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=fill)


def main() -> None:
    w, h = 64 * SCALE, HEIGHT * SCALE
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    shapes(d, 7 * SCALE, INK)
    shapes(d, 0, RED)
    # A light streak down the bar's left side, so it reads as a solid shape.
    s = SCALE
    d.polygon([(19 * s, 10 * s), (24 * s, 10 * s), (27 * s, 60 * s), (24 * s, 60 * s)], fill=HIGHLIGHT)
    img = img.crop(img.getbbox())
    out_w = round(img.width * HEIGHT / img.height)
    img = img.resize((out_w, HEIGHT), Image.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT)
    print(f'saved {OUT} ({img.width} x {img.height})')


if __name__ == '__main__':
    main()
