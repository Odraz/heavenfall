"""
Builds the Binder in Blender from primitives, rigs and animates it, and renders sprite frames.
The look follows assets/art-src/reference/binder-front.png and binder-turnaround.png. Shared code
and the commands are in common.py.

Run with Blender 5.2 (headless):
  blender -b --factory-startup -P scripts/blender/binder.py -- <command> [args]
"""
import math
import os
import sys

from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (EMISSIVE, PAL, Pose, Spec, add, add_ik, bind_rigid, bind_skirt, box, build_armature, chain,  # noqa: E402
                    main, robe_panel, sag, sphere, torus, tube)

# ---------------------------------------------------------------- palette

PAL.update({
    'coat': (0.33, 0.27, 0.22),     # ragged brown-black coat
    'hood': (0.26, 0.21, 0.18),
    'mask': (0.47, 0.45, 0.43),     # the faceless iron mask
    'shade': (0.12, 0.10, 0.09),
    'iron': (0.31, 0.30, 0.30),
    'chain': (0.70, 0.26, 0.13),    # red-hot links
    'lock': (0.50, 0.42, 0.33),
    'leather': (0.37, 0.26, 0.18),
    'skin': (0.62, 0.47, 0.35),
    'hot': (1.0, 0.42, 0.15),
})
EMISSIVE.add('hot')

# ---------------------------------------------------------------- armature

# The chain gun is held at the hip, the right hand on the rear grip and the left on the top
# handle, the barrels pointing forward and a little to the character's left.
GUN_DIR = Vector((0.50, -0.86, -0.04)).normalized()
GUN_SIDE = GUN_DIR.cross(Vector((0, 0, 1))).normalized()
GUN_UP = GUN_SIDE.cross(GUN_DIR).normalized()
GRIP = Vector((-0.15, -0.20, 0.90))                      # the right hand
TOP = GRIP + GUN_DIR * 0.30 + GUN_UP * 0.15              # the left hand

# name: (head, tail, parent)
BONES = {
    'root': ((0, 0, 0), (0, 0.15, 0), None),
    'hips': ((0, 0, 0.88), (0, 0, 0.98), 'root'),
    'spine': ((0, 0, 0.98), (0, 0, 1.16), 'hips'),
    'chest': ((0, 0, 1.16), (0, 0, 1.36), 'spine'),
    'neck': ((0, 0, 1.36), (0, 0, 1.44), 'chest'),
    'head': ((0, 0, 1.44), (0, 0, 1.66), 'neck'),
    'skirt_front': ((0, -0.17, 0.94), (0, -0.21, 0.35), 'hips'),
    'skirt_back': ((0, 0.16, 0.94), (0, 0.21, 0.30), 'hips'),
    'gun': (tuple(GRIP), tuple(GRIP + GUN_DIR * 0.2), 'chest'),
    'grip.R': (tuple(GRIP), tuple(GRIP + GUN_UP * 0.05), 'gun'),
    'grip.L': (tuple(TOP), tuple(TOP + GUN_UP * 0.05), 'gun'),
}
ELBOW = {'R': Vector((-0.33, 0.07, 1.06)), 'L': Vector((0.31, 0.04, 1.07))}
FOREARM = 0.36
for side, sx in (('R', -1), ('L', 1)):
    hand = GRIP if side == 'R' else TOP
    wrist = ELBOW[side] + (hand - ELBOW[side]).normalized() * FOREARM
    BONES.update({
        f'shoulder.{side}': ((0.05 * sx, 0, 1.31), (0.25 * sx, 0, 1.31), 'chest'),
        f'upper_arm.{side}': ((0.28 * sx, 0.02, 1.30), tuple(ELBOW[side]), f'shoulder.{side}'),
        f'forearm.{side}': (tuple(ELBOW[side]), tuple(wrist), f'upper_arm.{side}'),
        f'thigh.{side}': ((0.13 * sx, 0, 0.86), (0.135 * sx, 0, 0.48), 'hips'),
        f'shin.{side}': ((0.135 * sx, 0, 0.48), (0.135 * sx, 0.01, 0.10), f'thigh.{side}'),
        f'foot.{side}': ((0.135 * sx, 0.01, 0.10), (0.135 * sx, -0.15, 0.03), f'shin.{side}'),
        f'skirt.{side}': ((0.20 * sx, 0, 0.94), (0.30 * sx, 0, 0.32), 'hips'),
    })


