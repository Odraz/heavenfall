/** Helpers for simulation unit tests. */
import type { ClassId } from '../../data/classes';
import { ENEMIES } from '../../data/enemies';
import { Simulation, type SimOptions, type SimPlayer } from '../sim';
import { dungeonOf } from './maps';

/** Run-scoped fields for standalone simulation fixtures; session tests supply their admitted ID. */
export const INPUT_DEFAULTS = {
  runId: '00000000000000000000000000000000',
  item1Presses: 0, item2Presses: 0, mapHeld: false, qHeld: false, eHeld: false,
  leftPresses: 0, rightPresses: 0, viewTick: -1, viewGap: 0, viewFrac: 0, shots: 0, shotButton: 255,
  shotYaw: 0, shotPitch: 0, shotViewTick: -1, shotViewGap: 0, shotViewFrac: 0,
};

/** An open room of floor 0, `w` × `h` cells inside a wall border. */
export function room(w: number, h: number): string[] {
  const wall = '#'.repeat(w + 2);
  return [wall, ...Array.from({ length: h }, () => '#' + '0'.repeat(w) + '#'), wall];
}

export function makeSim(heights: string[], classes: ClassId[], opts: Partial<SimOptions> = {}): Simulation {
  return new Simulation({
    dungeon: dungeonOf(heights),
    players: classes.map((classId, id) => ({ id, name: `P${id}`, classId })),
    seed: 1,
    ...opts,
  });
}

/** Puts a player at (x, y) on the floor, aiming along yaw/pitch. */
export function put(sim: Simulation, p: SimPlayer, x: number, y: number, yaw = 0, pitch = 0): void {
  p.x = x;
  p.y = y;
  p.z = sim.map.floor[Math.floor(y) * sim.map.w + Math.floor(x)];
  p.yaw = yaw;
  p.pitch = pitch;
}

/** Places an enemy at an exact position (Cherubs hover 4 m up). */
export function enemyAt(sim: Simulation, type: number, x: number, y: number, z?: number): number {
  // Enemies pick a target when they spawn, from the players' current flow fields.
  sim.refreshFields();
  const slot = sim.placeEnemy(type, Math.floor(x), Math.floor(y), -1);
  sim.eX[slot] = x;
  sim.eY[slot] = y;
  if (z !== undefined) sim.eZ[slot] = z;
  sim.retarget(slot);
  return slot;
}

/** Aim yaw and pitch from a player's eye to an enemy's body center. */
export function aimAt(sim: Simulation, p: SimPlayer, slot: number): void {
  const dx = sim.eX[slot] - p.x;
  const dy = sim.eY[slot] - p.y;
  const dz = sim.eZ[slot] + ENEMIES[sim.eType[slot]].height / 2 - (p.z + 1.6);
  p.yaw = Math.atan2(dy, dx);
  p.pitch = Math.atan2(dz, Math.hypot(dx, dy));
}

/** Simulates a press of Q or E the way an input with an increased counter does. */
export function press(p: SimPlayer, key: 'Q' | 'E', allyTargetId = 255): void {
  if (key === 'Q') p.pendingQ = true;
  else {
    p.pendingE = true;
    p.pendingEAlly = allyTargetId;
  }
}

/**
 * Ends a room's countdown (M8 §5) at the next tick, as if its timer ran out, and steps once.
 * The room must be in its countdown.
 */
export function sealNow(sim: Simulation, ai = 0): void {
  sim.rooms[ai].sealTick = sim.tick; // Already expired, independent of the next quorum hold.
  sim.step();
}
