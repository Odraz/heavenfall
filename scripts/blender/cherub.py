"""
Builds the Cherub in Blender from primitives, rigs and animates it, and renders sprite frames.
The look follows assets/art-src/reference/cherub-front.jpg and cherub-turnaround.png. Shared code
and the commands are in common.py.

Run with Blender 5.2 (headless):
  blender -b --factory-startup -P scripts/blender/cherub.py -- <command> [args]

The model's ground point is under its dangling feet; in the game a Cherub flies with its feet
CHERUB_HOVER above the ground, and its corpse falls the rest of the way while it dies.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (PAL, Pose, Spec, add, add_ik, bind_rigid, box, build_armature, feather, keys, main,  # noqa: E402
                    smooth, sphere, sweep, torus, tube)

# ---------------------------------------------------------------- palette

PAL.update({
    'gold': (0.88, 0.70, 0.33),     # polished gold armor
    'mask': (0.93, 0.78, 0.43),
    'trim': (0.70, 0.83, 0.92),     # pale sky-blue bands
    'feather': (0.97, 0.97, 0.98),
    'eyehole': (0.16, 0.12, 0.10),
    'skin': (0.93, 0.80, 0.70),
    'string': (0.92, 0.90, 0.82),
    'shaft': (0.80, 0.62, 0.30),
})

# ---------------------------------------------------------------- armature

# The bow hand (left) and the draw hand (right) hang at the sides at rest; the cast moves them to
# the aim: the bow held out to the left, the string drawn to the right cheek, as in the reference.
BOW_REST = Vector((0.17, -0.05, 0.36))
DRAW_REST = Vector((-0.17, -0.05, 0.36))
BOW_AIM = Vector((0.09, -0.20, 0.58))
NOCK_AIM = Vector((-0.08, -0.09, 0.60))
ARROW_DIR = (BOW_AIM - NOCK_AIM).normalized()
NOCK_REST = BOW_REST - ARROW_DIR * 0.06   # the string's middle, behind the grip

# name: (head, tail, parent)
BONES = {
    'root': ((0, 0, 0), (0, 0.15, 0), None),
    'hips': ((0, 0, 0.34), (0, 0, 0.40), 'root'),
    'spine': ((0, 0, 0.40), (0, 0, 0.48), 'hips'),
    'chest': ((0, 0, 0.48), (0, 0, 0.57), 'spine'),
    'head': ((0, 0, 0.57), (0, 0, 0.78), 'chest'),
    'bowhand': (tuple(BOW_REST), tuple(BOW_REST + Vector((0, 0, 0.05))), 'chest'),
    'nock': (tuple(NOCK_REST), tuple(NOCK_REST + Vector((0, 0, 0.04))), 'bowhand'),
    'drawhand': (tuple(DRAW_REST), tuple(DRAW_REST + Vector((0, 0, 0.05))), 'chest'),
}
ELBOW = {'R': Vector((-0.15, 0.02, 0.45)), 'L': Vector((0.15, 0.02, 0.45))}
for side, sx in (('R', -1), ('L', 1)):
    hand = DRAW_REST if side == 'R' else BOW_REST
    wrist = ELBOW[side] + (hand - ELBOW[side]).normalized() * 0.12
    BONES.update({
        f'upper_arm.{side}': ((0.11 * sx, 0, 0.55), tuple(ELBOW[side]), 'chest'),
        f'forearm.{side}': (tuple(ELBOW[side]), tuple(wrist), f'upper_arm.{side}'),
        f'wing.{side}': ((0.06 * sx, 0.08, 0.55), (0.40 * sx, 0.12, 0.92), 'chest'),
        f'thigh.{side}': ((0.06 * sx, 0, 0.34), (0.065 * sx, -0.02, 0.20), 'hips'),
        f'shin.{side}': ((0.065 * sx, -0.02, 0.20), (0.065 * sx, 0.0, 0.07), f'thigh.{side}'),
        f'foot.{side}': ((0.065 * sx, 0.0, 0.07), (0.065 * sx, -0.03, 0.0), f'shin.{side}'),
    })


def build_wing(side, sx):
    """One wing: a bony arm along the top edge, primaries fanning out and down, secondaries and coverts."""
    root = Vector((0.06 * sx, 0.08, 0.55))
    wrist = Vector((0.40 * sx, 0.12, 0.92))
    tip = Vector((0.95 * sx, 0.16, 0.62))
    normal = Vector((0.0, 1.0, 0.0))
    objs = [sweep(f'wingarm.{side}', [root, root.lerp(wrist, 0.5) + Vector((0, 0, 0.05)), wrist], [0.022, 0.026, 0.02], 'feather', seg=10, outline=0.004)]
    # Primaries: long feathers from the wrist region, fanning from outward to downward.
    for k in range(8):
        f = k / 7
        base = wrist.lerp(wrist + (tip - wrist) * 0.35, f)
        ang = math.radians(lerp(-20, -80, f))  # below horizontal, outward
        d = Vector((math.cos(ang) * sx, 0.01, math.sin(ang)))
        objs.append(feather(f'primary{k}.{side}', base, d, lerp(0.62, 0.48, f), 0.11, 'feather', normal))
    # Secondaries: hanging from the arm between the shoulder and the wrist.
    for k in range(6):
        f = (k + 0.5) / 6
        base = root.lerp(wrist, f) + Vector((0, 0.005, 0.02))
        ang = math.radians(lerp(-95, -82, f))
        d = Vector((math.cos(ang) * sx, 0.0, math.sin(ang)))
        objs.append(feather(f'secondary{k}.{side}', base, d, lerp(0.30, 0.48, f), 0.12, 'feather', normal))
    # Coverts: short rounded feathers over the bases.
    for k in range(5):
        f = (k + 0.3) / 5
        base = root.lerp(wrist, f) + Vector((0, -0.01, 0.03))
        d = Vector((0.25 * sx, -0.01, -1.0))
        objs.append(feather(f'covert{k}.{side}', base, d, 0.20, 0.12, 'feather', normal))
    return objs


def lerp(a, b, t):
    return a + (b - a) * t


# ---------------------------------------------------------------- the model

def build_model():
    arm = build_armature(BONES)
    parts = []  # (object, bone)

    def rigid(obj, bone):
        for o in obj if isinstance(obj, list) else [obj]:
            parts.append((o, bone))
        return obj

    # Head: a round gold helm with an expressionless gold mask and dark eye holes.
    rigid(sphere('helm', (0, 0.01, 0.675), (0.095, 0.10, 0.105), 'gold', outline=0.007), 'head')
    rigid(sphere('mask', (0, -0.035, 0.66), (0.078, 0.07, 0.095), 'mask', outline=0.005), 'head')
    rigid(box('maskridge', (0, -0.103, 0.665), (0.014, 0.012, 0.06), 'mask', outline=0.003), 'head')
    for sx in (-1, 1):
        rigid(sphere(f'eyehole{sx}', (0.03 * sx, -0.095, 0.685), (0.018, 0.012, 0.012), 'eyehole', seg=10, rot=(0, 0.25 * sx, 0), outline=0.0), 'head')
    rigid(box('mouthline', (0, -0.1, 0.618), (0.024, 0.008, 0.004), 'eyehole', outline=0.0), 'head')
    rigid(torus('helmband', (0, 0.01, 0.70), 0.096, 0.01, 'trim', scale=(1.0, 1.05, 1.0), rot=(0.15, 0, 0), outline=0.003), 'head')

    # Torso: a chubby gold cuirass with a sky-blue belt and a short plated skirt.
    rigid(sphere('torso', (0, -0.005, 0.47), (0.125, 0.105, 0.125), 'gold', outline=0.007), 'spine')
    rigid(sphere('chestplate', (0, -0.035, 0.50), (0.10, 0.07, 0.07), 'gold', outline=0.005), 'chest')
    rigid(torus('belt', (0, 0, 0.385), 0.11, 0.014, 'trim', scale=(1.0, 0.85, 1.0), outline=0.004), 'hips')
    rigid(sphere('skirt', (0, 0, 0.35), (0.11, 0.095, 0.05), 'gold', outline=0.006), 'hips')
    # The quiver on the back.
    rigid(tube('quiver', (0.05, 0.11, 0.38), (-0.06, 0.12, 0.62), 0.03, 0.035, 'gold', seg=10, outline=0.005), 'chest')
    rigid(torus('quiverband', (0.0, 0.115, 0.50), 0.034, 0.008, 'trim', rot=(0, 0.42, 0), seg=12, outline=0.003), 'chest')

    for side, sx in (('R', -1), ('L', 1)):
        e = ELBOW[side]
        hand = DRAW_REST if side == 'R' else BOW_REST
        fdir = (hand - e).normalized()
        rigid(sphere(f'pauldron.{side}', (0.10 * sx, 0, 0.55), (0.06, 0.058, 0.045), 'gold', seg=14, outline=0.005), 'chest')
        rigid(tube(f'upperarm.{side}', (0.11 * sx, 0, 0.55), e, 0.045, 0.04, 'gold', outline=0.005), f'upper_arm.{side}')
        rigid(sphere(f'elbow.{side}', e, (0.04, 0.04, 0.04), 'gold', seg=12, outline=0.004), f'upper_arm.{side}')
        rigid(tube(f'forearm.{side}', e, e + fdir * 0.10, 0.04, 0.034, 'gold', outline=0.005), f'forearm.{side}')
        rigid(torus(f'cuff.{side}', e + fdir * 0.09, 0.036, 0.009, 'trim', rot=fdir.to_track_quat('Z', 'Y').to_euler(), seg=12, outline=0.003), f'forearm.{side}')
        rigid(sphere(f'hand.{side}', hand, (0.026, 0.028, 0.03), 'gold', seg=10, outline=0.004), 'drawhand' if side == 'R' else 'bowhand')
        # Legs: chubby gold-plated, sky-blue knee bands, bare feet hanging.
        rigid(sphere(f'thigh.{side}', (0.062 * sx, -0.01, 0.27), (0.06, 0.06, 0.08), 'gold', seg=12, outline=0.005), f'thigh.{side}')
        rigid(torus(f'kneeband.{side}', (0.065 * sx, -0.02, 0.20), 0.045, 0.01, 'trim', seg=12, outline=0.003), f'shin.{side}')
        rigid(sphere(f'shin.{side}', (0.065 * sx, -0.01, 0.135), (0.046, 0.046, 0.068), 'gold', seg=12, outline=0.005), f'shin.{side}')
        rigid(sphere(f'foot.{side}', (0.065 * sx, -0.018, 0.035), (0.03, 0.04, 0.042), 'skin', seg=10, outline=0.004), f'foot.{side}')
        rigid(build_wing(side, sx), f'wing.{side}')

    # The bow: a gold recurve with sky-blue grip wraps, held upright, its belly toward the aim.
    g, d = BOW_REST, ARROW_DIR
    up = Vector((0, 0, 1))
    pts = [g + d * (0.055 * (1 - (v / 0.27) ** 2) - 0.055) + up * v for v in (-0.27, -0.2, -0.12, -0.05, 0.0, 0.05, 0.12, 0.2, 0.27)]
    pts = [pts[0] + d * 0.02 + up * -0.02] + pts + [pts[-1] + d * 0.02 + up * 0.02]
    rigid(sweep('bow', pts, [0.006, 0.009, 0.012, 0.014, 0.016, 0.016, 0.014, 0.012, 0.009, 0.007, 0.004], 'gold', seg=8, outline=0.004), 'bowhand')
    for k, v in enumerate((-0.05, 0.05)):
        rigid(torus(f'bowwrap{k}', g + up * v, 0.019, 0.006, 'trim', seg=10, outline=0.002), 'bowhand')
    # The string: its ends follow the bow, its middle the nock, which the draw pulls back.
    tip_lo, tip_hi = pts[1], pts[-2]
    string = sweep('string', [tip_lo, NOCK_REST, tip_hi], [0.0035, 0.0035, 0.0035], 'string', seg=6, outline=0.0)
    string.parent = arm
    gb, gn = string.vertex_groups.new(name='bowhand'), string.vertex_groups.new(name='nock')
    for v in string.data.vertices:
        w = max(0.0, 1.0 - (v.co - NOCK_REST).length / (tip_hi - NOCK_REST).length)
        gb.add([v.index], 1.0 - w, 'REPLACE')
        gn.add([v.index], w, 'REPLACE')
    mod = string.modifiers.new('rig', 'ARMATURE')
    mod.object = arm
    # The arrow, on the string, pointing through the bow.
    a0, a1 = NOCK_REST - d * 0.02, NOCK_REST + d * 0.40
    rigid(tube('arrowshaft', a0, a1, 0.005, 0.005, 'shaft', seg=6, outline=0.002), 'nock')
    rigid(tube('arrowhead', a1, a1 + d * 0.05, 0.016, 0.0, 'gold', seg=6, outline=0.003), 'nock')
    for k in range(3):
        a = 2 * math.pi * k / 3
        off = (d.cross(up) * math.cos(a) + up * math.sin(a)) * 0.014
        rigid(tube(f'fletch{k}', a0 + off * 0.3, a0 + d * 0.07 + off, 0.008, 0.004, 'feather', seg=4, squash=0.3, outline=0.002), 'nock')

    for obj, bone in parts:
        bind_rigid(obj, arm, bone)
    add_ik(arm, 'forearm.R', 'drawhand')
    add_ik(arm, 'forearm.L', 'bowhand')
    return arm


ARROW_PARTS = ('arrowshaft', 'arrowhead', 'fletch0', 'fletch1', 'fletch2')


def after_pose(pose):
    for name in ARROW_PARTS:
        bpy.data.objects[name].hide_render = not pose.extra.get('arrow', False)


# ---------------------------------------------------------------- animations

def wings(r, lift, sweep_back=0.0):
    """Raises both wings by `lift` degrees (negative lowers them), and sweeps them back."""
    r['wing.L'] = (0, -lift, sweep_back)
    r['wing.R'] = (0, lift, -sweep_back)


def hover():
    """The hovering pose: a slight forward lean, legs dangling, the bow lowered at the side."""
    r = {'spine': (6, 0, 0), 'head': (-4, 0, 0),
         'thigh.L': (-12, 0, 0), 'thigh.R': (-4, 0, 0), 'shin.L': (18, 0, 0), 'shin.R': (10, 0, 0),
         'foot.L': (10, 0, 0), 'foot.R': (6, 0, 0)}
    wings(r, 0)
    return r


def aim(t, nock_pull):
    """Bone offsets for the bow raised by `t` (0–1) and the string drawn by `nock_pull` (0–1)."""
    bow = (BOW_AIM - BOW_REST) * t
    nock = (NOCK_AIM - (BOW_AIM - ARROW_DIR * 0.06)) * nock_pull
    draw_target = (NOCK_REST + bow + nock) - DRAW_REST
    draw = (DRAW_REST + (draw_target * min(1.0, t * 1.5))) - DRAW_REST
    return {'bowhand': tuple(bow), 'nock': tuple(nock), 'drawhand': tuple(draw)}


def pose_fly(t):
    """One wingbeat; t in [0, 1) is the 0.5 s cycle. The body rises on the downstroke."""
    p = 2 * math.pi * t
    r = hover()
    wings(r, 38 * math.cos(p), 8 * math.sin(p))
    add(r, 'thigh.L', dx=6 * math.sin(p))
    add(r, 'thigh.R', dx=-6 * math.sin(p))
    add(r, 'head', dx=3 * math.sin(p))
    return Pose(r, locs={'hips': (0, 0, 0.035 * math.sin(p))}, grounded=False)


def pose_cast(t):
    """
    The shot: frames 1–4 (t up to 3/5) raise the bow, nock an arrow and draw to the cheek, held;
    frames 5–6 release it, the string snapping back and the draw hand flying open.
    """
    k = t * 5
    raise_ = keys([(0, 0.15), (1, 0.8), (2, 1.0), (5, 1.0)], k)
    pull = keys([(0, 0), (1, 0.15), (2, 0.6), (3, 1.0), (3.5, 1.0), (4, 0.0), (5, 0.0)], k)
    r = hover()
    wings(r, keys([(0, 10), (3, 18), (4, -10), (5, 5)], k))
    add(r, 'spine', dx=-4 * raise_)
    locs = aim(raise_, pull)
    if k >= 3.5:
        # Follow-through: the draw hand springs back past the cheek.
        follow = keys([(3.5, 0), (4, 1), (5, 0.6)], k)
        x, y, z = locs['drawhand']
        locs['drawhand'] = (x - 0.05 * follow, y + 0.04 * follow, z + 0.02 * follow)
    return Pose(r, locs=locs, grounded=False, arrow=1 <= k < 3.5)


def pose_pain(t):
    """A jolt; three frames at t = 0, 0.5, 1."""
    j = keys([(0, 0.7), (0.5, 1.0), (1, 0.4)], t)
    r = hover()
    add(r, 'spine', dx=-18 * j)
    add(r, 'head', dx=-16 * j, dy=10 * j)
    add(r, 'thigh.L', dx=-14 * j)
    add(r, 'thigh.R', dx=-10 * j)
    wings(r, 35 * j, 10 * j)
    return Pose(r, locs={'hips': (0, 0.03 * j, 0.02 * j)}, grounded=False)


def pose_death(t):
    """
    Struck from the air: a recoil, the wings crumpling, a forward tumble, and the Cherub lands face
    down with its wings limp across the floor; t from 0 to 1 over the frames.
    """
    recoil = keys([(0, 0.7), (0.15, 1.0), (0.4, 0.2), (1, 0)], t)
    crumple = smooth(t / 0.5)
    fall = smooth((t - 0.2) / 0.8) ** 1.5
    r = hover()
    add(r, 'spine', dx=-16 * recoil + 10 * fall)
    add(r, 'head', dx=-14 * recoil + 10 * fall)
    wings(r, lerp(30 * recoil, -25, crumple) + 20 * fall, 25 * crumple - 15 * fall)
    add(r, 'thigh.L', dx=-20 * crumple + 18 * fall)
    add(r, 'thigh.R', dx=-6 * crumple + 18 * fall)
    add(r, 'shin.L', dx=10 * crumple)
    return Pose(r, locs={'hips': (0, 0.03 * recoil, 0)}, fall=88 * fall, pivot_y=-0.11)


# name: (frames, pose function, looping)
ANIMS = {
    'fly': (6, pose_fly, True),
    'cast': (6, pose_cast, False),
    'pain': (3, pose_pain, False),
    'death': (8, pose_death, False),
}


def idle_fly(t):
    r = hover()
    wings(r, 8)
    return Pose(r, grounded=False)


# 160 px/m (§11.2); the canvas leaves room for the wings in any direction and the body on the floor.
# `model` previews the hover with the wings level.
SPEC = Spec(build_model, dict(ANIMS, idle=(1, idle_fly, True)), px_per_m=160, canvas=(-1.3, 1.3, -0.3, 1.4),
            contact=(0.07, 0.0, 0.05), after_pose=after_pose)

if __name__ == '__main__':
    if 'sprites' in sys.argv:
        SPEC.anims = ANIMS
    main(SPEC, __doc__)
