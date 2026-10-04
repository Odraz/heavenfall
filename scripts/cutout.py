"""Turns generated 2D art into game sprites (§11.2).

Reads assets/art-src/<name>.png, writes assets/sprites/<name>.png.
- SPRITES (flat green background): the green keyed out, the green spill removed from the
  edges, cropped to the subject and resized to the listed height. The atlas draws PNG
  sprites at their own size.
- ICONS (painted background filling the square): any light frame around the painting
  trimmed, then cropped to a centered square of the listed size.
- TEXTURES (seamless terrain textures): resized to the listed size, wrapping around the
  edges so they stay seamless; written to assets/textures/<name>.png.
- EFFECTS (effect textures on black): brightness turned into opacity, so black becomes
  transparent and the color stays true over the bright world; resized to the listed width
  and written to assets/textures/<name>.png. Strips (beam, chain) repeat along their
  length: they are cropped to the rows that aren't black and their side seams smoothed.

Needs Python 3 with Pillow and NumPy.
Usage: python scripts/cutout.py [name ...]   (no names: every image)
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'art-src'
OUT = ROOT / 'assets' / 'sprites'
TEX_OUT = ROOT / 'assets' / 'textures'

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
    # Decorations: about 170 px per meter of their height in src/data/decor.ts, at least 192.
    'decor-candelabrum': 320,
    'decor-lily-urn': 192,
    'decor-harp': 256,
    'decor-cloud-tuft': 192,
    'decor-angel-statue': 512,
    'decor-fountain': 352,
    # HUD: 10vh wide, so 256 stays sharp up to 2560 px tall screens.
    'muzzle-flash': 256,
}

# Sprites drawn centered on a point (the muzzle flash on the muzzle): cropped symmetrically
# around the image center, so the center stays where the painting put it.
CENTERED = {'muzzle-flash'}

# Icons: output size in pixels. Ability icons show at 64 CSS px, so 128 stays sharp on
# high-DPI screens; class icons are for the party frames.
ICONS = {
    'icon-blasphemy': 128,
    'icon-falling-star': 128,
    'icon-communion': 128,
    'icon-shroud': 128,
    'icon-chains': 128,
    'icon-discord': 128,
    'icon-kiss': 128,
    'icon-shadowstep': 128,
    'class-fallen': 128,
    'class-heretic': 128,
    'class-binder': 128,
    'class-betrayer': 128,
}

# Terrain textures (§11.1): output size in pixels, each covering 4 × 4 m.
TEXTURES = {
    'tex-floor': 1024,
    'tex-riser': 1024,
    'tex-wall': 1024,
    'tex-door': 1024,
}

# Effect textures: output width in pixels, whether it's a strip repeated left to right, and
# an opacity gain (the chain's dim red edges would be see-through at 1).
EFFECTS = {
    'fx-ring': (512, False, 1),
    'fx-glow': (256, False, 1),
    'fx-smoke': (512, False, 1),
    'fx-beam': (256, True, 1),
    'fx-chain': (512, True, 2.5),
}

# Sprites with some green of their own (the lilies' stems). Pixels with less than
# OWN_GREEN of the background's greenness are kept as they are, not keyed or despilled.
HAS_GREEN = {'decor-lily-urn'}
OWN_GREEN = 0.15

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
    bg_share[bg_share < (OWN_GREEN if name in HAS_GREEN else 0.08)] = 0  # JPEG noise inside the subject
    alpha = 1 - bg_share
    with np.errstate(divide='ignore', invalid='ignore'):
        color = (rgb - bg_share[..., None] * bg) / alpha[..., None]
    color = np.nan_to_num(np.clip(color, 0, 255))
    # Whatever green is left is spill: no palette color has more green than red or blue.
    spill = bg_share > 0 if name in HAS_GREEN else np.full(alpha.shape, True)
    color[..., 1] = np.where(spill, np.minimum(color[..., 1], np.maximum(color[..., 0], color[..., 2])), color[..., 1])

    # Crop to the pixels the game keeps (at least 50% opaque).
    ys, xs = np.nonzero(alpha >= 0.5)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    if name in CENTERED:
        h, w = alpha.shape
        dy = max(h / 2 - y0, y1 - h / 2)
        dx = max(w / 2 - x0, x1 - w / 2)
        y0, y1, x0, x1 = round(h / 2 - dy), round(h / 2 + dy), round(w / 2 - dx), round(w / 2 + dx)
    rgba = np.dstack([color, alpha * 255])[y0:y1, x0:x1].round().astype(np.uint8)

    # Resize premultiplied, so transparent pixels don't bleed their color into the edges.
    inner = height - 2 * MARGIN
    width = max(1, round(inner * (x1 - x0) / (y1 - y0)))
    img = Image.fromarray(rgba, 'RGBA').convert('RGBa').resize((width, inner), Image.LANCZOS).convert('RGBA')
    out = Image.new('RGBA', (width + 2 * MARGIN, height), (0, 0, 0, 0))
    out.paste(img, (MARGIN, MARGIN))
    out.save(OUT / f'{name}.png', optimize=True)
    print(f'{name}: {out.width}x{out.height}')


def icon(name: str, size: int) -> None:
    img = Image.open(SRC / f'{name}.png').convert('RGB')

    # Trim rows and columns of a light frame (some images come with a white border),
    # plus 1% more, so the frame's soft inner edge goes too.
    bright = np.asarray(img.convert('L')) > 200
    rows = np.nonzero(bright.mean(axis=1) < 0.9)[0]
    cols = np.nonzero(bright.mean(axis=0) < 0.9)[0]
    y0, y1, x0, x1 = rows[0], rows[-1] + 1, cols[0], cols[-1] + 1
    if (y0, y1, x0, x1) != (0, img.height, 0, img.width):
        inset = round(0.01 * max(img.size))
        y0, y1, x0, x1 = y0 + inset, y1 - inset, x0 + inset, x1 - inset

    # A centered square.
    side = min(y1 - y0, x1 - x0)
    top = y0 + (y1 - y0 - side) // 2
    left = x0 + (x1 - x0 - side) // 2
    out = img.crop((left, top, left + side, top + side)).resize((size, size), Image.LANCZOS)
    out.save(OUT / f'{name}.png', optimize=True)
    print(f'{name}: {size}x{size}')


def texture(name: str, size: int) -> None:
    rgb = np.asarray(Image.open(SRC / f'{name}.png').convert('RGB'))
    # Pad with the opposite edges, so resampling near an edge sees what the tiling puts there.
    scale = size / rgb.shape[1]
    pad = 16
    padded = Image.fromarray(np.pad(rgb, ((pad, pad), (pad, pad), (0, 0)), mode='wrap'))
    big = round((rgb.shape[1] + 2 * pad) * scale)
    p = round(pad * scale)
    out = padded.resize((big, big), Image.LANCZOS).crop((p, p, p + size, p + size))
    TEX_OUT.mkdir(exist_ok=True)
    out.save(TEX_OUT / f'{name}.png', optimize=True)
    print(f'{name}: {size}x{size}')


def effect(name: str, width: int, strip: bool, gain: float) -> None:
    rgb = np.asarray(Image.open(SRC / f'{name}.png').convert('RGB')).astype(np.float32)
    if strip:
        # Crop to the rows that aren't black.
        rows = np.nonzero(rgb.max(axis=2).mean(axis=1) > 4)[0]
        rgb = rgb[rows[0]:rows[-1] + 1]
        # Smooth the side seam: spread the difference between the two edge columns, blurred
        # down the rows so only its broad shape is corrected, over a band at each side.
        diff = rgb[:, 0] - rgb[:, -1]
        k = 31
        diff = np.stack([np.convolve(np.pad(diff[:, c], k // 2, mode='edge'), np.ones(k) / k, mode='valid') for c in range(3)], axis=1)
        band = rgb.shape[1] // 10
        ramp = (1 - np.arange(band) / band)[None, :, None]
        rgb[:, :band] -= diff[:, None] / 2 * ramp
        rgb[:, -band:] += diff[:, None] / 2 * ramp[:, ::-1]
        rgb = np.clip(rgb, 0, 255)

    # Brightness becomes opacity (above the JPEG's near-black floor), times the gain; the color
    # is divided by the brightness, so drawn over black at gain 1 it matches the original.
    alpha = np.clip((rgb.max(axis=2) - 3) / 252, 0, 1)
    color_alpha = alpha
    alpha = np.minimum(alpha * gain, 1)
    with np.errstate(divide='ignore', invalid='ignore'):
        color = np.nan_to_num(np.clip(rgb / np.maximum(color_alpha, 1e-6)[..., None], 0, 255))
    rgba = np.dstack([color, alpha * 255]).round().astype(np.uint8)

    height = round(width * rgba.shape[0] / rgba.shape[1])
    img = Image.fromarray(rgba, 'RGBA').convert('RGBa')
    if strip:
        # Pad with the opposite side, so resampling near a side sees what the tiling puts there.
        pad = 16
        padded = Image.fromarray(np.pad(np.asarray(img), ((0, 0), (pad, pad), (0, 0)), mode='wrap'), 'RGBa')
        p = round(pad * width / rgba.shape[1])
        img = padded.resize((width + 2 * p, height), Image.LANCZOS).crop((p, 0, p + width, height))
    else:
        img = img.resize((width, height), Image.LANCZOS)
    TEX_OUT.mkdir(exist_ok=True)
    img.convert('RGBA').save(TEX_OUT / f'{name}.png', optimize=True)
    print(f'{name}: {width}x{height}')


def main() -> None:
    known = [*SPRITES, *ICONS, *TEXTURES, *EFFECTS]
    for name in sys.argv[1:] or known:
        if name in SPRITES:
            cutout(name, SPRITES[name])
        elif name in ICONS:
            icon(name, ICONS[name])
        elif name in TEXTURES:
            texture(name, TEXTURES[name])
        elif name in EFFECTS:
            effect(name, *EFFECTS[name])
        else:
            sys.exit(f'Unknown image {name}; known: {", ".join(known)}')


if __name__ == '__main__':
    main()
