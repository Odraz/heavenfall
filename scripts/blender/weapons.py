"""
Builds the four first-person weapons in Blender, each in its class's hands, and renders the
first-person weapon atlases (§11.2): an idle frame and 4 fire frames, 600 px tall, each storing
its muzzle point. The look follows assets/art-src/reference/weapon-*-sheet.png. Shared code is in
common.py.

Run with Blender 5.2 (headless):
  blender -b --factory-startup -P scripts/blender/weapons.py -- <command> [args]

Commands:
  preview <classId> <out.png>   the 5 frames side by side, the muzzle points marked
  swing <out.png>               the Binder's Scourge swing frames side by side
  sprites <classId|all>         writes assets/sprites/weapon-<classId>/atlas.png and atlas.json

The Binder's atlas also holds the Scourge's swing (M9 §5.1): the left hand lets go of the Chain Gun
and swings a chain ending in a hooked iron weight across the view, from left to right, over 0.3 s.
The swing frames are cropped on their own, since the chain reaches across the whole view.

Each frame is the bottom half of the view from the eye, so the HUD draws it over the bottom half
of the screen. The camera sits at the origin looking along +Y, +Z up.
"""
import math
import os
import sys

import bpy
from mathutils import Euler, Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (EMISSIVE, PAL, box, chain, cracked, ink_frame, render_to_array, reset_scene,  # noqa: E402
                    save_array, sphere, torus, tube)

# A narrower field of view than the world's 75°, as is usual for first-person weapons: the weapon
# sits further away, so the parts nearest the eye don't balloon.
FOV_DEG = 50
FRAME_H = 600         # the frame height: the bottom half of a 1200 px tall view
SS = 2                # supersampling
INK_PX_PER_M = 150    # sets the outer contour to 3 px (see ink_frame)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

PAL.update({
    # Fallen
    'iron': (0.36, 0.32, 0.30), 'rust': (0.56, 0.26, 0.16), 'gunmetal': (0.40, 0.40, 0.43),
    'molten': (1.0, 0.52, 0.12), 'rune': (1.0, 0.30, 0.12), 'horn': (0.24, 0.21, 0.20),
    # Heretic
    'robe': (0.32, 0.28, 0.26), 'trim': (0.70, 0.20, 0.10), 'bronze': (0.50, 0.34, 0.20),
    'gold': (0.80, 0.62, 0.32), 'coal': (1.0, 0.62, 0.20), 'skin': (0.62, 0.58, 0.55),
    # Binder
    'chain': (0.66, 0.28, 0.16), 'hot': (1.0, 0.42, 0.15), 'glove': (0.33, 0.31, 0.30),
    # Betrayer
    'silver': (0.80, 0.81, 0.84), 'leather': (0.25, 0.24, 0.24), 'grip': (0.17, 0.15, 0.15), 'gem': (0.85, 0.10, 0.10),
    'shade': (0.10, 0.09, 0.09),
})
EMISSIVE.update({'molten', 'rune', 'coal', 'hot'})


# ---------------------------------------------------------------- shared pieces

class Rig:
    """The weapon's root (the right hand on the grip) and the parts its fire animation moves."""

    def __init__(self):
        self.root = bpy.data.objects.new('weapon_root', None)
        bpy.context.collection.objects.link(self.root)
        self.parts = {}     # name: empty, for moving parts
        self.muzzle = Vector()

    def part(self, name, pivot=(0, 0, 0)):
        e = bpy.data.objects.new(name, None)
        bpy.context.collection.objects.link(e)
        e.parent = self.root
        e.location = pivot
        self.parts[name] = e
        return e

    def add(self, obj, parent=None):
        """Parents `obj` (built in weapon space) to the root or to a moving part."""
        for o in obj if isinstance(obj, list) else [obj]:
            p = parent or self.root
            o.parent = p
            if p is not self.root:
                o.matrix_parent_inverse = Matrix.Translation(-p.location)
        return obj


def arm(rig, name, hand, elbow, r_hand, r_elbow, mat, fist_mat=None, fist_scale=(0.05, 0.06, 0.05)):
    """A forearm from off-screen (`elbow`) to `hand`, and a fist."""
    rig.add(tube(f'{name}forearm', elbow, hand, r_elbow, r_hand, mat, seg=14, outline=0.006))
    rig.add(sphere(f'{name}fist', hand, fist_scale, fist_mat or mat, seg=14, outline=0.006))


# ---------------------------------------------------------------- the weapons