def padlock(name, p, rot=(0, 0, 0)):
    """A padlock hanging at p: body and shackle, as two objects."""
    p = Vector(p)
    return [box(name, p, (0.068, 0.034, 0.072), 'lock', rot=rot, bevel=0.01, outline=0.005),
            torus(name + 'shackle', p + Vector((0, 0, 0.046)), 0.022, 0.007, 'iron', rot=(math.pi / 2, 0, rot[2]), seg=12, outline=0.003)]


# ---------------------------------------------------------------- the model

def build_model():
    arm = build_armature(BONES)
    parts = []  # (object, bone)

    def rigid(obj, bone):
        for o in obj if isinstance(obj, list) else [obj]:
            parts.append((o, bone))
        return obj

    # Head: a ragged hood over a faceless iron mask, and an iron collar.
    rigid(sphere('hood', (0, 0.015, 1.55), (0.135, 0.15, 0.15), 'hood', outline=0.009), 'head')
    rigid(sphere('hoodpeak', (0, 0.05, 1.66), (0.06, 0.07, 0.06), 'hood', outline=0.0), 'head')
    rigid(sphere('shade', (0, -0.06, 1.54), (0.098, 0.07, 0.12), 'shade', outline=0.0), 'head')
    rigid(sphere('mask', (0, -0.088, 1.52), (0.078, 0.05, 0.10), 'mask', outline=0.005), 'head')
    rigid(box('maskridge', (0, -0.136, 1.53), (0.016, 0.012, 0.09), 'mask', outline=0.003), 'head')
    for sx in (-1, 1):
        rigid(box(f'eyehole{sx}', (0.033 * sx, -0.132, 1.555), (0.04, 0.012, 0.016), 'shade', rot=(0, -0.3 * sx, 0), outline=0.0), 'head')
    rigid(box('mouthslot', (0, -0.128, 1.465), (0.05, 0.012, 0.008), 'hot', outline=0.0), 'head')
    rigid(torus('collar', (0, -0.01, 1.38), 0.12, 0.03, 'iron', scale=(1.05, 0.95, 1), outline=0.007), 'neck')
    rigid(torus('collarring', (0, -0.14, 1.33), 0.025, 0.008, 'iron', rot=(math.pi / 2, 0, 0), seg=12, outline=0.003), 'neck')

    # Torso: a broad, ragged coat with a tattered short mantle and leather harness straps.
    rigid(tube('torso', (0, 0, 0.86), (0, 0, 1.38), 0.21, 0.25, 'coat', squash=0.76, seg=18, outline=0.010), 'spine')
    rigid(robe_panel('mantle', -math.pi + 0.01, math.pi - 0.01, 1.38, 1.13, 0.13, 0.12, 0.31, 0.24,
                     trim=0, tatter=0.07, seed=21, push=0.01, mats=('hood', 'hood'), thickness=0.012, outline=0.008), 'chest')
    for sx in (-1, 1):
        rigid(tube(f'strap{sx}', (0.13 * sx, -0.20, 1.10), (0.15 * sx, -0.17, 1.36), 0.025, 0.025, 'leather', seg=6, squash=0.4, outline=0.004), 'chest')
    rigid(torus('belt', (0, 0, 0.92), 0.215, 0.035, 'leather', scale=(1.05, 0.80, 1.0), outline=0.007), 'hips')
    rigid(box('buckle', (0, -0.18, 0.92), (0.08, 0.03, 0.065), 'iron', outline=0.005), 'hips')

    # Red-hot chains crossed over the chest, one down from the collar, padlocks dangling.
    for sx in (-1, 1):
        rigid(chain(f'xchain{sx}', [(0.24 * sx, -0.12, 1.36), (0.12 * sx, -0.21, 1.24), (-0.02 * sx, -0.235, 1.10),
                                    (-0.14 * sx, -0.22, 0.98), (-0.22 * sx, -0.15, 0.90)], 'chain', link=0.06, thick=0.013), 'spine')
    rigid(chain('collarchain', sag((0, -0.15, 1.31), (0.03, -0.24, 1.02), 0.02, n=6), 'chain', link=0.055, thick=0.012), 'spine')
    rigid(padlock('lockchest', (0.02, -0.255, 0.98)), 'spine')
    for sx in (-1, 1):
        rigid(chain(f'hipchain{sx}', sag((0.08 * sx, -0.225, 0.89), (0.25 * sx, -0.17, 0.89), 0.22, n=10), 'chain', link=0.055, thick=0.012), 'hips')
        rigid(padlock(f'lockhip{sx}', (0.165 * sx, -0.225, 0.63)), 'hips')

    # Two slotted drums on the back, chained on, their ammo belts feeding the gun.
    for side, sx in (('R', -1), ('L', 1)):
        base, top = Vector((0.21 * sx, 0.27, 1.16)), Vector((0.26 * sx, 0.29, 1.58))
        axis = (top - base).normalized()
        rigid(tube(f'drum.{side}', base, top, 0.13, 0.13, 'iron', seg=20, outline=0.009), 'chest')
        for k, t in enumerate((0.06, 0.94)):
            rigid(torus(f'drumband{k}.{side}', base.lerp(top, t), 0.133, 0.014, 'iron', rot=(-0.05, 0.12 * sx, 0), outline=0.004), 'chest')
        u = axis.cross(Vector((1, 0, 0))).normalized()
        v = axis.cross(u)
        for k in range(10):
            a = 2 * math.pi * k / 10
            off = (u * math.cos(a) + v * math.sin(a)) * 0.128
            rigid(tube(f'slot{k}.{side}', base + axis * 0.26 + off, base + axis * 0.36 + off, 0.012, 0.012, 'hot', seg=6, outline=0.0), 'chest')
        ring = [base + axis * 0.18 + (u * math.cos(a) + v * math.sin(a)) * 0.145 for a in (2 * math.pi * i / 16 for i in range(17))]
        rigid(chain(f'drumchain.{side}', ring, 'chain', link=0.055, thick=0.012), 'chest')
        rigid(padlock(f'lockdrum.{side}', base + axis * 0.18 + Vector((0.13 * sx, -0.05, -0.07))), 'chest')
        # The ammo belt: big dark links from under the drum, round the side, into the gun.
        feed = GRIP + GUN_DIR * 0.12 - GUN_UP * 0.07
        rigid(chain(f'belt.{side}', [base + Vector((0.02 * sx, -0.02, -0.02)), (0.42 * sx, 0.10, 0.98), (0.45 * sx, -0.06, 0.66),
                                     (0.30 * sx, -0.20, 0.58), feed + Vector((0.08 * sx, 0.0, -0.08)), feed],
                    'iron', link=0.07, thick=0.02, outline=0.005), 'chest')

    # Ragged coat skirt to mid-shin, in four panels so the legs can stride.
    skirt = [
        (robe_panel('skirt_front', -0.50, 0.50, 0.94, 0.30, 0.215, 0.17, 0.26, 0.22, trim=0, tatter=0.10, seed=22,
                    push=0.012, mats=('coat', 'coat')), 'skirt_front'),
        (robe_panel('skirt_back', 1.70, 2 * math.pi - 1.70, 0.94, 0.26, 0.21, 0.16, 0.30, 0.25, trim=0, tatter=0.12, seed=23,
                    mats=('coat', 'coat')), 'skirt_back'),
        (robe_panel('skirt_L', 0.45, 1.90, 0.94, 0.30, 0.21, 0.16, 0.31, 0.25, trim=0, tatter=0.12, seed=24,
                    mats=('coat', 'coat')), 'skirt.L'),
        (robe_panel('skirt_R', -1.90, -0.45, 0.94, 0.30, 0.21, 0.16, 0.31, 0.25, trim=0, tatter=0.12, seed=25,
                    mats=('coat', 'coat')), 'skirt.R'),
    ]

    for side, sx in (('R', -1), ('L', 1)):
        # Arms: thick coat sleeves wrapped in chain coils, hanging loops with padlocks, bare fists.
        e = ELBOW[side]
        hand = GRIP if side == 'R' else TOP
        fdir = (hand - e).normalized()
        rigid(tube(f'upperarm.{side}', (0.28 * sx, 0.02, 1.30), e, 0.085, 0.08, 'coat', outline=0.008), f'upper_arm.{side}')
        rigid(tube(f'forearm.{side}', e, e + fdir * (FOREARM - 0.04), 0.078, 0.068, 'coat', outline=0.008), f'forearm.{side}')
        rigid(tube(f'cuff.{side}', e + fdir * (FOREARM - 0.10), e + fdir * (FOREARM - 0.035), 0.072, 0.07, 'leather', outline=0.005), f'forearm.{side}')
        u = fdir.cross(Vector((0, 0, 1))).normalized()
        v = fdir.cross(u)
        coil = [e + fdir * (0.04 + 0.22 * i / 36) + (u * math.cos(w) + v * math.sin(w)) * 0.09
                for i, w in ((i, 2 * math.pi * 3 * i / 36) for i in range(37))]
        rigid(chain(f'armcoil.{side}', coil, 'chain', link=0.05, thick=0.011), f'forearm.{side}')
        loop_a = e + fdir * 0.08 + Vector((0.08 * sx, 0, -0.03))
        loop_b = e + fdir * 0.24 + Vector((0.08 * sx, 0, -0.05))
        rigid(chain(f'armloop.{side}', sag(loop_a, loop_b, 0.22), 'chain', link=0.05, thick=0.011), f'forearm.{side}')
        rigid(padlock(f'lockarm.{side}', loop_a.lerp(loop_b, 0.5) - Vector((0, 0, 0.26))), f'forearm.{side}')
        rigid(sphere(f'fist.{side}', hand, (0.06, 0.065, 0.06), 'skin', seg=14, outline=0.007), 'gun')
        # Legs: coat-coloured trousers and heavy boots.
        rigid(tube(f'thigh.{side}', (0.13 * sx, 0, 0.86), (0.135 * sx, 0, 0.48), 0.10, 0.085, 'hood', outline=0.007), f'thigh.{side}')
        rigid(tube(f'shin.{side}', (0.135 * sx, 0, 0.50), (0.135 * sx, 0.01, 0.12), 0.085, 0.08, 'leather', outline=0.007), f'shin.{side}')
        rigid(torus(f'bootcuff.{side}', (0.135 * sx, 0.0, 0.30), 0.088, 0.018, 'leather', outline=0.004), f'shin.{side}')
        rigid(sphere(f'boot.{side}', (0.135 * sx, -0.05, 0.055), (0.085, 0.145, 0.058), 'leather', seg=16, outline=0.008), f'foot.{side}')

    # The chain gun: a drum-shaped receiver, six barrels in a red-hot banded cluster, two grips.
    g, d, s, u = GRIP, GUN_DIR, GUN_SIDE, GUN_UP
    rot = Matrix((s, d, u)).transposed().to_euler()
    rigid(tube('receiver', g + d * 0.02, g + d * 0.30, 0.095, 0.095, 'iron', seg=16, outline=0.008), 'gun')
    rigid(torus('recband', g + d * 0.22, 0.098, 0.016, 'hot', rot=Vector((0, 0, 1)).rotation_difference(d).to_euler(), seg=20, outline=0.004), 'gun')
    for k in range(6):
        a = 2 * math.pi * k / 6
        off = (s * math.cos(a) + u * math.sin(a)) * 0.048
        rigid(tube(f'barrel{k}', g + d * 0.30 + off, g + d * 0.78 + off, 0.021, 0.021, 'iron', seg=8, outline=0.004), 'gun')
    for k, t in enumerate((0.40, 0.58, 0.74)):
        rigid(torus(f'band{k}', g + d * t, 0.072, 0.014, 'hot', rot=Vector((0, 0, 1)).rotation_difference(d).to_euler(), seg=20, outline=0.004), 'gun')
    rigid(tube('hub', g + d * 0.29, g + d * 0.80, 0.022, 0.022, 'shade', seg=8, outline=0.0), 'gun')
    rigid(box('rearplate', g - d * 0.0 + u * 0.02, (0.16, 0.03, 0.17), 'iron', rot=rot, bevel=0.01, outline=0.006), 'gun')
    rigid(tube('reargrip', g - u * 0.06, g + u * 0.06, 0.022, 0.022, 'leather', seg=8, outline=0.004), 'gun')
    rigid(tube('handlepost0', g + d * 0.22 + u * 0.08, TOP - d * 0.06, 0.016, 0.016, 'iron', seg=8, outline=0.004), 'gun')
    rigid(tube('handlepost1', g + d * 0.38 + u * 0.08, TOP + d * 0.06, 0.016, 0.016, 'iron', seg=8, outline=0.004), 'gun')
    rigid(tube('tophandle', TOP - d * 0.07, TOP + d * 0.07, 0.022, 0.022, 'leather', seg=8, outline=0.004), 'gun')

    for obj, bone in parts:
        bind_rigid(obj, arm, bone)
    for obj, bone in skirt:
        bind_skirt(obj, arm, bone, z_top=0.94, z_free=0.78)
    add_ik(arm, 'forearm.R', 'grip.R')
    add_ik(arm, 'forearm.L', 'grip.L')
    return arm


