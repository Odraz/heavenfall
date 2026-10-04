"""
Builds the Fallen in Blender from primitives, rigs and animates it, and renders sprite frames.
The look follows assets/art-src/reference/fallen-front.png and fallen-turnaround.png. Shared code
and the commands are in common.py.

Run with Blender 5.2 (headless):
  blender -b --factory-startup -P scripts/blender/fallen.py -- <command> [args]
"""
import math
import os
import sys

from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (EMISSIVE, PAL, Pose, Spec, add, add_ik, bind_rigid, bind_skirt, box, build_armature,  # noqa: E402
                    cracked, main, robe_panel, sphere, sweep, torus, tube)

# ---------------------------------------------------------------- palette

PAL.update({
    'iron': (0.30, 0.26, 0.24),     # charred black plate
    'rust': (0.52, 0.24, 0.15),     # rust-red enamel
    'horn': (0.24, 0.21, 0.20),
    'bone': (0.50, 0.37, 0.26),     # the burnt wing bones
    'cloth': (0.25, 0.23, 0.23),    # soot-black tabard
    'gunmetal': (0.27, 0.27, 0.29),
    'molten': (1.0, 0.52, 0.12),
    'eye': (1.0, 0.66, 0.20),
    'rune': (1.0, 0.27, 0.12),
})
EMISSIVE.update({'molten', 'rune'})


def iron_c(seed=0.0):
    return cracked('iron', 'molten', scale=4.0, width=0.035, seed=seed, coverage=0.35)


def rust_c(seed=0.0):
    return cracked('rust', 'molten', scale=4.5, width=0.035, seed=seed, coverage=0.45)


# ---------------------------------------------------------------- armature

# The shotgun is held low across the body, the right hand on the grip and the left on the pump,
# the muzzle pointing forward and to the character's left (+X), slightly down.
GUN_DIR = Vector((0.80, -0.45, -0.22)).normalized()
GUN_SIDE = GUN_DIR.cross(Vector((0, 0, 1))).normalized()  # faces the viewer, toward -Y
GUN_UP = GUN_SIDE.cross(GUN_DIR).normalized()
GRIP = Vector((-0.12, -0.21, 1.03))   # the right hand
PUMP = GRIP + GUN_DIR * 0.46          # the left hand

# name: (head, tail, parent)
BONES = {
    'root': ((0, 0, 0), (0, 0.15, 0), None),
    'hips': ((0, 0, 1.00), (0, 0, 1.12), 'root'),
    'spine': ((0, 0, 1.12), (0, 0, 1.34), 'hips'),
    'chest': ((0, 0, 1.34), (0, 0, 1.56), 'spine'),
    'neck': ((0, 0, 1.56), (0, 0, 1.64), 'chest'),
    'head': ((0, 0, 1.64), (0, 0, 1.88), 'neck'),
    'skirt_front': ((0, -0.17, 1.06), (0, -0.20, 0.45), 'hips'),
    'skirt_back': ((0, 0.16, 1.06), (0, 0.20, 0.45), 'hips'),
    'gun': (tuple(GRIP), tuple(GRIP + GUN_DIR * 0.2), 'chest'),
    'grip.R': (tuple(GRIP), tuple(GRIP + GUN_UP * 0.05), 'gun'),
    'grip.L': (tuple(PUMP), tuple(PUMP + GUN_UP * 0.05), 'gun'),
}
ELBOW = {'R': Vector((-0.34, 0.06, 1.19)), 'L': Vector((0.34, 0.06, 1.19))}
FOREARM = 0.42
for side, sx in (('R', -1), ('L', 1)):
    hand = GRIP if side == 'R' else PUMP
    wrist = ELBOW[side] + (hand - ELBOW[side]).normalized() * FOREARM
    BONES.update({
        f'shoulder.{side}': ((0.05 * sx, 0, 1.50), (0.26 * sx, 0, 1.50), 'chest'),
        f'upper_arm.{side}': ((0.29 * sx, 0.02, 1.48), tuple(ELBOW[side]), f'shoulder.{side}'),
        f'forearm.{side}': (tuple(ELBOW[side]), tuple(wrist), f'upper_arm.{side}'),
        f'thigh.{side}': ((0.14 * sx, 0, 1.00), (0.15 * sx, 0, 0.58), 'hips'),
        f'shin.{side}': ((0.15 * sx, 0, 0.58), (0.15 * sx, 0.01, 0.12), f'thigh.{side}'),
        f'foot.{side}': ((0.15 * sx, 0.01, 0.12), (0.15 * sx, -0.16, 0.05), f'shin.{side}'),
    })


def gun_rot():
    """Rotation taking a part's X, Y, Z to the gun's side, length and up."""
    return Matrix((GUN_SIDE, GUN_DIR, GUN_UP)).transposed().to_euler()