def build_shotgun(rig):
    """The Brimstone Shotgun in the Fallen's charred gauntlets: wide barrel, pump, runes, seams."""
    iron = cracked('iron', 'molten', scale=9.0, width=0.03, coverage=0.4)
    rig.add(box('receiver', (0, 0.07, 0.05), (0.075, 0.24, 0.10), iron, bevel=0.01, outline=0.005))
    rig.add(tube('barrel', (0, 0.17, 0.085), (0, 0.72, 0.085), 0.036, 0.036, 'gunmetal', seg=16, squash=0.8, outline=0.005))
    rig.add(box('rib', (0, 0.44, 0.122), (0.016, 0.56, 0.008), 'gunmetal', outline=0.003))
    rig.add(box('sight', (0, 0.71, 0.134), (0.01, 0.02, 0.022), 'rune', outline=0.002))
    rig.add(box('rearsight', (0, 0.14, 0.11), (0.04, 0.012, 0.02), 'gunmetal', outline=0.003))
    for sx in (-1, 1):
        rig.add(tube(f'bore{sx}', (0.014 * sx, 0.715, 0.085), (0.014 * sx, 0.722, 0.085), 0.012, 0.012, 'molten', seg=10, outline=0.0))
    rig.add(tube('magtube', (0, 0.17, 0.03), (0, 0.66, 0.03), 0.024, 0.024, 'gunmetal', seg=12, outline=0.004))
    for k in range(7):
        rig.add(box(f'rune{k}', (0, 0.26 + 0.06 * k, 0.1215), (0.022, 0.03, 0.004), 'rune', outline=0.0))
    rig.add(box('rrune', (0, 0.05, 0.1015), (0.03, 0.05, 0.004), 'rune', outline=0.0))
    pump = rig.part('pump', (0, 0.42, 0.03))
    rig.add(tube('pumpgrip', (0, 0.34, 0.028), (0, 0.50, 0.028), 0.042, 0.042, iron, seg=14, outline=0.005), pump)
    for k in range(4):
        rig.add(torus(f'pumpridge{k}', (0, 0.36 + 0.04 * k, 0.028), 0.043, 0.005, 'gunmetal', rot=(math.pi / 2, 0, 0), seg=16, outline=0.0), pump)
    rig.add(tube('stock', (0, -0.02, 0.03), (0.01, -0.16, -0.03), 0.032, 0.04, iron, seg=10, squash=0.7, outline=0.005))
    # The Fallen's hands: cracked charred gauntlets, the left one on the pump.
    gaunt = cracked('iron', 'molten', scale=7.0, width=0.04, coverage=0.5)
    arm(rig, 'R', (0.02, -0.03, -0.015), (0.10, -0.16, -0.38), 0.042, 0.06, gaunt, fist_scale=(0.045, 0.055, 0.045))
    rig.add(tube('Rbracer', (0.05, -0.08, -0.15), (0.08, -0.13, -0.29), 0.055, 0.065, cracked('rust', 'molten', scale=7.0, width=0.04), seg=14, outline=0.005))
    rig.add(tube('Rspike', (0.10, -0.10, -0.20), (0.17, -0.10, -0.17), 0.018, 0.0, 'horn', seg=8, outline=0.004))
    arm(rig, 'L', (-0.015, 0.42, -0.02), (-0.18, 0.18, -0.42), 0.042, 0.06, gaunt, fist_scale=(0.045, 0.055, 0.042))
    rig.add(tube('Lbracer', (-0.07, 0.33, -0.17), (-0.13, 0.25, -0.31), 0.052, 0.062, cracked('rust', 'molten', scale=7.0, width=0.04), seg=14, outline=0.005))
    rig.muzzle = Vector((0, 0.73, 0.085))
    # Grip in the lower right, aimed just under the crosshair.
    return Vector((0.24, 0.62, -0.30)), 8.0


