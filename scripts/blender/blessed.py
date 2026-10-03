"""
Builds the Blessed in Blender from primitives, rigs and animates it, and renders sprite frames.

Run with Blender 5.2 (headless):
  blender -b --factory-startup -P scripts/blender/blessed.py -- <command> [args]

Commands:
  model <out.png>       turnaround preview of the rest pose
  sheet <anim> <out.png> contact sheet of one animation (rows: 8 directions, columns: frames)
  sprites <out-dir>     renders every frame and writes the atlas PNG and manifest JSON

Conventions: meters, Z up, the character faces -Y, so its right side is -X. The camera looks
along +Y. Direction d (0–7) means the character is turned d × 45° counterclockwise seen from
above, away from facing the camera: d = 2 shows its right side.
"""
import math
import random
import sys

import bpy
import bmesh
from mathutils import Euler, Matrix, Vector

# ---------------------------------------------------------------- palette

PAL = {
    'ink': (0.165, 0.129, 0.094),  # #2a2118, the outline color of the other sprites
    'ivory': (0.93, 0.89, 0.78),
    'white': (0.95, 0.95, 0.94),
    'steel': (0.80, 0.83, 0.87),
    'gold': (0.90, 0.70, 0.27),
    'blue': (0.66, 0.80, 0.90),
    'skin': (0.80, 0.78, 0.73),
    'beard': (0.88, 0.87, 0.84),
    'eye': (1.0, 1.0, 1.0),
    'grip': (0.45, 0.30, 0.18),
}


def srgb_to_linear(c):
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# ---------------------------------------------------------------- scene

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    scene.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in engines else 'BLENDER_EEVEE_NEXT'
    scene.render.film_transparent = True
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.fps = 30
    world = bpy.data.worlds.new('World')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.0
    scene.world = world
    return scene


_mats = {}


def toon(name):
    """Two-to-three-tone cel material: diffuse lighting quantized by a constant color ramp."""
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    col = srgb_to_linear(PAL[name]) + (1.0,)
    if name == 'eye':
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs['Color'].default_value = col
        nt.links.new(em.outputs[0], out.inputs['Surface'])
    else:
        diff = nt.nodes.new('ShaderNodeBsdfDiffuse')
        s2r = nt.nodes.new('ShaderNodeShaderToRGB')
        bw = nt.nodes.new('ShaderNodeRGBToBW')
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.interpolation = 'CONSTANT'
        els = ramp.color_ramp.elements
        els[0].position = 0.0
        els[0].color = (0.60, 0.60, 0.66, 1)  # cool shadow
        els[1].position = 0.10
        els[1].color = (0.80, 0.80, 0.83, 1)
        e3 = els.new(0.42)
        e3.color = (1, 1, 1, 1)
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
        mix.inputs['A'].default_value = col
        em = nt.nodes.new('ShaderNodeEmission')
        nt.links.new(diff.outputs[0], s2r.inputs[0])
        nt.links.new(s2r.outputs['Color'], bw.inputs[0])
        nt.links.new(bw.outputs[0], ramp.inputs['Fac'])
        nt.links.new(ramp.outputs['Color'], mix.inputs['B'])
        nt.links.new(mix.outputs['Result'], em.inputs['Color'])
        nt.links.new(em.outputs[0], out.inputs['Surface'])
    _mats[name] = m
    return m


def outline_mat():
    if 'outline' in _mats:
        return _mats['outline']
    m = bpy.data.materials.new('outline')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = srgb_to_linear(PAL['ink']) + (1.0,)
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    m.use_backface_culling = True
    _mats['outline'] = m
    return m


# ---------------------------------------------------------------- mesh helpers

def _finish(obj, mat, smooth=True, outline=0.008):
    obj.data.materials.append(toon(mat) if isinstance(mat, str) else mat)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    if outline:
        add_outline(obj, outline)
    return obj


