/**
 * Netcode stage 3: the host's client-timed shot is the shooter's predicted shot. Its pellets scatter by
 * the shooter's own counter, its hits match the prediction from the snapshot's HP, the snapshot says
 * which shots the host has resolved, and its hits' damage numbers stay on the shooter's screen.
 */
import { describe, expect, it } from 'vitest';
import { BLESSED, CHERUB, WATCHMAN } from '../data/enemies';
import { FIRE_LEFT, SHOTGUN_CLOSE_DAMAGE, SHOTGUN_KNOCKBACK_RANGE, WEAPONS } from '../data/weapons';
import { decodeInput, decodeSnapshot, encodeInput, FLAG_ROOTED, type InputMsg } from '../net/protocol';
import { predictPellets, type PelletTarget } from '../client/killPredict';
import { aimDir, rayEnemy } from './combat';
import { PLAYER_EYE, PLAYER_HEIGHT } from './constants';
import { raycastTerrain } from './los';
import { distToCylinder } from './movement';
import { shotSpread } from './shotSpread';
import { ENEMIES } from '../data/enemies';
import type { SimPlayer, Simulation } from './sim';
import { enemyAt, INPUT_DEFAULTS, makeSim, put, room } from './testutil/sims';

const RUN = 'c'.repeat(32);
let seq = 0;

function input(sim: Simulation, p: SimPlayer, m: Partial<InputMsg>): void {
  const full: InputMsg = { ...INPUT_DEFAULTS, runId: RUN, seq: ++seq, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, fire: 0,
    qPresses: p.qPresses, ePresses: p.ePresses, allyTargetId: 255, lastTeleportId: p.teleportId, shots: p.shotsSeen, shotButton: 0, ...m };
  // The latest shot's aim and view: this input's, as when it carries the shot (netcode stage 4).
  full.shotYaw = m.shotYaw ?? full.yaw; full.shotPitch = m.shotPitch ?? full.pitch;
  full.shotViewTick = m.shotViewTick ?? full.viewTick; full.shotViewGap = m.shotViewGap ?? full.viewGap; full.shotViewFrac = m.shotViewFrac ?? full.viewFrac;
  sim.applyInput(p.id, decodeInput(encodeInput(full), RUN)!, sim.nowMs);
}

function setup(classId: 'fallen' | 'binder' | 'betrayer', seed = 1) {
  const sim = makeSim(room(40, 21), [classId], { god: true, runId: RUN, seed, noWaves: true });
  const p = sim.players[0];
  put(sim, p, 3.5, 10.5);
  input(sim, p, {});
  sim.step();
  return { sim, p };
}

/** A crowd ahead of the player: Blessed and Cherubs (grounded), at 4–15 m, some of them hurt. */
function crowd(sim: Simulation): number[] {
  const slots: number[] = [];
  for (let k = 0; k < 40; k++) {
    const x = 7.5 + (k % 8) * 1.4, y = 8.6 + Math.floor(k / 8) * 0.9 + (k % 3) * 0.12;
    const s = enemyAt(sim, k % 5 === 0 ? CHERUB : BLESSED, x, y, k % 5 === 0 ? 0 : undefined);
    if (k % 4 === 1) sim.eHp[s] -= 10;
    slots.push(s);
  }
  return slots;
}

/**
 * The shooter's prediction of its shot `shot`, as its screen makes it: the shared spread, the ray tests
 * against the enemies where they stand, the HP from the snapshot. Returns the predicted HP per slot.
 */
