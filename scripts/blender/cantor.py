"""Lectern Cantor: shared Dominion toon renderer, eight real views of the bronze hymnal.
blender -b --factory-startup -P scripts/blender/cantor.py -- sprites assets/sprites/cantor
References: assets/art-src/reference/cantor-{design,turnaround,hymnal}.png.
"""
import math
import os
import sys
import bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chorister as base
from common import PAL, EMISSIVE, Pose, Spec, bind_rigid, box, sphere, torus, tube, robe_panel, main

PAL.update({'bronze': (0.36, 0.25, 0.14), 'paper': (1, 0.94, 0.68), 'flame': (1, 0.72, 0.22)})
EMISSIVE.update({'paper', 'flame'})
for side in ('L', 'R'):
    base.BONES['book.' + side] = ((0, -0.36, 1.15), (0, -0.36, 1.7), 'chest')


def build_model():
    arm = base.build_model()
    bpy.data.objects.remove(bpy.data.objects['orb'], do_unlink=True)
    def rigid(obj, bone):
        bind_rigid(obj, arm, bone)
        return obj
    # Cope and the plain silk back: the gold lacing stays readable from behind.
    rigid(robe_panel('cope', 0.65, 2 * math.pi - 0.65, 1.7, 0.04, 0.25, 0.19, 0.43, 0.30,
                     trim=0.15, mats=('silk', 'gold'), thickness=0.015), 'chest')
    for j in range(10):
        z = 0.35 + j * 0.12
        for sx in (-1, 1):
            rigid(tube('lacing', (-sx * 0.07, 0.28, z), (sx * 0.07, 0.28, z + 0.1), 0.008, 0.008, 'gold'), 'chest')
    rigid(torus('candle-crown', (0, 0, 2.005), 0.115, 0.018, 'gold'), 'head')
    for j in range(7):
        a = j * 2 * math.pi / 7
        x, y = math.cos(a) * 0.113, math.sin(a) * 0.113
        top = 2.14 + (0.06 if j % 2 == 0 else 0)
        rigid(tube('candle', (x, y, 2.01), (x, y, top), 0.011, 0.012, 'silk'), 'head')
        rigid(sphere('flame', (x, y, top + 0.026), (0.014, 0.014, 0.035), 'flame', outline=0.002), 'head')
    for sx, side in ((-1, 'R'), (1, 'L')):
        # Closed covers meet at the spine; page faces rotate outward in the singing pose.
        rigid(box('cover.' + side, (sx * 0.19, -0.40, 1.15), (0.38, 0.065, 0.97), 'bronze'), 'book.' + side)
        rigid(box('pages.' + side, (sx * 0.183, -0.355, 1.15), (0.345, 0.018, 0.90), 'paper', outline=0.003), 'book.' + side)
        for z in (0.69, 1.61):
            rigid(box('book-trim', (sx * 0.19, -0.44, z), (0.38, 0.02, 0.04), 'gold'), 'book.' + side)
        rigid(box('book-rim', (sx * 0.365, -0.44, 1.15), (0.025, 0.02, 0.97), 'gold'), 'book.' + side)
        rigid(box('cross-stem', (sx * 0.19, -0.445, 1.16), (0.025, 0.02, 0.43), 'gold'), 'book.' + side)
        rigid(box('cross-bar', (sx * 0.19, -0.445, 1.23), (0.17, 0.02, 0.025), 'gold'), 'book.' + side)
        for j in range(9):
            rigid(sphere('folded-feather', (sx * (0.28 + j * 0.033), 0.22, 1.07 + j * 0.02),
                         (0.065, 0.035, 0.82 - j * 0.02), 'silk', rot=(0, sx * -0.16, 0), outline=0.005), 'chest')
    return arm


def book_pose(t, closing=False):
    opening = 1 - t if closing else t
    r = base.guard()
    r['book.L'] = (0, 0, -155 * opening)
    r['book.R'] = (0, 0, 155 * opening)
    r['head'] = (-4 - 12 * opening, 0, 0)
    return Pose(r)


SPEC = Spec(build_model, {
    'idle': (1, base.pose_idle, True), 'walk': (8, base.pose_walk, True),
    'cast': (8, book_pose, False), 'sing': (4, lambda t: book_pose(1), True),
    'close': (4, lambda t: book_pose(t, True), False),
    'pain': (3, base.pose_pain, False), 'death': (8, base.pose_death, False),
}, px_per_m=120, canvas=(-2.5, 2.5, -0.5, 2.7), directions=8, contact=(0.10, 0.03, 0.07))
if __name__ == '__main__':
    main(SPEC)
