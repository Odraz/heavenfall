"""Stray-Carrier: Cherub rig with closed eyes, elongated arms and a trailing burial shroud.
blender -b --factory-startup -P scripts/blender/carrier.py -- sprites assets/sprites/carrier
References: assets/art-src/reference/carrier-{design,turnaround,wings,shroud}.png.
"""
import math
import os
import sys
import bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cherub as base
from common import PAL, Pose, Spec, bind_rigid, sphere, robe_panel, main

PAL['silk'] = (0.97, 0.95, 0.89)
base.BONES['shroud'] = ((0, 0.10, 0.52), (0, 0.13, -0.6), 'chest')


def build_model():
    arm = base.build_model()
    for sx in (-1, 1):
        bpy.data.objects[f'eyehole{sx}'].scale.z *= 0.20
    # Make the existing arm meshes and hand targets longer without changing the flying headroom.
    for name in ('bowhand', 'drawhand'):
        arm.pose.bones[name].location.z -= 0.10
    for side, sx in (('R', -1), ('L', 1)):
        obj = sphere('long-vambrace.' + side, (sx * 0.17, 0, 0.33), (0.039, 0.04, 0.12), 'gold', outline=0.004)
        bind_rigid(obj, arm, 'forearm.' + side)
    obj = robe_panel('burial-shroud', 0.6, 2 * math.pi - 0.6, 0.55, -0.8, 0.14, 0.12, 0.23, 0.21,
                     trim=0, mats=('silk', 'silk'), thickness=0.008, outline=0.005)
    bind_rigid(obj, arm, 'shroud')
    return arm


def drape(pose, t, carry=False):
    pose.rots['shroud'] = (-18 if carry else 8 * math.sin(2 * math.pi * t), 6 * math.sin(2 * math.pi * t), 0)
    if carry:
        pose.locs['bowhand'] = (0, -0.08, -0.18)
        pose.locs['drawhand'] = (0, -0.08, -0.18)
    return pose


def shriek(t):
    p = base.pose_fly(t)
    p.rots['head'] = (-30 * t, 0, 0)
    base.wings(p.rots, 40 * t)
    return drape(p, t)


def swoop(t):
    p = base.pose_fly(t)
    p.rots['spine'] = (40, 0, 0)
    base.wings(p.rots, -25, 30)
    return drape(p, t)


SPEC = Spec(build_model, {
    'idle': (1, lambda t: drape(base.pose_fly(0), 0), True),
    'fly': (6, lambda t: drape(base.pose_fly(t), t), True),
    'cast': (6, base.pose_cast, False), 'mark': (6, shriek, False), 'swoop': (4, swoop, False),
    'carry': (6, lambda t: drape(base.pose_fly(t), t, True), True),
    'pain': (3, base.pose_pain, False), 'death': (8, base.pose_death, False),
}, px_per_m=160, canvas=(-1.7, 1.7, -1.3, 1.55), directions=5, after_pose=base.after_pose)
if __name__ == '__main__':
    main(SPEC)
