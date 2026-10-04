"""
Builds the Heretic Saint in Blender from primitives, rigs and animates it, and renders sprite
frames. The look follows assets/art-src/reference/heretic-front.png and heretic-turnaround.png.
Shared code and the commands are in common.py.

Run with Blender 5.2 (headless):
  blender -b --factory-startup -P scripts/blender/heretic.py -- <command> [args]
"""
import math
import os
import sys

from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (EMISSIVE, PAL, Pose, Spec, add, bind_rigid, bind_skirt, box, build_armature,  # noqa: E402
                    cracked, face_camera, main, robe_panel, sphere, torus, tube)

# ---------------------------------------------------------------- palette

PAL.update({
    'robe': (0.27, 0.23, 0.21),     # soot-black wool
    'trim': (0.70, 0.20, 0.10),     # ember-red trim
    'skin': (0.60, 0.60, 0.58),     # ash-grey
    'shade': (0.17, 0.15, 0.14),    # the dark inside of the hood
    'rope': (0.56, 0.45, 0.31),
    'bead': (0.20, 0.17, 0.16),
    'leather': (0.27, 0.21, 0.17),
    'bronze': (0.50, 0.34, 0.20),   # blackened bronze
    'gold': (0.78, 0.58, 0.30),     # the embroidered sigils
    'iron': (0.32, 0.29, 0.28),
    'molten': (1.0, 0.52, 0.12),
    'coal': (1.0, 0.62, 0.20),
})
EMISSIVE.update({'molten', 'coal'})

# ---------------------------------------------------------------- armature

# name: (head, tail, parent)
BONES = {
    'root': ((0, 0, 0), (0, 0.15, 0), None),
    'hips': ((0, 0, 0.98), (0, 0, 1.06), 'root'),
    'spine': ((0, 0, 1.06), (0, 0, 1.28), 'hips'),
    'chest': ((0, 0, 1.28), (0, 0, 1.50), 'spine'),
    'neck': ((0, 0, 1.50), (0, 0, 1.60), 'chest'),
    'head': ((0, 0, 1.60), (0, 0, 1.84), 'neck'),
    'skirt_front': ((0, -0.13, 0.98), (0, -0.17, 0.30), 'hips'),
    'skirt_back': ((0, 0.12, 0.98), (0, 0.17, 0.20), 'hips'),
}
for side, sx in (('R', -1), ('L', 1)):
    BONES.update({
        f'shoulder.{side}': ((0.03 * sx, 0, 1.46), (0.17 * sx, 0, 1.46), 'chest'),
        f'upper_arm.{side}': ((0.19 * sx, 0, 1.44), (0.22 * sx, 0, 1.14), f'shoulder.{side}'),
        f'forearm.{side}': ((0.22 * sx, 0, 1.14), (0.235 * sx, -0.03, 0.88), f'upper_arm.{side}'),
        f'hand.{side}': ((0.235 * sx, -0.03, 0.88), (0.24 * sx, -0.04, 0.80), f'forearm.{side}'),
        f'thigh.{side}': ((0.09 * sx, 0, 0.94), (0.095 * sx, 0, 0.52), 'hips'),
        f'shin.{side}': ((0.095 * sx, 0, 0.52), (0.095 * sx, 0.01, 0.09), f'thigh.{side}'),
        f'foot.{side}': ((0.095 * sx, 0.01, 0.09), (0.095 * sx, -0.12, 0.03), f'shin.{side}'),
        f'skirt.{side}': ((0.15 * sx, 0, 0.98), (0.25 * sx, 0, 0.25), 'hips'),
    })

# The censer launcher is held in the right hand, its muzzle (the censer) down and a little forward.
HAND_R = Vector((-0.24, -0.04, 0.82))
LAUNCH_DIR = Vector((0.0, -0.18, -1.0)).normalized()


# ---------------------------------------------------------------- the model

