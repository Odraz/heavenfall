"""
Builds the Betrayer in Blender from primitives, rigs and animates it, and renders sprite frames.
The look follows assets/art-src/reference/betrayer-front.png and betrayer-turnaround.png. Shared
code and the commands are in common.py.

Run with Blender 5.2 (headless):
  blender -b --factory-startup -P scripts/blender/betrayer.py -- <command> [args]
"""
import math
import os
import sys

from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (PAL, Pose, Spec, add, bind_rigid, bind_skirt, box, build_armature, main,  # noqa: E402
                    robe_panel, sphere, sweep, torus, tube)

# ---------------------------------------------------------------- palette

PAL.update({
    'coat': (0.26, 0.25, 0.25),     # fitted black coat
    'lining': (0.40, 0.14, 0.11),   # dark red, inside the collar
    'sash': (0.64, 0.16, 0.12),     # blood red
    'silver': (0.78, 0.79, 0.82),
    'skin': (0.78, 0.64, 0.54),
    'shade': (0.10, 0.09, 0.09),
    'leather': (0.20, 0.19, 0.19),  # gloves and boots
    'grip': (0.42, 0.26, 0.18),
    'gem': (0.80, 0.10, 0.10),
})

# ---------------------------------------------------------------- armature

# name: (head, tail, parent)
BONES = {
    'root': ((0, 0, 0), (0, 0.15, 0), None),
    'hips': ((0, 0, 0.98), (0, 0, 1.06), 'root'),
    'spine': ((0, 0, 1.06), (0, 0, 1.28), 'hips'),
    'chest': ((0, 0, 1.28), (0, 0, 1.48), 'spine'),
    'neck': ((0, 0, 1.48), (0, 0, 1.56), 'chest'),
    'head': ((0, 0, 1.56), (0, 0, 1.80), 'neck'),
    'skirt_back': ((0, 0.11, 0.98), (0, 0.16, 0.30), 'hips'),
}
for side, sx in (('R', -1), ('L', 1)):
    BONES.update({
        f'shoulder.{side}': ((0.03 * sx, 0, 1.44), (0.17 * sx, 0, 1.44), 'chest'),
        f'upper_arm.{side}': ((0.19 * sx, 0, 1.42), (0.215 * sx, 0, 1.13), f'shoulder.{side}'),
        f'forearm.{side}': ((0.215 * sx, 0, 1.13), (0.23 * sx, -0.03, 0.88), f'upper_arm.{side}'),
        f'hand.{side}': ((0.23 * sx, -0.03, 0.88), (0.235 * sx, -0.04, 0.80), f'forearm.{side}'),
        f'thigh.{side}': ((0.085 * sx, 0, 0.94), (0.09 * sx, 0, 0.51), 'hips'),
        f'shin.{side}': ((0.09 * sx, 0, 0.51), (0.09 * sx, 0.01, 0.09), f'thigh.{side}'),
        f'foot.{side}': ((0.09 * sx, 0.01, 0.09), (0.09 * sx, -0.13, 0.03), f'shin.{side}'),
        f'skirt.{side}': ((0.10 * sx, -0.08, 0.98), (0.14 * sx, -0.12, 0.35), 'hips'),
    })

# The revolver points down at the right side, a little forward and out.
HAND_R = Vector((-0.235, -0.045, 0.82))
GUN_DIR = Vector((-0.12, -0.22, -1.0)).normalized()


# ---------------------------------------------------------------- the model

