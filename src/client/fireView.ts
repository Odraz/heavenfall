/**
 * Class floor fire on the client (classes-fallen.md "Hellfire", classes-heretic.md "Burning ground"): the
 * host's burning cells by owner, drawn as low red-orange flames with a floor glow, fading over each
 * cell's last 0.5 s (game.md §4.10's damage color, with motion). Accepted host facts only.
 */
import * as THREE from 'three';
import type { FireState } from '../net/messages';
import { TICK_HZ } from '../sim/constants';
import type { GameMap } from '../sim/map';

const MAX = 2048;
const FADE_TICKS = TICK_HZ / 2;
const FLAME = new THREE.Color(0xe8380c);
const EMBER = new THREE.Color(0xff9a2a);
const FLOOR = new THREE.Color(0x9a1c06);

export class FireView {
  readonly group = new THREE.Group();
  /** End tick by cell, per owner. */
  readonly cells = new Map<number, Map<number, number>>();
  private readonly flames: THREE.InstancedMesh;
  private readonly glows: THREE.InstancedMesh;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly c = new THREE.Color();

  constructor(private readonly map: GameMap, glow: THREE.Texture, flames: THREE.Texture = glow) {
    // Normal blending: additive washes out to white over the bright marble. The painted flames (B10)
    // shape each tongue; the floor keeps the soft glow.
    const flameMaterial = new THREE.MeshBasicMaterial({ map: flames, color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const glowMaterial = new THREE.MeshBasicMaterial({ map: glow, color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, fog: false });
    // Two crossed upright quads per cell, so the flame reads from every side.
    const a = new THREE.PlaneGeometry(1, 1), b = new THREE.PlaneGeometry(1, 1);
    b.rotateY(Math.PI / 2);
    const merged = new THREE.BufferGeometry();
    const pos = [...a.attributes.position.array, ...b.attributes.position.array];
    const uv = [...a.attributes.uv.array, ...b.attributes.uv.array];
    merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    merged.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    merged.setIndex([...Array.from(a.index!.array as ArrayLike<number>), ...Array.from(b.index!.array as ArrayLike<number>, (i) => i + 4)]);
    merged.translate(0, 0.5, 0);
    this.flames = new THREE.InstancedMesh(merged, flameMaterial, MAX);
    const floor = new THREE.PlaneGeometry(1.25, 1.25);
    floor.rotateX(-Math.PI / 2);
    this.glows = new THREE.InstancedMesh(floor, glowMaterial, MAX);
    for (const m of [this.flames, this.glows]) { m.count = 0; m.frustumCulled = false; m.renderOrder = 3; this.group.add(m); }
  }

  /** A `fire` event: cells lit or refreshed until their end ticks; an end at or before `now` puts one out. */
  apply(playerId: number, cells: readonly number[], ends: readonly number[], now: number): void {
    let own = this.cells.get(playerId);
    if (!own) { own = new Map(); this.cells.set(playerId, own); }
    cells.forEach((cell, i) => { if (ends[i] <= now) own!.delete(cell); else own!.set(cell, ends[i]); });
  }

  /** floorSync: every still-burning cell, replacing what was drawn. */
  sync(fires: readonly FireState[] | undefined, now: number): void {
    this.cells.clear();
    for (const f of fires ?? []) this.apply(f.playerId, f.cells, f.ends, now);
  }

  /** Burning cells now, for tests and the debug view. */
  count(tick: number): number {
    let n = 0;
    for (const own of this.cells.values()) for (const end of own.values()) if (end > tick) n++;
    return n;
  }

  /** Draws every burning cell at host tick `tick` (fractional), flickering with `ms`. */
  update(tick: number, ms: number): void {
    let n = 0;
    const w = this.map.w;
    for (const own of this.cells.values()) {
      for (const [cell, end] of own) {
        if (end <= tick) { own.delete(cell); continue; }
        if (n >= MAX) break;
        const x = cell % w + 0.5, y = Math.floor(cell / w) + 0.5, z = this.map.floor[cell];
        const fade = Math.min(1, (end - tick) / FADE_TICKS);
        const flicker = 0.75 + 0.25 * Math.sin(ms / 90 + cell * 1.7) * Math.sin(ms / 53 + cell * 0.9);
        this.s.set(0.75, (0.55 + 0.35 * flicker) * fade, 0.75);
        this.q.setFromAxisAngle(this.v.set(0, 1, 0), (cell % 7) * 0.45);
        this.m.compose(this.v.set(x, z, y), this.q, this.s);
        this.flames.setMatrixAt(n, this.m);
        this.c.copy(FLAME).lerp(EMBER, 0.6 * flicker);
        this.flames.setColorAt(n, this.c);
        this.m.compose(this.v.set(x, z + 0.04, y), this.q.identity(), this.s.set(fade, 1, fade));
        this.glows.setMatrixAt(n, this.m);
        this.glows.setColorAt(n, this.c.copy(FLAME).lerp(FLOOR, 0.4));
        n++;
      }
    }
    for (const m of [this.flames, this.glows]) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  dispose(): void {
    this.flames.dispose(); this.glows.dispose();
    this.group.clear();
  }
}