def build_censer(rig):
    """The Censer Launcher in the Heretic's cloth-wrapped hands: filigreed bronze, a censer of coals."""
    rig.add(tube('body', (0, 0.03, 0.08), (0, 0.27, 0.08), 0.045, 0.066, 'bronze', seg=18, outline=0.005))
    for k, y in enumerate((0.07, 0.20)):
        rig.add(chain(f'bodychain{k}', [(0.068 * math.cos(a), y, 0.08 + 0.068 * math.sin(a)) for a in (2 * math.pi * i / 14 for i in range(15))],
                      'iron', link=0.03, thick=0.006, outline=0.002))
    for k, x in enumerate((-0.03, 0.03)):
        rig.add(box(f'arch{k}', (x, 0.135, 0.146), (0.022, 0.10, 0.004), 'gold', outline=0.0))
    rig.add(box('cross', (0, 0.135, 0.147), (0.006, 0.07, 0.003), 'gold', outline=0.0))
    rig.add(tube('bell', (0, 0.27, 0.08), (0, 0.31, 0.08), 0.066, 0.076, 'bronze', seg=18, cap=False, outline=0.005))
    rig.add(torus('bellrim', (0, 0.31, 0.08), 0.076, 0.009, 'gold', rot=(math.pi / 2, 0, 0), seg=20, outline=0.003))
    censer = rig.part('censer', (0, 0.39, 0.08))
    rig.add(sphere('censerball', (0, 0.39, 0.08), (0.098, 0.098, 0.098), cracked('bronze', 'coal', scale=22.0, width=0.12, coverage=0.75), seg=18, outline=0.005), censer)
    rig.add(sphere('censertip', (0, 0.495, 0.08), (0.024, 0.024, 0.024), 'bronze', seg=10, outline=0.003), censer)
    rig.add(box('hammer', (0, 0.02, 0.135), (0.018, 0.03, 0.03), 'bronze', outline=0.003))
    rig.add(tube('grip', (0, 0.04, 0.03), (0, -0.02, -0.10), 0.026, 0.03, 'gold', seg=10, squash=0.7, outline=0.004))
    rig.add(box('frame', (0, 0.06, 0.02), (0.032, 0.08, 0.04), 'bronze', bevel=0.006, outline=0.004))
    # The Heretic's hands: soot-black wrappings banded with ember-red bandages.
    arm(rig, 'R', (0.01, 0.02, -0.05), (0.18, -0.30, -0.32), 0.045, 0.06, 'robe', fist_mat='skin', fist_scale=(0.045, 0.05, 0.05))
    arm(rig, 'L', (-0.065, 0.14, 0.06), (-0.30, -0.05, -0.30), 0.042, 0.06, 'robe', fist_mat='skin', fist_scale=(0.03, 0.06, 0.05))
    for name, a, b in (('R', (0.01, 0.02, -0.05), (0.18, -0.30, -0.32)), ('L', (-0.065, 0.14, 0.06), (-0.30, -0.05, -0.30))):
        a, b = Vector(a), Vector(b)
        for k in range(3):
            p = a.lerp(b, 0.25 + 0.2 * k)
            rig.add(torus(f'{name}band{k}', p, 0.05 + 0.004 * k, 0.012, 'trim', rot=(b - a).to_track_quat('Z', 'Y').to_euler(), seg=14, outline=0.003))
    rig.muzzle = Vector((0, 0.45, 0.08))
    return Vector((0.30, 0.95, -0.40)), 3.0