def add_outline(obj, thickness):
    """Inverted-hull ink line: a flipped, pushed-out shell that only shows its back faces."""
    obj.data.materials.append(outline_mat())
    mod = obj.modifiers.new('outline', 'SOLIDIFY')
    mod.thickness = -thickness
    mod.offset = -1.0
    mod.use_flip_normals = True
    mod.use_rim = False
    mod.material_offset = len(obj.data.materials) - 1
    mod.use_even_offset = False


def _new_obj(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    return obj


def sphere(name, loc, scale, mat, seg=20, rot=(0, 0, 0), outline=0.008):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2 + 2, radius=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.LocRotScale(Vector(loc), Euler(rot), Vector(scale)), verts=bm.verts)
    return _finish(_new_obj(name, bm), mat, outline=outline)


def tube(name, p0, p1, r0, r1, mat, seg=14, cap=True, outline=0.008, squash=1.0):
    """A truncated cone from p0 (radius r0) to p1 (radius r1); `squash` scales its depth axis."""
    p0, p1 = Vector(p0), Vector(p1)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, segments=seg, radius1=r0, radius2=r1, depth=1.0)
    for v in bm.verts:
        v.co.y *= squash
    axis = p1 - p0
    rot = Vector((0, 0, 1)).rotation_difference(axis.normalized()).to_matrix().to_4x4()
    m = Matrix.Translation((p0 + p1) / 2) @ rot @ Matrix.Diagonal((1, 1, axis.length, 1))
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    return _finish(_new_obj(name, bm), mat, outline=outline)


def torus(name, loc, major, minor, mat, rot=(0, 0, 0), scale=(1, 1, 1), seg=32, outline=0.006):
    bm = bmesh.new()
    rings, ring_seg = seg, 8
    verts = []
    for i in range(rings):
        a = 2 * math.pi * i / rings
        row = []
        for j in range(ring_seg):
            b = 2 * math.pi * j / ring_seg
            r = major + minor * math.cos(b)
            row.append(bm.verts.new((r * math.cos(a), r * math.sin(a), minor * math.sin(b))))
        verts.append(row)
    for i in range(rings):
        for j in range(ring_seg):
            bm.faces.new((verts[i][j], verts[(i + 1) % rings][j], verts[(i + 1) % rings][(j + 1) % ring_seg], verts[i][(j + 1) % ring_seg]))
    bmesh.ops.transform(bm, matrix=Matrix.LocRotScale(Vector(loc), Euler(rot), Vector(scale)), verts=bm.verts)
    return _finish(_new_obj(name, bm), mat, outline=outline)


def box(name, loc, size, mat, rot=(0, 0, 0), outline=0.006, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    if bevel:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=2, affect='EDGES')
    bmesh.ops.transform(bm, matrix=Matrix.LocRotScale(Vector(loc), Euler(rot), Vector(size)), verts=bm.verts)
    return _finish(_new_obj(name, bm), mat, smooth=False, outline=outline)


def blade_mesh(name, p0, p1, side, flat, w=0.026, t=0.006):
    """A flat blade from p0 to a point at p1, `side` across its width, `flat` through its thickness."""
    bm = bmesh.new()
    d = p1 - p0
    tip_start = p0 + d * 0.88
    rows = [(p0, 1.0), (tip_start, 0.85)]
    ring = []
    for c, k in rows:
        ring.append([bm.verts.new(c + side * w * k * sx + flat * t * fy) for sx, fy in ((1, 0), (0, 1), (-1, 0), (0, -1))])
    tip = bm.verts.new(p1)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((ring[0][i], ring[0][j], ring[1][j], ring[1][i]))
        bm.faces.new((ring[1][i], ring[1][j], tip))
    bm.faces.new(list(reversed(ring[0])))
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return _finish(_new_obj(name, bm), 'steel', smooth=False, outline=0.005)


