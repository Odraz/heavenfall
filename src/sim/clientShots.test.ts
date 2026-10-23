/**
 * Client-timed shots (netcode stage 2): the host fires the shots the player's screen fired, each with
 * the aim and view of the input that carried it, no faster than the fire timer allows.
 */
import { describe, expect, it } from 'vitest';
import { BLESSED } from '../data/enemies';
import { FIRE_LEFT, FIRE_RIGHT, WEAPONS } from '../data/weapons';
import { decodeInput, encodeInput, type InputMsg } from '../net/protocol';
import { nextShot, queueShots, SHOT_EARLY_TICKS, SHOT_QUEUE, SHOT_WAIT_TICKS, shotsDone, type ClientShot } from './fireLatch';
import { NO_VIEW } from './lagComp';
import type { SimPlayer, Simulation } from './sim';
import { aimAt, enemyAt, INPUT_DEFAULTS, makeSim, put, room } from './testutil/sims';

const RUN = 'b'.repeat(32);
let seq = 0;

/** An input from the player's screen: its current state, a shot counter and the latest shot's button. */
function input(sim: Simulation, p: SimPlayer, m: Partial<InputMsg>): void {
  const full: InputMsg = { ...INPUT_DEFAULTS, runId: RUN, seq: ++seq, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, fire: 0,
    qPresses: p.qPresses, ePresses: p.ePresses, allyTargetId: 255, lastTeleportId: p.teleportId, shots: p.shotsSeen, shotButton: 0, ...m };
  sim.applyInput(p.id, decodeInput(encodeInput(full), RUN)!, sim.nowMs);
}

function setup(classId: 'betrayer' | 'fallen' = 'betrayer') {
  const sim = makeSim(room(30, 20), [classId], { god: true, runId: RUN });
  const p = sim.players[0];
  put(sim, p, 3.5, 10.5);
  input(sim, p, {});
  sim.step();
  return { sim, p };
}

