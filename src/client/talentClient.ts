/**
 * The client side of talents (R4): every player's resolved kit from the host, the Betrayer's coins,
 * wires, traps and shadows, The Informer's outlines through walls, One of Them's silhouettes and each
 * talent effect's VFX. Accepted host facts only: nothing here decides a hit, a bind or an offer.
 */
import * as THREE from 'three';
import { ENEMIES, CHERUB, CHORISTER, WATCHMAN, isCommander } from '../data/enemies';
import { BASE_ABILITIES, TALENT, talentNode } from '../data/talents';
import type { ClassId } from '../data/classes';
import type { FloorSync, GameEvent, KitState, RiteOffer, TalentArea } from '../net/messages';
import { abilityDef } from '../sim/build';
import { coinHeight } from '../sim/talentGeometry';
import type { Vfx } from '../render/vfx';
import type { InterpolatedEnemies } from './snapshots';
import { INFORMER, THROUGH_THE_THRONG } from '../sim/talents';
import type { GameMap } from '../sim/map';
import { FireView } from './fireView';
import type { IncenseClouds } from '../render/incense';
import { FLAG_ROOTED, FLAG_SLOWED } from '../net/protocol';

interface Pose { x: number; y: number; z: number }
export interface TalentDeps {
  vfx: Vfx;
  glow: THREE.Texture;
  localId: number;
  classOf: (id: number) => ClassId | undefined;
  pose: (id: number) => Pose | undefined;
  /** Runs an effect of another player's after the render delay; the own one at once. */
  later: (playerId: number, run: (now: number) => void) => void;
  /** The map, for floor fire cells; and the estimated host tick now (fractional). */
  map: GameMap;
  tick: () => number;
  /** The incense renderer and the height its puffs float above at a point under a cloud at height z. */
  incense: IncenseClouds;
  cloudBase: (x: number, y: number, z: number) => number;
}

const SILVER = 0xdfe6ef;
const FROST = 0xcfe3ff;
const CLAY = 0xb5452c;
const CHAIN = 0xd8401c;

interface Drawn { area: TalentArea; obj: THREE.Object3D; arrived: number }

export class TalentClient {
  readonly group = new THREE.Group();
  readonly kits = new Map<number, KitState>();
  readonly hidden = new Set<number>();
  offers: RiteOffer[] = [];
  private readonly drawn = new Map<number, Drawn>();
  private readonly outlines: THREE.Sprite[] = [];
  private readonly veils = new Map<number, THREE.Mesh>();
  private readonly silver = new THREE.MeshBasicMaterial({ color: SILVER });
  private readonly dark = new THREE.MeshBasicMaterial({ color: 0x07060a, transparent: true, opacity: 0.6, depthWrite: false });
  private readonly outlineMaterial: THREE.SpriteMaterial;

  readonly fire: FireView;

  constructor(private readonly d: TalentDeps) {
    this.outlineMaterial = new THREE.SpriteMaterial({ map: d.glow, color: 0xe8f0ff, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false, fog: false });
    this.fire = new FireView(d.map, d.glow);
    this.group.add(this.fire.group);
  }

  own(): KitState | undefined {
    return this.kits.get(this.d.localId);
  }

  ownHas(id: string): boolean {
    return this.own()?.active.includes(id) ?? false;
  }

  /** The assigned Q/E ability id for a player, its base one until the host says otherwise. */
  ability(playerId: number, slot: 'Q' | 'E'): string {
    const k = this.kits.get(playerId), cls = this.d.classOf(playerId);
    if (k) return slot === 'Q' ? k.q : k.e;
    return cls ? BASE_ABILITIES[cls][slot === 'Q' ? 0 : 1] : '';
  }

  /** The own Q/E definition for the HUD, cooldowns and hints. */
  ownDef(classId: ClassId, slot: 'Q' | 'E') {
    return abilityDef(classId, slot, this.ability(this.d.localId, slot));
  }