def robe_panel(name, a0, a1, z0, z1, rx0, ry0, rx1, ry1, trim=0.12, tatter=0.0, seed=0, push=0.0):
    """
    A curved cloth panel on an elliptical cone around the waist. Angles: 0 is the front (-Y),
    positive toward the character's left (+X). z0 top, z1 bottom. The outer columns are blue trim.
    """
    rnd = random.Random(seed)
    cols, rows = 12, 10
    bm = bmesh.new()
    grid = []
    bottom_jag = [0.0] * (cols + 1)
    if tatter:
        for i in range(cols + 1):
            bottom_jag[i] = (rnd.random() * tatter) if i % 2 else rnd.random() * tatter * 0.25
    for r in range(rows + 1):
        t = r / rows
        z = z0 + (z1 - z0) * t
        rx = rx0 + (rx1 - rx0) * t ** 0.8
        ry = ry0 + (ry1 - ry0) * t ** 0.8
        row = []
        for c in range(cols + 1):
            a = a0 + (a1 - a0) * c / cols
            zz = z + (bottom_jag[c] if r == rows else 0.0)
            row.append(bm.verts.new(((rx + push) * math.sin(a), -(ry + push) * math.cos(a), zz)))
        grid.append(row)
    trim_cols = max(1, round(cols * trim))
    is_trim = []
    for r in range(rows):
        for c in range(cols):
            bm.faces.new((grid[r][c], grid[r + 1][c], grid[r + 1][c + 1], grid[r][c + 1]))
            is_trim.append(c < trim_cols or c >= cols - trim_cols)
    bm.normal_update()
    bm.faces.ensure_lookup_table()
    # Normals point outward: flip if the first face points inward.
    f0 = bm.faces[0]
    center = f0.calc_center_median()
    if f0.normal.dot(Vector((center.x, center.y, 0))) < 0:
        for f in bm.faces:
            f.normal_flip()
    obj = _new_obj(name, bm)
    obj.data.materials.append(toon('ivory'))
    obj.data.materials.append(toon('blue'))
    for p in obj.data.polygons:
        p.use_smooth = True
    for p in obj.data.polygons:
        if is_trim[p.index]:
            p.material_index = 1
    sol = obj.modifiers.new('thick', 'SOLIDIFY')
    sol.thickness = 0.012
    sol.offset = 0.0
    add_outline(obj, 0.007)
    return obj


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


