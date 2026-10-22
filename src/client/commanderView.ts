import * as THREE from 'three';
import { CARRIER_FLY_THROUGH, CARRIER_GRAB_RADIUS, CARRIER_MIN_FLIGHT, CARRIER_SWOOP, COMMANDER_RECORD_CAP, type CommanderCast } from '../data/commanders';
import type { GameMap } from '../sim/map';
import { beamSegment } from '../sim/commanders';
import { Ribbon } from '../render/vfx';

/** Chevrons along a Carrier's lane: one every 2 m, at most this many per record (a 32 m flight). */
const CHEVRON_SPACING = 2;
const CHEVRONS = 17;
/** The lane flashes white-gold for this many ticks when it locks (R06 follow-up §6). */
const LOCK_FLASH = 8;

/**
 * A floor chevron pointing along +x, as wide as the Carrier's grab reach: standing outside the
 * chevrons is outside the grab.
 */
function chevronGeometry(): THREE.BufferGeometry {
  const d = 0.7, w = CARRIER_GRAB_RADIUS, k = 0.55;
  const shape = new THREE.Shape([new THREE.Vector2(d, 0), new THREE.Vector2(-d, w), new THREE.Vector2(-d - k, w),
    new THREE.Vector2(d - k, 0), new THREE.Vector2(-d - k, -w), new THREE.Vector2(-d, -w)]);
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/**
 * Where a Carrier's lane chevrons stand (R06 follow-up §6): from the Carrier along its facing, to the
 * target and on past it as far as the flight goes, marching toward the target as ticks pass. Pure, for tests.
 */
export function chevronPoints(c: Pick<CommanderCast, 'x' | 'y' | 'yaw' | 'targetX' | 'targetY'>, tick: number): Array<[number, number]> {
  const length = Math.max(CARRIER_MIN_FLIGHT, Math.hypot(c.targetX - c.x, c.targetY - c.y) + CARRIER_FLY_THROUGH);
  const shift = (tick * 0.2) % CHEVRON_SPACING, out: Array<[number, number]> = [];
  for (let s = 1 + shift; s <= length && out.length < CHEVRONS; s += CHEVRON_SPACING) out.push([c.x + Math.cos(c.yaw) * s, c.y + Math.sin(c.yaw) * s]);
  return out;
}

/** Reusable meshes: host yaw/pitch drive the ray; local geometry only clips its visible length. */
export class CommanderView {
  readonly group = new THREE.Group();
  private readonly ring = new THREE.RingGeometry(1.9, 2, 48);
  private readonly cloth = new THREE.PlaneGeometry(0.7, 1.1);
  private readonly wardGeometry = new THREE.CylinderGeometry(1.2, 1.2, 2.4, 24, 1, true, 0, Math.PI * 2 / 3);
  private readonly wardMaterial = new THREE.MeshBasicMaterial({ color: 0xffd56c, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  private readonly gold = new THREE.MeshBasicMaterial({ color: 0xffdf88, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide });
  private readonly white = new THREE.MeshBasicMaterial({ color: 0xfffaf1, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
  private readonly beamGold: THREE.MeshBasicMaterial;
  private readonly beamCore: THREE.MeshBasicMaterial;
  private readonly beamGlow: THREE.MeshBasicMaterial;
  private readonly flareMat: THREE.SpriteMaterial;
  private readonly knotMat: THREE.SpriteMaterial;
  private readonly pool;
  private readonly chevron = chevronGeometry();
  private readonly lanes: Array<{ material: THREE.MeshBasicMaterial; marks: THREE.Mesh[] }>;
  /**
   * The damaging beam reads at play distance (audit batch 3): a wide soft glow around the 1 m gold
   * body, a white-hot core, flares at the open book and where the beam stops, and a bright knot that
   * runs along it on every damage pulse. Hits use the enemies' existing hurt flash.
   */
  constructor(beamTexture: THREE.Texture, glowTexture: THREE.Texture | null = null) {
    // Share Sacrament's textured, camera-facing beam language, with gold rather than healing green.
    this.beamGold = new THREE.MeshBasicMaterial({ map: beamTexture, color: 0xffc547, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.beamCore = new THREE.MeshBasicMaterial({ map: beamTexture, color: 0xfffaf1, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.beamGlow = new THREE.MeshBasicMaterial({ map: beamTexture, color: 0xffb43c, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.flareMat = new THREE.SpriteMaterial({ map: glowTexture, color: 0xffe9a0, transparent: true, depthWrite: false, fog: false });
    this.knotMat = new THREE.SpriteMaterial({ map: glowTexture, color: 0xfffaf1, transparent: true, depthWrite: false, fog: false });
    this.pool = Array.from({ length: COMMANDER_RECORD_CAP }, () => {
      const marker = new THREE.Mesh(this.cloth, this.white), ring = new THREE.Mesh(this.ring, this.gold);
      const ray = new Ribbon([[0, 0, 0], [0, 0, 1]], 1, this.beamGold, 3), core = new Ribbon([[0, 0, 0], [0, 0, 1]], 0.38, this.beamCore, 3);
      const glow = new Ribbon([[0, 0, 0], [0, 0, 1]], 2.6, this.beamGlow, 3);
      ray.mesh.name = 'cantor-beam'; core.mesh.name = 'cantor-beam-core'; glow.mesh.name = 'cantor-beam-glow';
      const origin = new THREE.Sprite(this.flareMat), impact = new THREE.Sprite(this.flareMat), knot = new THREE.Sprite(this.knotMat);
      origin.name = 'cantor-beam-origin'; impact.name = 'cantor-beam-impact'; knot.name = 'cantor-beam-knot';
      origin.scale.setScalar(2.4); impact.scale.setScalar(2.8); knot.scale.setScalar(1.5);
      ring.rotation.x = -Math.PI / 2;
      const ward = new THREE.Mesh(this.wardGeometry, this.wardMaterial); ward.name = 'cantor-frontal-ward';
      this.group.add(marker, ring, glow.mesh, ray.mesh, core.mesh, ward, origin, impact, knot); return { marker, ring, ray, core, glow, ward, origin, impact, knot };
    });
    this.lanes = Array.from({ length: COMMANDER_RECORD_CAP }, () => {
      const material = new THREE.MeshBasicMaterial({ color: 0xffc547, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, fog: false });
      const marks = Array.from({ length: CHEVRONS }, () => {
        const m = new THREE.Mesh(this.chevron, material); m.name = 'carrier-chevron'; m.renderOrder = 3; m.visible = false;
        this.group.add(m); return m;
      });
      return { material, marks };
    });
  }

  /**
   * A Carrier's lane (R06 follow-up §6): gold chevrons marching toward its target through the tell,
   * brightening as it nears; a white-gold flash as the lane locks; the rest of the lane while it flies.
   */
  private lane(i: number, c: CommanderCast | undefined, map: GameMap, tick: number): void {
    const lane = this.lanes[i];
    for (const m of lane.marks) m.visible = false;
    if (!c || c.kind !== 'carry' || (c.phase !== 'tell' && c.phase !== 'active')) return;
    const age = tick - c.phaseTick, progress = Math.max(0, Math.min(1, age / Math.max(1, c.endTick - c.phaseTick)));
    const locked = c.phase === 'active';
    if (locked && age >= CARRIER_SWOOP) return;
    lane.material.color.setHex(locked && age < LOCK_FLASH ? 0xfff4d0 : 0xffc547);
    lane.material.opacity = locked ? Math.max(0.2, 0.9 - age / 40) : 0.35 + 0.5 * progress;
    chevronPoints(c, locked ? 0 : tick).forEach(([x, y], k) => {
      const f = map.floor[Math.floor(y) * map.w + Math.floor(x)];
      if (!Number.isFinite(f)) return;
      const m = lane.marks[k];
      m.visible = true; m.position.set(x, f + 0.07, y); m.rotation.y = -c.yaw;
    });
  }
  update(casts: readonly CommanderCast[], map: GameMap, tick: number, camera: THREE.Vector3): void {
    for (let i = 0; i < this.pool.length; i++) {
      const v = this.pool[i], c = casts[i]; v.ward.visible = v.marker.visible = v.ring.visible = v.ray.mesh.visible = v.core.mesh.visible = false;
      v.glow.mesh.visible = v.origin.visible = v.impact.visible = v.knot.visible = false;
      this.lane(i, c, map, tick);
      if (!c || c.phase === 'idle' || c.phase === 'recover') continue;
      if (c.kind === 'beam') {
        v.ward.visible = true; v.ward.position.set(c.x, c.z + 1.5, c.y);
        v.ward.rotation.y = Math.PI / 2 - c.yaw - Math.PI / 3;
        const b = beamSegment(map, c);
        const progress = Math.max(0, Math.min(1, (tick - c.phaseTick) / Math.max(1, c.endTick - c.phaseTick)));
        const points: Array<[number, number, number]> = [[b.x, b.y, b.z], [b.x + b.dx * b.length, b.y + b.dy * b.length, b.z + b.dz * b.length]];
        // Warning stays slender throughout. Only the accepted active phase snaps to the full
        // one-metre damage width and adds the bright core; client time never starts damage early.
        v.ray.width = c.phase === 'tell' ? 0.04 + 0.12 * progress : 1;
        v.ray.mesh.visible = b.length > 1e-6; v.ray.setPoints(points); v.ray.face(camera);
        if (c.phase === 'active') {
          // Each 10-tick damage pulse sends a bright knot from the book to the beam's end.
          const pulse = ((tick - c.phaseTick) % 10) / 10;
          v.core.width = 0.38 + 0.22 * (1 - pulse);
          v.core.mesh.visible = v.glow.mesh.visible = v.ray.mesh.visible; v.core.setPoints(points); v.core.face(camera);
          v.glow.setPoints(points); v.glow.face(camera);
          v.origin.visible = v.impact.visible = v.knot.visible = v.ray.mesh.visible;
          v.origin.position.set(b.x, b.z, b.y);
          v.impact.position.set(b.x + b.dx * b.length, b.z + b.dz * b.length, b.y + b.dy * b.length);
          v.knot.position.set(b.x + b.dx * b.length * pulse, b.z + b.dz * b.length * pulse, b.y + b.dy * b.length * pulse);
        }
      } else {
        if (c.phase === 'carry') {
          v.ring.visible = true; v.ring.position.set(c.dropX, map.floor[Math.floor(c.dropY) * map.w + Math.floor(c.dropX)] + 0.06, c.dropY);
        }
        if (c.phase === 'carry') { v.marker.visible = true; v.marker.position.set(c.x, c.z - 0.8, c.y); v.marker.scale.set(1.8, 2, 1); }
        else v.marker.scale.setScalar(1);
      }
    }
  }
  dispose(): void {
    this.group.removeFromParent();
    for (const v of this.pool) { v.ray.mesh.geometry.dispose(); v.core.mesh.geometry.dispose(); v.glow.mesh.geometry.dispose(); }
    this.beamGlow.dispose(); this.flareMat.dispose(); this.knotMat.dispose();
    this.ring.dispose(); this.cloth.dispose(); this.gold.dispose(); this.white.dispose(); this.beamGold.dispose(); this.beamCore.dispose();
    this.wardGeometry.dispose(); this.wardMaterial.dispose();
    this.chevron.dispose(); for (const l of this.lanes) l.material.dispose();
  }
}
