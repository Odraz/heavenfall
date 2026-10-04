"""
Builds the Gatekeeper in Blender from primitives, rigs and animates it, and renders sprite frames.
The look follows assets/art-src/reference/gatekeeper-front.png and gatekeeper-turnaround.png.
Shared code and the commands are in common.py.

Run with Blender 5.2 (headless):
  blender -b --factory-startup -P scripts/blender/gatekeeper.py -- <command> [args]

The model is built at a 2 m human scale and the armature is scaled up SCALE times, so it stands
6 m tall in the game. Bone positions and pose offsets are in the unscaled units.
"""
import math
import os
import sys

from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (EMISSIVE, PAL, Pose, Spec, add, bind_rigid, bind_skirt, box, build_armature, feather,  # noqa: E402
                    keys, lerp, main, robe_panel, smooth, sphere, sweep, torus, tube)

SCALE = 3.0

# ---------------------------------------------------------------- palette

PAL.update({
    'marble': (0.94, 0.93, 0.90),
    'ivory': (0.95, 0.91, 0.80),
    'gold': (0.90, 0.72, 0.32),
    'blue': (0.68, 0.82, 0.92),
    'feather': (0.96, 0.96, 0.97),
    'pupil': (0.36, 0.26, 0.12),
    'eye': (1.0, 0.97, 0.80),
})
EMISSIVE.add('eye')

# ---------------------------------------------------------------- armature

HAND_R = Vector((-0.30, -0.13, 1.12))   # grips the key
HAND_L = Vector((0.33, -0.03, 0.97))
WING_ROOTS = {1: 1.48, 2: 1.40, 3: 1.30}  # upper, middle and lower wing roots, by height

# name: (head, tail, parent)
BONES = {
    'root': ((0, 0, 0), (0, 0.15, 0), None),
    'hips': ((0, 0, 1.00), (0, 0, 1.12), 'root'),
    'spine': ((0, 0, 1.12), (0, 0, 1.32), 'hips'),
    'chest': ((0, 0, 1.32), (0, 0, 1.55), 'spine'),
    'neck': ((0, 0, 1.55), (0, 0, 1.63), 'chest'),
    'head': ((0, 0, 1.63), (0, 0, 1.90), 'neck'),
    'skirt_front': ((0, -0.15, 1.02), (0, -0.19, 0.35), 'hips'),
    'skirt_back': ((0, 0.14, 1.02), (0, 0.19, 0.25), 'hips'),
}
for side, sx in (('R', -1), ('L', 1)):
    hand = HAND_R if side == 'R' else HAND_L
    elbow = Vector((0.31 * sx, 0.02, 1.22))
    BONES.update({
        f'shoulder.{side}': ((0.05 * sx, 0, 1.50), (0.23 * sx, 0, 1.50), 'chest'),
        f'upper_arm.{side}': ((0.26 * sx, 0, 1.48), tuple(elbow), f'shoulder.{side}'),
        f'forearm.{side}': (tuple(elbow), tuple(hand), f'upper_arm.{side}'),
        f'hand.{side}': (tuple(hand), tuple(hand + Vector((0, -0.02, -0.08))), f'forearm.{side}'),
        f'thigh.{side}': ((0.11 * sx, 0, 0.96), (0.115 * sx, 0, 0.54), 'hips'),
        f'shin.{side}': ((0.115 * sx, 0, 0.54), (0.115 * sx, 0.01, 0.10), f'thigh.{side}'),
        f'foot.{side}': ((0.115 * sx, 0.01, 0.10), (0.115 * sx, -0.14, 0.03), f'shin.{side}'),
    })
    for w, z in WING_ROOTS.items():
        BONES[f'wing{w}.{side}'] = ((0.08 * sx, 0.12, z), (0.40 * sx, 0.16, z + 0.2), 'chest')