def build_model():
    arm = build_armature(BONES)
    parts = []  # (object, bone)

    def rigid(obj, bone):
        parts.append((obj, bone))
        return obj

    # Head: a narrow hood that hides the eyes in shadow, leaving the jaw and a smirk.
    rigid(sphere('hood', (0, 0.01, 1.70), (0.115, 0.135, 0.15), 'coat', outline=0.009), 'head')
    rigid(sweep('hoodpeak', [(0, 0.0, 1.76), (0, 0.01, 1.84), (0, 0.04, 1.90)], [0.09, 0.05, 0.0], 'coat', seg=12, outline=0.008), 'head')
    rigid(sphere('shade', (0, -0.06, 1.69), (0.085, 0.065, 0.11), 'shade', outline=0.0), 'head')
    rigid(sphere('face', (0, -0.092, 1.655), (0.06, 0.05, 0.075), 'skin', outline=0.005), 'head')
    rigid(sphere('hoodbrim', (0, -0.072, 1.725), (0.09, 0.068, 0.055), 'coat', outline=0.006), 'head')
    rigid(sphere('brow', (0, -0.112, 1.678), (0.056, 0.03, 0.016), 'shade', outline=0.0), 'head')
    rigid(sphere('nose', (0, -0.142, 1.665), (0.011, 0.016, 0.022), 'skin', seg=10, outline=0.003), 'head')
    # The smirk: a mouth line rising toward the left corner.
    rigid(box('smirk', (0.006, -0.136, 1.617), (0.04, 0.01, 0.006), 'shade', rot=(0.3, 0, 0.0), outline=0.0), 'head')
    rigid(box('smirkcorner', (0.028, -0.132, 1.622), (0.014, 0.01, 0.006), 'shade', rot=(0.3, 0.5, 0.0), outline=0.0), 'head')
    rigid(tube('neck', (0, 0, 1.42), (0, 0, 1.60), 0.05, 0.045, 'skin', outline=0.0), 'neck')
    rigid(tube('collar', (0, 0.0, 1.44), (0, -0.01, 1.58), 0.085, 0.10, 'coat', cap=False, outline=0.006), 'chest')
    rigid(tube('collarlining', (0, 0.0, 1.45), (0, -0.01, 1.575), 0.078, 0.092, 'lining', cap=False, outline=0.0), 'chest')

    # Torso: a fitted coat with lapels and two rows of silver coins down the front.
    rigid(tube('torso', (0, 0, 0.94), (0, 0, 1.47), 0.13, 0.165, 'coat', squash=0.70, seg=18), 'spine')
    for sx in (-1, 1):
        rigid(box(f'lapel{sx}', (0.07 * sx, -0.112, 1.37), (0.07, 0.02, 0.17), 'coat', rot=(0.1, 0, -0.35 * sx), outline=0.005), 'chest')
    # Thirty coins: 7 a side on the chest above the sash, 8 a side on the coat tails below it.
    for sx in (-1, 1):
        for k in range(7):
            z = 1.40 - k * 0.055
            y = -0.118 - 0.012 * math.sin(math.pi * k / 6)
            rigid(sphere(f'coin{sx}_{k}', (0.03 * sx, y, z), (0.014, 0.006, 0.014), 'silver', seg=10, outline=0.003), 'chest' if z > 1.28 else 'spine')

    # Sash: a blood-red band knotted at the left hip, one end hanging.
    rigid(torus('sash', (0, 0, 1.02), 0.14, 0.04, 'sash', scale=(1.05, 0.80, 0.9), outline=0.006), 'hips')
    rigid(sphere('sashknot', (0.10, -0.10, 1.02), (0.045, 0.035, 0.045), 'sash', seg=12, outline=0.005), 'hips')
    rigid(tube('sashend', (0.11, -0.11, 1.00), (0.15, -0.11, 0.74), 0.035, 0.05, 'sash', seg=8, squash=0.35, outline=0.005), 'hips')

    # Coat tails: split at the front and the back, reaching the knees.
    skirt = []
    for side, sx in (('R', -1), ('L', 1)):
        a0, a1 = sorted((0.06 * sx, 1.55 * sx))
        panel = robe_panel(f'tail_front.{side}', a0, a1, 0.98, 0.36, 0.14, 0.12, 0.21, 0.18, trim=0, tatter=0.0, seed=31,
                           push=0.01, mats=('coat', 'coat'))
        skirt.append((panel, f'skirt.{side}'))
        for k in range(8):
            z = 0.93 - k * 0.065
            ry = 0.12 + 0.06 * ((0.98 - z) / 0.62) ** 0.8
            skirt.append((sphere(f'tailcoin{side}_{k}', (0.035 * sx, -(ry + 0.017), z), (0.014, 0.006, 0.014), 'silver', seg=10, outline=0.003),
                          f'skirt.{side}'))
    b0, b1 = 1.55, 2 * math.pi - 1.55
    skirt.append((robe_panel('tail_back', b0, b1, 0.98, 0.30, 0.14, 0.11, 0.24, 0.20, trim=0, tatter=0.0, seed=32,
                             mats=('coat', 'coat')), 'skirt_back'))

    for side, sx in (('R', -1), ('L', 1)):
        # Arms: fitted sleeves, long black gloves with flared cuffs.
        rigid(tube(f'upperarm.{side}', (0.19 * sx, 0, 1.42), (0.215 * sx, 0, 1.13), 0.05, 0.048, 'coat'), f'upper_arm.{side}')
        rigid(tube(f'sleeve.{side}', (0.215 * sx, 0, 1.13), (0.225 * sx, -0.02, 0.98), 0.048, 0.045, 'coat'), f'forearm.{side}')
        rigid(tube(f'glovecuff.{side}', (0.222 * sx, -0.015, 1.02), (0.23 * sx, -0.03, 0.88), 0.062, 0.045, 'leather', outline=0.006), f'forearm.{side}')
        rigid(sphere(f'hand.{side}', (0.235 * sx, -0.045, 0.835), (0.035, 0.042, 0.052), 'leather', seg=12), f'hand.{side}')
        # Legs: slim dark trousers, tall boots with folded tops.
        rigid(tube(f'thigh.{side}', (0.085 * sx, 0, 0.94), (0.09 * sx, 0, 0.50), 0.065, 0.05, 'coat', outline=0.006), f'thigh.{side}')
        rigid(tube(f'boot.{side}', (0.09 * sx, 0, 0.50), (0.09 * sx, 0.01, 0.09), 0.055, 0.045, 'leather', outline=0.006), f'shin.{side}')
        rigid(tube(f'bootfold.{side}', (0.09 * sx, 0, 0.50), (0.09 * sx, 0, 0.44), 0.064, 0.062, 'leather', outline=0.005), f'shin.{side}')
        rigid(sphere(f'foot.{side}', (0.09 * sx, -0.045, 0.045), (0.05, 0.11, 0.045), 'leather', seg=14), f'foot.{side}')

    # The silver revolver: a long engraved barrel, a fluted cylinder, a dark grip, a red gem.
    h, d = HAND_R, GUN_DIR
    rigid(tube('rgrip', h - d * 0.07 + Vector((0, 0.02, 0)), h + d * 0.02, 0.018, 0.02, 'grip', seg=8, squash=0.7, outline=0.004), 'hand.R')
    rigid(tube('frame', h + d * 0.02, h + d * 0.10, 0.026, 0.026, 'silver', seg=8, squash=0.6, outline=0.004), 'hand.R')
    rigid(tube('cylinder', h + d * 0.06, h + d * 0.12, 0.03, 0.03, 'silver', seg=6, outline=0.004), 'hand.R')
    rigid(tube('rbarrel', h + d * 0.11, h + d * 0.36, 0.014, 0.013, 'silver', seg=8, outline=0.004), 'hand.R')
    rigid(tube('rib', h + d * 0.11 + Vector((0, 0.012, 0)), h + d * 0.36 + Vector((0, 0.012, 0)), 0.008, 0.008, 'silver', seg=6, outline=0.0), 'hand.R')
    rigid(sphere('gem', h + d * 0.035 + Vector((0, 0.025, 0)), (0.009,) * 3, 'gem', seg=8, outline=0.002), 'hand.R')

    for obj, bone in parts:
        bind_rigid(obj, arm, bone)
    for obj, bone in skirt:
        if obj.name.startswith('tailcoin'):
            bind_rigid(obj, arm, bone)
        else:
            bind_skirt(obj, arm, bone, z_top=0.98, z_free=0.82)
    return arm


