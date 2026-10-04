"""Cuts generated 2D art out of its green background into game sprites (§11.2).

Reads assets/art-src/<name>.png (flat green background), writes assets/sprites/<name>.png:
the green keyed out, the green spill removed from the edges, cropped to the subject and
resized to the height in SPRITES. The atlas draws PNG sprites at their own size.

Needs Python 3 with Pillow and NumPy.
Usage: python scripts/cutout.py [name ...]   (no names: every sprite)
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'art-src'
OUT = ROOT / 'assets' / 'sprites'

# Output height in pixels per sprite.
SPRITES = {
    'proj-censer': 192,
    'proj-orb': 192,
    'proj-arrow': 192,
    'feather': 192,
    'spark': 192,
    'ember': 192,
    'mark': 192,
    'chain-ring': 128,
}

# Transparent margin around the cropped subject, in output pixels.
MARGIN = 2


def greenness(rgb: np.ndarray) -> np.ndarray:
    """How much green exceeds the other two channels. No palette color has any."""
    return rgb[..., 1] - np.maximum(rgb[..., 0], rgb[..., 2])


def cutout(name: str, height: int) -> None:
    rgb = np.asarray(Image.open(SRC / f'{name}.png').convert('RGB')).astype(np.float32)

    # The background color, from the corners.
    k = 16
    corners = np.concatenate([c.reshape(-1, 3) for c in (rgb[:k, :k], rgb[:k, -k:], rgb[-k:, :k], rgb[-k:, -k:])])
    bg = np.median(corners, axis=0)
    bg_green = greenness(bg)

    # Each pixel is a mix of the subject and the background; its greenness says how much
    # background it holds. Unmixing recovers the subject's color at the edges.
    bg_share = np.clip(greenness(rgb) / bg_green, 0, 1)
    bg_share[bg_share < 0.08] = 0  # JPEG noise inside the subject
    alpha = 1 - bg_share
    with np.errstate(divide='ignore', invalid='ignore'):
        color = (rgb - bg_share[..., None] * bg) / alpha[..., None]
    color = np.nan_to_num(np.clip(color, 0, 255))
    # Whatever green is left is spill: no palette color has more green than red or blue.
    color[..., 1] = np.minimum(color[..., 1], np.maximum(color[..., 0], color[..., 2]))

    # Crop to the pixels the game keeps (at least 50% opaque).
    ys, xs = np.nonzero(alpha >= 0.5)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.dstack([color, alpha * 255])[y0:y1, x0:x1].round().astype(np.uint8)

    # Resize premultiplied, so transparent pixels don't bleed their color into the edges.
    inner = height - 2 * MARGIN
    width = max(1, round(inner * (x1 - x0) / (y1 - y0)))
    img = Image.fromarray(rgba, 'RGBA').convert('RGBa').resize((width, inner), Image.LANCZOS).convert('RGBA')
    out = Image.new('RGBA', (width + 2 * MARGIN, height), (0, 0, 0, 0))
    out.paste(img, (MARGIN, MARGIN))
    out.save(OUT / f'{name}.png', optimize=True)
    print(f'{name}: {out.width}x{out.height}')


def main() -> None:
    names = sys.argv[1:] or list(SPRITES)
    for name in names:
        if name not in SPRITES:
            sys.exit(f'Unknown sprite {name}; known: {", ".join(SPRITES)}')
        cutout(name, SPRITES[name])


if __name__ == '__main__':
    main()
