import * as THREE from 'three';
import { WATCHMAN } from '../data/enemies';
import { WATCHMAN_AIM_TICKS, WATCHMAN_MUZZLE_Z, WATCHMAN_RECORD_CAP, type WatchmanAim } from '../data/watchman';
import type { GameMap } from '../sim/map';
import { raycastTerrain } from '../sim/los';
import { Ribbon } from '../render/vfx';
import type { InterpolatedEnemies } from './snapshots';

/** The thread brightens and thickens over the aim, 0.02 → 0.05 m (rooms.md §6.4). */
export const THREAD_WIDTH_START = 0.02;
export const THREAD_WIDTH_END = 0.05;
/** The levelled Clarion's bell sits this far in front of the Watchman's center: the drawn model's (watchman.py), or the placeholder rod's. */
export const BELL_FORWARD = 1.85;
export const ROD_BELL_FORWARD = 0.6;
/** The placeholder Clarion: a gold rod carried upright on the shoulder, the bell about 2.5 m up. */
const ROD_LENGTH = 1.3;
const ROD_SHOULDER = 0.25;
const ROD_UPRIGHT_Z = 1.85;
const LABEL_Z = 2.75;

export interface ThreadLine {
  from: [number, number, number];
  to: [number, number, number];
  width: number;
  opacity: number;
}

/**
 * The aim thread at `tick` (fractional): from the bell toward the target's drawn body center,
 * stopped by the first terrain on the way, as the shot will be. Pure.
 */
export function threadLine(map: GameMap, ex: number, ey: number, ez: number, tx: number, ty: number, tz: number, fireTick: number, tick: number, bell = BELL_FORWARD): ThreadLine | null {
  const dx = tx - ex, dy = ty - ey, h = Math.hypot(dx, dy);
  if (h < 1e-6) return null;
  // A target closer than the bell: the thread starts at the Watchman's own muzzle.
  const f = Math.min(bell, h * 0.5);
  const bx = ex + (dx / h) * f, by = ey + (dy / h) * f, bz = ez + WATCHMAN_MUZZLE_Z;
  const vx = tx - bx, vy = ty - by, vz = tz - bz, len = Math.hypot(vx, vy, vz);
  if (len < 1e-6) return null;
  const t = raycastTerrain(map, bx, by, bz, vx / len, vy / len, vz / len, len);
  const k = Math.max(0, Math.min(1, 1 - (fireTick - tick) / WATCHMAN_AIM_TICKS));
  return { from: [bx, by, bz], to: [bx + (vx / len) * t, by + (vy / len) * t, bz + (vz / len) * t],
    width: THREAD_WIDTH_START + (THREAD_WIDTH_END - THREAD_WIDTH_START) * k, opacity: 0.45 + 0.5 * k };
}

/** Threads for aiming Watchmen; without the Watchman atlas, the placeholder look (gold rod, dev label) for every Watchman. */
export class WatchmanView {
  readonly group = new THREE.Group();
  private readonly threadMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly threads: Ribbon[] = [];
  private readonly rodGeometry = new THREE.CylinderGeometry(0.035, 0.07, ROD_LENGTH, 8);
  private readonly rodMaterial = new THREE.MeshBasicMaterial({ color: 0xe8b84a });
  private readonly rods: THREE.Mesh[] = [];
  private readonly labels: THREE.Sprite[] = [];
  private readonly labelMaterial: THREE.SpriteMaterial | null;
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly dir = new THREE.Vector3();

