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
- UI (flat green background): cut out like SPRITES, written to assets/ui/<name>.png; the
  frames (panel, buttons, slot frame) without a margin, since CSS slices them at their edges.
- BACKGROUNDS (full-frame paintings): resized to the listed width, written to
  assets/ui/<name>.jpg.

Needs Python 3 with Pillow and NumPy.
Usage: python scripts/cutout.py [name ...]   (no names: every image)
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'art-src'
OUT = ROOT / 'assets' / 'sprites'
TEX_OUT = ROOT / 'assets' / 'textures'
UI_OUT = ROOT / 'assets' / 'ui'

# Output height in pixels per sprite.
SPRITES = {
    'proj-censer': 192,
    'proj-orb': 192,
    'proj-arrow': 192,
    'feather': 192,
    'spark': 192,
    'ember': 192,
    # A world sprite 0.12 m across (M9 §5.1, the Field of Blood's toss).
    'coin': 128,
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
    'icon-field-of-blood': 128,
    'icon-shadowstep': 128,
    'class-fallen': 128,
    'class-heretic': 128,
    'class-binder': 128,
    'class-betrayer': 128,
}

# Icons painted inside a dark frame with a glow around it (light-frame trimming can't find it):
# this fraction of the image is cut off each side first.
ICON_INSET = {'icon-field-of-blood': 0.125}

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

# Transparent margin around the cropped subject, in output pixels.
MARGIN = 2

# UI images: output height in pixels and margin. The frames are 9-slice images (CSS
# border-image): about twice the size they're drawn at, for high-DPI screens.
UI = {
    'ui-logo': (320, MARGIN),
    'ui-panel': (512, 0),
    'ui-button': (192, 0),
    'ui-button-hover': (192, 0),
    'ui-slot-frame': (256, 0),
    'ui-bar-frame': (128, 0),
}

# Frames whose inside must be empty (the generated green inside can be uneven or smudged):
# everything within the rim's inner edge, found scanning out from the center, is cleared.
HOLLOW = {'ui-slot-frame', 'ui-bar-frame'}

# Lettering whose letters touch (the image generator won't space the logo's letters): the
# number of letters and the gap to add between them, as a fraction of the lettering's height.
SPACED = {'ui-logo': (10, 0.1)}

# Full-frame paintings: output width in pixels.
BACKGROUNDS = {
    'ui-title-bg': 1920,
}

# Sprites with some green of their own (the lilies' stems). Pixels with less than
# OWN_GREEN of the background's greenness are kept as they are, not keyed or despilled.
HAS_GREEN = {'decor-lily-urn'}
OWN_GREEN = 0.15



def greenness(rgb: np.ndarray) -> np.ndarray:
    """How much green exceeds the other two channels. No palette color has any."""
    return rgb[..., 1] - np.maximum(rgb[..., 0], rgb[..., 2])


def cutout(name: str, height: int, out_dir: Path = OUT, margin: int = MARGIN) -> None:
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

    if name in SPACED:
        color, alpha = space_letters(color, alpha, *SPACED[name])

    if name in HOLLOW:
        h, w = alpha.shape
        cy, cx = h // 2, w // 2
        rim = alpha >= 0.9
        top = cy - np.argmax(rim[cy::-1, cx])
        bottom = cy + np.argmax(rim[cy:, cx])
        left = cx - np.argmax(rim[cy, cx::-1])
        right = cx + np.argmax(rim[cy, cx:])
        alpha[top + 1:bottom, left + 1:right] = np.where(rim[top + 1:bottom, left + 1:right], alpha[top + 1:bottom, left + 1:right], 0)

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
    inner = height - 2 * margin
    width = max(1, round(inner * (x1 - x0) / (y1 - y0)))
    img = Image.fromarray(rgba, 'RGBA').convert('RGBa').resize((width, inner), Image.LANCZOS).convert('RGBA')
    out = Image.new('RGBA', (width + 2 * margin, height), (0, 0, 0, 0))
    out.paste(img, (margin, margin))
    out.save(out_dir / f'{name}.png', optimize=True)
    print(f'{name}: {out.width}x{out.height}')


