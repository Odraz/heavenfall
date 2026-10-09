"""
Shared code for the character models in scripts/blender/: materials, mesh helpers, rigging,
posing, rendering and atlas packing. Each model script describes its model with a `Spec` and
calls `main(spec)`.

Run a model script with Blender 5.2 (headless):
  blender -b --factory-startup -P scripts/blender/<model>.py -- <command> [args]

Commands:
  model <out.png> [px/m] [dirs]  turnaround of the idle pose (default: all 8 directions)
  sheet <anim> <out.png> [dirs]  contact sheet of one animation (rows: directions, columns: frames)
  sprites <out-dir>              renders every frame and writes the atlas PNG and manifest JSON
  portrait <out.png>             the idle frame from the front, PORTRAIT_PX tall (§11.2)

Conventions: meters, Z up, the character faces -Y, so its right side is -X. The camera looks
along +Y. Direction d (0–7) means the character is turned d × 45° counterclockwise seen from
above, away from facing the camera: d = 2 shows its right side.
"""
import math
import os
import random
import sys

import bpy
import bmesh
from mathutils import Euler, Matrix, Vector

# ---------------------------------------------------------------- palette

# Colors in sRGB by material name. Model scripts add their own with PAL.update.
PAL = {
    'ink': (0.165, 0.129, 0.094),  # #2a2118, the outline color of the other sprites
}
# Materials drawn unshaded at full color (eyes, glowing parts).
EMISSIVE = {'eye'}


def srgb_to_linear(c):
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# ---------------------------------------------------------------- scene

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()
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


def _toon_nodes(nt, col):
    """Two-to-three-tone cel shading of `col`: diffuse lighting quantized by a constant color ramp."""
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
    nt.links.new(diff.outputs[0], s2r.inputs[0])
    nt.links.new(s2r.outputs['Color'], bw.inputs[0])
    nt.links.new(bw.outputs[0], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], mix.inputs['B'])
    return mix.outputs['Result']


def toon(name):
    """The cel material for a palette color; EMISSIVE names are flat and unshaded."""
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    col = srgb_to_linear(PAL[name]) + (1.0,)
    em = nt.nodes.new('ShaderNodeEmission')
    if name in EMISSIVE:
        em.inputs['Color'].default_value = col
    else:
        nt.links.new(_toon_nodes(nt, col), em.inputs['Color'])
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    _mats[name] = m
    return m


def cracked(name, glow, scale=7.0, width=0.035, seed=0.0, coverage=0.5):
    """
    A cel material for palette color `name` split by glowing cracks of palette color `glow`: the
    edges of a Voronoi pattern in object space, so the cracks stay put on a moving part. A noise
    mask keeps about a `coverage` fraction of the edges, so the cracks read as veins, not a grid.
    """
    key = f'{name}~{glow}~{scale}~{width}~{seed}~{coverage}'
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    shaded = _toon_nodes(nt, srgb_to_linear(PAL[name]) + (1.0,))
    coord = nt.nodes.new('ShaderNodeTexCoord')
    offset = nt.nodes.new('ShaderNodeVectorMath')
    offset.operation = 'ADD'
    offset.inputs[1].default_value = (seed, seed * 1.7, seed * 0.6)
    vor = nt.nodes.new('ShaderNodeTexVoronoi')
    vor.voronoi_dimensions = '3D'
    vor.feature = 'DISTANCE_TO_EDGE'
    vor.inputs['Scale'].default_value = scale
    vor.inputs['Randomness'].default_value = 1.0
    less = nt.nodes.new('ShaderNodeMath')
    less.operation = 'LESS_THAN'
    less.inputs[1].default_value = width
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = scale * 0.6
    keep = nt.nodes.new('ShaderNodeMath')
    keep.operation = 'GREATER_THAN'
    keep.inputs[1].default_value = 1.0 - coverage
    # The noise is roughly uniform around 0.5 in [0.3, 0.7]; spread it to [0, 1] first.
    spread = nt.nodes.new('ShaderNodeMapRange')
    spread.inputs['From Min'].default_value = 0.3
    spread.inputs['From Max'].default_value = 0.7
    both = nt.nodes.new('ShaderNodeMath')
    both.operation = 'MULTIPLY'
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.inputs['B'].default_value = srgb_to_linear(PAL[glow]) + (1.0,)
    em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(coord.outputs['Object'], offset.inputs[0])
    nt.links.new(offset.outputs[0], vor.inputs['Vector'])
    nt.links.new(vor.outputs['Distance'], less.inputs[0])
    nt.links.new(offset.outputs[0], noise.inputs['Vector'])
    nt.links.new(noise.outputs['Fac'], spread.inputs['Value'])
    nt.links.new(spread.outputs['Result'], keep.inputs[0])
    nt.links.new(less.outputs[0], both.inputs[0])
    nt.links.new(keep.outputs[0], both.inputs[1])
    nt.links.new(both.outputs[0], mix.inputs['Factor'])
    nt.links.new(shaded, mix.inputs['A'])
    nt.links.new(mix.outputs['Result'], em.inputs['Color'])
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    _mats[key] = m
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