  /**
   * `placeholder`: no Watchman atlas, so a Blessed sprite carries a coded gold rod; `label`: dev builds
   * also name it so it isn't mistaken for a Blessed.
   */
  constructor(beamTexture: THREE.Texture, private readonly placeholder: boolean, label: boolean) {
    for (let i = 0; i < WATCHMAN_RECORD_CAP; i++) {
      const m = new THREE.MeshBasicMaterial({ map: beamTexture, color: 0xffd36a, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
      const r = new Ribbon([[0, 0, 0], [0, 0, 1]], THREAD_WIDTH_START, m, 2);
      r.mesh.name = 'watchman-thread'; r.mesh.visible = false;
      this.threadMaterials.push(m); this.threads.push(r); this.group.add(r.mesh);
    }
    this.labelMaterial = placeholder && label ? new THREE.SpriteMaterial({ map: labelTexture(), transparent: true, depthWrite: false, fog: false }) : null;
  }

  /**
   * `aims`: the live records; `target(id)`: a player's drawn body center; `tick`: the estimated
   * fractional tick. Threads show while aiming; the rod is levelled toward its target while aiming.
   */
  update(ents: InterpolatedEnemies, enemyZ: ArrayLike<number>, aims: readonly WatchmanAim[], map: GameMap, tick: number, camera: THREE.Vector3,
    target: (id: number) => [number, number, number] | undefined): void {
    let n = 0, rods = 0;
    for (let i = 0; i < ents.count; i++) {
      if (ents.type[i] !== WATCHMAN) continue;
      const x = ents.x[i], y = ents.y[i], z = enemyZ[i];
      const a = aims.find((r) => r.slot === ents.slot[i] && r.incarnation === ents.incarnation[i]);
      const t = a?.phase === 'aim' ? target(a.targetId) : undefined;
      // With the atlas, the sprite draws the Clarion itself.
      const rod = this.placeholder ? this.rods[rods] ?? this.newRod() : null;
      if (rod && t) {
        this.dir.set(t[0] - x, t[2] - (z + WATCHMAN_MUZZLE_Z), t[1] - y).normalize();
        rod.quaternion.setFromUnitVectors(this.up, this.dir);
        rod.position.set(x + this.dir.x * (ROD_LENGTH / 2 - 0.05), z + WATCHMAN_MUZZLE_Z + this.dir.y * (ROD_LENGTH / 2 - 0.05), y + this.dir.z * (ROD_LENGTH / 2 - 0.05));
      } else if (rod) {
        rod.quaternion.identity();
        rod.position.set(x + ROD_SHOULDER, z + ROD_UPRIGHT_Z, y);
      }
      if (rod) rod.visible = true;
      if (this.labelMaterial) {
        const label = this.labels[rods] ?? this.newLabel();
        label.visible = true; label.position.set(x, z + LABEL_Z, y);
      }
      rods++;
      if (!t || n >= this.threads.length) continue;
      const line = threadLine(map, x, y, z, t[0], t[1], t[2], a!.fireTick, tick, this.placeholder ? ROD_BELL_FORWARD : BELL_FORWARD);
      if (!line) continue;
      const r = this.threads[n++];
      r.width = line.width; this.threadMaterials[n - 1].opacity = line.opacity;
      r.setPoints([line.from, line.to]); r.face(camera); r.mesh.visible = true;
    }
    for (let k = n; k < this.threads.length; k++) this.threads[k].mesh.visible = false;
    for (let k = rods; k < this.rods.length; k++) this.rods[k].visible = false;
    for (let k = rods; k < this.labels.length; k++) this.labels[k].visible = false;
  }

  private newRod(): THREE.Mesh {
    const m = new THREE.Mesh(this.rodGeometry, this.rodMaterial);
    m.name = 'watchman-clarion';
    this.rods.push(m); this.group.add(m);
    return m;
  }

  private newLabel(): THREE.Sprite {
    const s = new THREE.Sprite(this.labelMaterial!);
    s.name = 'watchman-label'; s.scale.set(1.6, 0.4, 1);
    this.labels.push(s); this.group.add(s);
    return s;
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const r of this.threads) r.mesh.geometry.dispose();
    for (const m of this.threadMaterials) m.dispose();
    this.rodGeometry.dispose(); this.rodMaterial.dispose();
    this.labelMaterial?.map?.dispose(); this.labelMaterial?.dispose();
  }
}

function labelTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(20, 14, 4, 0.7)'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#ffd36a'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('WATCHMAN', 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
