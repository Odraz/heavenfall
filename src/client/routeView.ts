/**
 * The floor's route objects on every client (rogue game.md §6.5, §4.12): the Reliquary chest in its
 * hard-edged white beam with a pale blue core (6 m wide, 30 m tall, until it opens), the chest's lid
 * swapping to the open art, and the Bells of Judgment hanging gold over their reward squares once their
 * rooms clear. Presentation of the host's `route` state; F's target and its line come from here too.
 */
import * as THREE from 'three';
import type { RouteState } from '../net/messages';
import type { GameMap } from '../sim/map';
import { lineOfSight } from '../sim/los';
import { CHEST_HEIGHT, CHEST_REACH } from '../sim/route';
import { Ribbon } from '../render/vfx';
import { BELL_ART, CHEST_ART, CHEST_OPEN_ART } from './itemArt';

const BEAM_HEIGHT = 30;
const EYE = 1.6;

export class RouteView {
  readonly group = new THREE.Group();
  state: RouteState = { keyHolder: -1, keyUsed: false, chest: null, bells: [], sundial: 'missed', sundialTick: 0 };
  private chest: THREE.Sprite | null = null;
  private readonly beam: { core: Ribbon; glow: Ribbon };
  private readonly closed: THREE.Texture;
  private readonly opened: THREE.Texture;
  private readonly bellTexture: THREE.Texture;
  private readonly bells = new Map<number, THREE.Group>();

  constructor(private readonly map: GameMap, beamTexture: THREE.Texture) {
    const loader = new THREE.TextureLoader();
    this.closed = loader.load(CHEST_ART); this.opened = loader.load(CHEST_OPEN_ART); this.bellTexture = loader.load(BELL_ART);
    for (const t of [this.closed, this.opened, this.bellTexture]) t.colorSpace = THREE.SRGBColorSpace;
    const core = new THREE.MeshBasicMaterial({ map: beamTexture, color: 0xcfe6ff, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const glow = new THREE.MeshBasicMaterial({ map: beamTexture, color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.beam = { core: new Ribbon([[0, 0, 0], [0, 0, 1]], 1.6, core, BEAM_HEIGHT), glow: new Ribbon([[0, 0, 0], [0, 0, 1]], 6, glow, BEAM_HEIGHT) };
    this.beam.core.mesh.visible = this.beam.glow.mesh.visible = false;
    this.group.add(this.beam.glow.mesh, this.beam.core.mesh);
  }

  set(state: RouteState): void {
    this.state = { ...state, chest: state.chest ? { ...state.chest } : null, bells: state.bells.map((b) => ({ ...b })) };
    const c = state.chest;
    if (c && !this.chest) {
      this.chest = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.closed, alphaTest: 0.05, depthWrite: false }));
      this.chest.scale.set(1.6, 1.6, 1);
      this.chest.position.set(c.x, c.z + 0.75, c.y);
      this.chest.name = 'reliquary-chest';
      this.group.add(this.chest);
    }
    if (this.chest && c) this.chest.material.map = c.open ? this.opened : this.closed;
    this.beam.core.mesh.visible = this.beam.glow.mesh.visible = !!c && !c.open;
    if (c && !c.open) {
      const pts: Array<[number, number, number]> = [[c.x, c.y, c.z + BEAM_HEIGHT], [c.x, c.y, c.z]];
      this.beam.core.setPoints(pts); this.beam.glow.setPoints(pts);
    }
    for (const b of state.bells) {
      let g = this.bells.get(b.room);
      if (!g && b.state !== 'hidden') {
        g = new THREE.Group();
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.bellTexture, alphaTest: 0.05, depthWrite: false }));
        sprite.scale.set(1.4, 1.4, 1); sprite.position.set(b.x, b.z + 0.5, b.y);
        // The bell hangs on a short chain from the sky: a thin dark line above it.
        const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 6, 6), new THREE.MeshBasicMaterial({ color: 0x3a2c1c }));
        chain.position.set(b.x, b.z + 1.2 + 3, b.y);
        g.add(sprite, chain); g.name = 'judgment-bell';
        this.group.add(g); this.bells.set(b.room, g);
      }
      if (g) g.visible = b.state === 'available' || b.state === 'pending';
    }
  }

  /** Faces the beam to the camera. */
  update(camera: THREE.Vector3): void {
    if (this.beam.core.mesh.visible) { this.beam.core.face(camera); this.beam.glow.face(camera); }
  }

  /** What F at this pose reaches: the chest, a ringable Bell's room, or null. */
  target(p: { x: number; y: number; z: number }): { kind: 'chest' } | { kind: 'bell'; room: number } | null {
    const c = this.state.chest;
    if (c && this.reaches(p, c.x, c.y, c.z + CHEST_HEIGHT)) return { kind: 'chest' };
    for (const b of this.state.bells) if (b.state === 'available' && this.reaches(p, b.x, b.y, b.z)) return { kind: 'bell', room: b.room };
    return null;
  }

  private reaches(p: { x: number; y: number; z: number }, x: number, y: number, z: number): boolean {
    return Math.hypot(x - p.x, y - p.y, z - p.z - EYE) <= CHEST_REACH && lineOfSight(this.map, p.x, p.y, p.z + EYE, x, y, z);
  }

  /** The line shown while F reaches a route object. */
  label(t: ReturnType<RouteView['target']>, localId: number): string {
    if (!t) return '';
    if (t.kind === 'bell') return 'Bell of Judgment · F: ring it for one harder wave and a Rite for everyone';
    const c = this.state.chest!;
    if (c.open) return 'The Reliquary · F: your relic';
    return this.state.keyHolder === localId ? 'The Reliquary · F: open it with the key' : this.state.keyHolder >= 0 ? 'The Reliquary · the key holder opens it' : 'The Reliquary · it needs the key';
  }

  dispose(): void {
    this.group.removeFromParent();
    this.chest?.material.dispose();
    for (const t of [this.closed, this.opened, this.bellTexture]) t.dispose();
    this.beam.core.mesh.geometry.dispose(); this.beam.glow.mesh.geometry.dispose();
  }
}