def build_wing(name, sx, root, wrist, prim, sec):
    """
    One wing: a bone arm from `root` to `wrist`, primaries fanning from the wrist and secondaries
    hanging from the arm, at angles from the outward horizontal (90 is straight up). `prim` and `sec`
    are (angle0, angle1, length0, length1). Golden eyes are set in the feathers, as in the reference.
    """
    root, wrist = Vector(root), Vector(wrist)
    objs = [sweep(f'{name}arm', [root, root.lerp(wrist, 0.5) + Vector((0, 0, 0.03)), wrist], [0.024, 0.028, 0.02], 'feather', seg=10, outline=0.006)]

    def fan(kind, count, base_of, angles, lengths, width):
        for k in range(count):
            f = k / (count - 1)
            ang = math.radians(lerp(*angles, f))
            d = Vector((math.cos(ang) * sx, 0.02, math.sin(ang)))
            base = base_of(f)
            length = lerp(*lengths, f)
            objs.append(feather(f'{name}{kind}{k}', base, d, length, width, 'feather', thick=0.012, outline=0.006))
            if k % 2 == 1:
                # An eye two thirds of the way along the feather, facing forward.
                c = base + d * length * 0.62 + Vector((0, -0.016, 0))
                objs.append(sphere(f'{name}{kind}eye{k}', c, (0.032, 0.008, 0.019), 'gold', seg=10, outline=0.003))
                objs.append(sphere(f'{name}{kind}pupil{k}', c + Vector((0, -0.006, 0)), (0.011, 0.006, 0.011), 'pupil', seg=8, outline=0.0))

    fan('p', 7, lambda f: wrist + (wrist - root).normalized() * 0.05 * f, prim[:2], prim[2:], 0.12)
    fan('s', 5, lambda f: root.lerp(wrist, 0.15 + 0.8 * f) + Vector((0, 0.008, 0)), sec[:2], sec[2:], 0.13)
    return objs


# ---------------------------------------------------------------- the model

