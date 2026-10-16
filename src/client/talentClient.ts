/**
 * The client side of talents (R4): every player's resolved kit from the host, the Betrayer's coins,
 * wires, traps and shadows, The Informer's outlines through walls, One of Them's silhouettes and each
 * talent effect's VFX. Accepted host facts only: nothing here decides a hit, a bind or an offer.
 */
import * as THREE from 'three';
import { ENEMIES, CHERUB, CHORISTER, isCommander } from '../data/enemies';
import { BASE_ABILITIES, TALENT, talentNode } from '../data/talents';
import type { ClassId } from '../data/classes';
import type { FloorSync, GameEvent, KitState, RiteOffer, TalentArea } from '../net/messages';
import { abilityDef } from '../sim/build';
import { coinHeight } from '../sim/talentGeometry';
import type { Vfx } from '../render/vfx';
import type { InterpolatedEnemies } from './snapshots';
import { INFORMER, THROUGH_THE_THRONG } from '../sim/talents';

interface Pose { x: number; y: number; z: number }
export interface TalentDeps {
  vfx: Vfx;
  glow: THREE.Texture;
  localId: number;
  classOf: (id: number) => ClassId | undefined;
  pose: (id: number) => Pose | undefined;
  /** Runs an effect of another player's after the render delay; the own one at once. */
  later: (playerId: number, run: (now: number) => void) => void;
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

  constructor(private readonly d: TalentDeps) {
    this.outlineMaterial = new THREE.SpriteMaterial({ map: d.glow, color: 0xe8f0ff, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false, fog: false });
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
  }

  /** A host event; returns true when it was a talent event. */
  event(e: GameEvent, now: number): boolean {
    switch (e.type) {
      case 'kit': this.kits.set(e.kit.playerId, e.kit); return true;
      case 'hidden': if (e.hidden) this.hidden.add(e.playerId); else this.hidden.delete(e.playerId); return true;
      case 'riteOffers': this.offers = e.offers; return true;
      case 'talentArea':
        if (e.end) {
          const old = this.drawn.get(e.area.id);
          if (old && e.reason === 'spent') this.d.vfx.glow(now, old.area.x, old.area.y, old.area.z + 0.3, CHAIN, 0.2, 0.9, 260);
          this.remove(e.area.id);
        } else this.add(e.area, now);
        return true;
      case 'talentFx': this.d.later(e.playerId, (t) => this.fx(e, t)); return true;
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
    } else {
      // The Way Back's shadow: a dark standing silhouette everyone sees.
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 1.75, 10), this.dark);
      body.position.set(a.x, a.z + 0.9, a.y);
      obj = body;
    }
    this.group.add(obj);
    this.drawn.set(a.id, { area: a, obj, arrived: now });
  }

  private remove(id: number): void {
    const d = this.drawn.get(id);
    if (!d) return;
    this.group.remove(d.obj);
    d.obj.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    this.drawn.delete(id);
  }

  /** Animates coins and draws the outlines and silhouettes for this frame. */
  update(now: number, enemies: InterpolatedEnemies, players: ReadonlyArray<{ id: number; x: number; y: number; z: number; dead: boolean }>, roomAt: (x: number, y: number) => number): void {
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
        if (type !== CHORISTER && type !== CHERUB && !isCommander(type)) continue;
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
