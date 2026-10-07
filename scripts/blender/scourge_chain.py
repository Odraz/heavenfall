"""
Renders the Binder's Scourge chain for the painted first-person weapon (M11 §3.6, as reviewed in stage 1):
the chain flung from the left fist sweeping level across the view, ending in an iron eye hook, in 5
frames of the whole view from the eye. The fist itself is the painted one (fp-binder-sweep), drawn by
the HUD where the hand is in each frame; scripts/cutout_weapons.py paints the chain red-hot.

Writes the frames stacked top to bottom, cropped to the columns any of them uses, and beside it a JSON of
where the hand is in each frame: its center (x, y from the frame's top), the forearm's direction on
screen (degrees, clockwise from +x, elbow to hand) and the fist's radius, in frame pixels.

Run with Blender 5.2 (headless):
  blender -b --factory-startup -P scripts/blender/scourge_chain.py -- assets/art-src/scourge-chain.png

The camera sits at the origin looking along +Y, +Z up. Shared code is in common.py.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Euler, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (EMISSIVE, PAL, chain, ink_frame, render_to_array, reset_scene, save_array,  # noqa: E402
                    torus, tube)

# A narrower field of view than the world's 75°, as the M9 first-person weapons had.
FOV_DEG = 50
FRAME_H = 600         # half the view's height: the view is 1200 px tall
SS = 2                # supersampling
INK_PX_PER_M = 150    # sets the outer contour to 3 px (see ink_frame)

PAL.update({'iron': (0.36, 0.32, 0.30), 'chain': (0.66, 0.28, 0.16), 'hot': (1.0, 0.42, 0.15)})
EMISSIVE.update({'hot'})

SWING_FRAMES = 5
# The chain's tip: how far out from the eye it sweeps, and its height (m, below the eye).
SWING_REACH = 2.0
SWING_TIP_Z = -0.12
# How far the hook trails behind the chain's heading at the fist, in degrees around the circle.
SWING_TRAIL = 35
HOOK_SCALE = 1.2


def smoothstep(t):
    return t * t * (3 - 2 * t)


def swing_arm(f):
    """The swinging hand's and elbow's places in swing frame `f` (as M9's swing)."""
    t = (f + 0.5) / SWING_FRAMES
    s = smoothstep(t)
    lift = math.sin(math.pi * t)
    return Vector((-0.55 + 0.95 * s, 0.80 + 0.08 * lift, -0.27 + 0.10 * lift)), Vector((-0.50 + 0.35 * s, 0.25, -0.62))


def build_chain(f):
    """
    The chain of swing frame `f` (0 to SWING_FRAMES - 1), in camera space: flung out from the fist and
    trailing behind it, it leaves the fist pointing along the swing (heading `alpha` on a level circle
    SWING_REACH m around the eye, just below eye level) and bends back, so the hook at its end comes
    last, SWING_TRAIL behind. Returns the new objects.
    """
    t = (f + 0.5) / SWING_FRAMES
    hand, _ = swing_arm(f)
    objs = []
    alpha = math.radians(-65 + 160 * smoothstep(t))
    trail = math.radians(SWING_TRAIL)

    def on_circle(a):
        return Vector((SWING_REACH * math.sin(a), SWING_REACH * math.cos(a), SWING_TIP_Z))

    tip = on_circle(alpha - trail)
    ctrl = hand + (on_circle(alpha) - hand) * 0.6
    n = max(8, round((tip - hand).length / 0.07))
    pts = [hand * (1 - u) ** 2 + ctrl * (2 * u * (1 - u)) + tip * (u * u) for u in (k / n for k in range(n + 1))]
    # Rendered in the rust color; scripts/cutout_weapons.py maps its tones to red-hot metal.
    objs.append(chain('Schain', pts, 'chain', link=0.14, thick=0.015, outline=0.004))
    # The hook: an eye on the last link, a straight shank, and a J-shaped bowl curling down and back to
    # a point, its tip red-hot like the chain.
    end = pts[-1]
    out = (pts[-1] - pts[-2]).normalized()
    down = Vector((0, 0, -1))
    side = out.cross(down).normalized()
    k = HOOK_SCALE
    eye = end + out * 0.035 * k
    objs.append(torus('Shookeye', eye, 0.032 * k, 0.011 * k, 'iron', rot=side.to_track_quat('Z', 'Y').to_euler(), seg=16, outline=0.003))
    s0 = eye + out * 0.035 * k
    s1 = s0 + out * 0.13 * k
    objs.append(tube('Shookshank', s0, s1, 0.016 * k, 0.019 * k, 'iron', seg=10, outline=0.003))
    c = s1 + down * 0.055 * k
    bowl = [c + (out * math.sin(math.radians(a)) - down * math.cos(math.radians(a))) * 0.055 * k for a in range(0, 271, 30)]
    n = len(bowl) - 1
    for i, (p0, p1) in enumerate(zip(bowl, bowl[1:])):
        r0, r1 = 0.019 * k * (1 - 0.85 * i / n), 0.019 * k * (1 - 0.85 * (i + 1) / n)
        objs.append(tube(f'Shook{i}', p0, p1, r0, r1, 'hot' if i >= n - 2 else 'iron', seg=10, outline=0.003))
    return objs


def setup():
    """The scene: the camera at the eye, the render 2:1 wide, the sun as the M9 weapons had it."""
    scene = reset_scene()
    cam_data = bpy.data.cameras.new('cam')
    cam_data.sensor_fit = 'VERTICAL'
    cam_data.angle = math.radians(FOV_DEG)
    cam_data.clip_start = 0.01
    cam = bpy.data.objects.new('cam', cam_data)
    bpy.context.collection.objects.link(cam)
    cam.rotation_euler = (math.pi / 2, 0, 0)  # looks along +Y
    scene.camera = cam
    scene.render.resolution_x = 4 * FRAME_H * SS
    scene.render.resolution_y = 2 * FRAME_H * SS
    scene.render.resolution_percentage = 100
    scene.eevee.taa_render_samples = 16
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy = 3.0
    sun_obj = bpy.data.objects.new('sun', sun)
    bpy.context.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = Euler((math.radians(50), math.radians(-35), math.radians(-25)), 'XYZ')
    return scene, cam


def crop_columns(frames):
    """Crops every frame to the columns any frame uses, so they stay aligned. Returns the frames and the left edge."""
    import numpy as np
    used = np.zeros(frames[0].shape[1], dtype=bool)
    for img in frames:
        used |= (img[..., 3] > 0.02).any(axis=0)
    xs = np.nonzero(used)[0]
    x0, x1 = int(max(xs.min() - 2, 0)), int(min(xs.max() + 3, used.size))
    return [img[:, x0:x1] for img in frames], x0


def main():
    import numpy as np
    from bpy_extras.object_utils import world_to_camera_view
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if len(argv) != 1:
        raise SystemExit(__doc__)
    out = os.path.abspath(argv[0])
    scene, cam = setup()

    def px(p):
        v = world_to_camera_view(scene, cam, p)
        return v.x * 4 * FRAME_H, (1 - v.y) * 2 * FRAME_H

    frames, hands = [], []
    tmp = out + '.tmp.png'
    for f in range(SWING_FRAMES):
        objs = build_chain(f)
        bpy.context.view_layer.update()
        hand, elbow = swing_arm(f)
        hx, hy = px(hand)
        ex, ey = px(elbow)
        rx, _ = px(hand + Vector((0.058, 0, 0)))
        hands.append({'center': [round(hx, 1), round(hy, 1)], 'angle': round(math.degrees(math.atan2(hy - ey, hx - ex)), 1), 'radius': round(abs(rx - hx), 1)})
        frames.append(ink_frame(render_to_array(scene, tmp), SS, INK_PX_PER_M))
        for o in objs:
            bpy.data.objects.remove(o, do_unlink=True)
    os.remove(tmp)
    frames, x0 = crop_columns(frames)
    h, w, _ = frames[0].shape
    # Rows count from the bottom: the first frame goes on top.
    save_array(np.concatenate(list(reversed(frames)), axis=0), out)
    for hd in hands:
        hd['center'][0] = round(hd['center'][0] - x0, 1)
    meta = {'frames': len(frames), 'w': w, 'h': h, 'centerX': 2 * FRAME_H - x0, 'viewH': 2 * FRAME_H, 'hands': hands}
    with open(os.path.splitext(out)[0] + '.json', 'w', encoding='utf8', newline='\n') as fh:
        fh.write(json.dumps(meta, indent=2) + '\n')
    print(f'scourge-chain: {len(frames)} frames {w}x{h}, center column {2 * FRAME_H - x0}')


if __name__ == '__main__':
    main()