function predict(sim: Simulation, p: SimPlayer, shot: number, maxHits = 1): Map<number, number> {
  const w = WEAPONS[p.classId], shotgun = p.classId === 'fallen';
  const snap = decodeSnapshot(sim.encodeFor(p.id)[0])!;
  const ex = p.x, ey = p.y, ez = p.z + PLAYER_EYE;
  const rays = Array.from({ length: w.pellets }, (_, k) => {
    const [dx, dy, dz] = aimDir(p.yaw + shotSpread(p.id, shot, k, 0) * w.spreadYaw, p.pitch + shotSpread(p.id, shot, k, 1) * w.spreadPitch);
    const stop = raycastTerrain(sim.map, ex, ey, ez, dx, dy, dz, w.range);
    const ts: PelletTarget[] = [];
    for (let i = 0; i < snap.enemyCount; i++) {
      const s = snap.enemySlot[i], type = snap.enemyType[i], def = ENEMIES[type];
      const t = rayEnemy(ex, ey, ez, dx, dy, dz, type, sim.eX[s], sim.eY[s], sim.eZ[s]);
      if (t > stop) continue;
      const close = shotgun && distToCylinder(ex, ey, p.z + PLAYER_HEIGHT / 2, sim.eX[s], sim.eY[s], sim.eZ[s], def.radius, def.height) <= SHOTGUN_KNOCKBACK_RANGE;
      ts.push({ i, t, type, hp: snap.enemyHp[i], factor: snap.enemyFlags[i] & FLAG_ROOTED ? 2 : 1, close });
    }
    return ts.sort((a, b) => a.t - b.t);
  });
  const left = new Map<number, number>();
  for (let i = 0; i < snap.enemyCount; i++) left.set(snap.enemySlot[i], snap.enemyHp[i]);
  for (const hits of predictPellets(rays, w.damage, maxHits, shotgun ? 'shotgun' : 'other', SHOTGUN_CLOSE_DAMAGE)) {
    for (const h of hits) {
      const s = snap.enemySlot[h.target.i];
      left.set(s, h.result ? 0 : left.get(s)! - h.dealt);
    }
  }
  return left;
}

const hostHp = (sim: Simulation, slots: number[]) => new Map(slots.map((s) => [s, sim.eAlive[s] ? sim.eHp[s] : 0]));

describe('client-timed pellets on the host (netcode stage 3)', () => {
  for (const shot of [1, 2, 3, 77, 200]) {
    it(`a shotgun shot (counter ${shot}) hits exactly what the shooter's screen predicts`, () => {
      const { sim, p } = setup('fallen');
      const slots = crowd(sim);
      p.shotsSeen = (shot - 1) & 0xff;
      const before = hostHp(sim, slots), expected = predict(sim, p, shot);
      input(sim, p, { fire: FIRE_LEFT, shots: shot });
      sim.step();
      expect(p.shots).toBe(1);
      expect(hostHp(sim, slots)).toEqual(new Map(slots.map((s) => [s, expected.get(s) ?? 0])));
      // The shot hit several enemies and killed some, so the comparison means something.
      expect(slots.filter((s) => !sim.eAlive[s]).length).toBeGreaterThan(0);
      expect(slots.filter((s) => hostHp(sim, [s]).get(s)! < before.get(s)!).length).toBeGreaterThan(1);
    });
  }

  it("the same shot lands the same whatever the host's random stream; a held-fire shot draws from it", () => {
    const outcome = (seed: number, clientTimed: boolean) => {
      const { sim, p } = setup('fallen', seed);
      const slots = crowd(sim);
      if (clientTimed) input(sim, p, { fire: FIRE_LEFT, shots: 1 });
      else input(sim, p, { fire: FIRE_LEFT, shotButton: 255 });
      sim.step();
      return [...hostHp(sim, slots).values()];
    };
    expect(outcome(1, true)).toEqual(outcome(99, true));
    expect(outcome(1, false)).not.toEqual(outcome(99, false));
  });

  it('a Chain Gun bullet scatters by the counter too, and two bullets kill a Blessed the first one hurt', () => {
    const { sim, p } = setup('binder');
    const slots = crowd(sim);
    for (const shot of [1, 2, 3, 4]) {
      const expected = predict(sim, p, shot);
      input(sim, p, { fire: FIRE_LEFT, shots: shot });
      // The fire timer allows one bullet per 1/12 s: three ticks are enough.
      for (let i = 0; i < 3; i++) sim.step();
      expect(hostHp(sim, slots)).toEqual(new Map(slots.map((s) => [s, expected.get(s) ?? 0])));
    }
    expect(p.shots).toBe(4);
  });
});

