"""
Builds the Blessed in Blender from primitives, rigs and animates it, and renders sprite frames.
Shared code and the commands are in common.py.

Run with Blender 5.2 (headless):
  blender -b --factory-startup -P scripts/blender/blessed.py -- <command> [args]

Besides the shared commands: shreds [out-dir]  the torn pieces of M12 §4.2.1 (default assets/art-src)
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (EMISSIVE, PAL, Pose, Spec, add, bind_rigid, bind_skirt, blade_mesh, box, build_armature,  # noqa: E402
                    face_camera, keys, lerp, main, robe_panel, smooth, sphere, toon, torus, tube)

# ---------------------------------------------------------------- palette

PAL.update({
    'ivory': (0.93, 0.89, 0.78),
    'white': (0.95, 0.95, 0.94),
    'steel': (0.80, 0.83, 0.87),
    'gold': (0.90, 0.70, 0.27),
    'blue': (0.66, 0.80, 0.90),
    'skin': (0.80, 0.78, 0.73),
    'beard': (0.88, 0.87, 0.84),
    'eye': (1.0, 1.0, 1.0),
    'grip': (0.45, 0.30, 0.18),
})

# ---------------------------------------------------------------- armature

# name: (head, tail, parent)
BONES = {
    'root': ((0, 0, 0), (0, 0.15, 0), None),
    'hips': ((0, 0, 0.92), (0, 0, 1.02), 'root'),
    'spine': ((0, 0, 1.02), (0, 0, 1.20), 'hips'),
    'chest': ((0, 0, 1.20), (0, 0, 1.36), 'spine'),
    'neck': ((0, 0, 1.36), (0, 0, 1.43), 'chest'),
    'head': ((0, 0, 1.43), (0, 0, 1.62), 'neck'),
    'skirt_front': ((0, -0.13, 0.98), (0, -0.16, 0.40), 'hips'),
    'skirt_back': ((0, 0.12, 0.98), (0, 0.16, 0.30), 'hips'),
}
for side, sx in (('R', -1), ('L', 1)):
    BONES.update({
        f'shoulder.{side}': ((0.03 * sx, 0, 1.33), (0.17 * sx, 0, 1.33), 'chest'),
        f'upper_arm.{side}': ((0.19 * sx, 0, 1.31), (0.23 * sx, 0, 1.06), f'shoulder.{side}'),
        f'forearm.{side}': ((0.23 * sx, 0, 1.06), (0.25 * sx, -0.03, 0.83), f'upper_arm.{side}'),
        f'hand.{side}': ((0.25 * sx, -0.03, 0.83), (0.255 * sx, -0.04, 0.75), f'forearm.{side}'),
        f'thigh.{side}': ((0.095 * sx, 0, 0.90), (0.10 * sx, 0, 0.50), 'hips'),
        f'shin.{side}': ((0.10 * sx, 0, 0.50), (0.10 * sx, 0.01, 0.09), f'thigh.{side}'),
        f'foot.{side}': ((0.10 * sx, 0.01, 0.09), (0.10 * sx, -0.11, 0.03), f'shin.{side}'),
        f'skirt.{side}': ((0.17 * sx, 0, 0.98), (0.24 * sx, 0, 0.30), 'hips'),
    })
SWORD_DIR = Vector((0.42, -0.38, -0.82)).normalized()
BONES['sword'] = ((-0.255, -0.04, 0.79), tuple(Vector((-0.255, -0.04, 0.79)) + SWORD_DIR * 0.2), 'hand.R')


# ---------------------------------------------------------------- the model

def build_model():
    arm = build_armature(BONES)
    parts = []  # (object, bone)

    def rigid(obj, bone):
        parts.append((obj, bone))
        return obj

    # Head: bald, gaunt, blind white eyes, short white beard.
    rigid(sphere('head', (0, -0.005, 1.515), (0.088, 0.100, 0.112), 'skin'), 'head')
    rigid(sphere('jaw', (0, -0.03, 1.455), (0.066, 0.07, 0.06), 'skin', outline=0.0), 'head')
    rigid(sphere('beard', (0, -0.055, 1.435), (0.064, 0.05, 0.062), 'beard', outline=0.006), 'head')
    rigid(sphere('nose', (0, -0.103, 1.505), (0.014, 0.022, 0.03), 'skin', seg=10, outline=0.004), 'head')
    for sx in (-1, 1):
        rigid(sphere(f'eye{sx}', (0.032 * sx, -0.088, 1.53), (0.021, 0.012, 0.012), 'eye', seg=12, outline=0.004), 'head')
        rigid(sphere(f'ear{sx}', (0.088 * sx, 0.0, 1.51), (0.014, 0.024, 0.032), 'skin', seg=10, outline=0.004), 'head')
    rigid(tube('neck', (0, 0, 1.33), (0, 0, 1.45), 0.045, 0.042, 'skin', outline=0.0), 'neck')

    # Halo: a thin gold ring behind the head.
    halo = torus('halo', (0, 0, 0), 0.17, 0.012, 'gold', rot=(math.pi / 2, 0, 0), seg=40, outline=0.006)

    # Torso: ivory robe body, white breastplate with a gold Y, blue trims, gold collar.
    rigid(tube('torso', (0, 0, 0.97), (0, 0, 1.36), 0.15, 0.185, 'ivory', squash=0.72, seg=18), 'spine')
    rigid(sphere('breastplate', (0, -0.055, 1.17), (0.115, 0.095, 0.175), 'white', outline=0.006), 'spine')
    for sx in (-1, 1):
        rigid(box(f'chesttrim{sx}', (0.112 * sx, -0.105, 1.15), (0.026, 0.03, 0.30), 'blue', rot=(0.12, 0, 0)), 'spine')
        rigid(box(f'ygold{sx}', (0.035 * sx, -0.143, 1.235), (0.018, 0.016, 0.085), 'gold', rot=(0.3, 0.7 * sx, 0), outline=0.004), 'spine')
    rigid(box('ystem', (0, -0.148, 1.15), (0.018, 0.016, 0.09), 'gold', rot=(0.05, 0, 0), outline=0.004), 'spine')
    rigid(torus('collar', (0, 0, 1.37), 0.055, 0.016, 'gold', scale=(1, 1, 1.4), outline=0.005), 'chest')

    # Cowl: a thick ivory scarf around the shoulders that drapes into a V on the chest.
    rigid(torus('cowl', (0, 0.0, 1.355), 0.11, 0.06, 'ivory', scale=(1.25, 1.12, 0.85), rot=(0.15, 0, 0), outline=0.008), 'chest')
    rigid(tube('cowldrape', (0, -0.13, 1.35), (0, -0.165, 1.20), 0.12, 0.02, 'ivory', squash=0.4, seg=12), 'chest')

    # Belt and sash.
    rigid(torus('sash', (0, 0, 0.985), 0.155, 0.028, 'blue', scale=(1.05, 0.78, 1.0), outline=0.006), 'hips')
    rigid(box('buckle', (0, -0.135, 0.985), (0.07, 0.02, 0.05), 'gold', outline=0.005), 'hips')
    rigid(tube('pelvis', (0, 0, 0.86), (0, 0, 1.0), 0.15, 0.15, 'ivory', squash=0.75, outline=0.0), 'hips')

    for side, sx in (('R', -1), ('L', 1)):
        # Pauldrons: layered white plates with gold rims.
        rigid(sphere(f'pauldron.{side}', (0.19 * sx, 0, 1.335), (0.085, 0.085, 0.065), 'white'), f'shoulder.{side}')
        rigid(torus(f'pauldronrim.{side}', (0.20 * sx, 0, 1.30), 0.078, 0.012, 'gold', rot=(0, 0.35 * sx, 0), scale=(1, 1.05, 1)), f'shoulder.{side}')
        rigid(sphere(f'pauldron2.{side}', (0.215 * sx, 0, 1.275), (0.075, 0.08, 0.05), 'white', outline=0.006), f'shoulder.{side}')
        # Sleeves: upper arm, then a wide bell sleeve with a blue cuff; gold bracer, pale hand.
        rigid(tube(f'upperarm.{side}', (0.19 * sx, 0, 1.31), (0.23 * sx, 0, 1.06), 0.055, 0.06, 'ivory'), f'upper_arm.{side}')
        rigid(tube(f'sleeve.{side}', (0.23 * sx, 0, 1.08), (0.25 * sx, -0.03, 0.86), 0.06, 0.10, 'ivory', cap=False), f'forearm.{side}')
        rigid(torus(f'cuff.{side}', (0.25 * sx, -0.03, 0.865), 0.092, 0.014, 'blue', rot=(-0.13, 0.09 * sx, 0), outline=0.005), f'forearm.{side}')
        rigid(tube(f'bracer.{side}', (0.248 * sx, -0.028, 0.89), (0.25 * sx, -0.03, 0.83), 0.036, 0.034, 'gold', outline=0.005), f'forearm.{side}')
        rigid(sphere(f'hand.{side}', (0.253 * sx, -0.04, 0.79), (0.038, 0.045, 0.05), 'skin', seg=12), f'hand.{side}')
        # Legs: robe-covered thigh, gold-rimmed knee cop, white greave, sabaton.
        rigid(tube(f'thigh.{side}', (0.095 * sx, 0, 0.90), (0.10 * sx, 0, 0.50), 0.072, 0.058, 'ivory'), f'thigh.{side}')
        rigid(sphere(f'knee.{side}', (0.10 * sx, -0.035, 0.50), (0.06, 0.05, 0.065), 'white', seg=14), f'shin.{side}')
        rigid(torus(f'kneerim.{side}', (0.10 * sx, -0.04, 0.455), 0.052, 0.011, 'gold', rot=(1.25, 0, 0), outline=0.004), f'shin.{side}')
        rigid(tube(f'greave.{side}', (0.10 * sx, 0, 0.47), (0.10 * sx, 0.01, 0.10), 0.055, 0.042, 'white'), f'shin.{side}')
        rigid(torus(f'anklerim.{side}', (0.10 * sx, 0.01, 0.11), 0.044, 0.011, 'gold', outline=0.004), f'shin.{side}')
        rigid(sphere(f'boot.{side}', (0.10 * sx, -0.045, 0.045), (0.05, 0.10, 0.05), 'steel', seg=14), f'foot.{side}')

    # Sword in the right hand, blade along the sword bone: down, forward and across the body.
    g = Vector((-0.255, -0.04, 0.79))
    d = SWORD_DIR
    side = d.cross(Vector((0, 0, 1))).normalized()  # the guard's long axis
    flat = d.cross(side).normalized()
    rigid(tube('grip', g - d * 0.07, g + d * 0.05, 0.014, 0.014, 'grip', seg=8, outline=0.004), 'sword')
    rigid(sphere('pommel', g - d * 0.085, (0.022, 0.022, 0.022), 'gold', seg=10, outline=0.004), 'sword')
    rigid(tube('guard', g + d * 0.06 - side * 0.08, g + d * 0.06 + side * 0.08, 0.014, 0.014, 'gold', seg=8, outline=0.005), 'sword')
    blade = blade_mesh('blade', g + d * 0.07, g + d * 0.88, side, flat)
    rigid(blade, 'sword')

    # Robe skirt: four panels so the legs can stride between them.
    skirt = [
        (robe_panel('skirt_front', -0.42, 0.42, 0.98, 0.30, 0.165, 0.135, 0.20, 0.17, trim=0.17, tatter=0.0, push=0.012), 'skirt_front'),
        (robe_panel('skirt_back', 1.75, 2 * math.pi - 1.75, 0.98, 0.10, 0.16, 0.13, 0.27, 0.23, trim=0.08, tatter=0.07, seed=3), 'skirt_back'),
        (robe_panel('skirt_L', 0.40, 1.95, 0.98, 0.13, 0.16, 0.13, 0.29, 0.24, trim=0.1, tatter=0.08, seed=1), 'skirt.L'),
        (robe_panel('skirt_R', -1.95, -0.40, 0.98, 0.13, 0.16, 0.13, 0.29, 0.24, trim=0.1, tatter=0.08, seed=2), 'skirt.R'),
    ]

    for obj, bone in parts:
        bind_rigid(obj, arm, bone)
    for obj, bone in skirt:
        bind_skirt(obj, arm, bone)
    # Always faces the camera, centered above the head and 0.1 m behind it as seen from the camera.
    face_camera(halo, arm, 'head', (0, 0, 1.56), (0, 0.10, 0))
    return arm


# ---------------------------------------------------------------- animations

def guard():
    """The standing pose: a slight forward lean, sword low across the body."""
    return {
        'spine': (6, 0, 0), 'chest': (3, 0, 0), 'neck': (-3, 0, 0), 'head': (-5, 0, 0),
        'upper_arm.L': (-4, 0, 0), 'forearm.L': (-14, 0, 0),
        'upper_arm.R': (-6, 0, 0), 'forearm.R': (-12, 0, 0),
        'shin.L': (4, 0, 0), 'shin.R': (4, 0, 0), 'thigh.L': (-3, 0, 0), 'thigh.R': (-3, 0, 0),
    }


def pose_idle(t):
    return Pose(guard())


def pose_walk(t):
    """A marching stride; t in [0, 1) is one full cycle of two steps. t = 0: legs passing."""
    p = 2 * math.pi * t
    s, c = math.sin(p), math.cos(p)
    a = 27
    r = guard()
    add(r, 'spine', dx=6, dz=7 * s)
    add(r, 'hips', dz=-6 * s)
    add(r, 'head', dx=-4)
    thigh_l, thigh_r = -a * s, a * s
    # The knee flexes most early in the swing, while the thigh is still behind the body.
    bend_l = 6 + 42 * max(0.0, math.cos(p + math.pi / 4)) ** 2
    bend_r = 6 + 42 * max(0.0, -math.cos(p + math.pi / 4)) ** 2
    r['thigh.L'] = (thigh_l, 0, 0)
    r['thigh.R'] = (thigh_r, 0, 0)
    r['shin.L'] = (bend_l, 0, 0)
    r['shin.R'] = (bend_r, 0, 0)
    r['foot.L'] = (-0.6 * (thigh_l + bend_l), 0, 0)
    r['foot.R'] = (-0.6 * (thigh_r + bend_r), 0, 0)
    add(r, 'upper_arm.L', dx=20 * s)
    add(r, 'forearm.L', dx=-8 * max(0.0, -s))
    add(r, 'upper_arm.R', dx=-9 * s)
    r['skirt_front'] = (-0.6 * a * abs(s), 0, 0)
    r['skirt_back'] = (0.4 * a * abs(s), 0, 0)
    r['skirt.L'] = (0.6 * thigh_l, 0, 0)
    r['skirt.R'] = (0.6 * thigh_r, 0, 0)
    return Pose(r)


def pose_attack(t):
    """An overhead chop; t in [0, 1) is one 1 s cycle with the hit at t = 0.5 (frame 4 of 8)."""
    r = guard()
    ua = keys([(0, -6), (0.125, -70), (0.25, -140), (0.375, -170), (0.5, -75), (0.625, -38), (0.75, -20), (0.875, -10), (1, -6)], t)
    fa = keys([(0, -12), (0.125, -40), (0.25, -55), (0.375, -60), (0.5, -8), (0.625, -4), (0.75, -8), (0.875, -11), (1, -12)], t)
    sp = keys([(0, 6), (0.125, 2), (0.25, -3), (0.375, -8), (0.5, 20), (0.625, 24), (0.75, 16), (0.875, 10), (1, 6)], t)
    tw = keys([(0, 0), (0.25, -12), (0.375, -16), (0.5, 10), (0.625, 14), (0.875, 4), (1, 0)], t)
    # The arm swings in from the outside so the blade cuts diagonally across the body.
    yaw = keys([(0, 0), (0.25, -12), (0.375, -15), (0.5, 22), (0.625, 32), (0.875, 8), (1, 0)], t)
    r['upper_arm.R'] = (ua, 0, yaw)
    r['forearm.R'] = (fa, 0, 0)
    r['spine'] = (sp, 0, tw)
    r['head'] = (-sp * 0.5, 0, -tw * 0.5)
    r['upper_arm.L'] = (keys([(0, -4), (0.375, -20), (0.5, 15), (0.75, 5), (1, -4)], t), 0, 0)
    # Feet apart, left leg forward; the hips sink into the blow.
    r['thigh.L'] = (-14, 0, 0)
    r['shin.L'] = (12, 0, 0)
    r['foot.L'] = (2, 0, 0)
    r['thigh.R'] = (10, 0, 0)
    r['shin.R'] = (10, 0, 0)
    r['foot.R'] = (-12, 0, 0)
    r['skirt_front'] = (-8, 0, 0)
    r['skirt_back'] = (6, 0, 0)
    r['skirt.L'] = (-8, 0, 0)
    r['skirt.R'] = (6, 0, 0)
    return Pose(r)


def pose_pain(t):
    """A flinch; three frames at t = 0, 0.5, 1."""
    k = keys([(0, 0.6), (0.5, 1.0), (1, 0.4)], t)
    r = guard()
    add(r, 'spine', dx=-22 * k)
    add(r, 'chest', dx=-8 * k)
    add(r, 'head', dx=-16 * k, dy=8 * k)
    add(r, 'upper_arm.L', dx=-18 * k, dy=-12 * k)
    add(r, 'forearm.L', dx=-25 * k)
    add(r, 'upper_arm.R', dx=-14 * k, dy=10 * k)
    add(r, 'forearm.R', dx=-20 * k)
    add(r, 'thigh.L', dx=-8 * k)
    add(r, 'shin.L', dx=14 * k)
    add(r, 'thigh.R', dx=6 * k)
    add(r, 'shin.R', dx=10 * k)
    r['skirt_front'] = (-6 * k, 0, 0)
    return Pose(r, locs={'hips': (0, 0.04 * k, 0)})


def pose_death(t):
    """Recoil, drop to the knees, topple forward onto the face; t from 0 to 1 over the frames."""
    kneel = smooth(t / 0.42)
    fall = smooth((t - 0.38) / 0.62) ** 1.6
    recoil = keys([(0, 0.8), (0.15, 1.0), (0.4, 0.2), (1, 0)], t)
    r = guard()
    add(r, 'spine', dx=-20 * recoil + 14 * kneel)
    add(r, 'chest', dx=-6 * recoil + 8 * kneel)
    add(r, 'head', dx=-14 * recoil + 22 * kneel)
    # Kneeling: thighs nearly upright, shins folded back flat on the ground.
    r['thigh.L'] = (lerp(-3, -22, kneel), 0, 0)
    r['thigh.R'] = (lerp(-3, -8, kneel), 0, 0)
    r['shin.L'] = (lerp(4, 112, kneel), 0, 0)
    r['shin.R'] = (lerp(4, 98, kneel), 0, 0)
    r['foot.L'] = (lerp(0, 40, kneel), 0, 0)
    r['foot.R'] = (lerp(0, 40, kneel), 0, 0)
    # Arms go limp, then fling forward as the body falls.
    add(r, 'upper_arm.L', dx=-20 * recoil + 10 * kneel - 70 * fall, dy=-10 * recoil)
    add(r, 'forearm.L', dx=10 * kneel - 20 * fall)
    add(r, 'upper_arm.R', dx=-16 * recoil + 12 * kneel - 60 * fall, dy=8 * recoil)
    add(r, 'forearm.R', dx=12 * kneel - 20 * fall)
    add(r, 'hand.R', dx=40 * kneel)
    r['skirt_front'] = (-25 * kneel, 0, 0)
    r['skirt_back'] = (20 * kneel, 0, 0)
    # The fall pivots on the knees; the shins counter-rotate to stay on the ground.
    angle = 82 * fall
    add(r, 'shin.L', dx=-angle)
    add(r, 'shin.R', dx=-angle)
    add(r, 'head', dx=-25 * fall)
    return Pose(r, locs={'hips': (0, 0.05 * recoil, 0)}, fall=angle, pivot_y=-0.16, halo=1 - smooth((t - 0.3) / 0.6))


# name: (frames, pose function, looping)
ANIMS = {
    'idle': (1, pose_idle, True),
    'walk': (8, pose_walk, True),
    'attack': (8, pose_attack, True),
    'pain': (3, pose_pain, False),
    'death': (8, pose_death, False),
}


def after_pose(pose):
    halo = bpy.data.objects['halo']
    s = pose.extra.get('halo', 1.0)
    halo.scale = (s,) * 3
    halo.hide_render = s < 0.05


# Sprite pixels per meter in the game. A Blessed 1 m from the camera covers about 700 screen px
# per meter at 1080p, so close up it is magnified about 3.7×; 190 still fits one 4096² atlas.
# The canvas leaves room for a raised sword and a body lying on the ground in any direction.
SPEC = Spec(build_model, ANIMS, px_per_m=190, canvas=(-2.0, 2.0, -0.4, 2.6), after_pose=after_pose)


# ---------------------------------------------------------------- torn pieces (M12 §4.2.1)

CUT_Z = 0.95  # the cut's height above the feet, just below the sash
CUT_TEETH = 0.065  # the zigzag's period: about 6 teeth across the hips
CUT_AMP = 0.06
CUT_BAND = 0.008  # the white band along the cut edge
TILT = 35  # degrees, so the cut faces the camera
SWORD_PARTS = ('grip', 'pommel', 'guard', 'blade')
ARM_BONES = ('shoulder.', 'upper_arm.', 'forearm.', 'hand.')
GREEN_PAD = 24  # px of green around each piece; cutout.py reads the background from the corners

PAL.update({'cut': (1.0, 0xd2 / 255, 0x7a / 255), 'cutband': (1.0, 1.0, 1.0)})
EMISSIVE.update({'cut', 'cutband'})


def zigzag(x):
    """The cut's height at x: teeth of CUT_TEETH, ±CUT_AMP, a tooth's peak at x = 0."""
    f = (x / CUT_TEETH) % 1.0
    return CUT_Z + CUT_AMP * (4 * abs(f - 0.5) - 1)


def cut_slab(name, lo, hi, arm):
    """A closed solid between the zigzag raised by `lo` and by `hi`, across the whole body."""
    half = 0.6
    n = round(2 * half / (CUT_TEETH / 2))
    xs = [-half + i * CUT_TEETH / 2 for i in range(n + 1)]
    bm = bmesh.new()
    rings = []
    for y in (-half, half):
        top = [bm.verts.new((x, y, zigzag(x) + hi)) for x in xs]
        bottom = [bm.verts.new((x, y, zigzag(x) + lo)) for x in reversed(xs)]
        rings.append(top + bottom)
    bm.faces.new(rings[0])
    bm.faces.new(list(reversed(rings[1])))
    k = len(rings[0])
    for i in range(k):
        j = (i + 1) % k
        bm.faces.new((rings[0][i], rings[1][i], rings[1][j], rings[0][j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(cut_mat())
    obj.hide_render = True
    obj.parent = arm
    obj.matrix_parent_inverse = arm.matrix_world.inverted()
    return obj


def cut_mat():
    """The cut faces: flat gold light; back faces culled so their outline shell doesn't show."""
    m = toon('cut')
    m.use_backface_culling = True
    return m


