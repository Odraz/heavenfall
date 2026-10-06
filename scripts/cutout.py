"""Turns generated 2D art into game sprites (§11.2).

Reads assets/art-src/<name>.png (or a JPEG with the same base name: .jpg, .jpeg, .jfif; M10
§4.3), writes assets/sprites/<name>.png.
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
- SKIES (M10 §4.2): the horizon band, cropped to the listed width from the left (the mirrored
  sampling makes the right edge meet itself), written to assets/textures/<name>.jpg.

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
    # M10 §5.1: prepared first (PREPARED below), then resized like the others.
    'tex-floor-plain': 1024,
    'tex-floor-medallion': 1024,
    'tex-wall-window': 1024,
    'tex-wall-pilaster': 1024,
    'tex-cornice': 1024,
}

# M10 §5.1 preparation. tex-wall's frieze: its bottom rows, from the gold line above the carved band
# (2 048 px source: rows 1 786-2 047, 0.51 m of the 4 m tile), copied onto the window wall.
FRIEZE_FROM = 1786 / 2048
# The floors' gold lines are 12 px wide in the 2 048 px sources, centered on row and column 1 023.
FLOOR_LINE = (1012, 1036)
# The cornice band (rows 1-1 308 of the source: from the top gold line to the dark line under the
# bottom one), and its pattern's repeat: two palmettes, 1 582 px (by autocorrelation). Two repeats
# fit the 3 168 px source, cut at the column where the two ends match best.
CORNICE_ROWS = (1, 1309)
CORNICE_REPEAT = 1582
CORNICE_REPEATS = 2

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

# Sky bands (M10 §4.2): the width kept from the left edge. sky-day is cut through the axis of the
# floating spire at x 2 701, so the mirror line runs down its middle and the dome beside it, which
# would show twice mirror-imaged, is left out.
SKIES = {
    'sky-day': 2701,
}

# The row where the cloud sea meets the haze, as a fraction of the height from the top (found by eye).
SKY_HORIZON = 0.65

# The sky's colors and proportions, read by src/render/sky.ts.
SKY_GEN = ROOT / 'src' / 'render' / 'sky.gen.ts'

# JPEG quality for images without transparency (M10 §4.3).
JPEG_QUALITY = 88

# Sprites with some green of their own (the lilies' stems). Pixels with less than
# OWN_GREEN of the background's greenness are kept as they are, not keyed or despilled.
HAS_GREEN = {'decor-lily-urn'}
OWN_GREEN = 0.15



def source(name: str) -> Path:
    """The source image: PNG, or a JPEG with the same base name (M10 §4.3)."""
    for ext in ('.png', '.jpg', '.jpeg', '.jfif'):
        if (SRC / f'{name}{ext}').exists():
            return SRC / f'{name}{ext}'
    sys.exit(f'No source image for {name} in {SRC}')


def greenness(rgb: np.ndarray) -> np.ndarray:
    """How much green exceeds the other two channels. No palette color has any."""
    return rgb[..., 1] - np.maximum(rgb[..., 0], rgb[..., 2])


def cutout(name: str, height: int, out_dir: Path = OUT, margin: int = MARGIN) -> None:
    rgb = np.asarray(Image.open(source(name)).convert('RGB')).astype(np.float32)

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
    img = Image.open(source(name)).convert('RGB')
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


def prepare_floor_plain(rgb: np.ndarray) -> np.ndarray:
    """Shifted by half (its cross moves to the edges, hiding the broken veins), with the same thin
    gold cross painted through the new center, so it's a 2 x 2 grid like tex-floor; its marble
    matched to tex-floor's brightness (M10 §5.1)."""
    rgb = rgb.astype(np.float32)
    n = rgb.shape[0]
    shifted = np.roll(rgb, (n // 2, n // 2), axis=(0, 1))
    a, b = FLOOR_LINE
    # The line's pixels are gold (red well above blue); their opacity from how gold they are.
    def paint(strip_src: np.ndarray, strip_dst: np.ndarray) -> np.ndarray:
        gold = strip_src[..., 0] - strip_src[..., 2]
        base = np.median(gold)
        k = np.clip((gold - base - 10) / 50, 0, 1)[..., None]
        return strip_dst * (1 - k) + strip_src * k
    out = shifted.copy()
    out[:, a:b] = paint(rgb[:, a:b], shifted[:, a:b])
    out[a:b, :] = paint(rgb[a:b, :], out[a:b, :])
    floor = np.asarray(Image.open(source('tex-floor')).convert('RGB')).astype(np.float32)
    lum = lambda x: np.median(x.mean(axis=2))
    out *= lum(floor) / lum(out)
    return np.clip(out, 0, 255).astype(np.uint8)


def prepare_wall_window(rgb: np.ndarray) -> np.ndarray:
    """tex-wall's frieze copied into the bottom rows (M10 §5.1)."""
    wall = np.asarray(Image.open(source('tex-wall')).convert('RGB').resize((rgb.shape[1], rgb.shape[0]), Image.LANCZOS))
    out = rgb.copy()
    r = round(FRIEZE_FROM * rgb.shape[0])
    out[r:] = wall[r:]
    trace_window(out)
    return out


def prepare_cornice(rgb: np.ndarray) -> np.ndarray:
    """Cropped to the band and to a whole number of repeats, cut where the ends match best."""
    band = rgb[CORNICE_ROWS[0]:CORNICE_ROWS[1]].astype(np.float32)
    width = CORNICE_REPEAT * CORNICE_REPEATS
    # The column after the crop should equal its first: compare them for every possible start.
    best = min(range(band.shape[1] - width), key=lambda x0: float(((band[:, x0] - band[:, x0 + width]) ** 2).mean()))
    print(f'tex-cornice: band {band.shape[0]} px tall, {width} px from column {best}')
    return band[:, best:best + width].astype(np.uint8)


def trace_window(prepared: np.ndarray) -> None:
    """Traces the window's glass (the sky-blue area inside the frame, its tracery bars included) into
    a symmetric polyline of 23 points in tile coordinates (u 0-1 across, v 0-1 up), written to
    src/render/window.gen.ts (M10 §5.1, §5.3)."""
    rgb = prepared.astype(np.int32)
    h, w, _ = rgb.shape
    blue = (rgb[..., 2] - rgb[..., 0] > 40) & (rgb[..., 2] > 150)
    rows = np.nonzero(blue.any(axis=1))[0]
    top, bottom = rows.min(), rows.max()
    center = (w - 1) / 2
    # Half-width per row: the farthest blue pixel from the center on either side, averaged, so
    # tracery bars inside don't matter.
    half = np.zeros(h)
    for r in range(top, bottom + 1):
        xs = np.nonzero(blue[r])[0]
        half[r] = ((center - xs.min()) + (xs.max() - center)) / 2 + 0.5 if len(xs) else 0
    # Tracery bars and the frame's bevels only ever hide glass, so take the upper envelope over 31
    # rows, then make it widen monotonically from the apex down (a pointed arch only narrows upward).
    smooth = half.copy()
    for r in range(top, bottom + 1):
        smooth[r] = half[max(top, r - 15):min(bottom, r + 15) + 1].max()
    for r in range(top + 1, bottom + 1):
        smooth[r] = max(smooth[r], smooth[r - 1])
    full = np.median(smooth[(top + bottom) // 2:bottom])
    # Where the sides stop being straight: the lowest row above which the width falls under 99%.
    spring = bottom
    while spring > top and smooth[spring] >= 0.99 * full:
        spring -= 1
    side = [bottom, spring] + [round(spring - (spring - top) * k / 10) for k in range(1, 10)]
    left = [(0.5 - (full if r in (bottom, spring) else smooth[r]) / w, 1 - (r + 1) / h if r == bottom else 1 - r / h) for r in side]
    apex = (0.5, 1 - top / h)
    right = [(1 - u, v) for u, v in reversed(left)]
    # Counterclockwise in (u, v): from the bottom right up the right side, over the apex, down the left.
    pts = list(reversed(left + [apex] + right))
    seen = []
    for p in pts:
        if p not in seen:
            seen.append(p)
    lines = ',\n'.join(f'  [{u:.4f}, {v:.4f}]' for u, v in seen)
    (ROOT / 'src' / 'render' / 'window.gen.ts').write_text(
        '// Generated by scripts/cutout.py from the prepared tex-wall-window (M10 §5.1). Do not edit.\n'
        '/** The window\'s glass outline in tile coordinates (u across, v up), counterclockwise. */\n'
        f'export const WINDOW_GLASS: ReadonlyArray<readonly [number, number]> = [\n{lines},\n];\n',
        encoding='utf8',
    )
    print(f'tex-wall-window: glass outline of {len(seen)} points, half-width {full / w:.4f}, rows {top}-{bottom}, spring {spring}')


PREPARED = {
    'tex-floor-plain': prepare_floor_plain,
    'tex-wall-window': prepare_wall_window,
    'tex-cornice': prepare_cornice,
}


def texture(name: str, size: int) -> None:
    rgb = np.asarray(Image.open(source(name)).convert('RGB'))
    if name in PREPARED:
        rgb = PREPARED[name](rgb)
    # Pad with the opposite edges, so resampling near an edge sees what the tiling puts there.
    # Non-square images (the cornice band) are squeezed into the square.
    pad = 16
    padded = Image.fromarray(np.pad(rgb, ((pad, pad), (pad, pad), (0, 0)), mode='wrap'))
    sx = size / rgb.shape[1]
    sy = size / rgb.shape[0]
    big = (round((rgb.shape[1] + 2 * pad) * sx), round((rgb.shape[0] + 2 * pad) * sy))
    px, py = round(pad * sx), round(pad * sy)
    out = padded.resize(big, Image.LANCZOS).crop((px, py, px + size, py + size))
    TEX_OUT.mkdir(exist_ok=True)
    # No transparency: JPEG (M10 §4.3).
    out.save(TEX_OUT / f'{name}.jpg', quality=JPEG_QUALITY, optimize=True)
    print(f'{name}: {size}x{size}')


def effect(name: str, width: int, strip: bool, gain: float) -> None:
    rgb = np.asarray(Image.open(source(name)).convert('RGB')).astype(np.float32)
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
    img = Image.open(source(name)).convert('RGB')
    height = round(width * img.height / img.width)
    img.resize((width, height), Image.LANCZOS).save(UI_OUT / f'{name}.jpg', quality=JPEG_QUALITY, optimize=True)
    print(f'{name}: {width}x{height}')


def sky(name: str, width: int) -> None:
    img = Image.open(source(name)).convert('RGB')
    img = img.crop((0, 0, min(width, img.width), img.height))
    TEX_OUT.mkdir(exist_ok=True)
    img.save(TEX_OUT / f'{name}.jpg', quality=JPEG_QUALITY, optimize=True)
    print(f'{name}: {img.width}x{img.height}')

    # Colors averaged across a row (M10 §4.2): the top row (above the band), the bottom row (below
    # it) and the horizon row (the fog color); the zenith is the deepest blue in the band's top 5%:
    # the average of its 10% bluest pixels.
    rgb = np.asarray(img).astype(np.float64)
    hex_of = lambda c: '0x' + ''.join(f'{round(v):02x}' for v in c)
    horizon_row = round(SKY_HORIZON * img.height)
    top_rows = rgb[:max(1, round(0.05 * img.height))].reshape(-1, 3)
    blueness = top_rows[:, 2] - top_rows[:, 0]
    zenith = top_rows[blueness >= np.quantile(blueness, 0.9)].mean(axis=0)
    SKY_GEN.write_text(
        '// Generated by scripts/cutout.py from the sky painting (M10 §4.2). Do not edit.\n'
        f'export const SKY_WIDTH = {img.width};\n'
        f'export const SKY_HEIGHT = {img.height};\n'
        '/** The row where the cloud sea meets the haze, in pixels from the top. */\n'
        f'export const SKY_HORIZON_ROW = {horizon_row};\n'
        f'export const SKY_TOP_COLOR = {hex_of(rgb[0].mean(axis=0))};\n'
        f'export const SKY_BOTTOM_COLOR = {hex_of(rgb[-1].mean(axis=0))};\n'
        f'export const SKY_HORIZON_COLOR = {hex_of(rgb[horizon_row].mean(axis=0))};\n'
        f'export const SKY_ZENITH_COLOR = {hex_of(zenith)};\n',
        encoding='utf8',
    )


def key_green(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Unmixes a flat green background like cutout(): the subject's color and its opacity."""
    k = 16
    corners = np.concatenate([c.reshape(-1, 3) for c in (rgb[:k, :k], rgb[:k, -k:], rgb[-k:, :k], rgb[-k:, -k:])])
    greens = rgb.reshape(-1, 3)[greenness(rgb).reshape(-1) > 100]
    bg = np.median(greens if len(greens) else corners, axis=0)
    bg_share = np.clip(greenness(rgb) / greenness(bg), 0, 1)
    bg_share[bg_share < 0.08] = 0
    alpha = 1 - bg_share
    with np.errstate(divide='ignore', invalid='ignore'):
        color = (rgb - bg_share[..., None] * bg) / alpha[..., None]
    color = np.nan_to_num(np.clip(color, 0, 255))
    color[..., 1] = np.minimum(color[..., 1], np.maximum(color[..., 0], color[..., 2]))
    return color, alpha


# The arcade bay (M10 §6): 4 m wide, 8 m tall. The source is 9:16 with plain stone on top; 160 px
# of its own stone is added on top to bring it to 1:2: the stone courses of rows 20-180 between
# the half piers (so the seam falls on a mortar line), and the piers' plain shaft (rows 100-260)
# at the sides, so each pier keeps one capital. Columns 0-76 and 691-767 are the half piers.
ARCADE_ADD = 160
ARCADE_COURSES = (20, 180)
ARCADE_SHAFT = (100, 260)
ARCADE_PIERS = (77, 691)
# The bay in meters, and the balustrade's rail as built in the game (PARAPET in src/sim/heights.ts).
ARCADE_W = 4
ARCADE_H = 8
PARAPET = 1.4


def trace_arch(alpha: np.ndarray, apex_row: int, rail_row: int) -> None:
    """Traces the arch opening above the rail (the edge of the transparent area: both sides from the
    rail up, and the pointed arch) into a symmetric polyline of 31 points in bay meters (x 0-4 across,
    z 0-8 up), written to src/render/arch.gen.ts (M10 §6)."""
    h, w = alpha.shape
    clear = alpha < 0.5
    center = (w - 1) / 2
    # Half-width per row: from the center out to the first opaque pixel on each side, averaged.
    def half(r: int) -> float:
        row = clear[r]
        c = int(round(center))
        left = c
        while left > 0 and row[left - 1]:
            left -= 1
        right = c
        while right < w - 1 and row[right + 1]:
            right += 1
        return ((center - left) + (right - center)) / 2 + 0.5
    rows = list(range(apex_row, rail_row))
    widths = {r: half(r) for r in rows}
    full = np.median([widths[r] for r in rows[len(rows) // 2:]])
    # The spring line: from the apex down, the first row where the opening reaches 99% of its width.
    spring = apex_row
    while spring < rail_row - 1 and widths[spring] < 0.99 * full:
        spring += 1
    m_per_px_x = ARCADE_W / w
    m_per_px_z = ARCADE_H / h
    z_of = lambda r: (h - r) * m_per_px_z
    side = [rail_row, spring] + [round(spring - (spring - apex_row) * k / 14) for k in range(1, 14)]
    left = [(2 - (full if r in (rail_row, spring) else widths[r]) * m_per_px_x, z_of(r)) for r in side]
    pts = left + [(2.0, z_of(apex_row))] + [(4 - x, z) for x, z in reversed(left)]
    # Every point lies on the edge of the transparent area (within 2 px), checked here.
    for x, z in pts:
        r = min(h - 1, max(0, int(round(h - z / m_per_px_z))))
        c = (x / m_per_px_x)
        near = clear[max(0, r - 2):r + 3, max(0, int(c) - 3):int(c) + 3]
        if not (near.any() and (~near).any()):
            sys.exit(f'arch outline point ({x:.3f}, {z:.3f}) is not on the opening\'s edge')
    lines = ',\n'.join(f'  [{x:.4f}, {z:.4f}]' for x, z in pts)
    (ROOT / 'src' / 'render' / 'arch.gen.ts').write_text(
        '// Generated by scripts/cutout.py from the prepared tex-arcade (M10 §6). Do not edit.\n'
        '/** The arch opening above the rail, in bay meters (x 0-4 across, z 0-8 up): from the rail up the left\n'
        ' * side, over the apex and down the right side. */\n'
        f'export const ARCH_OPENING: ReadonlyArray<readonly [number, number]> = [\n{lines},\n];\n',
        encoding='utf8',
    )
    print(f'arch outline: {len(pts)} points, opening {2 * full * m_per_px_x:.3f} m wide, apex {z_of(apex_row):.3f} m')


def arcade(name: str) -> None:
    rgb = np.asarray(Image.open(source(name)).convert('RGB')).astype(np.float32)
    top = rgb[ARCADE_COURSES[0]:ARCADE_COURSES[1]].copy()
    shaft = rgb[ARCADE_SHAFT[0]:ARCADE_SHAFT[1]]
    top[:, :ARCADE_PIERS[0]] = shaft[:, :ARCADE_PIERS[0]]
    top[:, ARCADE_PIERS[1]:] = shaft[:, ARCADE_PIERS[1]:]
    rgb = np.concatenate([top, rgb])
    color, alpha = key_green(rgb)
    h, w = alpha.shape

    # The rail's top: the lowest row of the opening at the bay's center, + 1.
    center = alpha[:, w // 2] < 0.5
    rows = np.nonzero(center)[0]
    opening_bottom = rows[rows < h * 0.85].max() + 1
    rail = (h - opening_bottom) / h * ARCADE_H
    print(f'{name}: rail at {rail:.3f} m (PARAPET {PARAPET} m), apex at {(h - rows.min()) / h * ARCADE_H:.2f} m')
    if abs(rail - PARAPET) > 0.03:
        sys.exit(f'{name}: the rail is at {rail:.3f} m, not PARAPET = {PARAPET} m; update PARAPET in both places')

    trace_arch(alpha, rows.min(), opening_bottom)

    rgba = np.dstack([color, alpha * 255]).round().astype(np.uint8)
    img = Image.fromarray(rgba, 'RGBA').convert('RGBa').resize((1024, 2048), Image.LANCZOS).convert('RGBA')
    TEX_OUT.mkdir(exist_ok=True)
    img.crop((0, 0, 1024, 1024)).save(TEX_OUT / 'arcade-upper.png', optimize=True)
    img.crop((0, 1024, 1024, 2048)).save(TEX_OUT / 'arcade-lower.png', optimize=True)
    print(f'{name}: arcade-upper and arcade-lower, 1024x1024 each')


def main() -> None:
    known = [*SPRITES, *ICONS, *TEXTURES, *EFFECTS, *UI, *BACKGROUNDS, *SKIES, 'tex-arcade']
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
        elif name in SKIES:
            sky(name, SKIES[name])
        elif name == 'tex-arcade':
            arcade(name)
        else:
            sys.exit(f'Unknown image {name}; known: {", ".join(known)}')


if __name__ == '__main__':
    main()