# ---------------------------------------------------------------- the model

def build_model():
    arm = build_armature(BONES)
    parts = []  # (object, bone)

    def rigid(obj, bone):
        parts.append((obj, bone))
        return obj

    # Helm: a closed bucket helm with a ridge down the face, two ember eye slits and two horns.
    rigid(sphere('helm', (0, -0.01, 1.75), (0.125, 0.135, 0.15), 'iron', outline=0.010), 'head')
    rigid(sphere('visor', (0, -0.06, 1.72), (0.105, 0.085, 0.12), 'iron', outline=0.006), 'head')
    rigid(box('ridge', (0, -0.142, 1.72), (0.022, 0.03, 0.17), 'iron', outline=0.005), 'head')
    for sx in (-1, 1):
        rigid(box(f'eye{sx}', (0.045 * sx, -0.138, 1.755), (0.05, 0.03, 0.018), 'eye', rot=(0, 0.28 * sx, 0), outline=0.004), 'head')
        rigid(sweep(f'horn{sx}', [(0.08 * sx, -0.01, 1.83), (0.14 * sx, -0.005, 1.88), (0.175 * sx, 0.0, 1.95),
                                  (0.175 * sx, 0.01, 2.02), (0.145 * sx, 0.02, 2.07)],
                    [0.042, 0.034, 0.025, 0.014, 0.0], 'horn', seg=12, outline=0.008), 'head')
    rigid(tube('neck', (0, 0, 1.52), (0, 0, 1.66), 0.08, 0.075, 'iron', outline=0.0), 'neck')
    rigid(torus('gorget', (0, 0, 1.60), 0.10, 0.045, iron_c(3), scale=(1.1, 1.0, 1.0), outline=0.008), 'neck')

    # Torso: a barrel chest of iron with a rust-red breastplate and plated belly.
    rigid(tube('torso', (0, 0, 1.08), (0, 0, 1.58), 0.21, 0.27, 'iron', squash=0.70, seg=18, outline=0.010), 'spine')
    rigid(sphere('backplate', (0, 0.07, 1.41), (0.24, 0.15, 0.20), iron_c(1), outline=0.010), 'chest')
    rigid(sphere('breastplate', (0, -0.075, 1.40), (0.245, 0.165, 0.20), rust_c(2), outline=0.010), 'chest')
    for i, z in enumerate((1.22, 1.14)):
        rigid(box(f'belly{i}', (0, -0.15 + 0.01 * i, z), (0.30 - 0.03 * i, 0.10, 0.075), rust_c(4 + i), bevel=0.015, outline=0.006), 'spine')

    # Belt, tassets and the tattered soot-black loincloth front and back.
    rigid(tube('pelvis', (0, 0, 0.90), (0, 0, 1.08), 0.20, 0.21, 'iron', squash=0.75, outline=0.0), 'hips')
    rigid(torus('belt', (0, 0, 1.07), 0.215, 0.04, 'iron', scale=(1.05, 0.76, 1.0), outline=0.008), 'hips')
    rigid(box('buckle', (0, -0.18, 1.07), (0.09, 0.03, 0.07), 'rust', outline=0.005), 'hips')
    for sx in (-1, 1):
        rigid(box(f'tasset{sx}', (0.21 * sx, -0.03, 0.97), (0.13, 0.20, 0.17), rust_c(6 + sx), rot=(0, 0.30 * sx, 0), bevel=0.02, outline=0.007), 'hips')
    skirt = [
        (robe_panel('loin_front', -0.36, 0.36, 1.06, 0.44, 0.20, 0.165, 0.21, 0.20, trim=0, tatter=0.09, seed=5,
                    mats=('cloth', 'cloth'), thickness=0.014, outline=0.008), 'skirt_front'),
        (robe_panel('loin_back', math.pi - 0.42, math.pi + 0.42, 1.06, 0.40, 0.20, 0.16, 0.22, 0.21, trim=0, tatter=0.10, seed=6,
                    mats=('cloth', 'cloth'), thickness=0.014, outline=0.008), 'skirt_back'),
    ]

    for side, sx in (('R', -1), ('L', 1)):
        sh = f'shoulder.{side}'
        # Pauldrons: two layered domes with molten cracks and three spikes.
        rigid(sphere(f'pauldron.{side}', (0.31 * sx, 0.0, 1.53), (0.175, 0.175, 0.13), iron_c(10 + sx), outline=0.010), sh)
        rigid(sphere(f'pauldron2.{side}', (0.35 * sx, 0.0, 1.44), (0.15, 0.16, 0.09), rust_c(12 + sx), outline=0.008), sh)
        for k, (p0, p1) in enumerate((
                ((0.30 * sx, -0.02, 1.62), (0.33 * sx, -0.03, 1.80)),
                ((0.40 * sx, -0.02, 1.57), (0.55 * sx, -0.03, 1.66)),
                ((0.30 * sx, -0.13, 1.56), (0.34 * sx, -0.27, 1.62)))):
            rigid(tube(f'pspike{k}.{side}', p0, p1, 0.04, 0.0, 'horn', seg=10, outline=0.006), sh)
        # Arms: thick plated upper arm, spiked elbow, gauntleted forearm.
        e = ELBOW[side]
        rigid(tube(f'upperarm.{side}', (0.29 * sx, 0.02, 1.48), e, 0.095, 0.08, iron_c(14 + sx), outline=0.009), f'upper_arm.{side}')
        rigid(sphere(f'elbow.{side}', e, (0.075, 0.075, 0.075), 'rust', seg=14, outline=0.007), f'upper_arm.{side}')
        rigid(tube(f'espike.{side}', e + Vector((0.03 * sx, 0.04, 0)), e + Vector((0.10 * sx, 0.16, -0.02)), 0.03, 0.0, 'horn', seg=8, outline=0.005), f'upper_arm.{side}')
        hand = GRIP if side == 'R' else PUMP
        fdir = (hand - e).normalized()
        wrist = e + fdir * FOREARM
        rigid(tube(f'forearm.{side}', e, wrist - fdir * 0.03, 0.075, 0.065, iron_c(16 + sx), outline=0.008), f'forearm.{side}')
        rigid(tube(f'bracer.{side}', e + fdir * 0.10, e + fdir * 0.30, 0.092, 0.085, rust_c(18 + sx), outline=0.007), f'forearm.{side}')
        out = Vector((sx, 0, 0)) - fdir * fdir.x * sx
        rigid(tube(f'bspike.{side}', e + fdir * 0.18 + out.normalized() * 0.07, e + fdir * 0.16 + out.normalized() * 0.19,
                   0.028, 0.0, 'horn', seg=8, outline=0.005), f'forearm.{side}')
        # Fists, closed around the gun.
        rigid(sphere(f'fist.{side}', hand, (0.065, 0.07, 0.065), 'iron', seg=14, outline=0.007), 'gun')
        # Legs: plated thigh, spiked knee cop, rust greave, heavy sabaton.
        rigid(tube(f'thigh.{side}', (0.14 * sx, 0, 1.00), (0.15 * sx, 0, 0.60), 0.115, 0.095, iron_c(20 + sx), outline=0.009), f'thigh.{side}')
        rigid(sphere(f'thighplate.{side}', (0.15 * sx, -0.075, 0.80), (0.10, 0.06, 0.15), rust_c(22 + sx), outline=0.007), f'thigh.{side}')
        rigid(sphere(f'knee.{side}', (0.15 * sx, -0.07, 0.58), (0.09, 0.075, 0.085), 'iron', seg=14, outline=0.007), f'shin.{side}')
        for k, dx in enumerate((-0.04, 0.04)):
            rigid(tube(f'kspike{k}.{side}', (0.15 * sx + dx, -0.11, 0.60), (0.15 * sx + dx * 1.8, -0.21, 0.70), 0.028, 0.0, 'horn', seg=8, outline=0.005), f'shin.{side}')
        rigid(tube(f'greave.{side}', (0.15 * sx, -0.005, 0.56), (0.15 * sx, 0.01, 0.15), 0.10, 0.08, rust_c(24 + sx), outline=0.009), f'shin.{side}')
        rigid(sphere(f'sabaton.{side}', (0.15 * sx, -0.05, 0.06), (0.088, 0.15, 0.06), 'iron', seg=16, outline=0.008), f'foot.{side}')
        rigid(box(f'toecap.{side}', (0.15 * sx, -0.13, 0.05), (0.15, 0.11, 0.08), rust_c(26 + sx), bevel=0.03, outline=0.006), f'foot.{side}')

        # Wing stumps: a burnt bone arm rising from the shoulder blade, its finger bones hanging down.
        top = Vector((0.36 * sx, 0.29, 2.05))
        rigid(sweep(f'wingarm.{side}', [(0.12 * sx, 0.16, 1.44), (0.22 * sx, 0.24, 1.68), (0.31 * sx, 0.28, 1.92), top],
                    [0.04, 0.034, 0.03, 0.038], 'bone', seg=10, outline=0.006), 'chest')
        rigid(sweep(f'wingclaw.{side}', [top, top + Vector((-0.02 * sx, 0, 0.08)), top + Vector((-0.07 * sx, 0, 0.14))],
                    [0.03, 0.018, 0.0], 'bone', seg=8, outline=0.005), 'chest')
        for k, (mid, end) in enumerate((
                ((0.60, 0.31, 1.98), (0.74, 0.33, 1.62)),
                ((0.56, 0.32, 1.80), (0.63, 0.33, 1.25)),
                ((0.46, 0.31, 1.65), (0.50, 0.31, 1.02)))):
            rigid(sweep(f'wingfinger{k}.{side}', [top, (mid[0] * sx, mid[1], mid[2]), (end[0] * sx, end[1], end[2])],
                        [0.02, 0.013, 0.0], 'bone', seg=8, outline=0.005), 'chest')

    # The Brimstone Shotgun: receiver, a wide barrel over a magazine tube, pump, stock, runes.
    rot = gun_rot()
    g, d, s, u = GRIP, GUN_DIR, GUN_SIDE, GUN_UP
    rigid(box('receiver', g + d * 0.13 + u * 0.05, (0.075, 0.30, 0.12), 'gunmetal', rot=rot, bevel=0.012, outline=0.007), 'gun')
    rigid(tube('barrel', g + d * 0.25 + u * 0.08, g + d * 0.82 + u * 0.08, 0.038, 0.038, 'gunmetal', seg=14, outline=0.007), 'gun')
    rigid(tube('muzzle', g + d * 0.79 + u * 0.08, g + d * 0.84 + u * 0.08, 0.046, 0.046, 'iron', seg=14, outline=0.006), 'gun')
    rigid(tube('magtube', g + d * 0.25 + u * 0.015, g + d * 0.76 + u * 0.015, 0.028, 0.028, 'gunmetal', seg=12, outline=0.006), 'gun')
    rigid(tube('pump', g + d * 0.38 + u * 0.02, g + d * 0.56 + u * 0.02, 0.048, 0.048, 'iron', seg=12, outline=0.007), 'gun')
    rigid(tube('stock', g - d * 0.02 + u * 0.03, g - d * 0.32 - u * 0.03, 0.035, 0.05, 'gunmetal', seg=10, squash=0.6, outline=0.007), 'gun')
    for k in range(6):
        rigid(box(f'rune{k}', g + d * (0.30 + 0.075 * k) + u * 0.08 + s * 0.036, (0.006, 0.04, 0.024), 'rune', rot=rot, outline=0.0), 'gun')
    for k in range(3):
        rigid(box(f'rrune{k}', g + d * (0.05 + 0.07 * k) + u * 0.06 + s * 0.039, (0.006, 0.035, 0.03), 'rune', rot=rot, outline=0.0), 'gun')

    for obj, bone in parts:
        bind_rigid(obj, arm, bone)
    for obj, bone in skirt:
        bind_skirt(obj, arm, bone, z_top=1.06, z_free=0.90)
    add_ik(arm, 'forearm.R', 'grip.R')
    add_ik(arm, 'forearm.L', 'grip.L')
    return arm