describe('resolved shots in the snapshot (netcode stage 3)', () => {
  it("each player's record carries the counter up to which the host has fired or dropped every shot", () => {
    const { sim, p } = setup('betrayer');
    const done = () => decodeSnapshot(sim.encodeFor(p.id)[0])!.players.find((q) => q.id === p.id)!.shotsDone;
    expect(done()).toBe(0);
    // Three shots in one input: the revolver fires one per 0.3 s, so they resolve one by one.
    input(sim, p, { fire: FIRE_LEFT, shots: 3 });
    expect(done()).toBe(0);
    sim.step();
    expect([p.shots, done()]).toEqual([1, 1]);
    while (p.shots < 2) sim.step();
    expect(done()).toBe(2);
    // The third waits longer than 0.3 s and is dropped: resolved all the same.
    for (let i = 0; i < 10; i++) sim.step();
    expect([p.shots, done()]).toEqual([2, 3]);
  });

  it('a dead player resolves every shot it sends at once', () => {
    const { sim, p } = setup('betrayer');
    p.dead = true;
    input(sim, p, { fire: FIRE_LEFT, shots: 2 });
    expect(decodeSnapshot(sim.encodeFor(p.id)[0])!.players.find((q) => q.id === p.id)!.shotsDone).toBe(2);
  });
});

describe("damage numbers of the shooter's own shots (netcode stage 3)", () => {
  const damage = (sim: Simulation, id: number) => sim.events.filter((e) => e.event.type === 'damage' && e.to === id);

  it("a client-timed shot's hits stay out of the damage event: the screen showed them; a held-fire shot's are in it", () => {
    for (const clientTimed of [true, false]) {
      const { sim, p } = setup('betrayer');
      const w = enemyAt(sim, WATCHMAN, 12.5, 10.5);
      p.yaw = Math.atan2(sim.eY[w] - p.y, sim.eX[w] - p.x);
      p.pitch = Math.atan2(sim.eZ[w] + 1.2 - (p.z + PLAYER_EYE), Math.hypot(sim.eX[w] - p.x, sim.eY[w] - p.y));
      sim.events.length = 0;
      input(sim, p, clientTimed ? { fire: FIRE_LEFT, shots: 1 } : { fire: FIRE_LEFT, shotButton: 255 });
      sim.step();
      expect(sim.eHp[w]).toBe(ENEMIES[WATCHMAN].hp - WEAPONS.betrayer.damage);
      expect(damage(sim, p.id)).toHaveLength(clientTimed ? 0 : 1);
    }
  });

  it("a client-timed shot's kill is still listed among the kills, without its number (netcode stage 4)", () => {
    const { sim, p } = setup('betrayer');
    const b = enemyAt(sim, BLESSED, 12.5, 10.5);
    const incarnation = sim.eIncarnation[b];
    p.yaw = Math.atan2(sim.eY[b] - p.y, sim.eX[b] - p.x);
    p.pitch = Math.atan2(sim.eZ[b] + 0.8 - (p.z + PLAYER_EYE), Math.hypot(sim.eX[b] - p.x, sim.eY[b] - p.y));
    sim.events.length = 0;
    input(sim, p, { fire: FIRE_LEFT, shots: 1 });
    sim.step();
    expect(sim.eAlive[b]).toBe(0);
    const events = damage(sim, p.id).map((e) => e.event as { hits: number[]; kills?: number[] });
    expect(events).toEqual([{ type: 'damage', hits: [], kills: [b, incarnation] }]);
  });

  it('damage the shot causes beyond its own hits (a world source here) still arrives in the event', () => {
    const { sim, p } = setup('betrayer');
    const w = enemyAt(sim, WATCHMAN, 12.5, 10.5);
    sim.events.length = 0;
    sim.damageEnemy(w, 15, p.index);
    sim.step();
    expect(damage(sim, p.id)).toHaveLength(1);
  });
});

describe('weapon kills, the lag test diagnostic (netcode stage 3)', () => {
  it('counts kills by the weapon, not by world damage', () => {
    const { sim, p } = setup('betrayer');
    const target = enemyAt(sim, BLESSED, 12.5, 10.5), other = enemyAt(sim, BLESSED, 20.5, 14.5);
    p.yaw = 0;
    p.pitch = Math.atan2(sim.eZ[target] + 0.8 - (p.z + PLAYER_EYE), sim.eX[target] - p.x);
    input(sim, p, { fire: FIRE_LEFT, shots: 1 });
    sim.step();
    sim.damageEnemy(other, 100, p.index);
    expect([sim.eAlive[target], sim.eAlive[other], p.kills]).toEqual([0, 0, 2]);
    expect(sim.weaponKills()).toEqual({ [p.id]: 1 });
  });
});