def intersect(obj, cutter):
    """Keeps the part of `obj` inside `cutter`, after its rig and thickness, before its outline."""
    mod = obj.modifiers.new('cut', 'BOOLEAN')
    mod.operation = 'INTERSECT'
    mod.solver = 'EXACT'
    mod.material_mode = 'TRANSFER'
    mod.object = cutter
    names = [m.name for m in obj.modifiers]
    if 'outline' in names:
        obj.modifiers.move(len(names) - 1, names.index('outline'))


def band_copy(obj):
    """A copy of `obj` drawn in the white band's material, without an outline."""
    band = obj.copy()
    band.data = obj.data.copy()
    band.name = obj.name + '_band'
    bpy.context.collection.objects.link(band)
    if 'outline' in band.modifiers:
        band.modifiers.remove(band.modifiers['outline'])
    for i in range(len(band.data.materials)):
        band.data.materials[i] = toon('cutband')
    return band


def world_z_range(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    zs = [(ev.matrix_world @ Vector(c)).z for c in ev.bound_box]
    return min(zs), max(zs)


def cmd_shreds(spec, out_dir='assets/art-src'):
    """
    The Blessed torn in half (M12 §4.2.1): the upper half, the lower half and the sword, each
    rendered alone in the idle pose with the gold cut toward the camera, composited onto flat
    green as shred-blessed-<piece>.png, and their heights in shred-blessed.json.
    """
    import json
    import numpy as np
    from mathutils import Matrix
    from common import SUPERSAMPLE, apply_pose, crop, ink_frame, render_to_array, reset_scene, save_array, setup_camera

    os.makedirs(out_dir, exist_ok=True)
    scene = reset_scene()
    arm = spec.build()
    pose = pose_idle(0)
    apply_pose(arm, pose, spec.contact)
    bpy.data.objects['halo'].hide_render = True
    cam = setup_camera(scene, spec.canvas, spec.px_per_m * SUPERSAMPLE)
    bpy.context.view_layer.update()

    # Sort the parts: the sword alone; arms whole to the upper half; the rest by the cut's band.
    pieces = {'upper': [], 'lower': [], 'sword': []}
    cut = []
    for obj in list(bpy.data.objects):
        if obj.type != 'MESH' or obj.name == 'halo':
            continue
        if obj.name in SWORD_PARTS:
            pieces['sword'].append(obj)
        elif obj.parent_type == 'BONE' and obj.parent_bone.startswith(ARM_BONES):
            pieces['upper'].append(obj)
        else:
            z0, z1 = world_z_range(obj)
            if z0 > CUT_Z + CUT_AMP:
                pieces['upper'].append(obj)
            elif z1 < CUT_Z - CUT_AMP:
                pieces['lower'].append(obj)
            else:
                cut.append(obj)

    # Each cut part becomes four: the upper and lower halves, each with its white band at the cut.
    slabs = {
        'upper': cut_slab('slab_upper', CUT_BAND, 5.0, arm), 'upper_band': cut_slab('slab_upper_band', 0.0, CUT_BAND, arm),
        'lower': cut_slab('slab_lower', -5.0, -CUT_BAND, arm), 'lower_band': cut_slab('slab_lower_band', -CUT_BAND, 0.0, arm),
    }
    for obj in cut:
        bands = {half: band_copy(obj) for half in ('upper', 'lower')}
        lower = obj.copy()
        lower.data = obj.data.copy()
        lower.name = obj.name + '_lower'
        bpy.context.collection.objects.link(lower)
        intersect(obj, slabs['upper'])
        intersect(lower, slabs['lower'])
        for half, band in bands.items():
            intersect(band, slabs[half + '_band'])
        pieces['upper'] += [obj, bands['upper']]
        pieces['lower'] += [lower, bands['lower']]
    print('cut:', ', '.join(o.name for o in cut))

    rest = arm.matrix_world.copy()

    def about(pivot, rot):
        p = Matrix.Translation(pivot)
        return p @ rot.to_4x4() @ p.inverted() @ rest

    # The halves tilt about the left-right axis around the cut: the upper's bottom and the lower's
    # top toward the camera (it looks along +Y).
    pivot = Vector((0, 0, CUT_Z))
    tilt = {'upper': Matrix.Rotation(math.radians(-TILT), 3, 'X'), 'lower': Matrix.Rotation(math.radians(TILT), 3, 'X')}
    # The sword lies diagonally, tip down to the right, its flat toward the camera.
    blade = bpy.data.objects['blade']
    rot = blade.matrix_world.to_3x3()
    d = (rot @ SWORD_DIR).normalized()
    side = (rot @ SWORD_DIR.cross(Vector((0, 0, 1))).normalized()).normalized()
    src = Matrix((d, side, d.cross(side))).transposed()
    a = 1 / math.sqrt(2)
    dt, st = Vector((a, 0, -a)), Vector((a, 0, a))
    dst = Matrix((dt, st, dt.cross(st))).transposed()
    grip = Vector((-0.255, -0.04, 0.79))
    sword_center = blade.matrix_world @ (grip + SWORD_DIR * 0.4)

    meta = {}
    for name, objs in pieces.items():
        shown = set(objs)
        for obj in bpy.data.objects:
            if obj.type == 'MESH':
                obj.hide_render = obj not in shown
        arm.matrix_world = about(sword_center, dst @ src.transposed()) if name == 'sword' else about(pivot, tilt[name])
        bpy.context.view_layer.update()
        arr = render_to_array(scene, os.path.join(out_dir, 'shreds.tmp.png'))
        img, _, _ = crop(ink_frame(arr, SUPERSAMPLE, spec.px_per_m), 0, 0)
        rows = np.nonzero((img[..., 3] >= 0.5).any(axis=1))[0]
        meta[name] = {'heightM': round((rows.max() - rows.min() + 1) / spec.px_per_m, 3)}
        h, w, _ = img.shape
        out = np.zeros((h + 2 * GREEN_PAD, w + 2 * GREEN_PAD, 4), dtype=np.float32)
        out[...] = (0, 1, 0, 1)
        a_ = img[..., 3:4]
        out[GREEN_PAD:GREEN_PAD + h, GREEN_PAD:GREEN_PAD + w, :3] = img[..., :3] * a_ + np.array((0, 1, 0)) * (1 - a_)
        save_array(out, os.path.join(out_dir, f'shred-blessed-{name}.png'))
        print(f'shred-blessed-{name}: {w}x{h}, {meta[name]["heightM"]} m')
    os.remove(os.path.join(out_dir, 'shreds.tmp.png'))
    with open(os.path.join(out_dir, 'shred-blessed.json'), 'w', encoding='utf8', newline='\n') as f:
        f.write(json.dumps(meta, indent=2) + '\n')


if __name__ == '__main__':
    main(SPEC, __doc__, {'shreds': cmd_shreds})