describe('client-timed shots on the host (netcode stage 2)', () => {
  it('fires each shot the screen fired, once, even with the button already released', () => {
    const { sim, p } = setup();
    input(sim, p, { fire: 0, shots: 1 });
    for (let i = 0; i < 30; i++) sim.step();
    expect(p.shots).toBe(1);
  });

  it('a held button fires only the shots the screen sends, not on the host’s own timer', () => {
    const { sim, p } = setup();
    input(sim, p, { fire: FIRE_LEFT, shots: 1 });
    for (let i = 0; i < 30; i++) sim.step();
    expect(p.shots).toBe(1);
  });

  it('fires with the aim of the input that carried the shot, though a newer input turned away', () => {
    const { sim, p } = setup();
    const target = enemyAt(sim, BLESSED, 15.5, 10.5);
    aimAt(sim, p, target);
    const aimed = p.yaw;
    // The shot's input and the next one, turned 90° away, both reach the host before its tick.
    input(sim, p, { fire: FIRE_LEFT, shots: 1, yaw: aimed });
    input(sim, p, { fire: FIRE_LEFT, yaw: aimed + Math.PI / 2 });
    sim.step();
    expect(p.shots).toBe(1);
    expect(sim.eAlive[target]).toBe(0);
    // The player still faces where the newest input turned it.
    expect(p.yaw).toBeCloseTo(aimed + Math.PI / 2, 6);
  });

  it('fires with the view of the input that carried the shot (lag compensation)', () => {
    for (const [withView, kills] of [[true, true], [false, false]] as const) {
      const { sim, p } = setup();
      p.yaw = 0;
      p.pitch = 0;
      // A Blessed is pushed across the aim; the screen drew it near the line 5 ticks ago (its first record).
      const e = enemyAt(sim, BLESSED, 15.5, 10.5);
      for (let i = 0; i < 6; i++) { sim.eY[e] += 0.15; sim.step(); }
      // Now 0.9 m off the line: only the drawn position is hit. The newer input's view is the present.
      input(sim, p, { fire: FIRE_LEFT, shots: 1, viewTick: withView ? sim.tick - 5 : -1 });
      input(sim, p, { fire: FIRE_LEFT, viewTick: sim.tick });
      sim.step();
      expect(p.shots).toBe(1);
      expect(sim.eAlive[e]).toBe(kills ? 0 : 1);
    }
  });

  it('never fires faster than the weapon: a burst of shots waits for the timer, and stale ones are dropped', () => {
    const { sim, p } = setup();
    // Three shots in one input (a slow frame): the revolver's 0.3 s spaces them out.
    input(sim, p, { fire: FIRE_LEFT, shots: 3 });
    sim.step();
    expect(p.shots).toBe(1);
    for (let i = 0; i < 9 - SHOT_EARLY_TICKS - 1; i++) sim.step();
    expect(p.shots).toBe(1);
    // The others waited longer than SHOT_WAIT_TICKS by then: dropped, not saved up.
    for (let i = 0; i < 30; i++) sim.step();
    expect(p.shots).toBe(2);
    expect(p.shotQueue).toHaveLength(0);
  });

  it('a shot that comes a moment early (jitter) fires at once; its interval still counts in full', () => {
    const { sim, p } = setup();
    input(sim, p, { shots: 1 });
    sim.step();
    expect(p.shots).toBe(1);
    // The next shot arrives SHOT_EARLY_TICKS before the revolver's 9 ticks are up.
    const early = Math.round(WEAPONS.betrayer.interval * 30) - SHOT_EARLY_TICKS;
    for (let i = 1; i < early; i++) sim.step();
    input(sim, p, { shots: 2 });
    sim.step();
    expect(p.shots).toBe(2);
    // Two seconds of a shot every input: no faster than 1 per 0.3 s overall.
    const start = sim.tick, from = p.shots;
    for (let i = 0; i < 60; i++) { input(sim, p, { shots: (p.shotsSeen + 1) & 0xff }); sim.step(); }
    expect((p.shots - from) / ((sim.tick - start) / 30)).toBeLessThanOrEqual(1 / WEAPONS.betrayer.interval + 0.5);
  });

  it('the first input sets the counter without firing; a dead or carried player queues nothing', () => {
    const sim = makeSim(room(30, 20), ['betrayer'], { god: true, runId: RUN });
    const p = sim.players[0];
    put(sim, p, 3.5, 10.5);
    input(sim, p, { shots: 17 });
    for (let i = 0; i < 5; i++) sim.step();
    expect(p.shots).toBe(0);
    p.dead = true;
    input(sim, p, { shots: 18 });
    sim.step();
    expect(p.shotQueue).toHaveLength(0);
    expect(p.shots).toBe(0);
  });

  it('a Heretic’s Sacrament shot with no ally here fires the censer if the left is held, and nothing otherwise', () => {
    for (const [fire, censers] of [[FIRE_LEFT | FIRE_RIGHT, 1], [FIRE_RIGHT, 0]] as const) {
      const sim = makeSim(room(30, 20), ['heretic'], { god: true, runId: RUN });
      const p = sim.players[0];
      put(sim, p, 3.5, 10.5);
      input(sim, p, {});
      sim.step();
      input(sim, p, { fire, shots: 1, shotButton: 1 });
      sim.step();
      expect([p.shots, p.shots2]).toEqual([censers, 0]);
    }
  });

  it('a client that sends no shots (HELD_FIRE) keeps the host firing its held buttons', () => {
    const { sim, p } = setup();
    input(sim, p, { fire: FIRE_LEFT, leftPresses: 1, shotButton: 255 });
    for (let i = 0; i < 30; i++) sim.step();
    expect(p.clientShots).toBe(false);
    expect(p.shots).toBe(4);
  });
});

describe('the shot queue', () => {
  const shot = (tick: number, index = 0): ClientShot => ({ button: 0, yaw: 0, pitch: 0, view: NO_VIEW, tick, index });

  it('keeps at most SHOT_QUEUE shots, the newest', () => {
    const q: ClientShot[] = [];
    queueShots(q, 5, shot(10), 5);
    expect(q).toHaveLength(SHOT_QUEUE);
    queueShots(q, 1, shot(11), 6);
    expect(q.map((s) => s.tick)).toEqual([10, 10, 11]);
  });

  it("numbers each shot by the screen's counter, wrapping at 256, and reports the resolved counter (netcode stage 3)", () => {
    const q: ClientShot[] = [];
    expect(shotsDone(q, 254)).toBe(254);
    queueShots(q, 3, shot(10), 1);
    expect(q.map((s) => s.index)).toEqual([255, 0, 1]);
    expect(shotsDone(q, 1)).toBe(254);
    q.shift();
    expect(shotsDone(q, 1)).toBe(255);
    q.length = 0;
    expect(shotsDone(q, 1)).toBe(1);
  });

  it('drops shots that waited longer than SHOT_WAIT_TICKS', () => {
    const q: ClientShot[] = [shot(10), shot(15)];
    expect(nextShot(q, 10 + SHOT_WAIT_TICKS)?.tick).toBe(10);
    expect(nextShot(q, 11 + SHOT_WAIT_TICKS)?.tick).toBe(15);
    expect(nextShot(q, 16 + SHOT_WAIT_TICKS)).toBeUndefined();
  });
});