# ---------------------------------------------------------------- animations

def guard():
    """The standing pose: loose and easy, the revolver hanging at the right side."""
    return {
        'spine': (2, 0, 0), 'chest': (0, 0, 0), 'head': (2, 0, 0),
        'upper_arm.L': (-2, 0, 5), 'forearm.L': (-12, 0, 0),
        'upper_arm.R': (-3, 0, -3), 'forearm.R': (-8, 0, 0), 'hand.R': (6, 0, 0),
        'thigh.L': (-1, -2, 0), 'thigh.R': (-1, 2, 0), 'shin.L': (2, 0, 0), 'shin.R': (2, 0, 0),
    }


def pose_idle(t):
    return Pose(guard())


def pose_walk(t):
    """A quick, light stride; t in [0, 1) is one full cycle of two steps. t = 0: legs passing."""
    p = 2 * math.pi * t
    s = math.sin(p)
    a = 28
    r = guard()
    add(r, 'spine', dx=5, dz=7 * s)
    add(r, 'hips', dz=-7 * s)
    thigh_l, thigh_r = -a * s, a * s
    bend_l = 6 + 45 * max(0.0, math.cos(p + math.pi / 4)) ** 2
    bend_r = 6 + 45 * max(0.0, -math.cos(p + math.pi / 4)) ** 2
    r['thigh.L'] = (thigh_l, -2, 0)
    r['thigh.R'] = (thigh_r, 2, 0)
    r['shin.L'] = (bend_l, 0, 0)
    r['shin.R'] = (bend_r, 0, 0)
    r['foot.L'] = (-0.6 * (thigh_l + bend_l), 0, 0)
    r['foot.R'] = (-0.6 * (thigh_r + bend_r), 0, 0)
    add(r, 'upper_arm.L', dx=22 * s)
    add(r, 'forearm.L', dx=-12 * max(0.0, -s))
    add(r, 'upper_arm.R', dx=-12 * s)
    # The split tails follow their legs; the back flaps behind.
    r['skirt.L'] = (0.85 * thigh_l, 0, 0)
    r['skirt.R'] = (0.85 * thigh_r, 0, 0)
    r['skirt_back'] = (0.5 * a * abs(s), 0, 0)
    return Pose(r)


# name: (frames, pose function, looping)
ANIMS = {
    'idle': (1, pose_idle, True),
    'walk': (8, pose_walk, True),
}

# 120 px/m (§11.2); the canvas leaves room for the stride.
SPEC = Spec(build_model, ANIMS, px_per_m=120, canvas=(-1.0, 1.0, -0.3, 2.1))

if __name__ == '__main__':
    main(SPEC, __doc__)