  /** Through the Throng (`b.1a`): the crowd doesn't slow the own movement. */
  get unslowed(): boolean {
    return this.ownHas(THROUGH_THE_THRONG);
  }

  /**
   * The own wading rule from talents (R5), by an enemy's snapshot flags: Unbowed counts only bound
   * enemies, Iron Stride leaves out slowed ones, and Walk in the Smoke leaves out every enemy while the
   * feet stand in its owner's incense. Undefined: every pressing enemy counts.
   */
  wadeIgnore(x: number, y: number, z: number): ((flags: number) => boolean) | undefined {
    if (this.inSmoke(x, y, z)) return () => true;
    const unbowed = this.ownHas('fallen.a.2b'), stride = this.ownHas('binder.b.1b');
    if (!unbowed && !stride) return undefined;
    return (f) => (unbowed && !(f & FLAG_ROOTED)) || (stride && !!(f & FLAG_SLOWED));
  }

  /** Whether feet stand in the incense of a Heretic with Walk in the Smoke (any player qualifies). */
  inSmoke(x: number, y: number, z: number): boolean {
    for (const { area } of this.drawn.values()) {
      if (area.kind !== 'cloud' || !this.kits.get(area.playerId)?.active.includes('heretic.c.1b')) continue;
      const at = area.y1 >= 0 ? this.d.pose(area.y1) : undefined;
      const cx = at?.x ?? area.x, cy = at?.y ?? area.y, cz = at ? at.z + 0.9 : area.z;
      if (Math.hypot(x - cx, y - cy) <= area.x1 && Math.abs(z - cz) <= 2.5) return true;
    }
    return false;
  }

  areaOf(playerId: number, kind: TalentArea['kind']): TalentArea | undefined {
    for (const { area } of this.drawn.values()) if (area.playerId === playerId && area.kind === kind) return area;
    return undefined;
  }

  sync(msg: FloorSync, now: number): void {
    if (msg.kits) for (const k of msg.kits) this.kits.set(k.playerId, k);
    if (msg.talentAreas) {
      for (const id of [...this.drawn.keys()]) this.remove(id);
      for (const a of msg.talentAreas) this.add(a, now);
    }
    if (msg.fires || msg.talentAreas) this.fire.sync(msg.fires, msg.tick);
  }

  /** A host event; returns true when it was a talent event. */
  event(e: GameEvent, now: number): boolean {
    switch (e.type) {
      case 'kit': this.kits.set(e.kit.playerId, e.kit); return true;
      case 'hidden': if (e.hidden) this.hidden.add(e.playerId); else this.hidden.delete(e.playerId); return true;
      case 'riteOffers': this.offers = e.offers; return true;
      case 'talentArea':
        // A worn cloud detached (or Bread's count changed): update in place, never restart the puffs.
        if (!e.end && this.drawn.has(e.area.id) && (e.area.kind === 'cloud' || e.area.kind === 'bread')) {
          const d = this.drawn.get(e.area.id)!;
          d.area = e.area;
          if (e.area.kind === 'cloud' && e.area.y1 < 0) { this.d.incense.move(e.area.id, e.area.x, e.area.y); d.obj.position.set(e.area.x, e.area.z, e.area.y); }
          return true;
        }
        if (e.end) {
          const old = this.drawn.get(e.area.id);
          if (old && e.reason === 'spent') this.d.vfx.glow(now, old.area.x, old.area.y, old.area.z + 0.3, CHAIN, 0.2, 0.9, 260);
          this.remove(e.area.id);
        } else this.add(e.area, now);
        return true;
      case 'talentFx': this.d.later(e.playerId, (t) => this.fx(e, t)); return true;
      case 'fire': this.fire.apply(e.playerId, e.cells, e.ends, this.d.tick()); return true;
      case 'tracer': {
        const pts: Array<[number, number, number]> = [[e.x, e.y, e.z], [e.ex, e.ey, e.ez]];
        this.d.later(e.playerId, (t) => {
          this.d.vfx.beam(t, pts, e.silver ? 0x9fb3ff : 0xfff1c8, e.silver ? 0.12 : 0.05, e.silver ? 260 : 160);
          this.d.vfx.beam(t, pts, 0xffffff, e.silver ? 0.04 : 0.02, e.silver ? 260 : 160);
        });
        return true;
      }
      default: return false;
    }
  }