def build_model():
    arm = build_armature(BONES)
    parts = []  # (object, bone)

    def rigid(obj, bone):
        for o in obj if isinstance(obj, list) else [obj]:
            parts.append((o, bone))
        return obj

    # Head: a faceless golden helm, egg-shaped, with a single glowing eye and a crest.
    rigid(sphere('helm', (0, 0.0, 1.76), (0.10, 0.115, 0.135), 'gold', outline=0.009), 'head')
    rigid(sweep('helmpeak', [(0, 0.01, 1.84), (0, 0.0, 1.90), (0, -0.02, 1.94)], [0.06, 0.035, 0.0], 'gold', seg=12, outline=0.006), 'head')
    rigid(box('crest', (0, 0.02, 1.88), (0.014, 0.20, 0.03), 'gold', outline=0.004), 'head')
    rigid(sphere('eye', (0, -0.108, 1.765), (0.026, 0.012, 0.022), 'eye', seg=14, outline=0.004), 'head')
    rigid(torus('eyering', (0, -0.11, 1.765), 0.032, 0.007, 'gold', rot=(math.pi / 2, 0, 0), seg=16, outline=0.003), 'head')
    rigid(box('faceridge', (0, -0.112, 1.71), (0.014, 0.012, 0.07), 'gold', outline=0.003), 'head')
    rigid(torus('gorget', (0, 0, 1.60), 0.09, 0.03, 'gold', outline=0.006), 'neck')

    # Torso: a marble cuirass with gold filigree rims, a pale-blue sash and a gold disc.
    rigid(tube('torso', (0, 0, 1.05), (0, 0, 1.58), 0.17, 0.20, 'marble', squash=0.72, seg=18, outline=0.009), 'spine')
    rigid(sphere('cuirass', (0, -0.04, 1.40), (0.205, 0.145, 0.17), 'marble', outline=0.008), 'chest')
    for sx in (-1, 1):
        rigid(box(f'filigree{sx}', (0.055 * sx, -0.172, 1.42), (0.022, 0.016, 0.22), 'gold', rot=(0.1, 0, 0.42 * sx), outline=0.004), 'chest')
    rigid(sphere('chestgem', (0, -0.183, 1.36), (0.025, 0.012, 0.03), 'blue', seg=10, outline=0.003), 'chest')
    rigid(torus('sash', (0, 0, 1.05), 0.18, 0.03, 'blue', scale=(1.05, 0.80, 1.0), outline=0.006), 'hips')
    rigid(sphere('sashdisc', (0, -0.155, 1.05), (0.045, 0.015, 0.045), 'gold', seg=14, outline=0.005), 'hips')

    # The tabard: gold-trimmed panels over the legs, longer at the back.
    skirt = [
        (robe_panel('tabard_front', -0.45, 0.45, 1.02, 0.30, 0.18, 0.15, 0.21, 0.19, trim=0.14, push=0.012,
                    mats=('ivory', 'gold')), 'skirt_front'),
        (robe_panel('tabard_back', math.pi - 0.55, math.pi + 0.55, 1.02, 0.15, 0.18, 0.15, 0.24, 0.22, trim=0.12,
                    mats=('ivory', 'gold')), 'skirt_back'),
    ]
    rigid(sphere('tabardsigil', (0, -0.18, 0.70), (0.04, 0.012, 0.06), 'gold', seg=10, outline=0.003), 'hips')

    for side, sx in (('R', -1), ('L', 1)):
        hand = HAND_R if side == 'R' else HAND_L
        elbow = Vector(BONES[f'forearm.{side}'][0])
        # Pauldrons: layered marble domes with gold rims.
        rigid(sphere(f'pauldron.{side}', (0.27 * sx, 0, 1.51), (0.12, 0.12, 0.09), 'marble', outline=0.008), f'shoulder.{side}')
        rigid(torus(f'pauldronrim.{side}', (0.28 * sx, 0, 1.46), 0.11, 0.014, 'gold', rot=(0, 0.35 * sx, 0), outline=0.004), f'shoulder.{side}')
        rigid(sphere(f'pauldron2.{side}', (0.30 * sx, 0, 1.42), (0.10, 0.11, 0.065), 'marble', outline=0.007), f'shoulder.{side}')
        # Arms: marble upper arm, gold bracer, marble gauntlet.
        rigid(tube(f'upperarm.{side}', (0.26 * sx, 0, 1.48), elbow, 0.065, 0.06, 'marble'), f'upper_arm.{side}')
        rigid(sphere(f'elbow.{side}', elbow, (0.06, 0.06, 0.06), 'gold', seg=12, outline=0.005), f'upper_arm.{side}')
        rigid(tube(f'forearm.{side}', elbow, hand, 0.058, 0.05, 'gold', outline=0.006), f'forearm.{side}')
        rigid(sphere(f'gauntlet.{side}', hand + Vector((0, -0.01, -0.03)), (0.05, 0.055, 0.06), 'marble', seg=12, outline=0.006), f'hand.{side}')
        # Legs: marble thighs, gold knees, marble greaves with gold trim, gold sabatons.
        rigid(tube(f'thigh.{side}', (0.11 * sx, 0, 0.96), (0.115 * sx, 0, 0.56), 0.08, 0.068, 'marble'), f'thigh.{side}')
        rigid(sphere(f'knee.{side}', (0.115 * sx, -0.05, 0.54), (0.065, 0.055, 0.065), 'gold', seg=14, outline=0.006), f'shin.{side}')
        rigid(tube(f'greave.{side}', (0.115 * sx, 0, 0.50), (0.115 * sx, 0.01, 0.12), 0.066, 0.055, 'marble'), f'shin.{side}')
        rigid(torus(f'greaverim.{side}', (0.115 * sx, 0.01, 0.13), 0.058, 0.012, 'gold', outline=0.004), f'shin.{side}')
        rigid(sphere(f'sabaton.{side}', (0.115 * sx, -0.045, 0.05), (0.06, 0.12, 0.05), 'gold', seg=14, outline=0.006), f'foot.{side}')

        # Six wings: two raised, two spread, two lowered, each with eyes in its feathers.
        rigid(build_wing(f'wing1{side}', sx, (0.08 * sx, 0.12, 1.48), (0.40 * sx, 0.17, 1.82), (75, 25, 0.62, 0.50), (-20, 30, 0.38, 0.50)), f'wing1.{side}')
        rigid(build_wing(f'wing2{side}', sx, (0.08 * sx, 0.14, 1.40), (0.50 * sx, 0.19, 1.50), (15, -40, 0.62, 0.48), (-75, -40, 0.35, 0.48)), f'wing2.{side}')
        rigid(build_wing(f'wing3{side}', sx, (0.08 * sx, 0.16, 1.30), (0.40 * sx, 0.20, 1.08), (-40, -95, 0.62, 0.50), (-100, -70, 0.35, 0.45)), f'wing3.{side}')

    # The giant golden key, held upright in the right hand: the bit at the top, the ornate bow below.
    k = HAND_R + Vector((0, -0.02, 0))
    top, bottom = k + Vector((0, 0, 0.85)), k + Vector((0, 0, -0.88))
    rigid(tube('keyshaft', bottom + Vector((0, 0, 0.12)), top, 0.026, 0.026, 'gold', seg=10, outline=0.006), 'hand.R')
    rigid(torus('keycollar', k + Vector((0, 0, -0.62)), 0.04, 0.014, 'gold', seg=14, outline=0.004), 'hand.R')
    # The bit: notched blocks off the shaft's top, toward the outside.
    for i, (dz, dx, h) in enumerate(((0.0, 0.10, 0.07), (-0.10, 0.07, 0.05), (-0.18, 0.11, 0.06))):
        rigid(box(f'keybit{i}', top + Vector((-dx / 2 - 0.02, 0, dz - 0.04)), (dx, 0.04, h), 'gold', outline=0.005), 'hand.R')
    rigid(sphere('keytop', top + Vector((0, 0, 0.02)), (0.035, 0.035, 0.035), 'gold', seg=12, outline=0.005), 'hand.R')
    # The bow: an ornate ring with a quatrefoil inside.
    bow = bottom + Vector((0, 0, 0.02))
    rigid(torus('keybow', bow, 0.12, 0.022, 'gold', rot=(math.pi / 2, 0, 0), seg=28, outline=0.006), 'hand.R')
    for i in range(4):
        a = math.pi / 2 * i + math.pi / 4
        rigid(torus(f'keyfoil{i}', bow + Vector((math.cos(a) * 0.05, 0, math.sin(a) * 0.05)), 0.04, 0.012, 'gold',
                    rot=(math.pi / 2, 0, 0), seg=16, outline=0.004), 'hand.R')
    rigid(sphere('keyjewel', bow + Vector((0, -0.01, 0)), (0.03, 0.02, 0.04), 'blue', seg=10, outline=0.004), 'hand.R')

    for obj, bone in parts:
        bind_rigid(obj, arm, bone)
    for obj, bone in skirt:
        bind_skirt(obj, arm, bone, z_top=1.02, z_free=0.85)
    arm.scale = (SCALE,) * 3
    return arm