# ---------------------------------------------------------------- animations

def guard():
    """The standing pose: chest out, a slight forward lean, the shotgun held low across the body."""
    return {
        'spine': (4, 0, 0), 'chest': (2, 0, 0), 'neck': (-2, 0, 0), 'head': (-4, 0, 0),
        'shin.L': (3, 0, 0), 'shin.R': (3, 0, 0), 'thigh.L': (-2, 0, 0), 'thigh.R': (-2, 0, 0),
    }


def pose_idle(t):
    return Pose(guard())


def pose_walk(t):
    """A heavy stride; t in [0, 1) is one full cycle of two steps. t = 0: legs passing."""
    p = 2 * math.pi * t
    s = math.sin(p)
    a = 26
    r = guard()
    add(r, 'spine', dx=5, dz=6 * s)
    add(r, 'hips', dz=-7 * s)
    add(r, 'head', dx=-4)
    thigh_l, thigh_r = -a * s, a * s
    bend_l = 6 + 40 * max(0.0, math.cos(p + math.pi / 4)) ** 2
    bend_r = 6 + 40 * max(0.0, -math.cos(p + math.pi / 4)) ** 2
    r['thigh.L'] = (thigh_l, 0, 0)
    r['thigh.R'] = (thigh_r, 0, 0)
    r['shin.L'] = (bend_l, 0, 0)
    r['shin.R'] = (bend_r, 0, 0)
    r['foot.L'] = (-0.6 * (thigh_l + bend_l), 0, 0)
    r['foot.R'] = (-0.6 * (thigh_r + bend_r), 0, 0)
    r['skirt_front'] = (-0.7 * a * abs(s), 0, 0)
    r['skirt_back'] = (0.5 * a * abs(s), 0, 0)
    return Pose(r)


# name: (frames, pose function, looping)
ANIMS = {
    'idle': (1, pose_idle, True),
    'walk': (8, pose_walk, True),
}

# 120 px/m (§11.2); the canvas leaves room for the horns, the wing stumps and the stride.
SPEC = Spec(build_model, ANIMS, px_per_m=120, canvas=(-1.2, 1.2, -0.3, 2.5), contact=(0.12, 0.05, 0.08))

if __name__ == '__main__':
    main(SPEC, __doc__)