def feather(name, base, direction, length, width, mat, normal=Vector((0, 1, 0)), thick=0.010, outline=0.004):
    """A flat, pointed-oval feather from `base` along `direction`, lying in the plane facing `normal`."""
    d = Vector(direction).normalized()
    n = (Vector(normal) - d * Vector(normal).dot(d)).normalized()
    s = d.cross(n)
    rot = Matrix((d, n, s)).transposed().to_euler()
    return sphere(name, Vector(base) + d * length / 2, (length / 2, thick, width / 2), mat, seg=12, rot=rot, outline=outline)


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


def sweep(name, pts, radii, mat, seg=10, outline=0.006, smooth=True):
    """
    A tube along the polyline `pts` with a radius per point (0 closes it to a point), as one mesh,
    for horns, bones and other curved parts.
    """
    pts = [Vector(p) for p in pts]
    bm = bmesh.new()
    rings = []
    prev_side = None
    for k, (p, r) in enumerate(zip(pts, radii)):
        t = (pts[min(k + 1, len(pts) - 1)] - pts[max(k - 1, 0)]).normalized()
        # Carry the ring's orientation along the curve so it doesn't twist.
        ref = prev_side if prev_side is not None else (Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0)))
        side = (ref - t * ref.dot(t)).normalized()
        up = t.cross(side)
        prev_side = side
        if r <= 0:
            rings.append([bm.verts.new(p)])
            continue
        rings.append([bm.verts.new(p + (side * math.cos(a) + up * math.sin(a)) * r)
                      for a in (2 * math.pi * i / seg for i in range(seg))])
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            for i in range(seg):
                bm.faces.new((a[0], b[i], b[(i + 1) % seg]))
        elif len(b) == 1:
            for i in range(seg):
                bm.faces.new((a[i], b[0], a[(i + 1) % seg]))
        else:
            for i in range(seg):
                bm.faces.new((a[i], b[i], b[(i + 1) % seg], a[(i + 1) % seg]))
    for ring in (rings[0], rings[-1]):
        if len(ring) > 1:
            bm.faces.new(ring)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return _finish(_new_obj(name, bm), mat, smooth=smooth, outline=outline)