def build_chaingun(rig):
    """The Chain Gun in the Binder's iron gloves: six barrels banded red-hot, chains, the belt feed."""
    rig.add(tube('receiver', (0, 0.02, 0.06), (0, 0.30, 0.06), 0.085, 0.085, 'iron', seg=18, outline=0.006))
    rig.add(torus('recband', (0, 0.25, 0.06), 0.087, 0.012, 'hot', rot=(math.pi / 2, 0, 0), seg=20, outline=0.003))
    for k in range(3):
        rig.add(box(f'slot{k}', (0, 0.06 + 0.07 * k, 0.146), (0.014, 0.045, 0.004), 'hot', outline=0.0))
    barrels = rig.part('barrels', (0, 0.0, 0.06))
    for k in range(6):
        a = 2 * math.pi * k / 6
        off = Vector((math.cos(a) * 0.04, 0, math.sin(a) * 0.04))
        rig.add(tube(f'barrel{k}', Vector((0, 0.30, 0.06)) + off, Vector((0, 0.86, 0.06)) + off, 0.017, 0.017, 'iron', seg=10, outline=0.004), barrels)
    for k, y in enumerate((0.45, 0.63, 0.80)):
        rig.add(torus(f'band{k}', (0, y, 0.06), 0.063, 0.013, 'hot', rot=(math.pi / 2, 0, 0), seg=20, outline=0.003), barrels)
    rig.add(tube('hub', (0, 0.30, 0.06), (0, 0.87, 0.06), 0.02, 0.02, 'shade', seg=8, outline=0.0), barrels)
    for k, y in enumerate((0.38, 0.70)):
        rig.add(chain(f'wrap{k}', [(0.075 * math.cos(a), y + 0.02 * math.sin(3 * a), 0.06 + 0.075 * math.sin(a)) for a in (2 * math.pi * i / 16 for i in range(17))],
                      'chain', link=0.035, thick=0.007, outline=0.002))
    # The top handle (left hand) and the rear grip (right hand).
    rig.add(tube('post0', (0, 0.12, 0.14), (0, 0.12, 0.20), 0.012, 0.012, 'iron', seg=8, outline=0.003))
    rig.add(tube('post1', (0, 0.26, 0.14), (0, 0.26, 0.20), 0.012, 0.012, 'iron', seg=8, outline=0.003))
    rig.add(tube('tophandle', (0, 0.11, 0.20), (0, 0.27, 0.20), 0.018, 0.018, 'glove', seg=8, outline=0.003))
    rig.add(box('rearplate', (0, 0.0, 0.04), (0.09, 0.02, 0.10), 'iron', bevel=0.008, outline=0.004))
    # The belt of links hanging from the left side, off the bottom of the screen.
    rig.add(chain('feedbelt', [(-0.08, 0.20, 0.03), (-0.14, 0.16, -0.06), (-0.17, 0.08, -0.20), (-0.18, 0.0, -0.40)],
                  'iron', link=0.05, thick=0.014, outline=0.003))
    # The Binder's hands: iron gloves, chains wound around the wrists.
    arm(rig, 'R', (0.02, -0.02, -0.01), (0.22, -0.30, -0.30), 0.05, 0.072, 'glove', fist_scale=(0.055, 0.065, 0.06))
    # The left hand braces the side of the receiver, clear of the view down the barrels.
    arm(rig, 'L', (-0.10, 0.20, 0.04), (-0.34, 0.0, -0.30), 0.048, 0.07, 'glove', fist_scale=(0.04, 0.06, 0.055))
    for name, a, b in (('R', (0.02, -0.02, -0.01), (0.22, -0.30, -0.30)), ('L', (-0.10, 0.20, 0.04), (-0.34, 0.0, -0.30))):
        a, b = Vector(a), Vector(b)
        d = (b - a).normalized()
        u = d.cross(Vector((0, 0, 1))).normalized()
        v = d.cross(u)
        coil = [a + d * (0.08 + 0.10 * i / 24) + (u * math.cos(w) + v * math.sin(w)) * 0.062 for i, w in ((i, 2 * math.pi * 2 * i / 24) for i in range(25))]
        rig.add(chain(f'{name}wristchain', coil, 'chain', link=0.035, thick=0.008, outline=0.002))
    rig.muzzle = Vector((0, 0.88, 0.06))
    return Vector((0.33, 0.95, -0.46)), 3.5


def build_revolver(rig):
    """The Silver Revolver in the Betrayer's slim black gloves, held in both hands."""
    rig.add(box('frame', (0, 0.03, 0.05), (0.032, 0.09, 0.06), 'silver', bevel=0.008, outline=0.004))
    cyl = rig.part('cylinder', (0, 0.07, 0.058))
    rig.add(tube('cyl', (0, 0.045, 0.058), (0, 0.10, 0.058), 0.03, 0.03, 'silver', seg=6, outline=0.004), cyl)
    for k in range(6):
        a = 2 * math.pi * k / 6 + math.pi / 6
        rig.add(box(f'flute{k}', (0.028 * math.cos(a), 0.072, 0.058 + 0.028 * math.sin(a)), (0.006, 0.04, 0.006), 'shade', rot=(0, -a, 0), outline=0.0), cyl)
    rig.add(tube('barrel', (0, 0.09, 0.07), (0, 0.42, 0.07), 0.013, 0.012, 'silver', seg=12, outline=0.004))
    rig.add(box('rib', (0, 0.26, 0.083), (0.008, 0.33, 0.008), 'silver', outline=0.002))
    rig.add(box('sight', (0, 0.41, 0.09), (0.004, 0.012, 0.012), 'silver', outline=0.002))
    rig.add(tube('ejector', (0, 0.10, 0.052), (0, 0.32, 0.052), 0.006, 0.006, 'silver', seg=8, outline=0.002))
    for k, y in enumerate((0.15, 0.24)):
        rig.add(box(f'engrave{k}', (0, y, 0.0835), (0.012, 0.05, 0.002), 'gold', outline=0.0))
    hammer = rig.part('hammer', (0, -0.005, 0.07))
    rig.add(box('hammerbody', (0, -0.01, 0.085), (0.012, 0.02, 0.035), 'silver', rot=(-0.4, 0, 0), outline=0.003), hammer)
    rig.add(sphere('gem', (0, -0.012, 0.1), (0.008, 0.008, 0.008), 'gem', seg=8, outline=0.002), hammer)
    rig.add(tube('grip', (0, 0.0, 0.03), (0, -0.04, -0.07), 0.018, 0.022, 'grip', seg=10, squash=0.8, outline=0.004))
    # The Betrayer's hands: slim black gloves, the left wrapped around the right.
    arm(rig, 'R', (0.008, -0.01, -0.02), (0.14, -0.30, -0.30), 0.032, 0.045, 'leather', fist_scale=(0.035, 0.045, 0.045))
    arm(rig, 'L', (-0.02, -0.005, -0.035), (-0.18, -0.28, -0.32), 0.032, 0.045, 'leather', fist_scale=(0.035, 0.045, 0.04))
    rig.muzzle = Vector((0, 0.425, 0.07))
    return Vector((0.17, 0.50, -0.22)), 6.0


