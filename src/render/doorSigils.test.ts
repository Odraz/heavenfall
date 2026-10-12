import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { PINNED } from '../gen/pinned';
import { loadRunMap } from '../sim/runMap';
import { roomIcon } from '../client/mapIcons';
import { DoorSigils, sigilPose } from './doorSigils';

it('every generated leaf glyph faces its owner and maps to the destination kind/focus', () => {
  const { map, floor } = loadRunMap({ heaven: 1, floor: 1, seed: PINNED.seed, fixture: null });
  map.rooms.forEach((room, i) => room.leaves.forEach((leaf, j) => {
    const p = sigilPose(map, i, j), cx = (room.rect.x0 + room.rect.x1 + 1) / 2, cy = (room.rect.y0 + room.rect.y1 + 1) / 2;
    expect(Math.sin(p.yaw) * (cx - p.x) + Math.cos(p.yaw) * (cy - p.y)).toBeGreaterThan(0);
    expect(p.z).toBeGreaterThan(map.floor[leaf.cells[0][1] * map.w + leaf.cells[0][0]] + 2);
    expect(roomIcon(map.rooms[leaf.to], leaf.to === floor!.reliquary)).toBe(
      leaf.to === floor!.reliquary ? 'reliquary' : map.rooms[leaf.to].kind === 'combat' ? map.rooms[leaf.to].focus : map.rooms[leaf.to].kind);
  }));
});

it('batches the floor into one draw/upload and keeps each quad facing inward with destination atlas UVs', () => {
  const { map, floor } = loadRunMap({ heaven: 1, floor: 1, seed: PINNED.seed, fixture: null });
  const ctx = { save() {}, translate() {}, scale() {}, stroke() {}, restore() {} };
  vi.stubGlobal('Path2D', class {});
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
  try {
    const sigils = new DoorSigils(map, floor);
    expect(sigils.group.children).toHaveLength(1);
    const mesh = sigils.group.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    const position = mesh.geometry.getAttribute('position'), uv = mesh.geometry.getAttribute('uv');
    expect(position.count).toBe(map.rooms.reduce((n, r) => n + r.leaves.length * 4, 0));
    const side = Math.ceil(Math.sqrt(map.rooms.length));
    let vertex = 0;
    map.rooms.forEach((r, i) => r.leaves.forEach((leaf, j) => {
      const a = new THREE.Vector3().fromBufferAttribute(position, vertex);
      const b = new THREE.Vector3().fromBufferAttribute(position, vertex + 1);
      const c = new THREE.Vector3().fromBufferAttribute(position, vertex + 2);
      const normal = b.sub(a).cross(c.sub(a)).normalize(), pose = sigilPose(map, i, j);
      expect(normal.x * Math.sin(pose.yaw) + normal.z * Math.cos(pose.yaw)).toBeCloseTo(1);
      expect(a.distanceTo(new THREE.Vector3().fromBufferAttribute(position, vertex + 1))).toBeCloseTo(1.2, 4);
      const centerU = (uv.getX(vertex) + uv.getX(vertex + 2)) / 2;
      const centerV = (uv.getY(vertex) + uv.getY(vertex + 2)) / 2;
      expect(Math.floor(centerU * side)).toBe(leaf.to % side);
      expect(Math.floor((1 - centerV) * side)).toBe(Math.floor(leaf.to / side));
      vertex += 4;
    }));
    const textureDispose = vi.spyOn(mesh.material.map!, 'dispose'), geometryDispose = vi.spyOn(mesh.geometry, 'dispose');
    sigils.dispose(); expect(textureDispose).toHaveBeenCalledOnce(); expect(geometryDispose).toHaveBeenCalledOnce();
  } finally { vi.unstubAllGlobals(); }
});