def chain(name, pts, mat, link=0.05, thick=0.011, outline=0.004):
    """
    Interlocking oval links along the polyline `pts`, as one mesh. `link` is a link's outer length,
    `thick` the radius of its wire. Consecutive links turn 90° to each other.
    """
    pts = [Vector(p) for p in pts]
    # Sample the polyline every 0.72 link lengths, keeping each sample's tangent.
    samples = []
    step = link * 0.72
    carry = 0.0
    for p0, p1 in zip(pts, pts[1:]):
        seg_len = (p1 - p0).length
        if seg_len < 1e-6:
            continue
        t = (p1 - p0) / seg_len
        s = carry
        while s <= seg_len:
            samples.append((p0 + t * s, t))
            s += step
        carry = s - seg_len
    bm = bmesh.new()
    ring_n, wire_n = 10, 6
    a, b = link / 2 - thick, link * 0.32 - thick
    prev = None
    for k, (c, t) in enumerate(samples):
        ref = prev if prev is not None else (Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0)))
        side = (ref - t * ref.dot(t)).normalized()
        prev = side
        n = side if k % 2 == 0 else t.cross(side)
        m = t.cross(n)
        rows = []
        for i in range(ring_n):
            th = 2 * math.pi * i / ring_n
            p = c + t * (a * math.cos(th)) + n * (b * math.sin(th))
            r = (t * math.cos(th) + n * math.sin(th)).normalized()
            rows.append([bm.verts.new(p + (r * math.cos(ph) + m * math.sin(ph)) * thick)
                         for ph in (2 * math.pi * j / wire_n for j in range(wire_n))])
        for i in range(ring_n):
            for j in range(wire_n):
                bm.faces.new((rows[i][j], rows[(i + 1) % ring_n][j], rows[(i + 1) % ring_n][(j + 1) % wire_n], rows[i][(j + 1) % wire_n]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return _finish(_new_obj(name, bm), mat, outline=outline)


def sag(p0, p1, depth, n=10):
    """Points of a hanging curve from p0 to p1 that dips `depth` below the straight line."""
    p0, p1 = Vector(p0), Vector(p1)
    return [p0.lerp(p1, i / n) - Vector((0, 0, depth * 4 * (i / n) * (1 - i / n))) for i in range(n + 1)]


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


def blade_mesh(name, p0, p1, side, flat, w=0.026, t=0.006, mat='steel'):
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
    return _finish(_new_obj(name, bm), mat, smooth=False, outline=0.005)


def robe_panel(name, a0, a1, z0, z1, rx0, ry0, rx1, ry1, trim=0.12, tatter=0.0, seed=0, push=0.0,
               mats=('ivory', 'blue'), thickness=0.012, outline=0.007):
    """
    A curved cloth panel on an elliptical cone around the waist. Angles: 0 is the front (-Y),
    positive toward the character's left (+X). z0 top, z1 bottom. The outer columns (a `trim`
    fraction on each side, 0 for none) use the second material.
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
    trim_cols = max(1, round(cols * trim)) if trim else 0
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
    for mat in mats:
        obj.data.materials.append(toon(mat) if isinstance(mat, str) else mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    for p in obj.data.polygons:
        if is_trim[p.index]:
            p.material_index = 1
    sol = obj.modifiers.new('thick', 'SOLIDIFY')
    sol.thickness = thickness
    sol.offset = 0.0
    add_outline(obj, outline)
    return obj


# ---------------------------------------------------------------- armature

def build_armature(bones):
    """An armature from {name: (head, tail, parent)}."""
    arm_data = bpy.data.armatures.new('rig')
    arm = bpy.data.objects.new('rig', arm_data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    for name, (h, t, parent) in bones.items():
        b = arm_data.edit_bones.new(name)
        b.head, b.tail = Vector(h), Vector(t)
        b.roll = 0.0
        if parent:
            b.parent = arm_data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    return arm


def add_ik(arm, bone, target, chain_count=2):
    """Two-bone IK: `bone`'s tail reaches the head of bone `target` (a hand on a weapon)."""
    c = arm.pose.bones[bone].constraints.new('IK')
    c.target = arm
    c.subtarget = target
    c.chain_count = chain_count


def bind_rigid(obj, arm, bone):
    bpy.context.view_layer.update()
    mw = obj.matrix_world.copy()
    obj.parent = arm
    obj.parent_type = 'BONE'
    obj.parent_bone = bone
    bpy.context.view_layer.update()
    obj.matrix_world = mw


def bind_skirt(obj, arm, bone, z_top=0.98, z_free=0.80, base='hips'):
    """Weights the panel to `base` at the waist, blending to its own bone below z_free."""
    obj.parent = arm
    g_hips = obj.vertex_groups.new(name=base)
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


def face_camera(obj, arm, bone, at, offset):
    """
    Keeps `obj` upright and facing the camera whatever the character's direction, following
    `bone` from the point `at` (the rest position, in meters) plus `offset` in camera axes (+Y is
    away from the camera). For halos, which should read as a ring from every direction.
    """
    anchor = bpy.data.objects.new(obj.name + '_anchor', None)
    bpy.context.collection.objects.link(anchor)
    anchor.parent = arm
    anchor.parent_type = 'BONE'
    anchor.parent_bone = bone
    bpy.context.view_layer.update()
    anchor.matrix_world = Matrix.Translation(at)
    c = obj.constraints.new('COPY_LOCATION')
    c.target = anchor
    c.use_offset = True
    obj.location = offset


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


def lowest_contact(arm, contact=(0.09, 0.03, 0.06)):
    """
    Height of the lowest point that should rest on the ground: soles, toes or knees. `contact` is
    how far below the ankle (foot head), toe (foot tail) and knee (shin head) the surface lies.
    """
    sole, toe, knee = contact
    bpy.context.view_layer.update()
    pb = arm.pose.bones
    zs = []
    for side in 'LR':
        zs.append(pb[f'foot.{side}'].head.z - sole)
        zs.append(pb[f'foot.{side}'].tail.z - toe)
        zs.append(pb[f'shin.{side}'].head.z - knee)
    return min(zs)


class Pose:
    """
    One frame: bone rotations and offsets, plus a forward fall around a point on the ground.
    Extra keyword arguments are kept for the model's own `after_pose` hook.
    """

    def __init__(self, rots, locs=None, fall=0.0, pivot_y=0.0, grounded=True, **extra):
        self.rots, self.locs = rots, dict(locs or {})
        self.fall, self.pivot_y, self.grounded = fall, pivot_y, grounded
        self.extra = extra


def apply_pose(arm, pose, contact=(0.09, 0.03, 0.06)):
    rots = dict(pose.rots)
    rots.pop('root', None)
    locs = dict(pose.locs)
    set_pose(arm, rots, locs)
    if pose.grounded:
        # Drop or lift the hips so the lowest foot or knee touches the ground.
        hx, hy, hz = locs.get('hips', (0, 0, 0))
        locs['hips'] = (hx, hy, hz - lowest_contact(arm, contact))
    if pose.fall:
        r = Euler((math.radians(pose.fall), 0, 0)).to_matrix()
        p = Vector((0, pose.pivot_y, 0))
        rots['root'] = (pose.fall, 0, 0)
        locs['root'] = tuple(p - r @ p)
    set_pose(arm, rots, locs)


# ---------------------------------------------------------------- animation helpers

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


def add(r, bone, dx=0, dy=0, dz=0):
    x, y, z = r.get(bone, (0, 0, 0))
    r[bone] = (x + dx, y + dy, z + dz)


# ---------------------------------------------------------------- the model description

class Spec:
    """
    What a model script provides:
      build()          builds the rigged model in the empty scene and returns the armature
      anims            {name: (frames, pose function of t, looping)}
      px_per_m         sprite pixels per meter (§11.2)
      canvas           (x0, x1, z0, z1): the render area in meters around the ground point
      contact          see lowest_contact
      after_pose(pose) optional; applies the pose's extras (a halo's scale, ...)
      directions       8, or 5 to render only front to back on one side
    """

    def __init__(self, build, anims, px_per_m, canvas, contact=(0.09, 0.03, 0.06), after_pose=None, directions=8):
        self.build, self.anims, self.px_per_m, self.canvas = build, anims, px_per_m, canvas
        self.contact, self.after_pose, self.directions = contact, after_pose, directions

    def times(self, name):
        n, _, loop = self.anims[name]
        return [i / n if loop or n == 1 else i / (n - 1) for i in range(n)]


# ---------------------------------------------------------------- camera and rendering

OUTLINE_M = 0.02  # thickness of the outer ink contour
SUPERSAMPLE = 2
PORTRAIT_PX = 512


def setup_camera(scene, canvas, px_per_m, elevation_deg=8.0):
    x0, x1, z0, z1 = canvas
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
    import os
    # Blender reads a relative output path its own way, so make it absolute.
    path = os.path.abspath(path)
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
    import os
    path = os.path.abspath(path)
    h, w, _ = arr.shape
    img = bpy.data.images.new('out', w, h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(arr, dtype=np.float32).ravel())
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


def ink_frame(arr, ss, px_per_m):
    """
    Downsamples a supersampled render and adds the bold outer contour: an ink layer made from
    the silhouette dilated by OUTLINE_M, under the figure. Fully transparent pixels get the ink color so
    texture filtering bleeds dark, not black or white, at the edges.
    """
    import numpy as np
    h, w, _ = arr.shape
    rgb, a = arr[..., :3], arr[..., 3:4]
    pre = np.concatenate([rgb * a, a], axis=2)
    pre = pre[: h - h % ss, : w - w % ss].reshape(h // ss, ss, w // ss, ss, 4).mean(axis=(1, 3))
    a = pre[..., 3:4]
    rgb = np.where(a > 1e-4, pre[..., :3] / np.maximum(a, 1e-4), 0)
    # Max-filter the alpha with a disk.
    rad = max(2, round(OUTLINE_M * px_per_m))  # at least 2 px (§11.2), even at low pixels per meter
    d = a[..., 0].copy()
    src = a[..., 0]
    for dy in range(-rad, rad + 1):
        for dx in range(-rad, rad + 1):
            if dx * dx + dy * dy > rad * rad + rad:
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
    def __init__(self, spec, tmp, px_per_m=None):
        self.spec = spec
        self.px_per_m = px_per_m or spec.px_per_m
        self.scene = reset_scene()
        self.arm = spec.build()
        self.cam = setup_camera(self.scene, spec.canvas, self.px_per_m * SUPERSAMPLE)
        self.tmp = tmp
        gx, gy = ground_pixel(self.scene, self.cam)
        self.ground = (gx / SUPERSAMPLE, gy / SUPERSAMPLE)

    def frame(self, anim, i, d):
        """One processed, cropped frame: (image, ground x, ground y) in final pixels."""
        _, fn, _ = self.spec.anims[anim]
        pose = fn(self.spec.times(anim)[i])
        apply_pose(self.arm, pose, self.spec.contact)
        if self.spec.after_pose:
            self.spec.after_pose(pose)
        self.arm.rotation_euler = (0, 0, math.radians(45 * d))
        arr = render_to_array(self.scene, f'{self.tmp}.frame.png')
        return crop(ink_frame(arr, SUPERSAMPLE, self.px_per_m), *self.ground)


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

def cmd_model(spec, out, px_per_m=None, dirs='01234567'):
    """Idle-pose turnaround, optionally at a larger scale, for checking the model."""
    r = Renderer(spec, out + '.tmp', int(px_per_m) if px_per_m else None)
    cells = [[r.frame('idle', 0, int(d)) for d in dirs]]
    save_array(compose_sheet(cells), out)
    os.remove(out + '.tmp.frame.png')


def cmd_sheet(spec, anim, out, dirs='01234567', px_per_m=None):
    r = Renderer(spec, out + '.tmp', int(px_per_m) if px_per_m else None)
    n = spec.anims[anim][0]
    cells = [[r.frame(anim, i, int(d)) for i in range(n)] for d in dirs]
    save_array(compose_sheet(cells), out)
    os.remove(out + '.tmp.frame.png')


def cmd_portrait(spec, out):
    """The idle frame from the front, scaled so it is exactly PORTRAIT_PX tall."""
    import numpy as np
    img, _, _ = Renderer(spec, out + '.tmp').frame('idle', 0, 0)
    px_per_m = spec.px_per_m * (PORTRAIT_PX - 2) / img.shape[0]
    img, _, _ = Renderer(spec, out + '.tmp', px_per_m).frame('idle', 0, 0)
    h, w, _ = img.shape
    if h > PORTRAIT_PX:
        img = img[h - PORTRAIT_PX:]
    elif h < PORTRAIT_PX:
        pad = np.zeros((PORTRAIT_PX - h, w, 4), dtype=np.float32)
        pad[..., :3] = PAL['ink']
        img = np.concatenate([pad, img])
    save_array(img, out)
    os.remove(out + '.tmp.frame.png')


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


def cmd_sprites(spec, out_dir, width=None):
    """Renders every animation from every direction and writes atlas.png and atlas.json."""
    import json
    import os
    import numpy as np
    os.makedirs(out_dir, exist_ok=True)
    r = Renderer(spec, os.path.join(out_dir, 'render'))
    nd = spec.directions
    images, refs = [], []
    for anim, (n, _, _) in spec.anims.items():
        for d in range(nd):
            for i in range(n):
                img, gx, gy = r.frame(anim, i, d)
                images.append(img)
                refs.append((anim, d, i, gx, gy))
    os.remove(os.path.join(out_dir, 'render.frame.png'))
    if width is None:
        # The narrowest power of two, from 1024 up, that keeps the atlas no taller than wide.
        width = 1024
        while pack(images, width)[1] > width:
            width *= 2
    width = int(width)
    pos, height = pack(images, width)
    atlas = np.zeros((height, width, 4), dtype=np.float32)
    atlas[..., :3] = PAL['ink']
    manifest = {}
    for img, (x, y), (anim, d, i, gx, gy) in zip(images, pos, refs):
        h, w, _ = img.shape
        # Arrays have row 0 at the bottom; atlas positions count from the top.
        atlas[height - y - h:height - y, x:x + w] = img
        dirs = manifest.setdefault(anim, [[] for _ in range(nd)])
        dirs[d].append([x, y, w, h, round(gx, 1), round(gy, 1)])
    save_array(atlas, os.path.join(out_dir, 'atlas.png'))
    # One line per direction keeps the manifest readable and its diffs small.
    lines = ['{', f'  "pxPerMeter": {spec.px_per_m}, "width": {width}, "height": {height},',
             '  "_frame": "[x, y from top, w, h, ground x from left, ground y from bottom] in pixels; anims[name][direction][frame]",',
             '  "anims": {']
    names = list(manifest)
    for ai, name in enumerate(names):
        lines.append(f'    "{name}": [')
        dirs = manifest[name]
        lines += ['      ' + json.dumps(fr) + (',' if d < nd - 1 else '') for d, fr in enumerate(dirs)]
        lines.append('    ]' + (',' if ai < len(names) - 1 else ''))
    lines += ['  }', '}', '']
    with open(os.path.join(out_dir, 'atlas.json'), 'w', encoding='utf8', newline='\n') as f:
        f.write('\n'.join(lines))
    print(f'atlas {width}x{height}, {len(images)} frames')


def main(spec, doc=__doc__, extra=None):
    """Runs the command after `--`; `extra` adds a model's own commands {name: fn(spec, *args)}."""
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if not argv:
        raise SystemExit(doc)
    cmd, args = argv[0], argv[1:]
    commands = {'model': cmd_model, 'sheet': cmd_sheet, 'sprites': cmd_sprites, 'portrait': cmd_portrait, **(extra or {})}
    if cmd not in commands:
        raise SystemExit(f'Unknown command {cmd}')
    commands[cmd](spec, *args)