WEAPONS = {'fallen': build_shotgun, 'heretic': build_censer, 'binder': build_chaingun, 'betrayer': build_revolver}


# ---------------------------------------------------------------- fire animations

def kick(rig, base_loc, base_rot, back, up_deg, side=0.0):
    """Moves the whole weapon back toward the eye by `back` and tips its muzzle up by `up_deg`."""
    rig.root.location = base_loc + Vector((side, -back, 0))
    rig.root.rotation_euler = (Euler(base_rot).to_matrix() @ Euler((math.radians(up_deg), 0, 0)).to_matrix()).to_euler()


def pose(cls, rig, base_loc, base_rot, frame):
    """Frame 0 is idle; 1–4 fire."""
    p = rig.parts
    if cls == 'fallen':
        back, up = [(0, 0), (0.06, 9), (0.035, 5), (0.012, 2), (0.0, 0.5)][frame]
        kick(rig, base_loc, base_rot, back, up)
        # Racking the pump: back on frame 2, forward on 3.
        p['pump'].location = (0, 0.42 - [0, 0.02, 0.11, 0.04, 0][frame], 0.03)
    elif cls == 'heretic':
        back, up = [(0, 0), (0.07, 12), (0.04, 6), (0.015, 2), (0.0, 0.5)][frame]
        kick(rig, base_loc, base_rot, back, up)
        # The censer leaves with the shot, and a fresh one swells into the muzzle.
        s = [1, 0.01, 0.01, 0.45, 0.85][frame]
        p['censer'].scale = (s,) * 3
        p['censer'].hide_render = s < 0.05
    elif cls == 'binder':
        # A quarter of the 60° between barrels per frame, so the spin loops at full fire rate.
        shake = [(0, 0, 0), (0.015, 2.0, 0.004), (0.01, 1.2, -0.004), (0.015, 2.0, 0.003), (0.01, 1.0, -0.003)][frame]
        kick(rig, base_loc, base_rot, shake[0], shake[1], shake[2])
        p['barrels'].rotation_euler = (0, math.radians(15 * frame), 0)
    elif cls == 'betrayer':
        back, up = [(0, 0), (0.05, 12), (0.03, 7), (0.012, 3), (0.0, 1)][frame]
        kick(rig, base_loc, base_rot, back, up)
        p['hammer'].rotation_euler = (math.radians([0, 0, -25, -40, 0][frame]), 0, 0)
        p['cylinder'].rotation_euler = (0, math.radians([0, 0, 20, 45, 60][frame]), 0)


# ---------------------------------------------------------------- the Scourge swing (M9 §5.1)

SWING_FRAMES = 4
# The Chain Gun's left arm, hidden while the left hand swings the chain.
LEFT_ARM = ('Lforearm', 'Lfist', 'Lwristchain')


def smoothstep(t):
    return t * t * (3 - 2 * t)