# ---------------------------------------------------------------- animations

def wings(r, lift=(0, 0, 0), back=0.0):
    """Raises the upper, middle and lower wing pairs by `lift` degrees each, and sweeps them back."""
    for w, a in zip((1, 2, 3), lift):
        r[f'wing{w}.L'] = (0, -a, back)
        r[f'wing{w}.R'] = (0, a, -back)


def stance():
    """The standing pose: perfectly upright and symmetric, the key planted, the left hand open."""
    r = {'upper_arm.L': (0, 0, 0), 'forearm.L': (-6, 0, 0)}
    wings(r)
    return r


def pose_idle(t):
    return Pose(stance())


def pose_volley(t):
    """
    The Orb Volley: frames 1–3 (t up to 2/3) raise the open left hand toward the target as the
    wings lift; frame 4 thrusts it forward as the orbs fly.
    """
    k = t * 3
    reach = keys([(0, 0.15), (1, 0.55), (2, 0.85), (3, 1.0)], k)
    r = stance()
    r['upper_arm.L'] = (-80 * reach, 0, -12 * reach)
    r['forearm.L'] = (-20 * reach + 10 * max(0.0, k - 2), 0, 0)
    r['hand.L'] = (-40 * reach, 0, 0)
    add(r, 'spine', dx=3 * reach + 5 * max(0.0, k - 2))
    add(r, 'head', dx=6 * reach)
    wings(r, (10 * reach, 6 * reach, -4 * reach), -6 * max(0.0, k - 2))
    return Pose(r)