  private fx(e: Extract<GameEvent, { type: 'talentFx' }>, now: number): void {
    const v = this.d.vfx, p = e.pts;
    switch (e.kind) {
      case 'frost':
        for (let i = 0; i < p.length; i += 3) { v.ring(now, p[i], p[i + 1], p[i + 2] + 0.05, FROST, 0.3, TALENT.frostRadius, 380); v.glow(now, p[i], p[i + 1], p[i + 2] + 0.6, FROST, 0.3, 1.1, 300, 0, 0.5); }
        break;
      case 'spark':
        for (let i = 0; i < p.length; i += 6) v.beam(now, [[p[i], p[i + 1], p[i + 2]], [p[i + 3], p[i + 4], p[i + 5]]], 0xeef4ff, 0.05, 240);
        break;
      case 'clay':
        for (let i = 0; i < p.length; i += 3) v.ring(now, p[i], p[i + 1], p[i + 2] + 0.05, CLAY, 0.2, TALENT.vesselRadius, 300);
        break;
      case 'nail':
        for (let i = 0; i < p.length; i += 3) { v.glow(now, p[i], p[i + 1], p[i + 2], 0xffffff, 0.2, 0.7, 220); v.ring(now, p[i], p[i + 1], p[i + 2] - 0.7, CHAIN, 0.3, TALENT.nailRadius, 320); }
        break;
      case 'split':
        v.glow(now, p[0], p[1], p[2], 0xffffff, 0.2, 1.4, 260);
        break;
      case 'recoil':
        v.smoke(now, p[0], p[1], p[2] + 1.2, 0x2a2730, 0.2, 0.9, 300);
        break;
      case 'potter':
        for (let i = 0; i < p.length; i += 3) v.beam(now, [[p[i], p[i + 1], p[i + 2]], [p[i], p[i + 1], p[i + 2] + 1.2]], CHAIN, 0.08, 400);
        break;
      case 'sicarius':
        for (let i = 0; i < p.length; i += 3) v.glow(now, p[i], p[i + 1], p[i + 2] + 0.9, 0xf2f6ff, 0.1, 0.5, 160);
        break;
      // The Fallen (R5).
      case 'ranks':
        for (let i = 0; i < p.length; i += 6) v.beam(now, [[p[i], p[i + 1], p[i + 2]], [p[i + 3], p[i + 4], p[i + 5]]], 0xff8a3a, 0.05, 160);
        break;
      case 'kindle':
        for (let i = 0; i < p.length; i += 3) v.glow(now, p[i], p[i + 1], p[i + 2] + 0.4, 0xff6a1a, 0.2, 0.9, 260);
        break;
      case 'brand':
        v.glow(now, p[0], p[1], p[2] + 0.6, 0xff5a1c, 0.4, 2.2, 320); v.ring(now, p[0], p[1], p[2], 0xff6a2a, 0.3, 2, 360);
        break;
      case 'wormwood':
        v.glow(now, p[0], p[1], p[2] + 0.8, 0xfff4d8, 0.4, 2.5, 260); v.ring(now, p[0], p[1], p[2], 0xfff0c8, 0.3, 2.5, 320);
        break;
      case 'fireRing':
        v.ring(now, p[0], p[1], p[2], 0xff5a1c, 0.5, 4, 420);
        break;
      case 'charge':
        for (let i = 3; i < p.length; i += 3) v.beam(now, [[p[i - 3], p[i - 2], p[i - 1] + 0.1], [p[i], p[i + 1], p[i + 2] + 0.1]], 0xff4a12, 0.9, 1000);
        break;
      case 'shove':
        for (let i = 0; i < p.length; i += 3) v.smoke(now, p[i], p[i + 1], p[i + 2] + 0.6, 0x5a3424, 0.2, 0.7, 260);
        break;
      case 'underfoot':
        for (let i = 0; i < p.length; i += 3) v.ring(now, p[i], p[i + 1], p[i + 2], 0xff6a2a, 0.1, 0.8, 240);
        break;
      case 'redIron':
        v.beam(now, [[p[0], p[1], p[2]], [p[3], p[4], p[5]]], 0xff3a10, 0.06, 200);
        break;
      case 'wrath':
        v.ring(now, p[0], p[1], p[2], 0xff3a10, 0.5, 4, 360); v.glow(now, p[0], p[1], p[2] + 1, 0xff5a1c, 0.5, 3, 300);
        break;
      // The Heretic Saint (R5).
      case 'exorcism':
        v.ring(now, p[0], p[1], p[2], 0xffffff, 0.5, 5, 320);
        break;
      case 'fork':
        v.beam(now, [[p[0], p[1], p[2]], [p[3], p[4], p[5]]], 0x5ee65e, 0.1, 520);
        break;
      case 'lazarus':
        v.ring(now, p[0], p[1], p[2], 0xfff4c8, 0.3, p[3], 360); v.glow(now, p[0], p[1], p[2] + 1, 0xfff0b0, 0.3, p[3] * 0.7, 300);
        break;
      case 'harvest':
        v.glow(now, p[0], p[1], p[2] + 0.6, 0x5ee65e, 0.2, 0.8, 360);
        break;
      case 'irons': case 'stake':
        v.ring(now, p[0], p[1], p[2], CHAIN, 0.2, e.kind === 'stake' ? 3.5 : 0.8, 360);
        break;
      case 'resurrect':
        for (let i = 0; i < p.length; i += 3) v.beam(now, [[p[i], p[i + 1], p[i + 2]], [p[i], p[i + 1], p[i + 2] + 6]], 0xfff6d8, 0.4, 700);
        break;
      case 'crash':
        for (let i = 0; i < p.length; i += 3) { v.ring(now, p[i], p[i + 1], p[i + 2], 0xfff0c0, 0.2, 1.2, 280); v.glow(now, p[i], p[i + 1], p[i + 2] + 0.3, 0xffe6a0, 0.2, 1, 240); }
        break;
      default:
        break;
    }
  }

