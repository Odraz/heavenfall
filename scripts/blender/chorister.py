"""
Builds the Chorister in Blender from primitives, rigs and animates it, and renders sprite frames.
The look follows assets/art-src/reference/chorister-front.jpg and chorister-turnaround.png.
Shared code and the commands are in common.py.

Run with Blender 5.2 (headless):
  blender -b --factory-startup -P scripts/blender/chorister.py -- <command> [args]
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (EMISSIVE, PAL, Pose, Spec, add, add_ik, bind_rigid, bind_skirt, box, build_armature,  # noqa: E402
                    keys, main, robe_panel, smooth, sphere, torus, tube)

# ---------------------------------------------------------------- palette

PAL.update({
    'silk': (0.97, 0.95, 0.89),     # brilliant white silk
    'gold': (0.90, 0.72, 0.30),
    'skin': (0.93, 0.84, 0.76),
    'hair': (0.90, 0.77, 0.45),
    'mouth': (0.38, 0.16, 0.13),
    'eye': (0.30, 0.32, 0.40),
    'orb': (1.0, 0.96, 0.76),
})
EMISSIVE.add('orb')

# ---------------------------------------------------------------- armature

ORB = Vector((0, -0.25, 1.43))  # held before the chest
# name: (head, tail, parent)
BONES = {
    'root': ((0, 0, 0), (0, 0.15, 0), None),
    # Points straight down, for parts that hang (see the sleeves).
    'down': ((0, 0, 0.3), (0, 0, 0.0), 'root'),
    'hips': ((0, 0, 1.15), (0, 0, 1.25), 'root'),
    'spine': ((0, 0, 1.25), (0, 0, 1.48), 'hips'),
    'chest': ((0, 0, 1.48), (0, 0, 1.70), 'spine'),
    'neck': ((0, 0, 1.70), (0, 0, 1.79), 'chest'),
    'head': ((0, 0, 1.79), (0, 0, 2.00), 'neck'),
    'skirt_front': ((0, -0.14, 1.15), (0, -0.19, 0.40), 'hips'),
    'skirt_back': ((0, 0.13, 1.15), (0, 0.19, 0.30), 'hips'),
    'orb': (tuple(ORB), tuple(ORB + Vector((0, 0, 0.1))), 'chest'),
    'orbcore': (tuple(ORB), tuple(ORB + Vector((0, 0, 0.05))), 'orb'),
    # The right hand cups the orb from below, the left steadies it from the side.
    'grip.R': (tuple(ORB + Vector((-0.04, 0.02, -0.09))), tuple(ORB + Vector((-0.04, 0.02, -0.04))), 'orb'),
    'grip.L': (tuple(ORB + Vector((0.095, 0.03, 0.01))), tuple(ORB + Vector((0.095, 0.03, 0.06))), 'orb'),
}
ELBOW = {'R': Vector((-0.24, 0.02, 1.37)), 'L': Vector((0.24, 0.03, 1.38))}
for side, sx in (('R', -1), ('L', 1)):
    hand = Vector(BONES[f'grip.{side}'][0])
    wrist = ELBOW[side] + (hand - ELBOW[side]).normalized() * 0.27
    BONES.update({
        f'shoulder.{side}': ((0.03 * sx, 0, 1.66), (0.17 * sx, 0, 1.66), 'chest'),
        f'upper_arm.{side}': ((0.19 * sx, 0.0, 1.64), tuple(ELBOW[side]), f'shoulder.{side}'),
        f'forearm.{side}': (tuple(ELBOW[side]), tuple(wrist), f'upper_arm.{side}'),
        f'thigh.{side}': ((0.10 * sx, 0, 1.10), (0.105 * sx, 0, 0.60), 'hips'),
        f'shin.{side}': ((0.105 * sx, 0, 0.60), (0.105 * sx, 0.01, 0.10), f'thigh.{side}'),
        f'foot.{side}': ((0.105 * sx, 0.01, 0.10), (0.105 * sx, -0.13, 0.03), f'shin.{side}'),
        f'skirt.{side}': ((0.18 * sx, 0, 1.15), (0.27 * sx, 0, 0.35), 'hips'),
        # Follows the elbow but always hangs straight down (see build_model).
        f'sleeve.{side}': (tuple(ELBOW[side]), tuple(ELBOW[side] + Vector((0, 0, -0.3))), f'upper_arm.{side}'),
    })


# ---------------------------------------------------------------- the model

def build_model():
    arm = build_armature(BONES)
    parts = []  # (object, bone)

    def rigid(obj, bone):
        parts.append((obj, bone))
        return obj

    # Head: a long pale face with swept-back blond hair, eyes half closed, mouth open in song.
    rigid(sphere('head', (0, -0.005, 1.885), (0.082, 0.095, 0.112), 'skin', outline=0.008), 'head')
    rigid(sphere('jaw', (0, -0.035, 1.83), (0.06, 0.065, 0.06), 'skin', outline=0.0), 'head')
    rigid(sphere('hair', (0, 0.025, 1.925), (0.088, 0.095, 0.085), 'hair', outline=0.007), 'head')
    rigid(sphere('hairfront', (0, -0.04, 1.965), (0.07, 0.06, 0.035), 'hair', outline=0.005), 'head')
    rigid(sphere('nose', (0, -0.1, 1.885), (0.013, 0.02, 0.028), 'skin', seg=10, outline=0.004), 'head')
    for sx in (-1, 1):
        rigid(box(f'eye{sx}', (0.032 * sx, -0.088, 1.905), (0.026, 0.01, 0.008), 'eye', outline=0.0), 'head')
        rigid(sphere(f'ear{sx}', (0.082 * sx, 0.0, 1.88), (0.013, 0.022, 0.03), 'skin', seg=10, outline=0.004), 'head')
    rigid(sphere('mouth', (0, -0.088, 1.835), (0.018, 0.012, 0.022), 'mouth', seg=12, outline=0.003), 'head')
    rigid(tube('neck', (0, 0, 1.66), (0, 0, 1.82), 0.042, 0.04, 'skin', outline=0.0), 'neck')

    # The high stiff collar: a flared band, open at the front, lined in gold.
    rigid(robe_panel('collar', 0.75, 2 * math.pi - 0.75, 1.85, 1.66, 0.13, 0.125, 0.075, 0.07, trim=0.12,
                     mats=('silk', 'gold'), thickness=0.014, outline=0.006), 'chest')
    rigid(robe_panel('collarlining', 0.80, 2 * math.pi - 0.80, 1.84, 1.67, 0.122, 0.117, 0.07, 0.065, trim=0,
                     mats=('gold', 'gold'), thickness=0.004, outline=0.0), 'chest')

    # Torso and a short gold-edged mantle; a gold V on the chest.
    rigid(tube('torso', (0, 0, 1.12), (0, 0, 1.70), 0.145, 0.16, 'silk', squash=0.70, seg=18), 'spine')
    rigid(robe_panel('mantle', -math.pi + 0.01, math.pi - 0.01, 1.70, 1.53, 0.11, 0.10, 0.23, 0.17, trim=0,
                     mats=('silk', 'silk'), thickness=0.01, outline=0.007), 'chest')
    rigid(robe_panel('mantleband', -math.pi + 0.01, math.pi - 0.01, 1.555, 1.525, 0.215, 0.16, 0.232, 0.172, trim=0,
                     mats=('gold', 'gold'), push=0.004, thickness=0.01, outline=0.005), 'chest')
    for sx in (-1, 1):
        rigid(box(f'vband{sx}', (0.045 * sx, -0.118, 1.52), (0.03, 0.012, 0.22), 'gold', rot=(0.05, 0, 0.32 * sx), outline=0.004), 'chest')

    # Robe skirt: four floor-length panels, gold bands down the front opening.
    skirt = [
        (robe_panel('skirt_front', -0.45, 0.45, 1.15, 0.02, 0.155, 0.13, 0.25, 0.21, trim=0.2, push=0.012,
                    mats=('silk', 'gold')), 'skirt_front'),
        (robe_panel('skirt_back', 1.70, 2 * math.pi - 1.70, 1.15, 0.0, 0.15, 0.12, 0.31, 0.26, trim=0.06,
                    mats=('silk', 'gold')), 'skirt_back'),
        (robe_panel('skirt_L', 0.42, 1.95, 1.15, 0.01, 0.15, 0.12, 0.32, 0.26, trim=0.06,
                    mats=('silk', 'gold')), 'skirt.L'),
        (robe_panel('skirt_R', -1.95, -0.42, 1.15, 0.01, 0.15, 0.12, 0.32, 0.26, trim=0.06,
                    mats=('silk', 'gold')), 'skirt.R'),
    ]
    rigid(torus('sash', (0, 0, 1.15), 0.15, 0.022, 'gold', scale=(1.05, 0.82, 1.0), outline=0.005), 'hips')

    for side, sx in (('R', -1), ('L', 1)):
        e = ELBOW[side]
        hand = Vector(BONES[f'grip.{side}'][0])
        fdir = (hand - e).normalized()
        # Arms: a slim upper sleeve, then a long hanging sleeve lined in gold, falling to the knees.
        rigid(tube(f'upperarm.{side}', (0.19 * sx, 0, 1.64), e, 0.05, 0.055, 'silk'), f'upper_arm.{side}')
        rigid(tube(f'hangsleeve.{side}', e + Vector((0.01 * sx, 0.0, 0.04)), e + Vector((0.04 * sx, 0.03, -0.52)), 0.065, 0.12, 'silk', cap=False, squash=0.7), f'sleeve.{side}')
        rigid(tube(f'hanglining.{side}', e + Vector((0.01 * sx, 0.0, 0.0)), e + Vector((0.04 * sx, 0.03, -0.515)), 0.06, 0.112, 'gold', cap=False, squash=0.7, outline=0.0), f'sleeve.{side}')
        rigid(tube(f'forearm.{side}', e, hand - fdir * 0.04, 0.045, 0.04, 'silk', outline=0.006), f'forearm.{side}')
        rigid(torus(f'cuff.{side}', hand - fdir * 0.05, 0.045, 0.012, 'gold', rot=fdir.to_track_quat('Z', 'Y').to_euler(), seg=16, outline=0.004), f'forearm.{side}')
        rigid(sphere(f'hand.{side}', hand, (0.034, 0.04, 0.05), 'skin', seg=12, outline=0.006), f'grip.{side}')
        # Slippers under the hem.
        rigid(sphere(f'shoe.{side}', (0.105 * sx, -0.05, 0.04), (0.05, 0.10, 0.04), 'gold', seg=12), f'foot.{side}')
        rigid(tube(f'leg.{side}', (0.10 * sx, 0, 1.10), (0.105 * sx, 0, 0.60), 0.06, 0.05, 'silk', outline=0.0), f'thigh.{side}')
        rigid(tube(f'shinwrap.{side}', (0.105 * sx, 0, 0.62), (0.105 * sx, 0.01, 0.07), 0.05, 0.042, 'silk', outline=0.004), f'shin.{side}')

    # The orb of light: the only part that glows, a hard-edged core and a thin gold band.
    rigid(sphere('orb', ORB, (0.085,) * 3, 'orb', seg=20, outline=0.006), 'orbcore')

    for obj, bone in parts:
        bind_rigid(obj, arm, bone)
    for obj, bone in skirt:
        bind_skirt(obj, arm, bone, z_top=1.15, z_free=0.95)
    add_ik(arm, 'forearm.R', 'grip.R')
    add_ik(arm, 'forearm.L', 'grip.L')
    for side in 'RL':
        c = arm.pose.bones[f'sleeve.{side}'].constraints.new('COPY_ROTATION')
        c.target = arm
        c.subtarget = 'down'
    return arm


def after_pose(pose):
    s = pose.extra.get('orb', 1.0)
    core = bpy.data.objects['rig'].pose.bones['orbcore']
    core.scale = (max(s, 1e-3),) * 3
    bpy.data.objects['orb'].hide_render = s < 0.05


# ---------------------------------------------------------------- animations

def guard():
    """The standing pose: upright and serene, the orb held before the chest."""
    return {'spine': (1, 0, 0), 'neck': (-2, 0, 0), 'head': (-4, 0, 0)}


def pose_idle(t):
    return Pose(guard())


def pose_walk(t):
    """A slow, gliding procession; t in [0, 1) is one full cycle of two steps. t = 0: legs passing."""
    p = 2 * math.pi * t
    s = math.sin(p)
    a = 20
    r = guard()
    add(r, 'spine', dx=2, dz=3 * s)
    add(r, 'hips', dz=-4 * s)
    thigh_l, thigh_r = -a * s, a * s
    bend_l = 6 + 30 * max(0.0, math.cos(p + math.pi / 4)) ** 2
    bend_r = 6 + 30 * max(0.0, -math.cos(p + math.pi / 4)) ** 2
    r['thigh.L'] = (thigh_l, 0, 0)
    r['thigh.R'] = (thigh_r, 0, 0)
    r['shin.L'] = (bend_l, 0, 0)
    r['shin.R'] = (bend_r, 0, 0)
    r['foot.L'] = (-0.6 * (thigh_l + bend_l), 0, 0)
    r['foot.R'] = (-0.6 * (thigh_r + bend_r), 0, 0)
    r['skirt_front'] = (-0.6 * a * abs(s), 0, 0)
    r['skirt_back'] = (0.4 * a * abs(s), 0, 0)
    r['skirt.L'] = (0.8 * thigh_l, 0, 0)
    r['skirt.R'] = (0.8 * thigh_r, 0, 0)
    return Pose(r, locs={'orb': (0, 0, 0.012 * math.cos(2 * p))})


def pose_cast(t):
    """
    The hymn: frames 1–6 (t up to 5/7) raise the swelling orb overhead, singing to the sky; frames
    7–8 thrust it forward, releasing it, and begin to draw back.
    """
    k = t * 7
    raise_ = keys([(0, 0), (1, 0.25), (3, 0.75), (5, 1.0), (6, 0.15), (7, 0.25)], k)
    lean = keys([(0, 0), (5, -7), (6, 14), (7, 8)], k)
    fwd = keys([(0, 0), (5, 0.04), (6, -0.30), (7, -0.16)], k)
    orb = keys([(0, 1.0), (5, 1.45), (5.5, 1.5), (6, 0.35), (7, 0.55)], k)
    r = guard()
    add(r, 'spine', dx=lean)
    add(r, 'chest', dx=lean * 0.5)
    add(r, 'head', dx=-22 * raise_ + 0.6 * lean)
    add(r, 'neck', dx=-8 * raise_)
    return Pose(r, locs={'orb': (0, fwd + 0.05 * raise_, 0.55 * raise_)}, orb=orb)


def pose_pain(t):
    """A flinch; three frames at t = 0, 0.5, 1."""
    k = keys([(0, 0.6), (0.5, 1.0), (1, 0.4)], t)
    r = guard()
    add(r, 'spine', dx=-16 * k)
    add(r, 'chest', dx=-6 * k)
    add(r, 'head', dx=-14 * k, dy=8 * k)
    add(r, 'thigh.L', dx=-6 * k)
    add(r, 'shin.L', dx=10 * k)
    add(r, 'thigh.R', dx=5 * k)
    add(r, 'shin.R', dx=8 * k)
    r['skirt_front'] = (-5 * k, 0, 0)
    return Pose(r, locs={'hips': (0, 0.04 * k, 0), 'orb': (0, 0.06 * k, -0.05 * k)}, orb=1 - 0.2 * k)


def pose_death(t):
    """
    The light goes out: a recoil as the orb fades, then the Chorister topples forward like a falling
    statue, pivoting on the hem; t from 0 to 1 over the frames.
    """
    recoil = keys([(0, 0.7), (0.15, 1.0), (0.35, 0.3), (1, 0)], t)
    fall = smooth((t - 0.15) / 0.85) ** 1.8
    r = guard()
    add(r, 'spine', dx=-14 * recoil + 6 * fall)
    add(r, 'chest', dx=-6 * recoil)
    add(r, 'head', dx=-16 * recoil - 18 * fall)
    r['skirt_front'] = (-4 * fall, 0, 0)
    return Pose(r, locs={'orb': (0, 0.05 * recoil - 0.08 * fall, -0.10 * fall)},
                fall=88 * fall, pivot_y=-0.27, orb=1 - smooth(t / 0.45))


# name: (frames, pose function, looping)
ANIMS = {
    'idle': (1, pose_idle, True),
    'walk': (8, pose_walk, True),
    'cast': (8, pose_cast, False),
    'pain': (3, pose_pain, False),
    'death': (8, pose_death, False),
}

# 120 px/m (§11.2); the canvas leaves room for the raised orb and a body lying in any direction.
SPEC = Spec(build_model, ANIMS, px_per_m=120, canvas=(-2.4, 2.4, -0.4, 2.8), contact=(0.10, 0.03, 0.07), after_pose=after_pose)

if __name__ == '__main__':
    main(SPEC, __doc__)