def build_model():
    arm = build_armature(BONES)
    parts = []  # (object, bone)

    def rigid(obj, bone):
        parts.append((obj, bone))
        return obj

    # Head: a deep hood over a gaunt ash-grey face, the eyes lost in its shadow.
    rigid(sphere('hood', (0, 0.01, 1.73), (0.13, 0.15, 0.165), 'robe', outline=0.009), 'head')
    rigid(sphere('hoodpeak', (0, 0.04, 1.83), (0.07, 0.08, 0.06), 'robe', outline=0.0), 'head')
    rigid(sphere('shade', (0, -0.06, 1.715), (0.09, 0.065, 0.115), 'shade', outline=0.0), 'head')
    rigid(sphere('face', (0, -0.108, 1.675), (0.062, 0.05, 0.085), 'skin', outline=0.005), 'head')
    rigid(sphere('brow', (0, -0.128, 1.728), (0.058, 0.035, 0.022), 'shade', outline=0.0), 'head')
    rigid(sphere('nose', (0, -0.155, 1.69), (0.012, 0.018, 0.028), 'skin', seg=10, outline=0.003), 'head')
    rigid(torus('hoodrim', (0, -0.118, 1.70), 0.09, 0.02, 'robe', rot=(math.pi / 2, 0, 0), scale=(0.95, 1.4, 1), outline=0.005), 'head')
    for sx in (-1, 1):
        rigid(sphere(f'socket{sx}', (0.026 * sx, -0.148, 1.70), (0.02, 0.012, 0.012), 'shade', seg=10, outline=0.0), 'head')
        rigid(sphere(f'cheek{sx}', (0.035 * sx, -0.135, 1.655), (0.015, 0.012, 0.026), 'shade', seg=10, outline=0.0), 'head')
    rigid(box('mouth', (0, -0.152, 1.628), (0.036, 0.01, 0.006), 'shade', rot=(0.25, 0, 0), outline=0.0), 'head')
    rigid(tube('neck', (0, 0, 1.44), (0, 0, 1.62), 0.07, 0.065, 'robe', outline=0.0), 'neck')

    # The cracked iron halo above the hood.
    halo = torus('halo', (0, 0, 0), 0.17, 0.026, cracked('iron', 'molten', scale=9.0, width=0.06, coverage=0.75),
                 rot=(math.pi / 2, 0, 0), seg=40, outline=0.007)

    # Torso and a tattered short mantle over the shoulders: dark wool over a red edge.
    rigid(tube('torso', (0, 0, 0.96), (0, 0, 1.50), 0.13, 0.165, 'robe', squash=0.72, seg=18), 'spine')
    rigid(robe_panel('mantle_edge', -math.pi + 0.01, math.pi - 0.01, 1.47, 1.20, 0.10, 0.09, 0.24, 0.18,
                     trim=0, tatter=0.05, seed=11, mats=('trim', 'trim'), thickness=0.01, outline=0.006), 'chest')
    rigid(robe_panel('mantle', -math.pi + 0.01, math.pi - 0.01, 1.49, 1.25, 0.10, 0.09, 0.245, 0.185,
                     trim=0, tatter=0.06, seed=12, push=0.008, mats=('robe', 'robe'), thickness=0.01, outline=0.007), 'chest')
    # The stole: a dark band edged in red down the chest, with gold sigils.
    rigid(robe_panel('stole', -0.42, 0.42, 1.44, 0.98, 0.135, 0.11, 0.155, 0.125, trim=0.25, push=0.012,
                     mats=('robe', 'trim'), outline=0.005), 'chest')
    for k, z in enumerate((1.36, 1.22, 1.10)):
        rigid(box(f'sigil{k}', (0, -0.142, z), (0.05, 0.01, 0.06 if k else 0.08), 'gold', outline=0.0), 'chest')

    # Rope belt with a knot, two hanging cords and a loop of charred prayer beads on the left.
    rigid(torus('belt', (0, 0, 0.99), 0.145, 0.022, 'rope', scale=(1.05, 0.82, 1.0), outline=0.005), 'hips')
    rigid(sphere('knot', (0, -0.125, 0.985), (0.035, 0.03, 0.035), 'rope', seg=12, outline=0.004), 'hips')
    for sx in (-1, 1):
        rigid(tube(f'cord{sx}', (0.012 * sx, -0.13, 0.97), (0.03 * sx, -0.15, 0.70), 0.011, 0.011, 'rope', seg=8, outline=0.004), 'hips')
        rigid(sphere(f'tassel{sx}', (0.03 * sx, -0.15, 0.68), (0.02, 0.02, 0.035), 'rope', seg=10, outline=0.004), 'hips')
    for k in range(13):
        t = k / 12
        a = math.pi * t
        p = Vector((0.065 + 0.075 * t, -0.172 + 0.012 * t, 0.97 - 0.20 * math.sin(a)))
        rigid(sphere(f'bead{k}', p, (0.017,) * 3, 'bead', seg=8, outline=0.003), 'hips')

    # Robe skirt: four floor-length panels, ragged at the hem, so the legs can stride between them.
    skirt = [
        (robe_panel('skirt_front', -0.42, 0.42, 0.98, 0.06, 0.15, 0.125, 0.19, 0.17, trim=0.25, tatter=0.06, seed=1,
                    push=0.012, mats=('robe', 'trim')), 'skirt_front'),
        (robe_panel('skirt_back', 1.75, 2 * math.pi - 1.75, 0.98, 0.03, 0.15, 0.12, 0.23, 0.20, trim=0.08, tatter=0.08, seed=2,
                    mats=('robe', 'trim')), 'skirt_back'),
        (robe_panel('skirt_L', 0.40, 1.95, 0.98, 0.05, 0.15, 0.12, 0.24, 0.20, trim=0.0, tatter=0.09, seed=3,
                    mats=('robe', 'robe')), 'skirt.L'),
        (robe_panel('skirt_R', -1.95, -0.40, 0.98, 0.05, 0.15, 0.12, 0.24, 0.20, trim=0.0, tatter=0.09, seed=4,
                    mats=('robe', 'robe')), 'skirt.R'),
    ]
    for k, z in enumerate((0.62, 0.40)):
        skirt.append((box(f'hemsigil{k}', (0, -0.17 - 0.025 * k, z), (0.07, 0.01, 0.09), 'gold', outline=0.0), 'skirt_front'))

    for side, sx in (('R', -1), ('L', 1)):
        # Sleeves: upper arm, then a wide ragged sleeve with a red cuff; gaunt grey hands.
        rigid(tube(f'upperarm.{side}', (0.19 * sx, 0, 1.44), (0.22 * sx, 0, 1.14), 0.052, 0.055, 'robe'), f'upper_arm.{side}')
        rigid(tube(f'sleeve.{side}', (0.22 * sx, 0, 1.16), (0.235 * sx, -0.03, 0.91), 0.055, 0.095, 'robe', cap=False), f'forearm.{side}')
        rigid(torus(f'cuff.{side}', (0.235 * sx, -0.03, 0.915), 0.088, 0.016, 'trim', rot=(-0.12, 0.06 * sx, 0), outline=0.005), f'forearm.{side}')
        rigid(sphere(f'hand.{side}', (0.24 * sx, -0.04, 0.84), (0.036, 0.042, 0.055), 'skin', seg=12), f'hand.{side}')
        # Worn boots under the hem.
        rigid(sphere(f'boot.{side}', (0.095 * sx, -0.045, 0.045), (0.052, 0.10, 0.048), 'leather', seg=14), f'foot.{side}')
        rigid(tube(f'thighwrap.{side}', (0.09 * sx, 0, 0.94), (0.095 * sx, 0, 0.50), 0.06, 0.05, 'robe', outline=0.005), f'thigh.{side}')
        rigid(tube(f'shinwrap.{side}', (0.095 * sx, 0, 0.54), (0.095 * sx, 0.01, 0.08), 0.05, 0.042, 'robe', outline=0.005), f'shin.{side}')

    # The censer launcher, a pistol-gripped hand cannon as in weapon-censer-sheet.png, pointing down
    # at the right side: a tapered bronze barrel bound in chain, a flared bell, the censer of
    # glowing coals bulging from its muzzle, and the grip in the fist.
    h, d = HAND_R, LAUNCH_DIR
    fwd = Vector((0, -1, 0))
    u = (fwd - d * fwd.dot(d)).normalized()   # across the barrel, toward the front
    b = h + u * 0.065                           # the barrel's axis passes in front of the fist
    rot = d.to_track_quat('Z', 'Y').to_euler()
    rigid(tube('lgrip', h - u * 0.035 - d * 0.03, h + u * 0.045 + d * 0.01, 0.024, 0.028, 'gold', seg=8, squash=0.7, outline=0.004), 'hand.R')
    rigid(tube('lbody', b - d * 0.06, b + d * 0.17, 0.036, 0.052, 'bronze', seg=14, outline=0.006), 'hand.R')
    for k, t in enumerate((0.0, 0.11)):
        rigid(torus(f'lchain{k}', b + d * t, 0.055, 0.012, 'iron', rot=rot, seg=16, outline=0.003), 'hand.R')
    rigid(box('lplate', b + d * 0.06 + u * 0.05, (0.04, 0.01, 0.10), 'gold', rot=rot, outline=0.003), 'hand.R')
    rigid(tube('lbell', b + d * 0.17, b + d * 0.21, 0.052, 0.062, 'bronze', seg=14, cap=False, outline=0.005), 'hand.R')
    rigid(sphere('censer', b + d * 0.27, (0.075, 0.075, 0.075),
                 cracked('bronze', 'coal', scale=16.0, width=0.10, coverage=0.7), seg=16, outline=0.006), 'hand.R')
    rigid(sphere('finial', b + d * 0.35, (0.02, 0.02, 0.02), 'bronze', seg=10, outline=0.004), 'hand.R')

    for obj, bone in parts:
        bind_rigid(obj, arm, bone)
    for obj, bone in skirt:
        if obj.name.startswith('hemsigil'):
            bind_rigid(obj, arm, bone)
        else:
            bind_skirt(obj, arm, bone)
    face_camera(halo, arm, 'head', (0, 0, 1.86), (0, 0.08, 0))
    return arm


