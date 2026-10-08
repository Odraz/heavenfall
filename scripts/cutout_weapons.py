"""The painted first-person weapons (M11 §2): the `weapons` kind of scripts/cutout.py.

Each class's painting is keyed, placed in the 3 840 x 2 160 view (a scale, a rotation around the
muzzle and the muzzle's target, from FP below), checked (the barrel's axis aims at the crosshair, the
muzzle is where it should be, nothing above the frame's top row, no cut end in view) and cropped to
the frame. Each class's files are stored at its storage scale k (view pixels times k) in
assets/sprites/weapon-<class>/: idle.webp, its glow, the alt frame, the hammer, the cylinder blur,
the green censer and the Scourge's fist and chain, with weapon.json, the manifest the HUD reads
(WeaponManifest in src/render/weaponAtlas.ts). The previews go to screenshots/weapons/prep-*.png.

Points in FP are in the source painting's pixels, measured by eye on gridded crops.
"""
import json
import math
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from cutout import OUT, ROOT, SRC, key_green, source

# The view the paintings are composed in (M11 §1), the frame's top row (40%), the crosshair's row.
VIEW_W, VIEW_H = 3840, 2160
FRAME_TOP = 864
FRAME_MARGIN = 8
AIM_ROW = VIEW_H // 2
# The axis must cross the crosshair's row within 3% of the view's width of its center column.
AIM_TOL = 115
# The muzzle's allowed area, in fractions of the view. Smaller and untilted (the stage 1 review), the
# weapons sit lower and further right, so the barrels still aim at the crosshair.
MUZZLE_X = (0.55, 0.76)
MUZZLE_Y = (0.56, 0.68)
WEBP_QUALITY = 90
# The gate's cut 3 (M11 §5): every layer stored at this fraction of its storage scale k.
STORE_CUT = 0.75
# Opaque specks smaller than this are cleared after keying.
SPECK_PX = 64

# Emissive pixels (M11 §2, Glow layers): hue 0-35 degrees, saturation, value and red at least these.
# Hues within 10 degrees below 360 count as red too (the Betrayer's gems are at 355-359). A class can
# override them (FP's 'emissive').
EMISSIVE = {'hue': 35.0, 'sat': 0.6, 'val': 0.85, 'red': 0.9}
# The glow's halo: the emissive pixels blurred by this many view pixels, at this strength.
GLOW_BLUR = 12
GLOW_HALO = 0.5
# A class whose emissive pixels are fewer than this fraction of its opaque pixels gets no glow layer.
GLOW_MIN = 0.002
HEAL_GREEN = (0x5e, 0xe6, 0x5e)
# The Binder's spin alt (M11 §2): the changed region is where the mean RGB difference, blurred over
# 16 px, is above this many levels, after the spin painting is shifted onto the idle one (it came out
# 1 px lower). At the spec's 12 levels the regeneration's changed ink lines covered the whole gun.
SPIN_DIFF = 20
# The Fallen's pump alt: how far the gauntlet moves back along the barrel, as a fraction of the view's height.
PUMP = 0.04

SPIN_SHIFT = 4

# The Scourge (M11 §2, §3.6, as reviewed in stage 1): the chain and its hook are rendered like the M9 swing's
# Blender chain without the hand (scripts/blender/scourge_chain.py, rendered to
# assets/art-src/scourge-chain.png), and the painted fist is drawn where the hand was in each frame.
# Both are stored at half the view's resolution; the sweep painting is a 16:9 view like the others, so
# the fist keeps the view's scale (its size then matches the rendered fist's).
SWING_STORE = 0.5
SWING_MARGIN = 8
SCOURGE_CHAIN = 'scourge-chain'
# How far the Chain Gun drops during the swing, in vh.
SWING_DROP = 30
# How far the Scourge fist's forearm is extended beyond the painting's edges, in its pixels.
FOREARM_EXTEND = 500

PREVIEW_W, PREVIEW_H = 1920, 1080
SHOTS = ROOT / 'screenshots' / 'weapons'

# Per class (M11 §2): the source painting; its placement (the painting's height as a fraction of the
# view's, the rotation around the muzzle in degrees clockwise, where the muzzle lands as fractions of
# the view); the storage scale k (the source's pixels per view pixel after placement, rounded up to a
# multiple of 0.05, at most 1); and the measured points: the muzzle, a second point on the barrel's
# axis near the receiver, the pivot (None: the middle of the gun on the view's bottom row). The fists
# run off the view's bottom edge, so a pivot is the center of the fist's visible part.
FP = {
    'fallen': {
        'src': 'fp-fallen', 'scale': 0.75, 'rot': 0.0, 'at': (0.634, 0.62), 'k': 0.95,
        'muzzle': (1480, 478), 'axis': (1900, 690), 'pivot': (2100, 1190),
        # The pump alt (optional, M11 §2): the left gauntlet, the hand on the forend and its forearm.
        'pump': [
            (1500, 665), (1525, 646), (1560, 640), (1595, 650), (1640, 690), (1670, 750), (1690, 830),
            (1720, 890), (1770, 960), (1795, 1000), (1700, 1250), (1650, 1400), (1612, 1536), (880, 1536),
            (850, 1490), (905, 1180), (1090, 1150), (1220, 1120), (1335, 1020), (1440, 930), (1475, 890),
            (1462, 800), (1470, 700),
        ],
        # The magazine tube under the barrel: a cross-section clear of the hand, from the barrel's underside
        # past the tube's bottom ink outline (perpendicular to the axis), extended back under the hand in
        # perspective when it slides back (the stage 1 review: the tube showed a gap, then a kink).
        'tube': {'at': (1532, 599), 'from': -8, 'to': 46},
    },
    'heretic': {
        'src': 'fp-heretic', 'scale': 0.7, 'rot': 0.0, 'at': (0.743, 0.66), 'k': 1.0,
        # The coals' yellow centers (hue 20-50, saturation 0.45-0.65) fall outside the rule, which finds
        # their red rings; the rings are filled (a closing of this many view pixels).
        'glow_fill': 6,
        'muzzle': (1700, 528), 'axis': (2030, 650), 'pivot': (2230, 1080),
        # The loaded censer (M11 §2): everything left of its own thick black outline where it meets the
        # launcher's collar (traced on the outline's outer edge, so the outline stays as the cut's edge),
        # and left of the left thumb, which is kept.
        'censer': [
            (1915, 440), (1908, 450), (1880, 452), (1850, 456), (1825, 461), (1807, 468), (1794, 476),
            (1782, 488), (1770, 502), (1757, 520), (1749, 545), (1744, 570), (1742, 595), (1742, 612),
            (1742, 627), (1730, 642), (1715, 662), (1703, 680),
            (1697, 700), (1693, 718), (1645, 695), (1605, 640), (1592, 560), (1600, 480), (1635, 405),
            (1700, 368), (1780, 360), (1855, 372), (1905, 415),
        ],
        'hammer': {
            # The whole hammer (the spur and its ribbed shank down to its base, with the ink outline), and
            # the spur sticking out above the frame's silhouette (erased from the idle image).
            'poly': [(2272, 580), (2300, 576), (2334, 584), (2346, 600), (2338, 616), (2316, 622), (2304, 632),
                     (2302, 660), (2307, 685), (2311, 706), (2252, 708), (2246, 680), (2244, 650), (2252, 626),
                     (2266, 612)],
            'out': [(2276, 570), (2352, 570), (2352, 624), (2306, 630), (2290, 616), (2276, 612)],
            'hinge': (2280, 704), 'fall': 25.0,
        },
    },
    'binder': {
        'src': 'fp-binder', 'scale': 0.7, 'rot': 0.0, 'at': (0.622, 0.65), 'k': 0.65,
        'muzzle': (915, 458), 'axis': (1350, 760), 'pivot': None,
        'spin': 'fp-binder-spin',
        # The fist's center, and a point on its forearm's axis near where it leaves the painting.
        # The forearm leaves the painting through the bottom edge in these columns.
        'sweep': 'fp-binder-sweep', 'fist': (727, 615), 'forearm': (260, 768), 'forearm_cols': (170, 605),
    },
    'betrayer': {
        'src': 'fp-betrayer', 'scale': 0.75, 'rot': 0.0, 'at': (0.635, 0.60), 'k': 0.6,
        # Only the blood-red gems (value 0.7-0.9); the gloves' orange rim light (hue 20-30) isn't a glow.
        'emissive': {'hue': 15.0, 'sat': 0.6, 'val': 0.6, 'red': 0.65},
        'muzzle': (868, 430), 'axis': (1050, 506), 'pivot': (1140, 700),
        'hammer': {
            'poly': [(1110, 508), (1140, 500), (1140, 540), (1150, 548), (1145, 566), (1138, 576), (1120, 574),
                     (1112, 556), (1108, 532)],
            'out': [(1138, 498), (1196, 498), (1196, 545), (1168, 545), (1158, 550), (1150, 555), (1143, 545),
                    (1138, 535)],
            'hinge': (1128, 570), 'fall': 30.0,
        },
        # The cylinder's visible side, inside its ink outline (M11 §2).
        'cylinder': [(992, 506), (1004, 497), (1022, 494), (1040, 498), (1050, 508), (1044, 525), (1039, 548),
                     (1037, 572), (1039, 596), (1030, 604), (1012, 598), (994, 588), (984, 572), (981, 550),
                     (984, 526)],
        'blur': 0.35,
    },
}