def build_swing(f):
    """
    Swing frame `f` (0 to SWING_FRAMES - 1), in camera space (the eye at the origin looking along +Y):
    the left forearm reaching up from off-screen, the gloved fist, and a chain trailing behind the
    fist that whips around it, ending in a hooked iron weight like the Chains of Tartarus icon.
    Returns the new objects.
    """
    t = (f + 0.5) / SWING_FRAMES
    s = smoothstep(t)
    lift = math.sin(math.pi * t)
    hand = Vector((-0.55 + 0.95 * s, 0.80 + 0.08 * lift, -0.27 + 0.10 * lift))
    elbow = Vector((-0.50 + 0.35 * s, 0.25, -0.62))
    objs = []
    objs.append(tube('Sforearm', elbow, hand, 0.066, 0.046, 'glove', seg=14, outline=0.006))
    objs.append(sphere('Sfist', hand, (0.058, 0.07, 0.062), 'glove', seg=14, outline=0.006))
    # The chain trails behind the fist, then swings around it: its direction turns from pointing back
    # to the left (behind the motion) to pointing ahead to the right, bending toward where it was.
    length = 0.62
    a_end = math.radians(165 - 150 * smoothstep(min(1.0, t * 1.15)))
    bend = math.radians(55) * (1 - t)
    pts = []
    for k in range(13):
        u = k / 12
        a = a_end + bend * u
        r = length * u
        # Horizontal, with a slight droop toward the end.
        pts.append(hand + Vector((math.cos(a) * r, math.sin(a) * r * 0.8 + 0.02, -0.06 * u * u)))
    objs.append(chain('Schain', pts, 'chain', link=0.07, thick=0.015, outline=0.003))
    # The weight: an iron bulb with a red-hot band, and a hook curling out of it.
    end = pts[-1]
    out = (pts[-1] - pts[-2]).normalized()
    w = end + out * 0.065
    objs.append(sphere('Sweight', w, (0.065, 0.065, 0.065), 'iron', seg=16, outline=0.004))
    objs.append(torus('Sweightband', w, 0.066, 0.013, 'hot', rot=out.to_track_quat('Z', 'Y').to_euler(), seg=16, outline=0.002))
    hook = [w + out * 0.04, w + out * 0.10, w + out * 0.13 + Vector((0, 0, 0.03)), w + out * 0.11 + Vector((0, 0, 0.07)), w + out * 0.07 + Vector((0, 0, 0.075))]
    for i, (p0, p1) in enumerate(zip(hook, hook[1:])):
        objs.append(tube(f'Shook{i}', p0, p1, 0.013 - 0.002 * i, 0.011 - 0.002 * i, 'iron', seg=8, outline=0.003))
    # Chain wound round the wrist, as on the Chain Gun hand.
    d = (hand - elbow).normalized()
    u = d.cross(Vector((0, 0, 1))).normalized()
    v = d.cross(u)
    coil = [hand - d * (0.18 - 0.10 * i / 24) + (u * math.cos(wv) + v * math.sin(wv)) * 0.062 for i, wv in ((i, 2 * math.pi * 2 * i / 24) for i in range(25))]
    objs.append(chain('Swristchain', coil, 'chain', link=0.035, thick=0.008, outline=0.002))
    return objs


SWING_SCALE = 2