# ---------------------------------------------------------------- animations

def guard():
    """The standing pose: upright and still, the launcher hanging at the right side."""
    return {
        'spine': (2, 0, 0), 'neck': (4, 0, 0), 'head': (4, 0, 0),
        'upper_arm.L': (-3, 0, 4), 'forearm.L': (-8, 0, 0),
        'upper_arm.R': (-4, 0, 0), 'forearm.R': (-6, 0, 0), 'hand.R': (8, 0, 0),
        'shin.L': (2, 0, 0), 'shin.R': (2, 0, 0), 'thigh.L': (-1, 0, 0), 'thigh.R': (-1, 0, 0),
    }


def pose_idle(t):
    return Pose(guard())


def pose_walk(t):
    """A long, gliding stride; t in [0, 1) is one full cycle of two steps. t = 0: legs passing."""
    p = 2 * math.pi * t
    s = math.sin(p)
    a = 22
    r = guard()
    add(r, 'spine', dx=4, dz=5 * s)
    add(r, 'hips', dz=-5 * s)
    thigh_l, thigh_r = -a * s, a * s
    bend_l = 6 + 30 * max(0.0, math.cos(p + math.pi / 4)) ** 2
    bend_r = 6 + 30 * max(0.0, -math.cos(p + math.pi / 4)) ** 2
    r['thigh.L'] = (thigh_l, 0, 0)
    r['thigh.R'] = (thigh_r, 0, 0)
    r['shin.L'] = (bend_l, 0, 0)
    r['shin.R'] = (bend_r, 0, 0)
    r['foot.L'] = (-0.6 * (thigh_l + bend_l), 0, 0)
    r['foot.R'] = (-0.6 * (thigh_r + bend_r), 0, 0)
    # The free left arm swings against the legs; the right only a little, weighed down.
    add(r, 'upper_arm.L', dx=18 * s)
    add(r, 'forearm.L', dx=-10 * max(0.0, -s))
    add(r, 'upper_arm.R', dx=-7 * s)
    r['skirt_front'] = (-0.6 * a * abs(s), 0, 0)
    r['skirt_back'] = (0.4 * a * abs(s), 0, 0)
    r['skirt.L'] = (0.85 * thigh_l, 0, 0)
    r['skirt.R'] = (0.85 * thigh_r, 0, 0)
    return Pose(r)


# name: (frames, pose function, looping)
ANIMS = {
    'idle': (1, pose_idle, True),
    'walk': (8, pose_walk, True),
}

# 120 px/m (§11.2); the canvas leaves room for the halo and the stride.
SPEC = Spec(build_model, ANIMS, px_per_m=120, canvas=(-1.0, 1.0, -0.3, 2.3))

if __name__ == '__main__':
    main(SPEC, __doc__)
