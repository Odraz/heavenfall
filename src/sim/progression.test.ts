import { XP_GAIN } from './rewards';
import { describe, expect, it } from 'vitest';
import { BLESSED } from '../data/enemies';
import type { InputMsg } from '../net/protocol';
import { enemyAt, INPUT_DEFAULTS, makeSim, room } from './testutil/sims';

describe('host XP and retained bodies', () => {
  it('pays accepted world deaths to connected humans once, excluding absent records and bots', () => {
    const sim = makeSim(room(20, 20), ['fallen', 'binder', 'betrayer']); sim.players[2].bot = true;
    const absent = sim.players[1]; sim.removePlayer(1, true);
    const s = enemyAt(sim, BLESSED, 10, 10); sim.rewards.eXp[s] = 2.5;
    sim.damageEnemy(s, 1000, -1); sim.damageEnemy(s, 1000, -1);
    expect(sim.players[0].runXp).toBe(2.5 * XP_GAIN); expect(sim.players[1].runXp).toBe(0); expect(absent.runXp).toBe(0);
  });
  it('retains HP, death count, wallet and charges but advances cooldowns through absence', () => {
    const sim = makeSim(room(20, 20), ['fallen', 'binder']); const p = sim.players[1];
    Object.assign(p, { hp: 17, deaths: 2, wallet: 22, cdQ: 9, cdE: 8 }); p.inventory[0] = { item: 'balm', count: 1 };
    sim.removePlayer(1, true); sim.tick += 90;
    const resumed = sim.addPlayer({ id: 1, name: 'Ignored replacement', classId: 'binder' })!;
    expect(resumed).toMatchObject({ hp: 17, deaths: 2, wallet: 22, cdQ: 6, cdE: 5, invulUntil: 0, runXp: 0 });
    expect(resumed.inventory[0]?.count).toBe(1); expect(resumed.lastSeq).toBe(-1);
  });
  it('adopts a reconnecting page\'s Q/E counters on its first input instead of casting (R9 review N2)', () => {
    const sim = makeSim(room(20, 20), ['fallen', 'binder']); const p = sim.players[1];
    Object.assign(p, { qPresses: 7, ePresses: 3, cdQ: 0, cdE: 0 });
    sim.removePlayer(1, true); sim.tick += 90;
    const resumed = sim.addPlayer({ id: 1, name: 'Back', classId: 'binder' })!;
    const input = (seq: number, q: number, e: number): InputMsg => ({ ...INPUT_DEFAULTS, seq, x: resumed.x, y: resumed.y, z: resumed.z,
      yaw: 0, pitch: 0, fire: 0, qPresses: q, ePresses: e, allyTargetId: 255, lastTeleportId: resumed.teleportId });
    // The new page's counters start at 0: adopted, nothing cast.
    sim.applyInput(1, input(1, 0, 0), sim.nowMs);
    expect([resumed.qPresses, resumed.ePresses, resumed.pendingQ, resumed.pendingE]).toEqual([0, 0, false, false]);
    sim.step(); expect([resumed.cdQ, resumed.cdE]).toEqual([0, 0]);
    // A real press after that still casts.
    sim.applyInput(1, input(2, 1, 0), sim.nowMs + 33);
    expect(resumed.pendingQ).toBe(true);
  });
  it('dev key I fills both slots with full stacks, pair by pair, outside saved progression', () => {
    const sim = makeSim(room(20, 20), ['fallen']);
    const seen = [0, 1, 2, 3, 4].map(() => { sim.devItems(0); return sim.players[0].inventory.map((st) => `${st!.item}×${st!.count}`).join(' '); });
    expect(seen).toEqual(['balm×3 seal×2', 'feather×3 mirror×2', 'venom×3 frost×3', 'chain×2 plume×2', 'balm×3 seal×2']);
  });
  it('does not pay XP for arbitrary cleanup and disables god/K in normal attempts', () => {
    const sim = makeSim(room(20, 20), ['fallen'], { progressionEnabled: true });
    const s = enemyAt(sim, BLESSED, 10, 10); sim.rewards.eXp[s] = 60;
    sim.killAll(); sim.toggleDevGod(0); expect(sim.eAlive[s]).toBe(1); expect(sim.players[0].devGod).toBe(false);
    sim.devItems(0); expect(sim.players[0].inventory).toEqual([null, null]);
    sim.removeEnemy(s, true); expect(sim.players[0].runXp).toBe(0);
  });
});
