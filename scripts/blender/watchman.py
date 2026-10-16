"""
The Watchman (rogue rooms.md §6.4): the Blessed's body and rig with a gold brimmed helmet, a short
sky-blue plume and the Clarion, a long ivory gun with gold rings and a trumpet bell, instead of the sword.

Run with Blender 5.2 (headless):
  blender -b --factory-startup -P scripts/blender/watchman.py -- sprites assets/sprites/watchman
References: assets/art-src/reference/watchman-{design,clarion,aim}.png.

Animations (client/enemyAnim.ts): idle and walk carry the Clarion upright, stock at the hip, the bell
above the helmet; `cast` raises it level over the 1 s aim (frames 1–4) and fires (frames 5–6);
`reload` lowers it again; pain and death are the Blessed's.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import blessed as base  # noqa: E402
from common import PAL, Pose, Spec, add, add_ik, bind_rigid, box, keys, lerp, main, sphere, torus, tube  # noqa: E402

PAL.update({'brass': (0.62, 0.45, 0.16), 'plume': (0.62, 0.78, 0.90)})

# The Clarion's grip, where the right hand holds it at rest: beside the right hip.
GRIP = Vector((-0.27, -0.07, 0.80))
UP = Vector((0, 0, 1))
STOCK = 0.24       # butt below the grip
BARREL = 1.08      # grip to the bell's throat
BELL = 0.30        # the flare; the bell's mouth ends 2.18 m up at rest, above the plume
FORE_GRIP = 0.16   # the left hand under the barrel when aiming
base.BONES['clarion'] = (tuple(GRIP), tuple(GRIP + UP * 0.2), 'chest')
base.BONES['grip.R'] = (tuple(GRIP + UP * 0.02), tuple(GRIP + UP * 0.07), 'clarion')
base.BONES['grip.L'] = (tuple(GRIP + UP * FORE_GRIP), tuple(GRIP + UP * (FORE_GRIP + 0.05)), 'clarion')
SWORD = ('grip', 'pommel', 'guard', 'blade')


def build_model():
    arm = base.build_model()
    for name in SWORD:
        bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)

    def rigid(obj, bone):
        bind_rigid(obj, arm, bone)
        return obj

    # Helmet: a gold dome with a wide flat brim and cheek guards, a knob and a short blue plume.
    rigid(sphere('helmet', (0, -0.005, 1.565), (0.106, 0.116, 0.088), 'gold'), 'head')
    rigid(tube('brim', (0, -0.01, 1.548), (0, -0.01, 1.560), 0.172, 0.168, 'gold', seg=28, outline=0.005), 'head')
    for sx in (-1, 1):
        rigid(box(f'cheek{sx}', (0.086 * sx, -0.03, 1.495), (0.016, 0.08, 0.10), 'gold', rot=(0, 0.12 * sx, 0), outline=0.004), 'head')
    rigid(sphere('knob', (0, 0.0, 1.655), (0.022, 0.022, 0.02), 'gold', seg=10, outline=0.004), 'head')
    rigid(sphere('plume', (0, 0.025, 1.725), (0.026, 0.05, 0.075), 'plume', rot=(-0.45, 0, 0), seg=12, outline=0.005), 'head')
    rigid(sphere('plume2', (0, 0.07, 1.70), (0.02, 0.05, 0.05), 'plume', rot=(-1.0, 0, 0), seg=10, outline=0.004), 'head')

    # The Clarion, along the bone at rest (upright): stock, lock, banded barrel, flared bell.
    g = GRIP
    rigid(tube('stock', g - UP * STOCK, g + UP * 0.03, 0.05, 0.03, 'ivory', squash=0.55, seg=12, outline=0.006), 'clarion')
    rigid(box('buttplate', g - UP * (STOCK + 0.005), (0.07, 0.04, 0.02), 'gold', outline=0.004), 'clarion')
    rigid(box('lock', g + Vector((-0.032, 0, 0.0)), (0.016, 0.03, 0.08), 'gold', outline=0.004), 'clarion')
    rigid(tube('barrel', g + UP * 0.02, g + UP * BARREL, 0.024, 0.02, 'ivory', seg=12, outline=0.006), 'clarion')
    for z in (0.08, 0.36, 0.64, 0.92):
        rigid(torus('band', g + UP * z, 0.026, 0.008, 'gold', seg=16, outline=0.004), 'clarion')
    rigid(tube('bell', g + UP * (BARREL - 0.04), g + UP * (BARREL + BELL), 0.026, 0.105, 'gold', seg=20, cap=False, outline=0.006), 'clarion')
    rigid(sphere('mouth', g + UP * (BARREL + BELL - 0.01), (0.092, 0.092, 0.012), 'brass', seg=18, outline=0.0), 'clarion')
    rigid(sphere('bead', g + Vector((0, -0.03, BARREL - 0.08)), (0.008, 0.008, 0.012), 'gold', seg=8, outline=0.003), 'clarion')

    add_ik(arm, 'forearm.R', 'grip.R')
    add_ik(arm, 'forearm.L', 'grip.L')
    return arm


def after_pose(pose):
    base.after_pose(pose)
    # The left hand holds the barrel only while the Clarion is raised.
    arm = bpy.data.objects['rig']
    arm.pose.bones['forearm.L'].constraints['IK'].influence = pose.extra.get('left', 0.0)


# ---------------------------------------------------------------- poses

def carry(r):
    """The Clarion upright beside the body, stock at the hip (the chest's lean undone)."""
    lean = r.get('spine', (0, 0, 0))[0] + r.get('chest', (0, 0, 0))[0]
    r['clarion'] = (-lean, 0, 0)
    return r


def aimed(r, k, recoil=0.0):
    """Raises the Clarion by k (0 carried, 1 levelled at the shoulder), with the aiming stance."""
    lean = r.get('spine', (0, 0, 0))[0] + r.get('chest', (0, 0, 0))[0]
    add(r, 'spine', dz=-14 * k, dx=-4 * recoil)
    add(r, 'chest', dz=-8 * k)
    add(r, 'head', dx=8 * k, dz=14 * k)
    # Levelled: tipped forward 90° in the world, butt at the right shoulder, the barrel straight ahead.
    r['clarion'] = (lerp(-lean, 90 - lean, k) - 8 * recoil, 0, 18 * k)
    for side, sx in (('L', 1), ('R', -1)):
        add(r, f'thigh.{side}', dx=-10 * k * (1 if side == 'L' else -0.6), dy=7 * k * sx)
        add(r, f'shin.{side}', dx=10 * k)
    locs = {'clarion': (0.19 * k, -0.19 * k + 0.06 * recoil, 0.50 * k)}
    return r, locs


def pose_idle(t):
    return Pose(carry(base.guard()))


def pose_walk(t):
    p = base.pose_walk(t)
    carry(p.rots)
    return p


def pose_cast(t):
    """Six frames: t 0–0.6 raise and hold the aim (frames 1–4), 0.8–1 fire and recoil (frames 5–6)."""
    k = keys([(0, 0.25), (0.6, 1.0), (1, 1.0)], t)
    recoil = keys([(0, 0), (0.6, 0), (0.8, 1.0), (1, 0.45)], t)
    r, locs = aimed(base.guard(), k, recoil)
    return Pose(r, locs=locs, left=min(1.0, k * 1.6))


def pose_reload(t):
    """Lowers the Clarion back to the carry over the reload; t from 0 to 1."""
    k = keys([(0, 1.0), (1, 0.0)], t)
    r, locs = aimed(base.guard(), k)
    return Pose(r, locs=locs, left=max(0.0, k * 1.6 - 0.6))


def pose_pain(t):
    p = base.pose_pain(t)
    carry(p.rots)
    return p


def pose_death(t):
    p = base.pose_death(t)
    carry(p.rots)
    return p


# name: (frames, pose function, looping)
ANIMS = {
    'idle': (1, pose_idle, True),
    'walk': (8, pose_walk, True),
    'cast': (6, pose_cast, False),
    'reload': (4, pose_reload, False),
    'pain': (3, pose_pain, False),
    'death': (8, pose_death, False),
}

# The Blessed's scale; the canvas leaves room for the bell above the helmet and the levelled Clarion.
SPEC = Spec(build_model, ANIMS, px_per_m=150, canvas=(-2.2, 2.2, -0.4, 2.6), after_pose=after_pose)

if __name__ == '__main__':
    main(SPEC, __doc__)
