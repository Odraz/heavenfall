/** A shared map glyph over each leaf, facing the owner room. No collision or authority (R1.5). */
import * as THREE from 'three';
import type { Floor } from '../gen/generate';
import type { GameMap } from '../sim/map';
import { drawMapIcon, roomIcon } from '../client/mapIcons';
import { drawRewardIcon, loadRewardArt } from '../client/rewardIcon';

export function sigilPose(map: GameMap, room: number, leaf: number) {
  const owner = map.rooms[room], cells = owner.leaves[leaf].cells;
  let x = cells.reduce((n, c) => n + c[0] + 0.5, 0) / 4;
  let y = cells.reduce((n, c) => n + c[1] + 0.5, 0) / 4;
  const cx = (owner.rect.x0 + owner.rect.x1 + 1) / 2, cy = (owner.rect.y0 + owner.rect.y1 + 1) / 2;
  // The quad's normal points inward; put it on the inside face of the one-cell door column.
  const vertical = cells.every((c) => c[0] === cells[0][0]);
  const nx = vertical ? Math.sign(cx - x) : 0, ny = vertical ? 0 : Math.sign(cy - y);
  x += nx * 0.51; y += ny * 0.51;
  const [c, r] = cells[0];
  return { x, y, z: map.floor[r * map.w + c] + 3.2, yaw: Math.atan2(nx, ny) };
}

export class DoorSigils {
  readonly group = new THREE.Group();
  private readonly geometry = new THREE.BufferGeometry();
  private material: THREE.MeshBasicMaterial | null = null;
  private disposed = false;
  constructor(map: GameMap, floor: Floor | null) {
    if (!floor) return;
    // One upload and one draw for all leaves: additional clients must fit the existing Loading budget.
    const side = Math.ceil(Math.sqrt(map.rooms.length)), tile = 128;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = side * tile;
    const ctx = canvas.getContext('2d')!;
    const paint = (): void => map.rooms.forEach((room, i) => {
      const x = (i % side) * tile, y = Math.floor(i / side) * tile;
      drawMapIcon(ctx, roomIcon(room, i === floor.reliquary), x + 64, y + 64, 96);
      if (room.secondary && i !== floor.reliquary) drawMapIcon(ctx, room.secondary, x + 105, y + 105, 40);
      if (room.kind === 'combat') drawRewardIcon(ctx, floor.rewards[i], x + 26, y + 102, 44);
    });
    paint();
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    // Reward art loads asynchronously: draw it once more, then upload the texture again.
    void loadRewardArt().then(() => { if (this.disposed) return; paint(); texture.needsUpdate = true; });
    this.material = new THREE.MeshBasicMaterial({ map: texture, alphaTest: 0.1 });
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    map.rooms.forEach((owner, i) => owner.leaves.forEach((leaf, j) => {
      if (leaf.to < 0) return;
      const p = sigilPose(map, i, j), first = positions.length / 3;
      for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]]) {
        positions.push(p.x + x * Math.cos(p.yaw), p.z + z, p.y - x * Math.sin(p.yaw));
      }
      const u = (leaf.to % side) / side, v = 1 - Math.floor(leaf.to / side) / side, d = 1 / side;
      uvs.push(u, v - d, u + d, v - d, u + d, v, u, v);
      indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
    }));
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    this.geometry.setIndex(indices); this.geometry.computeBoundingSphere();
    this.group.add(new THREE.Mesh(this.geometry, this.material));
  }
  dispose(): void {
    this.disposed = true;
    this.geometry.dispose();
    this.material?.map?.dispose(); this.material?.dispose();
  }
}