def space_letters(color: np.ndarray, alpha: np.ndarray, letters: int, gap: float) -> tuple[np.ndarray, np.ndarray]:
    """Moves touching letters apart and redraws the ink outline around them.

    Specks floating free of the letters (the logo's embers) are dropped: a few pixels each,
    their color is mostly the green they were mixed with.

    The cuts are the cheapest top-to-bottom paths through the lettering: through transparent
    pixels and the dark outline rather than the bright letters, wandering sideways at a small
    cost. Of their ends, the letters - 1 cheapest that are well apart are used.
    """
    h, w = alpha.shape
    solid = Image.fromarray(((alpha >= 0.5) * 255).astype(np.uint8)).copy()  # writable, for floodfill
    body = np.nonzero((alpha >= 0.5).sum(axis=1) > 0.15 * (alpha >= 0.5).sum(axis=1).max())[0]
    mid = (body[0] + body[-1]) // 2
    for x in range(w):
        if solid.getpixel((x, mid)) == 255:
            ImageDraw.floodfill(solid, (x, mid), 128)
    # Keep only what's at or near the letters, so the specks' soft edges go too.
    letters_mask = Image.fromarray(((np.asarray(solid) == 128) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))
    alpha = np.where(np.asarray(letters_mask) > 0, alpha, 0)

    cost = alpha * (0.05 + color.max(axis=2) / 255)
    move = 0.08
    total = cost[0].copy()
    step = np.zeros((h, w), dtype=np.int8)
    for y in range(1, h):
        options = np.stack([np.r_[np.inf, total[:-1]] + move, total, np.r_[total[1:], np.inf] + move])
        choice = options.argmin(axis=0)
        step[y] = choice - 1
        total = options.min(axis=0) + cost[y]

    xs = np.nonzero((alpha >= 0.5).any(axis=0))[0]
    spacing = (xs[-1] - xs[0]) / letters
    window = round(spacing / 4)
    ends = [x for x in range(xs[0] + window, xs[-1] - window) if total[x] == total[x - window:x + window + 1].min()]
    cuts: list[int] = []
    for x in sorted(ends, key=lambda x: total[x]):
        if all(abs(x - c) >= 0.45 * spacing for c in cuts):
            cuts.append(x)
        if len(cuts) == letters - 1:
            break
    paths = []
    for x in sorted(cuts):
        path = np.empty(h, dtype=int)
        for y in range(h - 1, -1, -1):
            path[y] = x
            x += int(step[y, x])
        paths.append(path)

    # Each letter is what lies between its two cuts; letter i moves right by i gaps.
    rows = np.arange(h)[:, None]
    cols = np.arange(w)[None, :]
    letter = sum((cols >= p[:, None]).astype(int) for p in paths)
    shift = round(gap * np.ptp(np.nonzero((alpha >= 0.5).any(axis=1))[0]))
    out_w = w + (letters - 1) * shift
    out_color = np.zeros((h, out_w, 3), dtype=np.float32)
    out_alpha = np.zeros((h, out_w), dtype=np.float32)
    dest = cols + letter * shift
    out_color[rows, dest] = color
    out_alpha[rows, dest] = alpha

    # The cuts left edges without ink: draw an outline around everything, under the letters.
    radius = max(1, round(h / 150))
    ink = np.asarray(Image.fromarray((out_alpha * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * radius + 1))).astype(np.float32) / 255
    ink_color = np.array([18, 12, 10], dtype=np.float32)
    a = out_alpha[..., None]
    combined = a + ink[..., None] * (1 - a)
    with np.errstate(divide='ignore', invalid='ignore'):
        out_color = np.nan_to_num((out_color * a + ink_color * ink[..., None] * (1 - a)) / combined)
    return out_color, combined[..., 0]


def icon(name: str, size: int) -> None:
    img = Image.open(SRC / f'{name}.png').convert('RGB')
    if name in ICON_INSET:
        k = round(ICON_INSET[name] * img.width), round(ICON_INSET[name] * img.height)
        img = img.crop((k[0], k[1], img.width - k[0], img.height - k[1]))

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


def background(name: str, width: int) -> None:
    img = Image.open(SRC / f'{name}.png').convert('RGB')
    height = round(width * img.height / img.width)
    img.resize((width, height), Image.LANCZOS).save(UI_OUT / f'{name}.jpg', quality=88, optimize=True)
    print(f'{name}: {width}x{height}')


def main() -> None:
    known = [*SPRITES, *ICONS, *TEXTURES, *EFFECTS, *UI, *BACKGROUNDS]
    for name in sys.argv[1:] or known:
        if name in SPRITES:
            cutout(name, SPRITES[name])
        elif name in ICONS:
            icon(name, ICONS[name])
        elif name in TEXTURES:
            texture(name, TEXTURES[name])
        elif name in EFFECTS:
            effect(name, *EFFECTS[name])
        elif name in UI:
            cutout(name, UI[name][0], UI_OUT, UI[name][1])
        elif name in BACKGROUNDS:
            background(name, BACKGROUNDS[name])
        else:
            sys.exit(f'Unknown image {name}; known: {", ".join(known)}')


if __name__ == '__main__':
    main()