def half(img):
    """Halves an image (rows from the bottom), averaging with premultiplied alpha."""
    import numpy as np
    h, w, _ = img.shape
    img = img[: h - h % 2, : w - w % 2]
    a = img[..., 3:4]
    pre = np.concatenate([img[..., :3] * a, a], axis=2).reshape(h // 2, 2, w // 2, 2, 4).mean(axis=(1, 3))
    a = pre[..., 3:4]
    rgb = np.where(a > 1e-4, pre[..., :3] / np.maximum(a, 1e-4), np.array(PAL['ink'], dtype=np.float32))
    return np.concatenate([rgb, a], axis=2)


def render_swing(tmp):
    """The Scourge swing frames, each the bottom half of the view, with the Chain Gun idle and its left arm hidden."""
    scene, cam, rig, grip, rot = setup('binder')
    pose('binder', rig, grip, rot, 0)
    for o in bpy.data.objects:
        if o.name.startswith(LEFT_ARM):
            o.hide_render = True
    out = []
    for f in range(SWING_FRAMES):
        objs = build_swing(f)
        arr = render_to_array(scene, tmp)
        out.append((ink_frame(arr, SS, INK_PX_PER_M)[:FRAME_H], 0.0, 0.0))
        for o in objs:
            bpy.data.objects.remove(o, do_unlink=True)
    os.remove(tmp)
    return out


# ---------------------------------------------------------------- rendering

def setup(cls):
    scene = reset_scene()
    cam_data = bpy.data.cameras.new('cam')
    cam_data.sensor_fit = 'VERTICAL'
    cam_data.angle = math.radians(FOV_DEG)
    cam_data.clip_start = 0.01
    cam = bpy.data.objects.new('cam', cam_data)
    bpy.context.collection.objects.link(cam)
    cam.rotation_euler = (math.pi / 2, 0, 0)  # looks along +Y
    scene.camera = cam
    # Twice as wide as tall, so nothing is cut off on screens up to 2:1.
    scene.render.resolution_x = 4 * FRAME_H * SS
    scene.render.resolution_y = 2 * FRAME_H * SS
    scene.render.resolution_percentage = 100
    scene.eevee.taa_render_samples = 16
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy = 3.0
    sun_obj = bpy.data.objects.new('sun', sun)
    bpy.context.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = Euler((math.radians(50), math.radians(-35), math.radians(-25)), 'XYZ')
    rig = Rig()
    # Each builder returns the grip position and how far ahead its barrel crosses the view axis.
    grip, converge = WEAPONS[cls](rig)
    target = Vector((0, converge, 0))
    # Aim so the barrel's axis (through the muzzle, along the weapon's +Y) passes through the
    # crosshair point; the axis sits above and beside the grip, so refine the aim a few times.
    axis_base = Vector((rig.muzzle.x, 0, rig.muzzle.z))
    rot = (target - grip).normalized().to_track_quat('Y', 'Z').to_euler()
    for _ in range(8):
        base = grip + rot.to_matrix() @ axis_base
        rot = (target - base).normalized().to_track_quat('Y', 'Z').to_euler()
    rig.root.location = grip
    rig.root.rotation_euler = rot
    return scene, cam, rig, grip, rot


def muzzle_pixel(scene, cam, rig):
    """The muzzle point in the frame: (x from the left, y from the top) in final pixels, uncropped."""
    from bpy_extras.object_utils import world_to_camera_view
    bpy.context.view_layer.update()
    v = world_to_camera_view(scene, cam, rig.root.matrix_world @ rig.muzzle)
    return v.x * 4 * FRAME_H, (1 - v.y) * 2 * FRAME_H


def render_frames(cls, tmp):
    """The 5 frames, each the bottom half of the view: (image, muzzle x, muzzle y from the frame's top)."""
    scene, cam, rig, grip, rot = setup(cls)
    out = []
    for f in range(5):
        pose(cls, rig, grip, rot, f)
        mx, my = muzzle_pixel(scene, cam, rig)
        arr = render_to_array(scene, tmp)
        img = ink_frame(arr, SS, INK_PX_PER_M)[:FRAME_H]  # rows from the bottom: keep the bottom half
        out.append((img, mx, my - FRAME_H))
    os.remove(tmp)
    return out


def crop_columns(frames):
    """Crops every frame to the columns any frame uses, so they stay aligned. Returns the frames and the left edge."""
    import numpy as np
    used = np.zeros(frames[0][0].shape[1], dtype=bool)
    for img, _, _ in frames:
        used |= (img[..., 3] > 0.02).any(axis=0)
    xs = np.nonzero(used)[0]
    x0, x1 = int(max(xs.min() - 2, 0)), int(min(xs.max() + 3, used.size))
    return [(img[:, x0:x1], mx - x0, my) for img, mx, my in frames], x0


def aim_error(cls):
    """How far, in screen pixels at 1200 px tall, the idle barrel's line passes from the crosshair."""
    from bpy_extras.object_utils import world_to_camera_view
    scene, cam, rig, _, _ = setup(cls)
    bpy.context.view_layer.update()
    w = rig.root.matrix_world
    base = Vector((rig.muzzle.x, 0, rig.muzzle.z))
    pts = [world_to_camera_view(scene, cam, w @ (base + Vector((0, t, 0)))) for t in (0.0, rig.muzzle.y)]
    (x0, y0), (x1, y1) = [(p.x * 4 * FRAME_H, p.y * 2 * FRAME_H) for p in pts]
    cx, cy = 2 * FRAME_H, FRAME_H
    return abs((x1 - x0) * (y0 - cy) - (y1 - y0) * (x0 - cx)) / math.hypot(x1 - x0, y1 - y0)


def cmd_preview(cls, out):
    import numpy as np
    print(f'{cls}: barrel line passes {aim_error(cls):.1f} px from the crosshair')
    frames, _ = crop_columns(render_frames(cls, out + '.tmp.png'))
    h, w, _ = frames[0][0].shape
    sheet = np.zeros((h, w * len(frames), 4), dtype=np.float32)
    sheet[..., :3] = (0.55, 0.62, 0.70)
    sheet[..., 3] = 1
    for i, (img, mx, my) in enumerate(frames):
        a = img[..., 3:4]
        dst = sheet[:, i * w:(i + 1) * w]
        dst[..., :3] = img[..., :3] * a + dst[..., :3] * (1 - a)
        # Mark the muzzle point (rows count from the bottom).
        px, py = int(round(mx)), h - 1 - int(round(my))
        dst[max(py - 3, 0):py + 4, max(px - 3, 0):px + 4, :3] = (0.1, 1.0, 0.3)
    save_array(sheet, out)


def cmd_swing(out):
    import numpy as np
    frames, _ = crop_columns(render_swing(out + '.tmp.png'))
    h, w, _ = frames[0][0].shape
    sheet = np.zeros((h, w * len(frames), 4), dtype=np.float32)
    sheet[..., :3] = (0.55, 0.62, 0.70)
    sheet[..., 3] = 1
    for i, (img, _, _) in enumerate(frames):
        a = img[..., 3:4]
        dst = sheet[:, i * w:(i + 1) * w]
        dst[..., :3] = img[..., :3] * a + dst[..., :3] * (1 - a)
    save_array(sheet, out)


def cmd_sprites(which):
    import json
    import numpy as np
    for cls in (WEAPONS if which == 'all' else [which]):
        out_dir = os.path.join(ROOT, 'assets', 'sprites', f'weapon-{cls}')
        os.makedirs(out_dir, exist_ok=True)
        frames, x0 = crop_columns(render_frames(cls, os.path.join(out_dir, 'render.png')))
        h, w, _ = frames[0][0].shape
        swing, sx0 = crop_columns(render_swing(os.path.join(out_dir, 'render.png'))) if cls == 'binder' else ([], 0)
        # The swing spans the whole view and lasts 0.3 s, so its frames are stored at half resolution.
        swing = [(half(img), 0, 0) for img, _, _ in swing]
        sw = swing[0][0].shape[1] if swing else 0
        sh = swing[0][0].shape[0] if swing else 0
        # Frames side by side in rows of 3, then the swing frames in rows of their own; the atlas
        # width is the next power of two.
        cols = 3
        width = 1
        while width < max(cols * (w + 2), sw + 2):
            width *= 2
        rows = -(-len(frames) // cols)
        scols = max(1, width // (sw + 2)) if swing else 1
        srows = -(-len(swing) // scols) if swing else 0
        height = -(-(rows * (h + 2) + srows * (sh + 2)) // 64) * 64
        atlas = np.zeros((height, width, 4), dtype=np.float32)
        atlas[..., :3] = PAL['ink']
        rects = []
        for i, (img, mx, my) in enumerate(frames):
            x, y = (i % cols) * (w + 2), (i // cols) * (h + 2)
            atlas[height - y - h:height - y, x:x + w] = img
            rects.append([x, y, round(float(mx), 1), round(float(my), 1)])
        srects = []
        for i, (img, _, _) in enumerate(swing):
            x, y = (i % scols) * (sw + 2), rows * (h + 2) + (i // scols) * (sh + 2)
            atlas[height - y - sh:height - y, x:x + sw] = img
            srects.append([x, y])
        save_array(atlas, os.path.join(out_dir, 'atlas.png'))
        manifest = {
            'width': width, 'height': height, 'frameW': w, 'frameH': h,
            # The column of the screen's center line within a frame.
            'centerX': 2 * FRAME_H - x0,
            '_frame': '[x, y from top, muzzle x from left, muzzle y from top] in pixels',
            'idle': [rects[0]],
            'fire': rects[1:],
        }
        if swing:
            # frameW and centerX in full-resolution frame pixels, like the other frames; each atlas
            # pixel of a swing frame covers `scale` of them.
            manifest['swing'] = {'scale': SWING_SCALE, 'frameW': sw * SWING_SCALE, 'centerX': 2 * FRAME_H - sx0, 'frames': srects}
        with open(os.path.join(out_dir, 'atlas.json'), 'w', encoding='utf8', newline='\n') as f:
            f.write(json.dumps(manifest, indent=2) + '\n')
        print(f'weapon-{cls}: atlas {width}x{height}, frames {w}x{h}')


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if not argv:
        raise SystemExit(__doc__)
    cmd, args = argv[0], argv[1:]
    if cmd == 'preview':
        cmd_preview(*args)
    elif cmd == 'swing':
        cmd_swing(*args)
    elif cmd == 'sprites':
        cmd_sprites(*args)
    else:
        raise SystemExit(f'Unknown command {cmd}')


if __name__ == '__main__':
    main()
