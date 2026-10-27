/**
 * Clear rewards you can't miss (audit batch 3): when a combat room clears, a bright white-gold shaft
 * comes down from the sky onto its reward spot, then settles into a slim pulsing pillar that stays
 * while the reward lies uncollected. Rewards come down from the sky; danger rises from the ground.
 * Presentation only: which pickup is the reward comes from accepted pickup records.
 */
import * as THREE from 'three';
import type { Floor } from '../gen/generate';
import type { ClearReward } from '../gen/rewards';
import { GOLD_HALO, ITEM_FIRST, ITEM_IDS, type PickupRecord } from '../data/pickups';
import type { GameMap } from '../sim/map';
import type { Snapshot } from '../net/protocol';
import { Ribbon } from '../render/vfx';

/** The Rite page's pickup kind (rogue game.md §14.12). */
const RITE_PAGE = 15;
/** How long the arrival shaft takes to narrow into the waiting pillar. */
export const ARRIVAL_MS = 600;
const SHAFT_HEIGHT = 16;
/** Reward pillars drawn at once; a floor has at most 11 rooms. */
const PILLAR_CAP = 12;

export function rewardKind(reward: ClearReward): number | null {
  return reward.kind === 'gold' ? GOLD_HALO : reward.kind === 'item' ? ITEM_FIRST + ITEM_IDS.indexOf(reward.item) : reward.kind === 'rite' ? RITE_PAGE : null;
}

/** The floor point of a room's reward spot (cell center), or null when the room has none. */
export function rewardSpot(map: GameMap, room: number): { x: number; y: number; z: number } | null {
  const cell = map.rooms[room]?.points?.reward;
  if (!cell) return null;
  return { x: cell[0] + 0.5, y: cell[1] + 0.5, z: map.floor[cell[1] * map.w + cell[0]] };
}

/**
 * Pickup ids that are a room's clear reward: the room's reward kind, created on its reward spot.
 * Other drops of the same kind (an enemy's item, a commander's gold halo) start elsewhere.
 */
export function rewardPickupIds(records: Iterable<PickupRecord>, floor: Floor, map: GameMap): Set<number> {
  const ids = new Set<number>();
  for (const p of records) {
    const reward = floor.rewards[p.room], spot = rewardSpot(map, p.room);
    if (!reward || !spot || map.rooms[p.room].kind !== 'combat' || rewardKind(reward) !== p.kind) continue;
    if (Math.abs(p.x - spot.x) < 0.01 && Math.abs(p.y - spot.y) < 0.01) ids.add(p.id);
  }
  return ids;
}

/** Waiting pillar brightness: a slow 1.6 s pulse, never fully gone. */
export function pillarOpacity(now: number): number {
  return 0.8 + 0.2 * Math.sin((now / 1600) * Math.PI * 2);
}

export class RewardShafts {
  readonly group = new THREE.Group();
  private readonly core: THREE.MeshBasicMaterial;
  private readonly glow: THREE.MeshBasicMaterial;
  private readonly pillars: Array<{ core: Ribbon; glow: Ribbon }>;
  private readonly arrivals: Array<{ x: number; y: number; z: number; start: number }> = [];

  constructor(beamTexture: THREE.Texture) {
    this.core = new THREE.MeshBasicMaterial({ map: beamTexture, color: 0xfff3c4, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.glow = new THREE.MeshBasicMaterial({ map: beamTexture, color: 0xffcf5c, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.pillars = Array.from({ length: PILLAR_CAP }, () => {
      const core = new Ribbon([[0, 0, 0], [0, 0, 1]], 0.9, this.core, SHAFT_HEIGHT);
      const glow = new Ribbon([[0, 0, 0], [0, 0, 1]], 3, this.glow, SHAFT_HEIGHT);
      core.mesh.name = 'reward-shaft'; glow.mesh.visible = core.mesh.visible = false;
      this.group.add(glow.mesh, core.mesh);
      return { core, glow };
    });
  }

  /** A room cleared with a reward: start the arrival shaft at its spot. */
  arrive(x: number, y: number, z: number, now: number): void {
    this.arrivals.push({ x, y, z, start: now });
  }

  /** Draws arriving shafts and one waiting pillar per uncollected reward in the newest snapshot. */
  update(now: number, s: Snapshot | null, rewardIds: ReadonlySet<number>, floorAt: (x: number, y: number) => number, camera: THREE.Vector3): void {
    for (let i = this.arrivals.length - 1; i >= 0; i--) if (now - this.arrivals[i].start > ARRIVAL_MS) this.arrivals.splice(i, 1);
    const shafts: Array<{ x: number; y: number; z: number; f: number }> = this.arrivals.map((a) => ({ ...a, f: (now - a.start) / ARRIVAL_MS }));
    if (s) for (let i = 0; i < s.pickupCount && shafts.length < PILLAR_CAP; i++) {
      if (!rewardIds.has(s.pickupId[i])) continue;
      const x = s.pickupX[i], y = s.pickupY[i];
      if (!shafts.some((a) => Math.hypot(a.x - x, a.y - y) < 0.5)) shafts.push({ x, y, z: floorAt(x, y), f: 1 });
    }
    const pulse = pillarOpacity(now);
    this.pillars.forEach(({ core, glow }, i) => {
      const shaft = shafts[i];
      core.mesh.visible = glow.mesh.visible = !!shaft;
      if (!shaft) return;
      // Arrival: wide and solid, narrowing into the waiting pillar over ARRIVAL_MS.
      const f = Math.max(0, Math.min(1, shaft.f));
      core.width = 0.9 + 1.9 * (1 - f); glow.width = 3 + 4 * (1 - f);
      const points: Array<[number, number, number]> = [[shaft.x, shaft.y, shaft.z + SHAFT_HEIGHT], [shaft.x, shaft.y, shaft.z]];
      core.setPoints(points); glow.setPoints(points); core.face(camera); glow.face(camera);
    });
    // Arrivals are solid; waiting pillars share the slow pulse.
    this.core.opacity = this.arrivals.length ? 1 : pulse;
    this.glow.opacity = this.arrivals.length ? 0.7 : 0.5 * pulse;
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const p of this.pillars) { p.core.mesh.geometry.dispose(); p.glow.mesh.geometry.dispose(); }
    this.core.dispose(); this.glow.dispose();
  }
}