def build_armature():
    arm_data = bpy.data.armatures.new('rig')
    arm = bpy.data.objects.new('rig', arm_data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    for name, (h, t, parent) in BONES.items():
        b = arm_data.edit_bones.new(name)
        b.head, b.tail = Vector(h), Vector(t)
        b.roll = 0.0
        if parent:
            b.parent = arm_data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    return arm


def bind_rigid(obj, arm, bone):
    bpy.context.view_layer.update()
    mw = obj.matrix_world.copy()
    obj.parent = arm
    obj.parent_type = 'BONE'
    obj.parent_bone = bone
    bpy.context.view_layer.update()
    obj.matrix_world = mw


def bind_skirt(obj, arm, bone, z_top=0.98, z_free=0.80):
    """Weights the panel to the hips at the waist, blending to its own bone below z_free."""
    obj.parent = arm
    g_hips = obj.vertex_groups.new(name='hips')
    g_bone = obj.vertex_groups.new(name=bone)
    for v in obj.data.vertices:
        t = min(1.0, max(0.0, (z_top - v.co.z) / (z_top - z_free)))
        w = t * t * (3 - 2 * t)
        g_hips.add([v.index], 1.0 - w, 'REPLACE')
        g_bone.add([v.index], w, 'REPLACE')
    mod = obj.modifiers.new('rig', 'ARMATURE')
    mod.object = arm
    # The armature must deform before thickness and outline are added.
    bpy.context.view_layer.objects.active = obj
    while obj.modifiers[0].name != 'rig':
        bpy.ops.object.modifier_move_up(modifier='rig')


# ---------------------------------------------------------------- the model

def build_model():
    arm = build_armature()
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

    # Halo: a thin gold ring behind the head. It always faces the camera (see track_halo).
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
    track_halo(halo, arm)
    return arm


def track_halo(halo, arm):
    """
    Keeps the halo upright and facing the camera, centered above the head and 0.1 m behind it
    as seen from the camera, so it reads as a ring from every direction.
    """
    anchor = bpy.data.objects.new('halo_anchor', None)
    bpy.context.collection.objects.link(anchor)
    anchor.parent = arm
    anchor.parent_type = 'BONE'
    anchor.parent_bone = 'head'
    bpy.context.view_layer.update()
    anchor.matrix_world = Matrix.Translation((0, 0, 1.56))
    c = halo.constraints.new('COPY_LOCATION')
    c.target = anchor
    c.use_offset = True
    halo.location = (0, 0.10, 0)


# ---------------------------------------------------------------- posing

def set_pose(arm, rots=None, locs=None):
    """
    Poses bones with rotations given in armature axes (degrees, XYZ Euler), each relative to its
    parent as if the parent were at rest. +X tips an upward bone forward (toward -Y) and swings a
    downward bone backward. Locations are armature-axis offsets in meters.
    """
    rots = rots or {}
    locs = locs or {}
    for pb in arm.pose.bones:
        rest = pb.bone.matrix_local.to_3x3()
        r = rots.get(pb.name, (0, 0, 0))
        world = Euler(tuple(math.radians(a) for a in r), 'XYZ').to_matrix()
        pb.rotation_quaternion = (rest.inverted() @ world @ rest).to_quaternion()
        pb.location = rest.inverted() @ Vector(locs.get(pb.name, (0, 0, 0)))


def lowest_contact(arm):
    """Height of the lowest point that should rest on the ground: soles, toes or knees."""
    bpy.context.view_layer.update()
    pb = arm.pose.bones
    zs = []
    for side in 'LR':
        zs.append(pb[f'foot.{side}'].head.z - 0.09)
        zs.append(pb[f'foot.{side}'].tail.z - 0.03)
        zs.append(pb[f'shin.{side}'].head.z - 0.06)
    return min(zs)


class Pose:
    """One frame: bone rotations and offsets, plus a forward fall around a point on the ground."""

    def __init__(self, rots, locs=None, fall=0.0, pivot_y=0.0, halo=1.0, grounded=True):
        self.rots, self.locs = rots, dict(locs or {})
        self.fall, self.pivot_y, self.halo, self.grounded = fall, pivot_y, halo, grounded


def apply_pose(arm, pose, halo):
    rots = dict(pose.rots)
    rots.pop('root', None)
    locs = dict(pose.locs)
    set_pose(arm, rots, locs)
    if pose.grounded:
        # Drop or lift the hips so the lowest foot or knee touches the ground.
        hx, hy, hz = locs.get('hips', (0, 0, 0))
        locs['hips'] = (hx, hy, hz - lowest_contact(arm))
    if pose.fall:
        r = Euler((math.radians(pose.fall), 0, 0)).to_matrix()
        p = Vector((0, pose.pivot_y, 0))
        rots['root'] = (pose.fall, 0, 0)
        locs['root'] = tuple(p - r @ p)
    set_pose(arm, rots, locs)
    halo.scale = (pose.halo,) * 3
    halo.hide_render = pose.halo < 0.05


# ---------------------------------------------------------------- animations

def smooth(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def keys(table, t):
    """Piecewise-smooth interpolation through (t, value) pairs."""
    for (t0, v0), (t1, v1) in zip(table, table[1:]):
        if t <= t1:
            return lerp(v0, v1, smooth((t - t0) / (t1 - t0)))
    return table[-1][1]


def guard():
    """The standing pose: a slight forward lean, sword low across the body."""
    return {
        'spine': (6, 0, 0), 'chest': (3, 0, 0), 'neck': (-3, 0, 0), 'head': (-5, 0, 0),
        'upper_arm.L': (-4, 0, 0), 'forearm.L': (-14, 0, 0),
        'upper_arm.R': (-6, 0, 0), 'forearm.R': (-12, 0, 0),
        'shin.L': (4, 0, 0), 'shin.R': (4, 0, 0), 'thigh.L': (-3, 0, 0), 'thigh.R': (-3, 0, 0),
    }


def add(r, bone, dx=0, dy=0, dz=0):
    x, y, z = r.get(bone, (0, 0, 0))
    r[bone] = (x + dx, y + dy, z + dz)


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


def anim_times(name):
    n, _, loop = ANIMS[name]
    return [i / n if loop or n == 1 else i / (n - 1) for i in range(n)]


# ---------------------------------------------------------------- camera and rendering

PX_PER_M = 100  # sprite pixels per meter in the game
SUPERSAMPLE = 2
# The render canvas in meters around the character's ground point: room for a raised sword and
# a body lying on the ground in any direction.
CANVAS = (-2.0, 2.0, -0.4, 2.6)  # x0, x1, z0, z1


def setup_camera(scene, px_per_m, elevation_deg=8.0):
    x0, x1, z0, z1 = CANVAS
    w, h = x1 - x0, z1 - z0
    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = max(w, h)
    cam = bpy.data.objects.new('cam', cam_data)
    bpy.context.collection.objects.link(cam)
    el = math.radians(elevation_deg)
    dist = 10.0
    cz = (z0 + z1) / 2
    cam.location = ((x0 + x1) / 2, -dist * math.cos(el), cz + dist * math.sin(el))
    cam.rotation_euler = (math.pi / 2 - el, 0, 0)
    scene.camera = cam
    scene.render.resolution_x = round(w * px_per_m)
    scene.render.resolution_y = round(h * px_per_m)
    scene.render.resolution_percentage = 100
    scene.eevee.taa_render_samples = 16
    # Key light from the upper front-left of the viewer, fixed relative to the camera.
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy = 3.0
    sun_obj = bpy.data.objects.new('sun', sun)
    bpy.context.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = Euler((math.radians(50), math.radians(-35), math.radians(-25)), 'XYZ')
    return cam


def ground_pixel(scene, cam):
    """Pixel (x from left, y from bottom) where the character's ground point lands."""
    from bpy_extras.object_utils import world_to_camera_view
    bpy.context.view_layer.update()
    v = world_to_camera_view(scene, cam, Vector((0, 0, 0)))
    return v.x * scene.render.resolution_x, v.y * scene.render.resolution_y


def render_to_array(scene, path):
    import numpy as np
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(path)
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    return a.reshape(h, w, 4)  # row 0 is the bottom


def save_array(arr, path):
    import numpy as np
    h, w, _ = arr.shape
    img = bpy.data.images.new('out', w, h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(arr, dtype=np.float32).ravel())
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


def ink_frame(arr, ss):
    """
    Downsamples a supersampled render and adds the bold outer contour: an ink layer made from
    the dilated silhouette, under the figure. Fully transparent pixels get the ink color so
    texture filtering bleeds dark, not black or white, at the edges.
    """
    import numpy as np
    h, w, _ = arr.shape
    rgb, a = arr[..., :3], arr[..., 3:4]
    pre = np.concatenate([rgb * a, a], axis=2)
    pre = pre[: h - h % ss, : w - w % ss].reshape(h // ss, ss, w // ss, ss, 4).mean(axis=(1, 3))
    a = pre[..., 3:4]
    rgb = np.where(a > 1e-4, pre[..., :3] / np.maximum(a, 1e-4), 0)
    # Max-filter the alpha with a disk of radius 2 px.
    d = a[..., 0].copy()
    src = a[..., 0]
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            if dx * dx + dy * dy > 5:
                continue
            sh = np.zeros_like(src)
            ys = slice(max(dy, 0), src.shape[0] + min(dy, 0))
            yd = slice(max(-dy, 0), src.shape[0] + min(-dy, 0))
            xs = slice(max(dx, 0), src.shape[1] + min(dx, 0))
            xd = slice(max(-dx, 0), src.shape[1] + min(-dx, 0))
            sh[yd, xd] = src[ys, xs]
            d = np.maximum(d, sh)
    d = d[..., None]
    ink = np.array(PAL['ink'], dtype=np.float32)
    out_a = a + d * (1 - a)
    out_rgb = (rgb * a + ink * d * (1 - a)) / np.maximum(out_a, 1e-4)
    out_rgb = np.where(out_a > 1e-4, out_rgb, ink)
    return np.concatenate([out_rgb, out_a], axis=2)


def crop(arr, gx, gy, pad=1):
    """Crops to the visible pixels; returns the image and the ground point relative to it."""
    import numpy as np
    ys, xs = np.nonzero(arr[..., 3] > 0.02)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, arr.shape[0])
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, arr.shape[1])
    return arr[y0:y1, x0:x1], gx - x0, gy - y0


class Renderer:
    def __init__(self, tmp):
        self.scene = reset_scene()
        self.arm = build_model()
        self.halo = bpy.data.objects['halo']
        self.cam = setup_camera(self.scene, PX_PER_M * SUPERSAMPLE)
        self.tmp = tmp
        gx, gy = ground_pixel(self.scene, self.cam)
        self.ground = (gx / SUPERSAMPLE, gy / SUPERSAMPLE)

    def frame(self, anim, i, d):
        """One processed, cropped frame: (image, ground x, ground y) in final pixels."""
        _, fn, _ = ANIMS[anim]
        apply_pose(self.arm, fn(anim_times(anim)[i]), self.halo)
        self.arm.rotation_euler = (0, 0, math.radians(45 * d))
        arr = render_to_array(self.scene, f'{self.tmp}.frame.png')
        return crop(ink_frame(arr, SUPERSAMPLE), *self.ground)


def compose_sheet(cells, bg=(0.55, 0.62, 0.70)):
    """Lays out rows of (image, gx, gy) cells, each with its ground point at its cell's bottom center."""
    import numpy as np
    left = max(gx for row in cells for _, gx, _ in row)
    right = max(img.shape[1] - gx for row in cells for img, gx, _ in row)
    down = max(gy for row in cells for _, _, gy in row)
    up = max(img.shape[0] - gy for row in cells for img, _, gy in row)
    cw, ch = int(left + right) + 8, int(down + up) + 8
    rows = len(cells)
    cols = max(len(r) for r in cells)
    sheet = np.zeros((rows * ch, cols * cw, 4), dtype=np.float32)
    sheet[..., :3] = bg
    sheet[..., 3] = 1
    for ri, row in enumerate(cells):
        for ci, (img, gx, gy) in enumerate(row):
            ox = ci * cw + int(round(4 + left - gx))
            oy = (rows - 1 - ri) * ch + int(round(4 + down - gy))
            h, w, _ = img.shape
            dst = sheet[oy:oy + h, ox:ox + w]
            a = img[..., 3:4]
            dst[..., :3] = img[..., :3] * a + dst[..., :3] * (1 - a)
    return sheet


# ---------------------------------------------------------------- commands

def cmd_model(out, px_per_m=None, dirs='01234567'):
    """Rest-pose turnaround at a larger scale, for checking the model."""
    global PX_PER_M
    if px_per_m:
        PX_PER_M = int(px_per_m)
    r = Renderer(out + '.tmp')
    cells = [[r.frame('idle', 0, int(d)) for d in dirs]]
    save_array(compose_sheet(cells), out)


def cmd_sheet(anim, out, dirs='01234567', px_per_m=None):
    global PX_PER_M
    if px_per_m:
        PX_PER_M = int(px_per_m)
    r = Renderer(out + '.tmp')
    n = ANIMS[anim][0]
    cells = [[r.frame(anim, i, int(d)) for i in range(n)] for d in dirs]
    save_array(compose_sheet(cells), out)


def pack(frames, width=2048, pad=2):
    """Shelf-packs images, tallest first. Returns positions (x, y from the top) and the atlas height."""
    order = sorted(range(len(frames)), key=lambda k: (-frames[k].shape[0], -frames[k].shape[1]))
    pos = [None] * len(frames)
    x = y = pad
    shelf = 0
    for k in order:
        h, w, _ = frames[k].shape
        if x + w + pad > width:
            x, y, shelf = pad, y + shelf + pad, 0
        pos[k] = (x, y)
        x += w + pad
        shelf = max(shelf, h)
    # WebGL 2 mipmaps any size, so the height is only rounded up to a multiple of 64.
    return pos, -(-(y + shelf + pad) // 64) * 64


def cmd_sprites(out_dir, width=2048):
    """Renders every animation from 8 directions and writes atlas.png and atlas.json."""
    import json
    import os
    import numpy as np
    os.makedirs(out_dir, exist_ok=True)
    r = Renderer(os.path.join(out_dir, 'render'))
    images, refs = [], []
    for anim, (n, _, _) in ANIMS.items():
        for d in range(8):
            for i in range(n):
                img, gx, gy = r.frame(anim, i, d)
                images.append(img)
                refs.append((anim, d, i, gx, gy))
    os.remove(os.path.join(out_dir, 'render.frame.png'))
    width = int(width)
    pos, height = pack(images, width)
    atlas = np.zeros((height, width, 4), dtype=np.float32)
    atlas[..., :3] = PAL['ink']
    manifest = {'pxPerMeter': PX_PER_M, 'width': width, 'height': height, 'anims': {}}
    for img, (x, y), (anim, d, i, gx, gy) in zip(images, pos, refs):
        h, w, _ = img.shape
        # Arrays have row 0 at the bottom; atlas positions count from the top.
        atlas[height - y - h:height - y, x:x + w] = img
        dirs = manifest['anims'].setdefault(anim, [[] for _ in range(8)])
        dirs[d].append([x, y, w, h, round(gx, 1), round(gy, 1)])
    save_array(atlas, os.path.join(out_dir, 'atlas.png'))
    # One line per direction keeps the manifest readable and its diffs small.
    lines = ['{', f'  "pxPerMeter": {PX_PER_M}, "width": {width}, "height": {height},',
             '  "_frame": "[x, y from top, w, h, ground x from left, ground y from bottom] in pixels; anims[name][direction][frame]",',
             '  "anims": {']
    names = list(manifest['anims'])
    for ai, name in enumerate(names):
        lines.append(f'    "{name}": [')
        dirs = manifest['anims'][name]
        lines += ['      ' + json.dumps(fr) + (',' if d < 7 else '') for d, fr in enumerate(dirs)]
        lines.append('    ]' + (',' if ai < len(names) - 1 else ''))
    lines += ['  }', '}', '']
    with open(os.path.join(out_dir, 'atlas.json'), 'w', encoding='utf8', newline='\n') as f:
        f.write('\n'.join(lines))
    print(f'atlas {width}x{height}, {len(images)} frames')


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if not argv:
        raise SystemExit(__doc__)
    cmd, args = argv[0], argv[1:]
    if cmd == 'model':
        cmd_model(*args)
    elif cmd == 'sheet':
        cmd_sheet(*args)
    elif cmd == 'sprites':
        cmd_sprites(*args)
    else:
        raise SystemExit(f'Unknown command {cmd}')


if __name__ == '__main__':
    main()