def pose_judgment(t):
    """
    Judgment, looping every second while it is cast: the left hand raised to the sky, the head
    lifted, every wing flared wide and trembling with the gathering light.
    """
    p = 2 * math.pi * t
    pulse = math.sin(p)
    r = stance()
    r['upper_arm.L'] = (-150, 0, -20 + 4 * pulse)
    r['forearm.L'] = (-10, 0, 0)
    r['hand.L'] = (-30, 0, 0)
    add(r, 'spine', dx=-4)
    add(r, 'head', dx=-14)
    wings(r, (24 + 6 * pulse, 18 + 6 * pulse, 12 + 5 * pulse), 4 * math.cos(p))
    return Pose(r, locs={'hips': (0, 0, 0.01 * pulse)})


def pose_death(t):
    """
    The colossus falls: a stagger, a slow sink to the knees with the wings sagging, then it topples
    forward to lie still; t from 0 to 1 over the frames.
    """
    stagger = keys([(0, 0.6), (0.15, 1.0), (0.4, 0.2), (1, 0)], t)
    kneel = smooth(t / 0.45)
    fall = smooth((t - 0.40) / 0.60) ** 1.6
    r = stance()
    add(r, 'spine', dx=-12 * stagger + 12 * kneel)
    add(r, 'chest', dx=-5 * stagger + 6 * kneel)
    add(r, 'head', dx=-12 * stagger + 18 * kneel)
    r['thigh.L'] = (lerp(0, -22, kneel), 0, 0)
    r['thigh.R'] = (lerp(0, -8, kneel), 0, 0)
    r['shin.L'] = (lerp(0, 110, kneel), 0, 0)
    r['shin.R'] = (lerp(0, 96, kneel), 0, 0)
    r['foot.L'] = (lerp(0, 40, kneel), 0, 0)
    r['foot.R'] = (lerp(0, 40, kneel), 0, 0)
    r['upper_arm.L'] = (-20 * stagger + 10 * kneel - 60 * fall, 0, 0)
    # It leans on the key as it kneels, so the key stays above the floor.
    r['upper_arm.R'] = (-10 * stagger - 40 * kneel - 20 * fall, 0, 0)
    r['forearm.R'] = (-35 * kneel, 0, 0)
    r['hand.R'] = (30 * kneel, 0, 0)
    # The tabard swings out over the knees instead of sinking into the floor.
    r['skirt_front'] = (-62 * kneel, 0, 0)
    r['skirt_back'] = (45 * kneel, 0, 0)
    wings(r, (lerp(10 * stagger, -25, kneel), lerp(6 * stagger, -20, kneel), lerp(0, -10, kneel)), 25 * kneel)
    angle = 84 * fall
    add(r, 'shin.L', dx=-angle)
    add(r, 'shin.R', dx=-angle)
    add(r, 'head', dx=-20 * fall)
    return Pose(r, locs={'hips': (0, 0.04 * stagger, 0)}, fall=angle, pivot_y=-0.17)


# name: (frames, pose function, looping)
ANIMS = {
    'idle': (1, pose_idle, True),
    'volley': (4, pose_volley, False),
    'judgment': (4, pose_judgment, True),
    'death': (8, pose_death, False),
}

# 64 px/m from 5 directions (§11.2); the game mirrors directions 1–3 for 7–5. The canvas, in game
# meters, leaves room for the six wings and the colossus lying on the ground.
SPEC = Spec(build_model, ANIMS, px_per_m=64, canvas=(-6.5, 6.5, -0.5, 8.5), contact=(0.10, 0.03, 0.06), directions=5)

if __name__ == '__main__':
    main(SPEC, __doc__)
