"""Armored Dominion, using the game's shared rig, toon materials and atlas renderer.

blender -b --factory-startup -P scripts/blender/dominion.py -- sprites assets/sprites/dominion
References: assets/art-src/reference/dominion-{design,turnaround,mace,wings}.png.
"""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import PAL, Pose, Spec, bind_rigid, box, keys, main, sphere, torus, tube
from blessed import BONES, build_armature, guard, pose_walk, pose_pain, pose_death

PAL.update({'ivory': (0.94, 0.90, 0.79), 'gold': (0.90, 0.70, 0.27),
            'bronze': (0.36, 0.25, 0.14), 'joint': (0.19, 0.17, 0.15),
            'blue': (0.66, 0.80, 0.90), 'eye': (1, 0.94, 0.68)})


def build_model():
    arm = build_armature(BONES)

    def rigid(obj, bone):
        bind_rigid(obj, arm, bone)
        return obj

    rigid(tube('waist', (0, 0, 0.90), (0, 0, 1.17), 0.17, 0.21, 'joint', squash=0.72), 'spine')
    rigid(sphere('breastplate', (0, -0.015, 1.18), (0.255, 0.155, 0.24), 'ivory'), 'spine')
    for sx in (-1, 1):
        rigid(box('chest-gold', (sx * 0.085, -0.16, 1.22), (0.022, 0.025, 0.24), 'gold', rot=(0, sx * 0.7, 0)), 'spine')
    rigid(sphere('gem', (0, -0.183, 1.22), (0.024, 0.015, 0.042), 'blue'), 'spine')
    rigid(torus('collar', (0, 0, 1.38), 0.078, 0.026, 'gold'), 'chest')
    rigid(sphere('closed-bronze-helm', (0, -0.015, 1.52), (0.095, 0.105, 0.13), 'bronze'), 'head')
    rigid(box('helm-ridge', (0, -0.119, 1.49), (0.015, 0.018, 0.17), 'gold'), 'head')
    for sx in (-1, 1):
        rigid(sphere('eye-slit', (sx * 0.039, -0.11, 1.54), (0.025, 0.012, 0.008), 'eye', outline=0.003), 'head')
    rigid(torus('belt', (0, 0, 0.96), 0.172, 0.032, 'gold', scale=(1, 0.8, 1)), 'hips')
    rigid(sphere('buckle', (0, -0.15, 0.96), (0.045, 0.025, 0.045), 'gold'), 'hips')
    rigid(box('tabard', (0, -0.14, 0.64), (0.19, 0.04, 0.54), 'ivory'), 'skirt_front')
    for sx, side in ((-1, 'R'), (1, 'L')):
        rigid(sphere('pauldron', (sx * 0.23, 0, 1.34), (0.14, 0.15, 0.14), 'ivory'), f'shoulder.{side}')
        rigid(torus('shoulder-rim', (sx * 0.23, 0, 1.27), 0.14, 0.018, 'gold'), f'shoulder.{side}')
        rigid(tube('arm', (sx * 0.23, 0, 1.26), (sx * 0.25, 0, 1.06), 0.077, 0.068, 'ivory'), f'upper_arm.{side}')
        rigid(tube('vambrace', (sx * 0.25, 0, 1.06), (sx * 0.255, -0.03, 0.83), 0.079, 0.052, 'ivory'), f'forearm.{side}')
        rigid(torus('cuff', (sx * 0.255, -0.03, 0.86), 0.056, 0.013, 'gold'), f'forearm.{side}')
        rigid(sphere('gauntlet', (sx * 0.255, -0.04, 0.79), (0.058, 0.057, 0.07), 'ivory'), f'hand.{side}')
        rigid(tube('thigh', (sx * 0.095, 0, 0.88), (sx * 0.10, 0, 0.5), 0.09, 0.07, 'ivory'), f'thigh.{side}')
        rigid(sphere('knee', (sx * 0.10, -0.025, 0.5), (0.075, 0.078, 0.08), 'gold'), f'shin.{side}')
        rigid(tube('greave', (sx * 0.10, 0, 0.47), (sx * 0.10, 0.01, 0.09), 0.078, 0.055, 'ivory'), f'shin.{side}')
        rigid(sphere('boot', (sx * 0.10, -0.055, 0.075), (0.072, 0.13, 0.075), 'ivory'), f'foot.{side}')
        # Layered folded feathers make the silhouette distinct from the Blessed.
        rigid(tube('wing-spine', (sx * 0.14, 0.12, 1.28), (sx * 0.31, 0.16, 1.61), 0.07, 0.06, 'ivory'), 'chest')
        for j in range(9):
            x = sx * (0.25 + j * 0.027)
            rigid(sphere('flight-feather', (x, 0.17 + j * 0.012, 0.97 - j * 0.02),
                         (0.055, 0.035, 0.59 - j * 0.012), 'ivory', rot=(0, sx * -0.10, 0), outline=0.005), 'chest')
    rigid(tube('mace-shaft', (-0.255, -0.08, 0.33), (-0.255, -0.08, 1.5), 0.018, 0.022, 'gold'), 'hand.R')
    rigid(sphere('mace-core', (-0.255, -0.08, 1.52), (0.10, 0.10, 0.17), 'gold', seg=8), 'hand.R')
    for j in range(6):
        angle = j * math.pi / 3
        rigid(box('mace-flange', (-0.255 + 0.08 * math.cos(angle), -0.08 + 0.08 * math.sin(angle), 1.52),
                  (0.12, 0.022, 0.27), 'gold', rot=(0, 0, angle)), 'hand.R')
    return arm


def pose_cast(t):
    r = guard()
    # Six windup frames, impact and recover: matches client/enemyAnim.ts.
    lift = keys([(0, 0), (0.625, 1), (0.75, 0.15), (1, 0)], t)
    r['upper_arm.R'] = (-135 * lift, 0, -12 * lift)
    r['forearm.R'] = (-12 - 42 * lift, 0, 0)
    r['spine'] = (6 - 12 * lift + (20 if t >= 0.75 else 0), 0, 0)
    return Pose(r)


SPEC = Spec(build_model, {'idle': (1, lambda t: Pose(guard()), True), 'walk': (8, pose_walk, True),
                         'cast': (8, pose_cast, True), 'pain': (3, pose_pain, False), 'death': (8, pose_death, False)},
            px_per_m=190, canvas=(-2, 2, -0.4, 2.8), directions=5)

if __name__ == '__main__':
    main(SPEC)
