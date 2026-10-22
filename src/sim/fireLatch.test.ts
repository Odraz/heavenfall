import { describe, expect, it } from 'vitest';
import { BLESSED } from '../data/enemies';
import { ATTACK_PRIMARY, ATTACK_SECONDARY, FIRE_LEFT, FIRE_RIGHT, FIRE_RIGHT_LAST, WEAPONS } from '../data/weapons';
import { FIRE_LATCH_TICKS, latchBits, latchClear, latchFired, latchPress, newFireLatch, pressDelta } from './fireLatch';
import { encodeInput, decodeInput, type InputMsg } from '../net/protocol';
import { INPUT_DEFAULTS, enemyAt, makeSim, put, room } from './testutil/sims';
import type { Simulation, SimPlayer } from './sim';

describe('fire latch', () => {
  it('holds a press until its attack fires or FIRE_LATCH_TICKS pass', () => {
    const l = newFireLatch();
    latchPress(l, 0, 10);
    expect(latchBits(l, 11)).toBe(FIRE_LEFT);
    expect(latchBits(l, 10 + FIRE_LATCH_TICKS)).toBe(FIRE_LEFT);
    expect(latchBits(l, 11 + FIRE_LATCH_TICKS)).toBe(0);
    latchPress(l, 1, 10);
    expect(latchBits(l, 11)).toBe(FIRE_LEFT | FIRE_RIGHT);
    latchFired(l, ATTACK_SECONDARY);
    expect(latchBits(l, 11)).toBe(FIRE_LEFT);
    latchFired(l, ATTACK_PRIMARY);
    expect(latchBits(l, 11)).toBe(0);
    latchPress(l, 0, 20); latchClear(l);
    expect(latchBits(l, 21)).toBe(0);
  });

  it('counts wrapping press counters, ignoring ones that went backwards', () => {
    expect(pressDelta(3, 3)).toBe(0);
    expect(pressDelta(4, 3)).toBe(1);
    expect(pressDelta(1, 255)).toBe(2);
    expect(pressDelta(2, 3)).toBe(0);
  });
});

describe('click latching on the host', () => {
  const RUN = 'a'.repeat(32);
  let seq = 0;
  function input(sim: Simulation, p: SimPlayer, m: Partial<InputMsg>): void {
    const full: InputMsg = { ...INPUT_DEFAULTS, runId: RUN, seq: ++seq, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, fire: 0,
      qPresses: p.qPresses, ePresses: p.ePresses, allyTargetId: 255, lastTeleportId: p.teleportId, leftPresses: p.leftPresses, rightPresses: p.rightPresses, ...m };
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

  it('fires once for a click whose press and release reach the host in the same tick', () => {
    const { sim, p } = setup();
    // The press input and the release input arrive together: the newest says nothing is held.
    input(sim, p, { fire: FIRE_LEFT, leftPresses: 1 });
    input(sim, p, { fire: 0, leftPresses: 1 });
    for (let i = 0; i < 30; i++) sim.step();
    expect(p.shots).toBe(1);
  });

  it('fires a click that arrives while the fire timer is still running, once it is ready', () => {
    const { sim, p } = setup();
    p.fireTimer = WEAPONS.betrayer.interval / 2;
    input(sim, p, { fire: 0, leftPresses: 1 });
    for (let i = 0; i < 3; i++) sim.step();
    expect(p.shots).toBe(0);
    for (let i = 0; i < 10; i++) sim.step();
    expect(p.shots).toBe(1);
  });

  it('drops a press it could not fire within FIRE_LATCH_TICKS', () => {
    const { sim, p } = setup();
    p.fireTimer = (FIRE_LATCH_TICKS + 3) / 30;
    input(sim, p, { fire: 0, leftPresses: 1 });
    for (let i = 0; i < 40; i++) sim.step();
    expect(p.shots).toBe(0);
  });

  it('a held button fires on its own interval: its press adds no extra shot', () => {
    const { sim, p } = setup();
    input(sim, p, { fire: FIRE_LEFT, leftPresses: 1 });
    // One second of holding the revolver (0.3 s): shots at 0, 0.3, 0.6 and 0.9 s.
    for (let i = 0; i < 30; i++) sim.step();
    expect(p.shots).toBe(4);
  });

  it('a right click while the left is held fires the secondary once', () => {
    const { sim, p } = setup('fallen');
    enemyAt(sim, BLESSED, 25.5, 3.5);
    input(sim, p, { fire: FIRE_LEFT, leftPresses: 1 });
    sim.step();
    expect(p.shots).toBe(1);
    // Late in the shotgun's interval (0.9 s) the slug is pressed and let go; the left stays held.
    for (let i = 0; i < 20; i++) sim.step();
    input(sim, p, { fire: FIRE_LEFT | FIRE_RIGHT_LAST, leftPresses: 1, rightPresses: 1 });
    for (let i = 0; i < FIRE_LATCH_TICKS; i++) sim.step();
    expect(p.shots2).toBe(1);
    expect(p.shots).toBe(1);
  });

  it('the first input after joining sets the counters without firing, and a dead player latches nothing', () => {
    const sim = makeSim(room(30, 20), ['betrayer'], { god: true, runId: RUN });
    const p = sim.players[0];
    put(sim, p, 3.5, 10.5);
    input(sim, p, { leftPresses: 17 });
    for (let i = 0; i < 5; i++) sim.step();
    expect(p.shots).toBe(0);
    p.dead = true;
    input(sim, p, { leftPresses: 18 });
    sim.step();
    expect(latchBits(p.fireLatch, sim.tick + 1)).toBe(0);
  });
});