  private add(a: TalentArea, now: number): void {
    this.remove(a.id);
    let obj: THREE.Object3D;
    if (a.kind === 'coin') {
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 18), this.silver);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.d.glow, color: SILVER, transparent: true, opacity: 0.6, depthWrite: false }));
      glow.scale.set(0.8, 0.8, 1);
      obj = new THREE.Group(); obj.add(coin, glow);
    } else if (a.kind === 'wire') {
      obj = new THREE.Group();
      const dx = a.x1 - a.x, dy = a.y1 - a.y, dz = a.z1 - a.z, len = Math.hypot(dx, dy, dz);
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, Math.max(0.01, len), 5), new THREE.MeshBasicMaterial({ color: 0xf4f7fb }));
      wire.position.set((a.x + a.x1) / 2, (a.z + a.z1) / 2, (a.y + a.y1) / 2);
      wire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dz, dy).normalize());
      obj.add(wire);
      for (const [x, y, z] of [[a.x, a.y, a.z], [a.x1, a.y1, a.z1]]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.75, 8), new THREE.MeshBasicMaterial({ color: 0x3a3238 }));
        post.position.set(x, z - 0.6 + 0.375, y); obj.add(post);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 12), this.silver);
        cap.position.set(x, z + 0.16, y); obj.add(cap);
      }
    } else if (a.kind === 'trap') {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 16), this.silver);
      disc.position.set(a.x, a.z + 0.03, a.y);
      obj = disc;
    } else if (a.kind === 'shadow') {
      // The Way Back's shadow: a dark standing silhouette everyone sees.
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 1.75, 10), this.dark);
      body.position.set(a.x, a.z + 0.9, a.y);
      obj = body;
    } else obj = this.r5Area(a);
    this.group.add(obj);
    this.drawn.set(a.id, { area: a, obj, arrived: now });
    if (a.kind === 'cloud') {
      // The incense puffs: for its remaining life, following its wearer while worn.
      const left = Math.max(0.2, (a.endTick - this.d.tick()) / 30);
      const follow = a.y1 >= 0 ? () => { const p = this.d.pose(a.y1); return p ? [p.x, p.y, p.z] as const : null; } : undefined;
      this.d.incense.add(now, a.x, a.y, (x, y) => this.d.cloudBase(x, y, a.z), { id: a.id, radius: a.x1, life: left, tall: a.z1 === 1, follow });
    }
  }

  /** R5 areas: flat floor shapes in each effect's color, so everyone sees where it acts. */
  private r5Area(a: TalentArea): THREE.Object3D {
    const g = new THREE.Group();
    const flat = (geo: THREE.BufferGeometry, color: number, opacity: number, y = 0.05) => {
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
      m.position.y = y; m.renderOrder = 2; g.add(m);
      return m;
    };
    const line = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number, width: number) => {
      const dx = x1 - x0, dy = y1 - y0, len = Math.max(0.01, Math.hypot(dx, dy));
      const bar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, width), new THREE.MeshBasicMaterial({ color }));
      bar.position.set((x0 + x1) / 2 - a.x, (z0 + z1) / 2 + 0.08 - a.z, (y0 + y1) / 2 - a.y);
      bar.rotation.y = -Math.atan2(dy, dx);
      g.add(bar);
    };
    switch (a.kind) {
      case 'rain':
        // Rain of Fire: a red-orange rim at the circle's edge and a faint glow inside; flakes fall in update.
        flat(new THREE.RingGeometry(a.x1 - 0.2, a.x1, 48), 0xff6a2a, 0.75);
        flat(new THREE.CircleGeometry(a.x1, 40), 0xff4a1a, 0.12, 0.03);
        break;
      case 'well':
        flat(new THREE.CircleGeometry(1, 24), 0x050407, 0.95, 0.06);
        flat(new THREE.RingGeometry(a.x1 - 0.15, a.x1, 56), 0x8b8f99, 0.7);
        flat(new THREE.RingGeometry(1, 1.2, 24), 0x55585f, 0.9, 0.07);
        break;
      case 'frost':
        flat(new THREE.CircleGeometry(a.x1, 28), 0xa58cff, 0.35);
        flat(new THREE.RingGeometry(a.x1 - 0.1, a.x1, 28), 0xd8ccff, 0.7, 0.06);
        break;
      case 'boundary': case 'furrow':
        line(a.x, a.y, a.z, a.x1, a.y1, a.z1, a.kind === 'boundary' ? CHAIN : 0xff5a1c, a.kind === 'boundary' ? 0.18 : 1.5);
        break;
      case 'bread':
        flat(new THREE.RingGeometry(a.x1 - 0.12, a.x1, 48), 0x5ee65e, 0.5);
        break;
      case 'cloud':
        // A faint rusty-gold rim at the incense's reach (worn clouds follow their wearer).
        flat(new THREE.RingGeometry(a.x1 - 0.1, a.x1, 48), 0xd8a24a, 0.35);
        break;
      default:
        break;
    }
    g.position.set(a.x, a.z, a.y);
    return g;
  }

  private remove(id: number): void {
    const d = this.drawn.get(id);
    if (!d) return;
    if (d.area.kind === 'cloud') this.d.incense.removeId(id);
    this.group.remove(d.obj);
    d.obj.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    this.drawn.delete(id);
  }

  /** Animates coins and draws the outlines and silhouettes for this frame. */
  update(now: number, enemies: InterpolatedEnemies, players: ReadonlyArray<{ id: number; x: number; y: number; z: number; dead: boolean }>, roomAt: (x: number, y: number) => number): void {
    this.fire.update(this.d.tick(), now);
    const tick = this.d.tick();
    for (const { area, obj } of this.drawn.values()) {
      // Areas that follow a player (Bread's ring, a worn cloud) take its pose each frame.
      const wearer = area.kind === 'bread' ? area.playerId : area.kind === 'cloud' && area.y1 >= 0 ? area.y1 : -1;
      if (wearer >= 0) { const pose = this.d.pose(wearer) ?? players.find((q) => q.id === wearer); if (pose) obj.position.set(pose.x, pose.z, pose.y); }
      if (area.kind === 'rain' && tick >= area.startTick && Math.random() < 0.6) {
        const r = Math.sqrt(Math.random()) * area.x1, t = Math.random() * Math.PI * 2;
        const x = area.x + Math.cos(t) * r, y = area.y + Math.sin(t) * r;
        this.d.vfx.mote(now, [x, y, area.z + 7], [x, y, area.z + 0.1], 0xff7a2a, 0.18, 600);
      }
    }
    for (const { area, obj, arrived } of this.drawn.values()) {
      if (area.kind !== 'coin') continue;
      const age = (now - arrived) / 1000;
      obj.position.set(area.x, coinHeight(area.z, age), area.y);
      obj.children[0].rotation.set(Math.PI / 2, 0, now / 90);
    }
    // The Informer: ordinary casters and elites within 40 m of an informer, in its room, through walls.
    const informers = players.filter((p) => !p.dead && this.kits.get(p.id)?.active.includes(INFORMER));
    let n = 0;
    if (informers.length) {
      for (let i = 0; i < enemies.count; i++) {
        const type = enemies.type[i];
        if (type !== CHORISTER && type !== CHERUB && type !== WATCHMAN && !isCommander(type)) continue;
        const x = enemies.x[i], y = enemies.y[i], z = enemies.z[i];
        if (!informers.some((p) => Math.hypot(p.x - x, p.y - y) <= TALENT.informer && roomAt(p.x, p.y) === roomAt(x, y))) continue;
        const s = this.outlines[n] ?? this.newOutline();
        const def = ENEMIES[type];
        s.visible = true; s.position.set(x, z + def.height / 2, y); s.scale.set(def.radius * 4, def.height * 1.3, 1);
        n++;
      }
    }
    for (let i = n; i < this.outlines.length; i++) this.outlines[i].visible = false;
    // One of Them: a dark veil over each hidden player but yourself.
    for (const [id, veil] of this.veils) if (!this.hidden.has(id)) { this.group.remove(veil); this.veils.delete(id); }
    for (const id of this.hidden) {
      if (id === this.d.localId) continue;
      const p = players.find((q) => q.id === id);
      if (!p) continue;
      let veil = this.veils.get(id);
      if (!veil) { veil = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.9, 10), this.dark); this.veils.set(id, veil); this.group.add(veil); }
      veil.position.set(p.x, p.z + 0.95, p.y);
    }
  }

  private newOutline(): THREE.Sprite {
    const s = new THREE.Sprite(this.outlineMaterial);
    s.renderOrder = 10;
    this.group.add(s); this.outlines.push(s);
    return s;
  }

  /** Card text for a node: its one-line rule and what it changes now. */
  static nodeLabel(id: string): string {
    return talentNode(id)?.name ?? id;
  }

  dispose(): void {
    for (const id of [...this.drawn.keys()]) this.remove(id);
    this.group.clear();
  }
}