# ---------------------------------------------------------------- animations

def guard():
    """The standing pose: planted wide, hunched a little behind the gun."""
    return {
        'spine': (6, 0, 0), 'chest': (3, 0, 0), 'neck': (-3, 0, 0), 'head': (-5, 0, 0),
        'thigh.L': (-2, -3, 0), 'thigh.R': (-2, 3, 0), 'shin.L': (3, 0, 0), 'shin.R': (3, 0, 0),
    }


def pose_idle(t):
    return Pose(guard())


def pose_walk(t):
    """A stomping stride; t in [0, 1) is one full cycle of two steps. t = 0: legs passing."""
    p = 2 * math.pi * t
    s = math.sin(p)
    a = 24
    r = guard()
    add(r, 'spine', dx=4, dz=6 * s)
    add(r, 'hips', dz=-7 * s)
    thigh_l, thigh_r = -a * s, a * s
    bend_l = 6 + 38 * max(0.0, math.cos(p + math.pi / 4)) ** 2
    bend_r = 6 + 38 * max(0.0, -math.cos(p + math.pi / 4)) ** 2
    r['thigh.L'] = (thigh_l, -3, 0)
    r['thigh.R'] = (thigh_r, 3, 0)
    r['shin.L'] = (bend_l, 0, 0)
    r['shin.R'] = (bend_r, 0, 0)
    r['foot.L'] = (-0.6 * (thigh_l + bend_l), 0, 0)
    r['foot.R'] = (-0.6 * (thigh_r + bend_r), 0, 0)
    r['skirt_front'] = (-0.6 * a * abs(s), 0, 0)
    r['skirt_back'] = (0.4 * a * abs(s), 0, 0)
    r['skirt.L'] = (0.8 * thigh_l, 0, 0)
    r['skirt.R'] = (0.8 * thigh_r, 0, 0)
    return Pose(r)


# name: (frames, pose function, looping)
ANIMS = {
    'idle': (1, pose_idle, True),
    'walk': (8, pose_walk, True),
}

# 120 px/m (§11.2); the canvas leaves room for the drums, the chains and the stride.
SPEC = Spec(build_model, ANIMS, px_per_m=120, canvas=(-1.1, 1.1, -0.3, 2.0), contact=(0.10, 0.03, 0.07))

if __name__ == '__main__':
    main(SPEC, __doc__)