# ---------------------------------------------------------------------------------------------
# Helpers

def components(mask: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """The 8-connected components of a mask: a label per pixel (0 outside) and each label's size."""
    h, w = mask.shape
    d = np.diff(np.pad(mask, ((0, 0), (1, 1))).astype(np.int8), axis=1)
    rows, starts = np.nonzero(d == 1)
    _, ends = np.nonzero(d == -1)
    n = len(rows)
    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    first = np.searchsorted(rows, np.arange(h + 1))
    for r in range(1, h):
        a, a1 = first[r - 1], first[r]
        b, b1 = first[r], first[r + 1]
        i, j = a, b
        while i < a1 and j < b1:
            # 8-connected: the runs overlap or touch diagonally.
            if starts[i] <= ends[j] and starts[j] <= ends[i]:
                ri, rj = find(i), find(j)
                if ri != rj:
                    parent[ri] = rj
            if ends[i] < ends[j]:
                i += 1
            else:
                j += 1
    roots = np.array([find(i) for i in range(n)], dtype=np.int64)
    _, label_of_run = np.unique(roots, return_inverse=True)
    label_of_run += 1
    sizes = np.zeros(label_of_run.max() + 1 if n else 1, dtype=np.int64)
    np.add.at(sizes, label_of_run, ends - starts)
    labels = np.zeros((h, w), dtype=np.int32)
    for k in range(n):
        labels[rows[k], starts[k]:ends[k]] = label_of_run[k]
    return labels, sizes


def clear_specks(alpha: np.ndarray, min_px: int = SPECK_PX) -> np.ndarray:
    """Clears the opaque specks under `min_px` pixels, and every soft pixel not within 4 px of what's
    kept (the specks' soft edges, faint lines along the painting's border)."""
    labels, sizes = components(alpha >= 0.5)
    keep = sizes >= min_px
    keep[0] = False
    return np.where(dilate(keep[labels], 4), alpha, 0)


def keyed(name: str) -> tuple[np.ndarray, np.ndarray]:
    """A painting with its green keyed out and its specks cleared: color (0-255) and alpha (0-1)."""
    rgb = np.asarray(Image.open(source(name)).convert('RGB')).astype(np.float32)
    color, alpha = key_green(rgb)
    return despill(color, alpha), clear_specks(alpha)


def despill(color: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """In the soft edges, green no higher than the mean of red and blue (as the M10 atmosphere sheet):
    the keying's own despill leaves an olive fringe on blurred edges."""
    soft = (alpha < 0.95)[..., None]
    g = np.minimum(color[..., 1], (color[..., 0] + color[..., 2]) / 2)
    return np.where(soft, np.dstack([color[..., 0], g, color[..., 2]]), color)


def poly_mask(shape: tuple[int, int], pts, scale: int = 4) -> np.ndarray:
    """A polygon's coverage of each pixel (0-1), antialiased by supersampling."""
    h, w = shape
    img = Image.new('L', (w * scale, h * scale), 0)
    ImageDraw.Draw(img).polygon([(x * scale, y * scale) for x, y in pts], fill=255)
    return np.asarray(img.resize((w, h), Image.BOX)).astype(np.float32) / 255


def box_blur(a: np.ndarray, r: int) -> np.ndarray:
    """The mean over a (2r + 1)-square window (zero outside), of a 2D array."""
    if r <= 0:
        return a
    p = np.pad(a, r + 1).cumsum(0).cumsum(1)
    n = 2 * r + 1
    s = p[n:, n:] - p[:-n, n:] - p[n:, :-n] + p[:-n, :-n]
    return s[:a.shape[0], :a.shape[1]] / (n * n)


def dilate(mask: np.ndarray, r: int) -> np.ndarray:
    return box_blur(mask.astype(np.float32), r) > 1e-6


def erode(mask: np.ndarray, r: int) -> np.ndarray:
    return ~dilate(~mask, r)


def hsv(color: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Hue in degrees, saturation and value (0-1) of colors in 0-255."""
    c = color / 255
    mx, mn = c.max(axis=-1), c.min(axis=-1)
    d = mx - mn
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    with np.errstate(divide='ignore', invalid='ignore'):
        h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
        s = np.where(mx > 0, d / mx, 0)
    return np.nan_to_num(h), s, mx


def emissive(color: np.ndarray, alpha: np.ndarray, rule: dict = EMISSIVE) -> np.ndarray:
    """The glowing pixels (M11 §2): opaque, red to orange, saturated, bright."""
    h, s, v = hsv(color)
    return (alpha >= 0.5) & ((h <= rule['hue']) | (h >= 350)) & (s >= rule['sat']) & (v >= rule['val']) & (color[..., 0] / 255 >= rule['red'])


def glow_layer(color: np.ndarray, mask: np.ndarray, blur_px: float) -> np.ndarray:
    """The emissive pixels' color, plus the same blurred by `blur_px`, at GLOW_HALO: RGBA, float 0-255."""
    m = mask.astype(np.float32)
    pre = np.dstack([color * m[..., None], m * 255]).round().clip(0, 255).astype(np.uint8)
    halo = np.asarray(Image.fromarray(pre, 'RGBa').filter(ImageFilter.GaussianBlur(blur_px))).astype(np.float32)
    p = pre.astype(np.float32) + GLOW_HALO * halo
    a = np.clip(p[..., 3], 0, 255)
    with np.errstate(divide='ignore', invalid='ignore'):
        rgb = np.nan_to_num(p[..., :3] / np.maximum(p[..., 3:], 1e-6)) * 255
    # Drawn with normal alpha, not screen (M11 §5, cut 1): over its own emissive pixels the layer carries
    # what screen would give there, the color screened over itself, so it brightens them the same way.
    rgb = np.where(m[..., None] > 0, 255 - (255 - rgb) ** 2 / 255, rgb)
    return np.dstack([np.clip(rgb, 0, 255), a])


def rgba_of(color: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    return np.dstack([color, alpha * 255])


def save_webp(rgba: np.ndarray, path) -> int:
    img = Image.fromarray(rgba.round().clip(0, 255).astype(np.uint8), 'RGBA')
    img.save(path, quality=WEBP_QUALITY, method=6)
    return path.stat().st_size


def rot(deg: float) -> np.ndarray:
    """Turns a vector clockwise on screen (y down) by `deg` degrees, as CSS does."""
    t = math.radians(deg)
    return np.array([[math.cos(t), -math.sin(t)], [math.sin(t), math.cos(t)]])


# ---------------------------------------------------------------------------------------------
# Placement

class Placement:
    """Where a painting lands in the view: view = M + f R (source - muzzle)."""

    def __init__(self, cfg: dict, src_h: int):
        self.f = cfg['scale'] * VIEW_H / src_h
        self.R = rot(cfg['rot'])
        self.m = np.array(cfg['muzzle'], dtype=np.float64)
        self.M = np.array([cfg['at'][0] * VIEW_W, cfg['at'][1] * VIEW_H])

    def view(self, p) -> np.ndarray:
        p = np.asarray(p, dtype=np.float64)
        return self.M + self.f * (p - self.m) @ self.R.T

    def src(self, v) -> np.ndarray:
        v = np.asarray(v, dtype=np.float64)
        return self.m + (v - self.M) @ self.R / self.f


class Frame:
    """The frame (M11 §1): rows FRAME_TOP to the bottom, the weapon's columns plus a margin; stored
    at k times the view's pixels."""

    def __init__(self, left: int, right: int, k: float):
        self.left, self.top = left, FRAME_TOP
        self.w, self.h = right - left, VIEW_H - FRAME_TOP
        self.k = k
        self.sw, self.sh = round(self.w * k), round(self.h * k)

    def to_store(self, v) -> np.ndarray:
        """View pixels to the stored image's pixels."""
        v = np.asarray(v, dtype=np.float64)
        return (v - [self.left, self.top]) * [self.sw / self.w, self.sh / self.h]

    def to_view(self, s) -> np.ndarray:
        s = np.asarray(s, dtype=np.float64)
        return s * [self.w / self.sw, self.h / self.sh] + [self.left, self.top]


def render(place: Placement, frame: Frame, color: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Resamples a painting into the stored frame (premultiplied, bicubic): RGBA, float 0-255."""
    # Stored pixel -> view -> source, as one affine map.
    sx, sy = frame.w / frame.sw, frame.h / frame.sh
    a = (place.R.T / place.f) @ np.diag([sx, sy])
    c = place.m + place.R.T @ (np.array([frame.left, frame.top]) - place.M) / place.f
    data = (a[0, 0], a[0, 1], c[0], a[1, 0], a[1, 1], c[1])
    chans = [color[..., i] * alpha for i in range(3)] + [alpha * 255]
    out = [np.asarray(Image.fromarray(ch.astype(np.float32), 'F').transform((frame.sw, frame.sh), Image.AFFINE, data, resample=Image.BICUBIC))
           for ch in chans]
    a_out = np.clip(out[3], 0, 255)
    with np.errstate(divide='ignore', invalid='ignore'):
        rgb = np.stack(out[:3], axis=-1) / np.maximum(a_out / 255, 1e-6)[..., None]
    rgb = np.where(a_out[..., None] > 0.5, np.clip(np.nan_to_num(rgb), 0, 255), 0)
    return np.dstack([rgb, a_out])


def opaque_view_points(place: Placement, alpha: np.ndarray, thresh: float) -> np.ndarray:
    """The view positions of the corners of every source pixel with alpha above `thresh`."""
    ys, xs = np.nonzero(alpha > thresh)
    pts = []
    for dx in (0, 1):
        for dy in (0, 1):
            pts.append(place.view(np.stack([xs + dx, ys + dy], axis=1)))
    return np.concatenate(pts)


def check_placement(name: str, cfg: dict, place: Placement, alpha: np.ndarray) -> list[str]:
    """M11 §2's checks of a placement; returns the failures."""
    fails = []
    mz = place.view(cfg['muzzle'])
    ax = place.view(cfg['axis'])
    d = (mz - ax) / np.linalg.norm(mz - ax)
    cross = mz[0] + (AIM_ROW - mz[1]) / d[1] * d[0]
    print(f'{name}: muzzle at ({mz[0] / VIEW_W:.1%}, {mz[1] / VIEW_H:.1%}), axis ({d[0]:.3f}, {d[1]:.3f}) crosses '
          f'the crosshair\'s row at x {cross:.0f} ({cross - VIEW_W / 2:+.0f} px from the center column)')
    if abs(cross - VIEW_W / 2) > AIM_TOL:
        fails.append(f'the axis crosses the crosshair\'s row {cross - VIEW_W / 2:+.0f} px from the center (limit {AIM_TOL})')
    if not (MUZZLE_X[0] <= mz[0] / VIEW_W <= MUZZLE_X[1] and MUZZLE_Y[0] <= mz[1] / VIEW_H <= MUZZLE_Y[1]):
        fails.append('the muzzle is outside 55-63% x 56-62% of the view')
    pts = opaque_view_points(place, alpha, 0.05)
    top = pts[:, 1].min()
    print(f'{name}: topmost opaque row {top:.0f} (frame top {FRAME_TOP})')
    if top < FRAME_TOP:
        fails.append(f'opaque pixels above row {FRAME_TOP} (row {top:.0f})')
    # Cut ends: the opaque pixels on the painting's edges must land outside the view.
    h, w = alpha.shape
    solid = alpha >= 0.5
    edge = []
    for x in np.nonzero(solid[-1])[0]:
        edge.append((x + 0.5, h))
    for y in np.nonzero(solid[:, -1])[0]:
        edge.append((w, y + 0.5))
    for y in np.nonzero(solid[:, 0])[0]:
        edge.append((0, y + 0.5))
    for x in np.nonzero(solid[0])[0]:
        edge.append((x + 0.5, 0))
    if edge:
        v = place.view(np.array(edge))
        inside = (v[:, 0] >= 0) & (v[:, 0] < VIEW_W) & (v[:, 1] < VIEW_H) & (v[:, 1] >= 0)
        worst = v[inside]
        print(f'{name}: {len(edge)} edge pixels, {inside.sum()} land inside the view')
        if inside.any():
            fails.append(f'cut ends in view, e.g. at view ({worst[0][0]:.0f}, {worst[0][1]:.0f}); {inside.sum()} edge pixels')
    return fails


# ---------------------------------------------------------------------------------------------
# Per-class layers

def binder_spin_source(color: np.ndarray, alpha: np.ndarray, idle_rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """The spin alt (M11 §2): the changed region from the idle painting, the idle's pixels elsewhere."""
    spin_rgb = np.asarray(Image.open(source(FP['binder']['spin'])).convert('RGB')).astype(np.float32)
    if spin_rgb.shape != idle_rgb.shape:
        sys.exit('fp-binder-spin is not the size of fp-binder; stop and ask (M11 §2)')
    # The shift that best lines the spin painting up with the idle one, over the gun's rear (unchanged).
    h, w = idle_rgb.shape[:2]
    y0, y1, x0, x1 = round(0.7 * h), h - SPIN_SHIFT, round(0.68 * w), w - SPIN_SHIFT
    shifts = [(dx, dy) for dy in range(-SPIN_SHIFT, SPIN_SHIFT + 1) for dx in range(-SPIN_SHIFT, SPIN_SHIFT + 1)]
    dx, dy = min(shifts, key=lambda d: float(np.abs(idle_rgb[y0:y1, x0:x1] - spin_rgb[y0 + d[1]:y1 + d[1], x0 + d[0]:x1 + d[0]]).mean()))
    spin_rgb = np.roll(spin_rgb, (-dy, -dx), axis=(0, 1))
    print(f'binder spin: shifted by ({-dx}, {-dy}) px onto fp-binder')
    diff = np.abs(spin_rgb - idle_rgb).mean(axis=2)
    blurred = np.asarray(Image.fromarray(np.clip(diff, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(16))).astype(np.float32)
    changed = blurred > SPIN_DIFF
    # Cleaned of specks; of what's left, only the barrels' region (the largest) is kept.
    labels, sizes = components(changed)
    sizes[0] = 0
    changed = labels == int(np.argmax(sizes))
    changed = dilate(changed, 24)
    ys, xs = np.nonzero(changed)
    print(f'binder spin: changed region {changed.sum()} px, columns {xs.min()}-{xs.max()}, rows {ys.min()}-{ys.max()}')
    (ROOT / 'test-results').mkdir(exist_ok=True)
    dbg = (idle_rgb * 0.5).astype(np.uint8)
    dbg[changed] = (dbg[changed] * 0.5 + np.array([255, 0, 255]) * 0.5).astype(np.uint8)
    Image.fromarray(dbg).save(ROOT / 'test-results' / 'binder-spin-region.png')
    mixed = np.where(changed[..., None], spin_rgb, idle_rgb)
    c, a = key_green(mixed)
    return despill(c, a), clear_specks(a)


def heretic_empty_source(cfg: dict, color: np.ndarray, alpha: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """The empty alt (M11 §2, as reviewed in stage 1): the censer removed along its own black outline
    where it meets the launcher's collar, with a thin ink line along the cut so the edge stays crisp."""
    censer = poly_mask(alpha.shape, cfg['censer'])
    kept = alpha * (1 - censer)
    ink = 3
    edge = dilate(censer > 0.5, ink) & (kept >= 0.5) & (censer < 0.5)
    ink_c = np.array([18, 12, 10], dtype=np.float32)
    color = np.where(edge[..., None], color * 0.25 + ink_c * 0.75, color)
    return color, kept


def fallen_pump_source(cfg: dict, place: Placement, color: np.ndarray, alpha: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """The pump alt (M11 §2): the left gauntlet moved back along the barrel's axis by PUMP of the view's
    height; the pixels it uncovers filled from the painting that far further toward the muzzle."""
    h, w = alpha.shape
    hand = poly_mask((h, w), cfg['pump'])
    toward = np.array(cfg['muzzle'], float) - np.array(cfg['axis'], float)
    toward /= np.linalg.norm(toward)
    d = toward * PUMP * VIEW_H / place.f
    # The gauntlet moved back (away from the muzzle): out[p] = layer[p + d].
    data = (1, 0, d[0], 0, 1, d[1])
    def shift(a: np.ndarray) -> np.ndarray:
        return np.asarray(Image.fromarray(a.astype(np.float32), 'F').transform((w, h), Image.AFFINE, data, resample=Image.BICUBIC))
    ha = np.clip(shift(alpha * hand), 0, 1)
    hc = np.stack([shift(color[..., i] * alpha * hand) for i in range(3)], axis=-1)
    # The gun under the hand: the painting's own pixels n moves further toward the muzzle, for the
    # first n that's off the hand (the forend is roughly uniform along its length).
    base_c, base_a = color.copy(), alpha * (1 - hand)
    todo = hand > 0.01
    for n in range(1, 8):
        if not todo.any():
            break
        ys, xs = np.nonzero(todo)
        sx = np.clip(np.round(xs + n * d[0]).astype(int), 0, w - 1)
        sy = np.clip(np.round(ys + n * d[1]).astype(int), 0, h - 1)
        free = hand[sy, sx] < 0.01
        base_c[ys[free], xs[free]] = color[sy[free], sx[free]]
        base_a[ys[free], xs[free]] = alpha[sy[free], sx[free]]
        todo[ys[free], xs[free]] = False
    # The tube continues under the hand, in perspective: the gun points at the crosshair, so its lines
    # along the barrel all meet there (the vanishing point V). Each pixel under the hand takes the
    # cross-section's pixel on the same ray from V (a straight tube extruded toward the viewer).
    if 'tube' in cfg:
        tb = cfg['tube']
        V = place.src((VIEW_W / 2, AIM_ROW))
        n = np.array([-toward[1], toward[0]])
        if n[1] < 0:
            n = -n
        q0 = np.array(tb['at'], float) + tb['from'] * n
        q1 = np.array(tb['at'], float) + tb['to'] * n
        ys, xs = np.nonzero(hand > 0.01)
        px, py = xs + 0.5 - V[0], ys + 0.5 - V[1]
        # The ray V + s (p - V) meets the segment q0 + u (q1 - q0): solve for s and u.
        e = q1 - q0
        r0 = q0 - V
        den = px * (-e[1]) - py * (-e[0])
        with np.errstate(divide='ignore', invalid='ignore'):
            s_ = (r0[0] * (-e[1]) - r0[1] * (-e[0])) / den
            u = (px * r0[1] - py * r0[0]) / den
        sel = (u >= 0) & (u <= 1) & (s_ > 0) & (s_ < 1)
        sx = np.clip(np.round(q0[0] + u[sel] * e[0] - 0.5).astype(int), 0, w - 1)
        sy = np.clip(np.round(q0[1] + u[sel] * e[1] - 0.5).astype(int), 0, h - 1)
        base_c[ys[sel], xs[sel]] = color[sy, sx]
        base_a[ys[sel], xs[sel]] = alpha[sy, sx]
    a = ha + base_a * (1 - ha)
    with np.errstate(divide='ignore', invalid='ignore'):
        c = np.nan_to_num((hc + base_c * (base_a * (1 - ha))[..., None]) / a[..., None])
    print(f'fallen pump: the gauntlet moved {np.hypot(*d):.0f} source px back along the axis')
    return np.clip(c, 0, 255), a


# The slot the hammer sits in, painted where the hammer was inside the frame's silhouette: it shows
# when the hammer swings out (stage 1 review: the hammers fall outward, toward the viewer).
SLOT_COLOR = np.array([0x22, 0x1a, 0x16], dtype=np.float32)


def hammer_cut(cfg: dict, color: np.ndarray, alpha: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """The hammer as its own layer (its alpha); the idle painting with the whole hammer taken out: its
    protruding part erased, its part inside the frame painted as the dark slot (returns the idle's color
    and alpha)."""
    h, w = alpha.shape
    out = poly_mask((h, w), cfg['hammer']['out'])
    body = poly_mask((h, w), cfg['hammer']['poly']) * (1 - out)
    hm = np.maximum(body, out)
    slot = body * (alpha >= 0.5)
    idle_color = color * (1 - slot[..., None]) + SLOT_COLOR * slot[..., None]
    return alpha * hm, (idle_color, alpha * (1 - out)), hm


def crop_box(alpha: np.ndarray, pad: int = 2) -> tuple[int, int, int, int]:
    ys, xs = np.nonzero(alpha > 0.5 / 255)
    return (max(0, xs.min() - pad), max(0, ys.min() - pad), min(alpha.shape[1], xs.max() + 1 + pad), min(alpha.shape[0], ys.max() + 1 + pad))


def cylinder_blur(cfg: dict, place: Placement, frame: Frame, idle: np.ndarray, axis: np.ndarray) -> tuple[np.ndarray, tuple, dict]:
    """The revolver's cylinder blurred around itself (M11 §2): returns the blurred cylinder's pixels
    (cropped), its box in stored pixels, and the sharp crop for the preview."""
    poly = frame.to_store(place.view(cfg['cylinder']))
    mask = poly_mask((frame.sh, frame.sw), [tuple(p) for p in poly]) > 0.5
    x0, y0, x1, y1 = crop_box(mask.astype(np.float32), pad=4)
    crop = idle[y0:y1, x0:x1]
    m = mask[y0:y1, x0:x1]
    # Turn the crop so the axis is horizontal: the blur then runs down the columns.
    ang = math.degrees(math.atan2(axis[1], axis[0]))
    pad = max(crop.shape[:2])
    big = np.zeros((crop.shape[0] + 2 * pad, crop.shape[1] + 2 * pad, 4), np.float32)
    big[pad:pad + crop.shape[0], pad:pad + crop.shape[1]] = crop
    bm = np.zeros(big.shape[:2], np.float32)
    bm[pad:pad + crop.shape[0], pad:pad + crop.shape[1]] = m
    pre = np.dstack([big[..., :3] * big[..., 3:] / 255, big[..., 3]])

    def turn(a: np.ndarray, deg: float, nearest=False) -> np.ndarray:
        return np.asarray(Image.fromarray(a.astype(np.float32), 'F').rotate(deg, resample=Image.NEAREST if nearest else Image.BICUBIC))

    # PIL turns counterclockwise for positive angles; the axis at `ang` (clockwise from +x) becomes horizontal.
    rp = np.stack([turn(pre[..., i], ang) for i in range(4)], axis=-1)
    rm = turn(bm, ang, nearest=True) > 0.5
    out = rp.copy()
    cols = np.nonzero(rm.any(axis=0))[0]
    spans = {c: np.nonzero(rm[:, c])[0] for c in cols}
    width = max(s.max() - s.min() + 1 for s in spans.values())
    L = cfg['blur'] * width
    for c in cols:
        rs = spans[c]
        t0, t1 = rs.min(), rs.max() + 1
        n = t1 - t0
        seg = rp[t0:t1, c]
        cs = np.vstack([np.zeros((1, 4)), np.cumsum(seg, axis=0)])
        u = (np.arange(n) + 0.5) / n
        half = 0.5 * L * np.sqrt(np.clip(1 - (2 * u - 1) ** 2, 0, 1))
        lo = np.clip(np.floor(np.arange(n) + 0.5 - half).astype(int), 0, n - 1)
        hi = np.clip(np.ceil(np.arange(n) + 0.5 + half).astype(int), lo + 1, n)
        out[t0:t1, c] = (cs[hi] - cs[lo]) / (hi - lo)[:, None]
    back = np.stack([turn(out[..., i], -ang) for i in range(4)], axis=-1)
    back = back[pad:pad + crop.shape[0], pad:pad + crop.shape[1]]
    # The 2 px band inside the outline stays sharp; only the inside is blurred.
    band = max(1, round(2 * frame.sw / frame.w))
    inner = erode(m, band)
    a = np.clip(back[..., 3], 0, 255)
    with np.errstate(divide='ignore', invalid='ignore'):
        rgb = np.nan_to_num(back[..., :3] / np.maximum(a / 255, 1e-6)[..., None])
    blurred = np.where(inner[..., None], np.dstack([np.clip(rgb, 0, 255), a]), crop)
    blurred[..., 3] *= m
    print(f'betrayer cylinder: {crop.shape[1]}x{crop.shape[0]} stored px, visible width {width} px, blur length {L:.1f} px')
    return blurred, (x0, y0, x1, y1), {'sharp': crop * np.dstack([np.ones(m.shape + (3,)), m])}


def heal_censer(cfg: dict, place: Placement, frame: Frame, idle: np.ndarray, rule: dict) -> tuple[np.ndarray, np.ndarray, tuple]:
    """The Heretic's green censer (M11 §2, §3.9): the loaded censer's glowing coals turned HEAL_GREEN's
    hue, their lightness and saturation kept; and its glow layer."""
    poly = frame.to_store(place.view(cfg['censer']))
    mask = poly_mask((frame.sh, frame.sw), [tuple(p) for p in poly])
    x0, y0, x1, y1 = crop_box(mask * (idle[..., 3] / 255), pad=2)
    crop = idle[y0:y1, x0:x1].copy()
    m = mask[y0:y1, x0:x1]
    color = crop[..., :3]
    h, s, v = hsv(color)
    # How much each pixel glows: full at the glow rule, fading out a little below it, so the coals'
    # soft edges turn green too and the bronze (darker, less saturated) stays.
    w = (np.clip((s - (rule['sat'] - 0.25)) / 0.25, 0, 1) * np.clip((v - (rule['val'] - 0.3)) / 0.3, 0, 1)
         * (h <= rule['hue'] + 10) * m)
    green = hue_shift(color, HEAL_GREEN)
    out = crop.copy()
    out[..., :3] = color * (1 - w[..., None]) + green * w[..., None]
    out[..., 3] *= m
    em = emissive(color, crop[..., 3] / 255, rule) & (m > 0.5)
    glow = glow_layer(green, em, GLOW_BLUR * frame.k)
    return out, glow, (x0, y0, x1, y1)


def hue_shift(color: np.ndarray, target) -> np.ndarray:
    """The colors with the target's hue, keeping their HSL lightness and saturation."""
    c = color / 255
    mx, mn = c.max(axis=-1), c.min(axis=-1)
    light = (mx + mn) / 2
    d = mx - mn
    with np.errstate(divide='ignore', invalid='ignore'):
        sat = np.nan_to_num(np.where(d > 0, d / (1 - np.abs(2 * light - 1)), 0))
    th, _, _ = hsv(np.array(target, dtype=np.float32))
    hh = float(th) / 60
    chroma = (1 - np.abs(2 * light - 1)) * sat
    x = chroma * (1 - abs(hh % 2 - 1))
    seg = int(hh) % 6
    rgb = [(chroma, x, 0), (x, chroma, 0), (0, chroma, x), (0, x, chroma), (x, 0, chroma), (chroma, 0, x)][seg]
    m0 = light - chroma / 2
    out = np.stack([np.broadcast_to(ch, light.shape) + m0 for ch in rgb], axis=-1)
    return np.clip(out * 255, 0, 255)


def extend_forearm(color: np.ndarray, alpha: np.ndarray, toward_fist: np.ndarray, pad: int, cols: tuple[int, int]) -> tuple[np.ndarray, np.ndarray, tuple[int, int]]:
    """Pads the painting by `pad` px at the left and bottom, filled by extruding its edge pixels along
    the forearm's axis (`toward_fist` points from the elbow to the fist). Returns the new color, alpha
    and the offset of the old image in the new one."""
    h, w = alpha.shape
    d = toward_fist / np.linalg.norm(toward_fist)
    H, W = h + pad, w + pad
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    qx, qy = xx - pad, yy
    # How far to step toward the fist to get back inside the image (with a 2 px inset).
    s = np.zeros((H, W))
    if d[0] > 0:
        s = np.maximum(s, (2 - qx) / d[0])
    if d[1] < 0:
        s = np.maximum(s, (qy - (h - 3)) / -d[1])
    sx = np.clip(np.round(qx + s * d[0]).astype(int), 0, w - 1)
    sy = np.clip(np.round(qy + s * d[1]).astype(int), 0, h - 1)
    out_a = alpha[sy, sx]
    # Only the forearm is extended, not the chain ends dangling across the same edge.
    outside = (qx < 0) | (qy > h - 1)
    out_a = np.where(outside & ((sx < cols[0]) | (sx > cols[1])), 0, out_a)
    return color[sy, sx], out_a, (pad, 0)


# The swung chain's red-hot shading (stage 1 review: like the painted Chain Gun's chains). The render
# is one flat tone with an ink line around every link, so each link is shaded by its pixels' distance
# from its ink (in stored px, up to HOT_DEPTH): deep red at the edge, orange-red, a bright orange core.
HOT_DARK = np.array([120, 20, 10], dtype=np.float32)
HOT_MID = np.array([222, 64, 18], dtype=np.float32)
HOT_LIT = np.array([255, 146, 52], dtype=np.float32)
HOT_DEPTH = 6


def hot_chain(rgba: np.ndarray) -> np.ndarray:
    """Repaints the chain's rust as red-hot metal; the ink and the hook stay."""
    color = rgba[..., :3]
    h, sat, v = hsv(color)
    hot = (rgba[..., 3] >= 128) & (h <= 40) & (sat >= 0.45) & (v >= 0.25)
    depth = np.zeros(hot.shape, np.float32)
    m = hot
    for _ in range(HOT_DEPTH):
        depth += m
        m = erode(m, 1)
    t = depth / HOT_DEPTH
    shade = np.where((t < 0.5)[..., None], HOT_DARK + (HOT_MID - HOT_DARK) * (t / 0.5)[..., None],
                     HOT_MID + (HOT_LIT - HOT_MID) * ((t - 0.5) / 0.5)[..., None])
    out = rgba.copy()
    out[..., :3] = np.where(hot[..., None], shade, color)
    return out


def scourge(cfg: dict, out_dir) -> dict:
    """The Scourge's fist and chain frames (M11 §2): returns the manifest's `swing`."""
    view_per_src = VIEW_H / Image.open(source(cfg['sweep'])).height
    color, alpha = keyed(cfg['sweep'])
    # The forearm leaves the painting at its left and bottom edges; turned in the swing, that cut end
    # would show. Extend it: every pixel beyond those edges takes the edge pixel along the forearm's axis.
    color, alpha, (px, py) = extend_forearm(color, alpha, np.array(cfg['fist'], float) - np.array(cfg['forearm'], float), FOREARM_EXTEND, cfg['forearm_cols'])
    cfg = dict(cfg, fist=(cfg['fist'][0] + px, cfg['fist'][1] + py), forearm=(cfg['forearm'][0] + px, cfg['forearm'][1] + py))
    x0, y0, x1, y1 = crop_box(alpha, pad=0)
    m = round(SWING_MARGIN / view_per_src)
    x0, y0, x1, y1 = max(0, x0 - m), max(0, y0 - m), min(alpha.shape[1], x1 + m), y1
    fist = rgba_of(color, alpha)[y0:y1, x0:x1]
    fw, fh = (x1 - x0) * view_per_src, (y1 - y0) * view_per_src
    fist_img = resize_rgba(fist, round(fw * SWING_STORE), round(fh * SWING_STORE))
    save_webp(fist_img, out_dir / 'fist.webp')
    center = ((cfg['fist'][0] - x0) * view_per_src, (cfg['fist'][1] - y0) * view_per_src)
    fx, fy = np.array(cfg['fist'], float) - np.array(cfg['forearm'], float)
    fist_angle = math.degrees(math.atan2(fy, fx))

    # The chain frames: stacked top to bottom in the render, each the bottom half of a view 2:1 wide.
    meta = json.loads((SRC / f'{SCOURGE_CHAIN}.json').read_text(encoding='utf8'))
    sheet = np.asarray(Image.open(SRC / f'{SCOURGE_CHAIN}.png').convert('RGBA')).astype(np.float32)
    per = VIEW_H / meta['viewH']
    n, fw_px, fh_px = meta['frames'], meta['w'], meta['h']
    # Only the columns a 16:9 screen shows.
    c0 = max(0, math.floor(meta['centerX'] - VIEW_W / 2 / per))
    c1 = min(fw_px, math.ceil(meta['centerX'] + VIEW_W / 2 / per))
    frames = [sheet[i * fh_px:(i + 1) * fh_px, c0:c1] for i in range(n)]
    cw, ch = round((c1 - c0) * per * SWING_STORE), round(fh_px * per * SWING_STORE)
    strip = np.concatenate([hot_chain(resize_rgba(f, cw, ch)) for f in frames], axis=0)
    save_webp(strip, out_dir / 'chain.webp')
    # The chain is red-hot: its glow layer, like the weapons' (screened over it in the HUD).
    save_webp(glow_layer(strip[..., :3], emissive(strip[..., :3], strip[..., 3] / 255), GLOW_BLUR * SWING_STORE), out_dir / 'chain-glow.webp')
    hands = []
    for hd in meta['hands']:
        hx = (hd['center'][0] + c0 - meta['centerX']) * per
        hy = VIEW_H - fh_px * per + hd['center'][1] * per
        hands.append([round(hx, 1), round(hy, 1), hd['angle']])
    print(f'scourge: fist {fist_img.shape[1]}x{fist_img.shape[0]} stored (forearm at {fist_angle:.1f} deg), '
          f'{n} chain frames {cw}x{ch} stored, hands {hands}')
    return {
        'fist': {'w': round(fist_img.shape[1] / SWING_STORE), 'h': round(fist_img.shape[0] / SWING_STORE),
                 'center': [round(center[0], 1), round(center[1], 1)], 'angle': round(fist_angle, 1)},
        'chain': {'frames': n, 'left': round((c0 - meta['centerX']) * per, 1), 'top': round(VIEW_H - fh_px * per, 1),
                  'w': round((c1 - c0) * per, 1), 'h': round(fh_px * per, 1)},
        'hands': hands,
    }


def resize_rgba(rgba: np.ndarray, w: int, h: int) -> np.ndarray:
    img = Image.fromarray(rgba.round().clip(0, 255).astype(np.uint8), 'RGBA').convert('RGBa').resize((w, h), Image.LANCZOS).convert('RGBA')
    return np.asarray(img).astype(np.float32)


# ---------------------------------------------------------------------------------------------
# The class

def weapon(name: str) -> dict:
    cfg = FP[name]
    out_dir = OUT / f'weapon-{name}'
    out_dir.mkdir(exist_ok=True)
    idle_rgb = np.asarray(Image.open(source(cfg['src'])).convert('RGB')).astype(np.float32)
    color, alpha = keyed(cfg['src'])
    h, w = alpha.shape
    place = Placement(cfg, h)
    k = math.ceil(min(1.0, 1 / place.f) / 0.05 - 1e-9) * 0.05
    print(f'{name}: {cfg["src"]} {w}x{h}, {place.f:.3f} view px per source px, storage scale {k:.2f}')
    if abs(k - cfg['k']) > 1e-6:
        sys.exit(f'{name}: the storage scale is {k:.2f}, not {cfg["k"]} as listed in FP')
    fails = check_placement(name, cfg, place, alpha)
    if fails:
        sys.exit(f'{name}: ' + '; '.join(fails))

    pts = opaque_view_points(place, alpha, 0.5 / 255)
    left = max(0, math.floor(pts[:, 0].min()) - FRAME_MARGIN)
    right = min(VIEW_W, math.ceil(pts[:, 0].max()) + FRAME_MARGIN)
    frame = Frame(left, right, k * STORE_CUT)

    layers: dict[str, np.ndarray] = {}
    hammer = None
    idle_color, idle_alpha = color, alpha
    if 'hammer' in cfg:
        hammer_alpha, (idle_color, idle_alpha), _ = hammer_cut(cfg, color, alpha)
        hl = render(place, frame, color, hammer_alpha)
        hammer_mask = dilate(hl[..., 3] >= 8, 2)
        x0, y0, x1, y1 = crop_box(hl[..., 3] / 255)
        layers['hammer'] = hl[y0:y1, x0:x1]
        hv0 = frame.to_view((x0, y0))
        hv1 = frame.to_view((x1, y1))
        hinge = place.view(cfg['hammer']['hinge']) - [frame.left, frame.top]
        hammer = {'x': round(hv0[0] - frame.left, 1), 'y': round(hv0[1] - frame.top, 1), 'w': round(hv1[0] - hv0[0], 1), 'h': round(hv1[1] - hv0[1], 1),
                  'hinge': [round(hinge[0], 1), round(hinge[1], 1)], 'fall': cfg['hammer']['fall']}
    idle = render(place, frame, idle_color, idle_alpha)
    full_idle = render(place, frame, color, alpha) if 'hammer' in cfg else idle
    layers['idle'] = idle

    alt = None
    alt_img = None
    extra_preview = {}
    if name == 'fallen' and 'pump' in cfg:
        c2, a2 = fallen_pump_source(cfg, place, color, alpha)
        alt_img = render(place, frame, c2, a2)
        alt = 'pump'
    elif name == 'binder':
        c2, a2 = binder_spin_source(color, alpha, idle_rgb)
        alt_img = render(place, frame, c2, a2)
        alt = 'spin'
    elif name == 'heretic':
        c2, a2 = heretic_empty_source(cfg, idle_color, idle_alpha)
        alt_img = render(place, frame, c2, a2)
        alt = 'empty'
    if alt_img is not None:
        layers['alt'] = alt_img

    axis = place.view(cfg['muzzle']) - place.view(cfg['axis'])
    axis /= np.linalg.norm(axis)

    cylinder = None
    if 'cylinder' in cfg:
        blurred, (x0, y0, x1, y1), extra = cylinder_blur(cfg, place, frame, full_idle, axis)
        layers['cylinder'] = blurred
        extra_preview['cylinder'] = (extra['sharp'], blurred)
        v0, v1 = frame.to_view((x0, y0)), frame.to_view((x1, y1))
        cylinder = {'x': round(v0[0] - frame.left, 1), 'y': round(v0[1] - frame.top, 1), 'w': round(v1[0] - v0[0], 1), 'h': round(v1[1] - v0[1], 1)}

    heal = None
    rule = dict(EMISSIVE, **cfg.get('emissive', {}))
    if name == 'heretic':
        green, green_glow, (x0, y0, x1, y1) = heal_censer(cfg, place, frame, full_idle, rule)
        layers['censer-green'] = green
        layers['censer-green-glow'] = green_glow
        extra_preview['heal'] = (full_idle[y0:y1, x0:x1], green, green_glow, glow_layer(full_idle[y0:y1, x0:x1, :3], emissive(full_idle[y0:y1, x0:x1, :3], full_idle[y0:y1, x0:x1, 3] / 255, rule), GLOW_BLUR * k))
        v0, v1 = frame.to_view((x0, y0)), frame.to_view((x1, y1))
        heal = {'x': round(v0[0] - frame.left, 1), 'y': round(v0[1] - frame.top, 1), 'w': round(v1[0] - v0[0], 1), 'h': round(v1[1] - v0[1], 1)}

    # Glow layers: without the hammer (it moves, the glow doesn't).
    glows = {}
    for key, img in (('idle', idle), ('alt', alt_img)):
        if img is None:
            continue
        em = emissive(img[..., :3], img[..., 3] / 255, rule)
        if 'glow_fill' in cfg:
            r = max(1, round(cfg['glow_fill'] * k))
            em = erode(dilate(em, r), r) & (img[..., 3] >= 128) & (hsv(img[..., :3])[2] >= 0.6)
        if 'hammer' in layers:
            em &= ~hammer_mask
        share = em.sum() / max(1, (img[..., 3] >= 128).sum())
        print(f'{name} {key}: emissive {share:.2%} of the opaque pixels')
        glows[key] = bool(share >= GLOW_MIN)
        if glows[key]:
            layers[f'{key}-glow'] = glow_layer(img[..., :3], em, GLOW_BLUR * k)

    for old in out_dir.glob('*.webp'):
        old.unlink()
    total = 0
    for key, img in layers.items():
        total += save_webp(img, out_dir / f'{key}.webp')

    mz = place.view(cfg['muzzle'])
    if cfg['pivot'] is None:
        # The middle of the gun where it leaves the view's bottom edge.
        row = idle[-1, :, 3] >= 128
        xs = np.nonzero(row)[0]
        pv = frame.to_view(((xs.min() + xs.max() + 1) / 2, frame.sh - 0.5))
    else:
        pv = place.view(cfg['pivot'])
    for label, pt in (('muzzle', mz), ('pivot', pv)):
        if not (frame.left <= pt[0] <= frame.left + frame.w and frame.top <= pt[1] <= VIEW_H):
            sys.exit(f'{name}: the {label} ({pt[0]:.0f}, {pt[1]:.0f}) is outside the frame')
    manifest = {
        'viewH': VIEW_H,
        'left': frame.left - VIEW_W // 2, 'top': frame.top, 'w': frame.w, 'h': frame.h,
        'muzzle': [round(mz[0] - VIEW_W / 2, 1), round(mz[1], 1)],
        'pivot': [round(pv[0] - VIEW_W / 2, 1), round(pv[1], 1)],
        'axis': [round(axis[0], 4), round(axis[1], 4)],
        'glow': glows['idle'],
    }
    if alt:
        manifest['alt'] = {'kind': alt, 'glow': glows['alt']}
    if hammer:
        manifest['hammer'] = hammer
    if cylinder:
        manifest['cylinder'] = cylinder
    if heal:
        manifest['heal'] = heal
    if 'sweep' in cfg:
        manifest['swing'] = scourge(cfg, out_dir)
        total += sum((out_dir / f).stat().st_size for f in ('fist.webp', 'chain.webp', 'chain-glow.webp'))
    (out_dir / 'weapon.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf8')
    print(f'{name}: frame {frame.w}x{frame.h} view px from column {frame.left}, stored {frame.sw}x{frame.sh}; '
          f'files {", ".join(sorted(p.name for p in out_dir.glob("*.webp")))}: {total / 1e6:.2f} MB')
    if total > 2.5e6:
        sys.exit(f'{name}: {total / 1e6:.2f} MB, over the 2.5 MB budget (M11 §5)')
    previews(name, manifest, frame, layers, glows, extra_preview, place, cfg)
    return manifest


# ---------------------------------------------------------------------------------------------
# Previews (M11 §2)

def composite(dst: np.ndarray, src: np.ndarray, x: float, y: float, w: float, h: float, mode: str = 'normal', opacity: float = 1.0) -> None:
    """Draws `src` (RGBA 0-255) into `dst` (RGB float, or RGBA) at a box in dst pixels."""
    img = Image.fromarray(src.round().clip(0, 255).astype(np.uint8), 'RGBA').convert('RGBa')
    x0, y0 = math.floor(x), math.floor(y)
    tw, th = max(1, round(x + w) - x0), max(1, round(y + h) - y0)
    s = np.asarray(img.resize((tw, th), Image.LANCZOS).convert('RGBA')).astype(np.float32)
    H, W = dst.shape[:2]
    sx0, sy0 = max(0, -x0), max(0, -y0)
    dx0, dy0 = max(0, x0), max(0, y0)
    dx1, dy1 = min(W, x0 + tw), min(H, y0 + th)
    if dx1 <= dx0 or dy1 <= dy0:
        return
    s = s[sy0:sy0 + dy1 - dy0, sx0:sx0 + dx1 - dx0]
    a = s[..., 3:] / 255 * opacity
    d = dst[dy0:dy1, dx0:dx1]
    if mode == 'screen':
        blended = 255 - (255 - d[..., :3]) * (255 - s[..., :3]) / 255
        # Over the weapon's own pixels (where dst has alpha) screen, elsewhere plain alpha (M11 §2).
        ab = d[..., 3:] / 255 if d.shape[-1] == 4 else np.ones_like(a)
        c = blended * ab + s[..., :3] * (1 - ab)
    else:
        c = s[..., :3]
    if d.shape[-1] == 4:
        ab = d[..., 3:] / 255
        ao = a + ab * (1 - a)
        with np.errstate(divide='ignore', invalid='ignore'):
            col = np.nan_to_num((c * a + d[..., :3] * ab * (1 - a)) / ao)
        d[..., :3] = col
        d[..., 3:] = ao * 255
    else:
        d[...] = c * a + d * (1 - a)


def weapon_group(frame: Frame, layers: dict, glows: dict, which: str = 'idle', g: float = 0.35, hammer_deg: float = 0.0,
                 manifest: dict | None = None, blur: float = 0.0) -> np.ndarray:
    """The weapon box as the HUD draws it, at view resolution: RGBA."""
    grp = np.zeros((frame.h, frame.w, 4), np.float32)
    base = layers['alt'] if which == 'alt' else layers['idle']
    composite(grp, base, 0, 0, frame.w, frame.h)
    if manifest and 'hammer' in manifest:
        hm = manifest['hammer']
        hl = layers['hammer']
        img = Image.fromarray(hl.round().clip(0, 255).astype(np.uint8), 'RGBA').resize((round(hm['w']), round(hm['h'])), Image.LANCZOS)
        hx, hy = hm['hinge'][0] - hm['x'], hm['hinge'][1] - hm['y']
        # Turned around its hinge: PIL turns counterclockwise for positive angles, CSS clockwise.
        pad = round(max(hm['w'], hm['h']))
        big = Image.new('RGBA', (img.width + 2 * pad, img.height + 2 * pad))
        big.paste(img, (pad, pad))
        big = big.rotate(-hammer_deg, resample=Image.BICUBIC, center=(hx + pad, hy + pad))
        composite(grp, np.asarray(big).astype(np.float32), hm['x'] - pad, hm['y'] - pad, big.width, big.height)
    if manifest and 'cylinder' in manifest and blur > 0:
        cy = manifest['cylinder']
        composite(grp, layers['cylinder'], cy['x'], cy['y'], cy['w'], cy['h'], opacity=blur)
    key = f'{which}-glow'
    if glows.get(which) and key in layers:
        composite(grp, layers[key], 0, 0, frame.w, frame.h, opacity=g)
    return grp


def preview_base(name: str) -> tuple[np.ndarray, np.ndarray]:
    scene = np.asarray(Image.open(SHOTS / 'base-scene.png').convert('RGB')).astype(np.float32)
    hud = np.asarray(Image.open(SHOTS / f'base-hud-{name}.png').convert('RGBA')).astype(np.float32)
    return scene, hud


def cross(d: ImageDraw.ImageDraw, x: float, y: float, color, r: int = 9) -> None:
    d.line([(x - r, y), (x + r, y)], fill=color, width=2)
    d.line([(x, y - r), (x, y + r)], fill=color, width=2)


def previews(name: str, manifest: dict, frame: Frame, layers: dict, glows: dict, extra: dict, place: Placement, cfg: dict) -> None:
    SHOTS.mkdir(parents=True, exist_ok=True)
    for old in SHOTS.glob(f'prep-{name}*.png'):
        old.unlink()
    s = PREVIEW_H / VIEW_H
    ox = PREVIEW_W / 2 - VIEW_W / 2 * s

    def placed(which: str) -> Image.Image:
        scene, hud = preview_base(name)
        grp = weapon_group(frame, layers, glows, which, manifest=manifest)
        composite(scene, grp, ox + frame.left * s, frame.top * s, frame.w * s, frame.h * s)
        composite(scene, hud, 0, 0, PREVIEW_W, PREVIEW_H)
        img = Image.fromarray(scene.round().clip(0, 255).astype(np.uint8))
        d = ImageDraw.Draw(img)
        mx, my = ox + (manifest['muzzle'][0] + VIEW_W / 2) * s, manifest['muzzle'][1] * s
        px, py = ox + (manifest['pivot'][0] + VIEW_W / 2) * s, manifest['pivot'][1] * s
        ax, ay = manifest['axis']
        t = (AIM_ROW * s - my) / ay
        d.line([(mx, my), (mx + t * ax, my + t * ay)], fill=(255, 32, 32), width=1)
        cx, cy = PREVIEW_W / 2, PREVIEW_H / 2
        d.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], outline=(255, 255, 255), width=1)
        cross(d, mx, my, (0, 255, 255))
        cross(d, px, py, (255, 0, 255))
        return img

    placed('idle').save(SHOTS / f'prep-{name}.png')
    if 'alt' in layers:
        placed('alt').save(SHOTS / f'prep-{name}-alt.png')
    # The glow layers alone on black.
    for which in ('idle', 'alt'):
        key = f'{which}-glow'
        if key not in layers:
            continue
        black = np.zeros((frame.h, frame.w, 3), np.float32)
        composite(black, layers[key], 0, 0, frame.w, frame.h)
        sfx = '' if which == 'idle' else '-alt'
        Image.fromarray(black.round().clip(0, 255).astype(np.uint8)).resize((round(frame.w * s), round(frame.h * s)), Image.LANCZOS).save(SHOTS / f'prep-{name}-glow{sfx}.png')
    if 'hammer' in manifest:
        hm = manifest['hammer']
        # Cropped to the gun around the hammer, enlarged 2x (from the preview's scale).
        cx, cy = hm['hinge']
        box = (max(0, round(cx - 260)), max(0, round(cy - 220)), min(frame.w, round(cx + 200)), min(frame.h, round(cy + 160)))
        tiles = []
        for deg in (0.0, hm['fall']):
            grp = weapon_group(frame, layers, glows, 'idle', manifest=manifest, hammer_deg=deg)
            bg = np.full((frame.h, frame.w, 3), 70, np.float32)
            composite(bg, grp, 0, 0, frame.w, frame.h)
            tiles.append(Image.fromarray(bg.round().clip(0, 255).astype(np.uint8)).crop(box))
        side_by_side(tiles, 2 * s).save(SHOTS / f'prep-{name}-hammer.png')
    if 'cylinder' in extra:
        sharp, blurred = extra['cylinder']
        bg_tiles = []
        for img in (sharp, blurred):
            bg = np.full(img.shape[:2] + (3,), 70, np.float32)
            composite(bg, img, 0, 0, img.shape[1], img.shape[0])
            bg_tiles.append(Image.fromarray(bg.round().clip(0, 255).astype(np.uint8)))
        # Stored pixels -> view pixels -> the preview's scale, enlarged 2x.
        side_by_side(bg_tiles, 2 * s / frame.k).save(SHOTS / f'prep-{name}-cylinder.png')
    if 'heal' in extra:
        orange, green, green_glow, orange_glow = extra['heal']
        tiles = []
        for img, gl in ((orange, orange_glow), (green, green_glow)):
            bg = np.full(img.shape[:2] + (4,), 0, np.float32)
            composite(bg, img, 0, 0, img.shape[1], img.shape[0])
            composite(bg, gl, 0, 0, img.shape[1], img.shape[0], opacity=0.5)
            flat = np.full(img.shape[:2] + (3,), 70, np.float32)
            composite(flat, bg, 0, 0, img.shape[1], img.shape[0])
            tiles.append(Image.fromarray(flat.round().clip(0, 255).astype(np.uint8)))
        side_by_side(tiles, 2 * s / frame.k).save(SHOTS / f'prep-{name}-heal.png')
    if 'swing' in manifest:
        n = manifest['swing']['chain']['frames']
        shots = [scourge_preview(name, manifest, frame, layers, glows, (f + 0.5) * 300 / n) for f in range(n)]
        scourge_preview(name, manifest, frame, layers, glows, 150)
        side_by_side(shots, 0.4).save(SHOTS / f'prep-{name}-scourge-frames.png')
    print(f'{name}: previews in {SHOTS.relative_to(ROOT)}')


def side_by_side(tiles: list, scale: float) -> Image.Image:
    tiles = [t.resize((max(1, round(t.width * scale)), max(1, round(t.height * scale))), Image.LANCZOS) for t in tiles]
    gap = 16
    out = Image.new('RGB', (sum(t.width for t in tiles) + gap * (len(tiles) - 1), max(t.height for t in tiles)), (30, 30, 30))
    x = 0
    for t in tiles:
        out.paste(t, (x, 0))
        x += t.width + gap
    return out


def smoothstep(t: float) -> float:
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def scourge_preview(name: str, manifest: dict, frame: Frame, layers: dict, glows: dict, ms: float) -> Image.Image:
    """The swing `ms` after the Scourge (M11 §3.6): the chain frame of that moment, the painted fist
    over it at the frame's hand, turned so its forearm lies along the rendered one's."""
    out_dir = OUT / f'weapon-{name}'
    sw = manifest['swing']
    scene, hud = preview_base(name)
    s = PREVIEW_H / VIEW_H
    ox = PREVIEW_W / 2 - VIEW_W / 2 * s
    t = ms / 300
    # The Chain Gun drops out of the way while the left hand swings (stage 1 review): down by SWING_DROP vh.
    drop = SWING_DROP * min(1.0, 1.6 * math.sin(math.pi * t))
    jolt = (3 * math.sin(math.pi * t) * PREVIEW_H / 100, drop * PREVIEW_H / 100)
    grp = weapon_group(frame, layers, glows, 'idle', manifest=manifest)
    composite(scene, grp, ox + frame.left * s + jolt[0], frame.top * s + jolt[1], frame.w * s, frame.h * s)
    ch = sw['chain']
    f = min(ch['frames'] - 1, int(t * ch['frames']))
    strip = np.asarray(Image.open(out_dir / 'chain.webp').convert('RGBA')).astype(np.float32)
    glow = np.asarray(Image.open(out_dir / 'chain-glow.webp').convert('RGBA')).astype(np.float32)
    fh = strip.shape[0] // ch['frames']
    box = (PREVIEW_W / 2 + ch['left'] * s, ch['top'] * s, ch['w'] * s, ch['h'] * s)
    composite(scene, strip[f * fh:(f + 1) * fh], *box)
    rgba = np.dstack([scene, np.full(scene.shape[:2], 255, np.float32)])
    composite(rgba, glow[f * fh:(f + 1) * fh], *box, opacity=0.5)
    scene = rgba[..., :3].copy()
    hx, hy, ang = sw['hands'][f]
    fist = np.asarray(Image.open(out_dir / 'fist.webp').convert('RGBA')).astype(np.float32)
    fw, fhh = sw['fist']['w'] * s, sw['fist']['h'] * s
    fimg = Image.fromarray(fist.round().clip(0, 255).astype(np.uint8), 'RGBA').resize((round(fw), round(fhh)), Image.LANCZOS)
    pad = round(max(fw, fhh))
    big = Image.new('RGBA', (fimg.width + 2 * pad, fimg.height + 2 * pad))
    big.paste(fimg, (pad, pad))
    ccx, ccy = sw['fist']['center'][0] * s + pad, sw['fist']['center'][1] * s + pad
    big = big.rotate(-(ang - sw['fist']['angle']), resample=Image.BICUBIC, center=(ccx, ccy))
    composite(scene, np.asarray(big).astype(np.float32), PREVIEW_W / 2 + hx * s - ccx, hy * s - ccy, big.width, big.height)
    composite(scene, hud, 0, 0, PREVIEW_W, PREVIEW_H)
    img = Image.fromarray(scene.round().clip(0, 255).astype(np.uint8))
    if ms == 150:
        img.save(SHOTS / f'prep-{name}-scourge.png')
    return img


def weapons(names: list[str] | None = None) -> None:
    for name in names or FP:
        weapon(name)
