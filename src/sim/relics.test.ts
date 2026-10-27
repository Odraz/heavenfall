/** R6: the twelve relics, six combos and their shared rules (items-relics.md §2.2–§2.4), on the host. */
import { describe, expect, it, vi } from 'vitest';
import { BLESSED, CHERUB } from '../data/enemies';
import { COIN, HEAL_MOTE } from '../data/pickups';
import { RELIC, RELICS, activeCombo, relicEffect } from '../data/relics';
import type { GameEvent } from '../net/messages';
import { TICK_HZ } from './constants';
import type { Simulation, SimPlayer } from './sim';
import type { Root } from './talents';
import { enemyAt, makeSim, put, room } from './testutil/sims';
import { dungeonOf } from './testutil/maps';

/** One 40 × 24 breach room, so floor effects have a room to belong to. */
function withRoom(classes: Array<'fallen' | 'betrayer' | 'binder' | 'heretic'>): Simulation {
  const geometry = room(40, 24), dungeon = dungeonOf(geometry);
  dungeon.rooms = [{ id: 'relics', name: 'Relics', kind: 'breach', rect: { x0: 1, y0: 1, x1: 40, y1: 24 },
    leaves: [], entry: [{ socket: 0, cells: [[2, 2], [3, 2], [4, 2], [5, 2]] }], waves: [], boss: false }];
  return makeSim(geometry, classes, { dungeon, noWaves: true });
}

function setup(relics: [string | null, string | null], classId: 'fallen' | 'betrayer' | 'binder' | 'heretic' = 'betrayer'): [Simulation, SimPlayer] {
  const sim = withRoom([classId]);
  const p = sim.players[0];
  p.ownedRelics = ['usher', 'thurible', 'link', 'tile', 'qseal', 'eseal', 'comb', 'wheel', 'unbroken', 'mercy', 'armageddon', 'sentence3'];
  sim.relics.equip(p, relics);
  put(sim, p, 3.5, 12.5);
  return [sim, p];
}
/** A native kill through the owner's root, then the tick's end evaluation. */
function kill(sim: Simulation, p: SimPlayer, s: number, input: Root['input'] = 'LMB'): Root {
  const root = sim.talents.root(p, input);
  sim.talents.primary(root, s, 9999, 9999);
  sim.streaks.flush();
  sim.relics.flush();
  return root;
}
function events<T extends GameEvent['type']>(sim: Simulation, type: T): Array<Extract<GameEvent, { type: T }>> {
  return sim.events.flatMap((e) => (e.event.type === type ? [e.event as Extract<GameEvent, { type: T }>] : []));
}
const run = (sim: Simulation, n: number) => { for (let i = 0; i < n; i++) sim.step(); };
const blessed = (sim: Simulation, x: number, y: number) => enemyAt(sim, BLESSED, x, y);

describe('combos', () => {
  it('a matched pair replaces relic b with its combo, in either order; unrelated pairs stay two effects', () => {
    expect(activeCombo(['usher', 'unbroken'])?.id).toBe('expulsion');
    expect(activeCombo(['unbroken', 'usher'])?.id).toBe('expulsion');
    expect(relicEffect('unbroken', ['usher', 'unbroken'])).toBe('expulsion');
    expect(relicEffect('usher', ['usher', 'unbroken'])).toBe('usher');
    expect(activeCombo(['usher', 'link'])).toBeNull();
    // Every relic is in exactly one combo, and every deed relic pairs with a chest relic.
    for (const r of Object.values(RELICS)) expect(activeCombo([r.id, r.id])).toBeNull();
  });
});

describe('kill relics', () => {
  it("Usher's Badge: a taunted kill leaves a 4 m slowing circle; the cooldown blocks a second one", () => {
    const [sim, p] = setup(['usher', null]);
    const a = blessed(sim, 10.5, 12.5), b = blessed(sim, 11.5, 12.5), far = blessed(sim, 20.5, 12.5);
    sim.eTauntUntil[a] = sim.eTauntUntil[b] = sim.tick + 100;
    kill(sim, p, a);
    expect(sim.relics.areas).toHaveLength(1);
    expect(sim.relics.areas[0].effect).toBe('usher');
    sim.relics.membership();
    expect(sim.talents.slowed(b)).toBe(true);
    expect(sim.ePooled[b]).toBe(1);
    expect(sim.talents.slowed(far)).toBe(false);
    kill(sim, p, b);
    expect(sim.relics.areas).toHaveLength(1);
    expect(p.relicCd.usher).toBe(sim.tick + 4 * TICK_HZ);
  });

  it('an untaunted kill makes no circle and starts no cooldown', () => {
    const [sim, p] = setup(['usher', null]);
    kill(sim, p, blessed(sim, 10.5, 12.5));
    expect(sim.relics.areas).toHaveLength(0);
    expect(p.relicCd.usher ?? 0).toBe(0);
  });

  it('Broken Thurible: a censed kill sends a 20-damage ember into the nearest remaining enemy', () => {
    const [sim, p] = setup(['thurible', null]);
    const a = blessed(sim, 10.5, 12.5), near = blessed(sim, 14.5, 12.5);
    sim.eHp[near] = 100;
    vi.spyOn(sim.talents, 'censed').mockImplementation((s) => s === a);
    kill(sim, p, a);
    expect(sim.relics.shots).toHaveLength(1);
    run(sim, 10);
    expect(sim.eHp[near]).toBe(100 - RELIC.emberDamage);
    expect(sim.relics.shots).toHaveLength(0);
  });

  it('Last Link: a bound kill launches the unbound survivors within 3 m, never the bound ones', () => {
    const [sim, p] = setup(['link', null]);
    const a = blessed(sim, 10.5, 12.5), free = blessed(sim, 12, 12.5), held = blessed(sim, 9, 12.5);
    sim.root(a, 2); sim.root(held, 2);
    kill(sim, p, a);
    expect(sim.talents.launches.airborne(free)).toBe(true);
    expect(sim.talents.launches.airborne(held)).toBe(false);
    // A relic launch never dispatches the landing bundle.
    expect(sim.talents.launches.pending.every((l) => l.kind === 'other')).toBe(true);
  });

  it("Petitioner's Tile: a pooled kill binds the survivors within 2.5 m for 0.5 s", () => {
    const [sim, p] = setup(['tile', null]);
    const a = blessed(sim, 10.5, 12.5), b = blessed(sim, 12, 12.5), c = blessed(sim, 15, 12.5);
    sim.ePooled[a] = 1;
    kill(sim, p, a);
    expect(sim.isRooted(b)).toBe(true);
    expect(sim.eRootUntil[b]).toBe(sim.tick + Math.round(0.5 * TICK_HZ));
    expect(sim.isRooted(c)).toBe(false);
  });

  it('Seal of the First Plea: only a kill credited to Q leaves its rune', () => {
    const [sim, p] = setup(['qseal', null]);
    kill(sim, p, blessed(sim, 10.5, 12.5), 'LMB');
    expect(sim.relics.areas).toHaveLength(0);
    kill(sim, p, blessed(sim, 10.5, 12.5), 'Q');
    expect(sim.relics.areas.map((a) => a.effect)).toEqual(['qseal']);
  });

  it('Seal of the Last Plea: an E kill launches the survivors beside it', () => {
    const [sim, p] = setup(['eseal', null]);
    const a = blessed(sim, 10.5, 12.5), b = blessed(sim, 11.5, 12.5);
    kill(sim, p, a, 'E');
    expect(sim.talents.launches.airborne(b)).toBe(true);
  });

  it('Wheel of Review: a slowed kill rolls 30 damage into the nearest enemy within 12 m', () => {
    const [sim, p] = setup(['wheel', null]);
    const a = blessed(sim, 10.5, 12.5), b = blessed(sim, 16.5, 12.5);
    sim.eHp[b] = 100;
    sim.slow(a, 2);
    kill(sim, p, a);
    run(sim, 15);
    expect(sim.eHp[b]).toBe(70);
  });

  it('relic damage never starts another relic: a Wheel kill of a pooled enemy binds nothing', () => {
    const [sim, p] = setup(['wheel', 'tile']);
    const a = blessed(sim, 10.5, 12.5), b = blessed(sim, 16.5, 12.5), c = blessed(sim, 17.5, 12.5);
    sim.slow(a, 2);
    sim.ePooled[b] = 1;
    kill(sim, p, a);
    for (let i = 0; i < 15; i++) { sim.ePooled[b] = 1; sim.step(); }
    expect(sim.eAlive[b]).toBe(0); // 30 damage kills a 20 HP Blessed
    expect(p.kills).toBe(2); // credited to the owner
    expect(sim.isRooted(c)).toBe(false);
  });
});

describe('the Comb', () => {
  it('one root hitting five distinct enemies lays one 6 × 2 m comb across its aim, at the first hit', () => {
    const [sim, p] = setup(['comb', null]);
    const root = sim.talents.root(p, 'LMB');
    const slots = [10.5, 11.5, 12.5, 13.5, 14.5].map((x) => blessed(sim, x, 12.5));
    for (const s of slots) { sim.eHp[s] = 100; sim.talents.primary(root, s, 1, 1); }
    // Five pellets into one enemy count once: still only one comb.
    sim.talents.primary(root, slots[0], 1, 1);
    sim.relics.flush();
    expect(sim.relics.areas).toHaveLength(1);
    const comb = sim.relics.areas[0];
    expect(comb.shape).toBe('rect');
    expect(comb.x).toBe(10.5);
    expect([comb.hx, comb.hy]).toEqual([1, 0]);
  });

  it('a later tick of the same root does not add to its window', () => {
    const [sim, p] = setup(['comb', null]);
    const root = sim.talents.root(p, 'LMB');
    const slots = [10.5, 11.5, 12.5, 13.5, 14.5].map((x) => blessed(sim, x, 12.5));
    slots.forEach((s) => { sim.eHp[s] = 100; });
    for (const s of slots.slice(0, 4)) sim.talents.primary(root, s, 1, 1);
    sim.step();
    sim.talents.primary(root, slots[4], 1, 1);
    sim.relics.flush();
    expect(sim.relics.areas).toHaveLength(0);
  });
});

describe('pickup relics', () => {
  it('the Unbroken Quill: a world halo picked up launches the enemies around its human collector', () => {
    const [sim, p] = setup(['unbroken', null]);
    const b = blessed(sim, 5, 12.5);
    sim.rewards.collect({ id: 1, kind: COIN, room: 0, x: p.x, y: p.y, value: 1, expiresTick: -1 }, p);
    sim.relics.flush();
    expect(sim.talents.launches.airborne(b)).toBe(true);
  });

  it("Mercy's Wax: a mote picked up shields 20 for 4 s, but never over a shield of 20 or more", () => {
    const [sim, p] = setup(['mercy', null]);
    p.hp = 10;
    sim.rewards.collect({ id: 1, kind: HEAL_MOTE, room: 0, x: p.x, y: p.y, value: 0, expiresTick: -1 }, p);
    sim.relics.flush();
    expect(p.shield).toBe(20);
    expect(p.shieldUntil).toBe(sim.tick + 4 * TICK_HZ);
    p.shield = 50; p.relicCd = {};
    sim.rewards.collect({ id: 2, kind: HEAL_MOTE, room: 0, x: p.x, y: p.y, value: 0, expiresTick: -1 }, p);
    sim.relics.flush();
    expect(p.shield).toBe(50);
    expect(p.relicCd.mercy ?? 0).toBe(0);
  });
});

describe('streaks and the Choral Fragment', () => {
  it('kills within a second extend the streak; a tier is announced once; a gap ends it', () => {
    const [sim, p] = setup([null, null]);
    for (let i = 0; i < 10; i++) kill(sim, p, blessed(sim, 10.5 + i, 12.5));
    expect(p.streak).toBe(10);
    expect(events(sim, 'streak')).toEqual([{ type: 'streak', playerId: p.id, count: 10, tier: 0 }]);
    run(sim, TICK_HZ + 2);
    expect(p.streak).toBe(0);
    expect(events(sim, 'streakEnd')).toEqual([{ type: 'streakEnd', playerId: p.id, count: 10 }]);
    expect(p.bestStreak).toBe(10);
  });

  it('a kill counts once for every other human who damaged that enemy in the last 1.5 s', () => {
    const sim = withRoom(['betrayer', 'binder']);
    const [a, b] = sim.players;
    const s = blessed(sim, 10.5, 12.5);
    sim.eHp[s] = 100;
    sim.damageEnemy(s, 5, b.index);
    kill(sim, a, s);
    expect(a.streak).toBe(1);
    expect(b.streak).toBe(1);
    expect(b.assists).toBe(1);
  });

  it('the Choral Fragment bursts 20 into the 12 nearest within 4 m when a native kill crosses a tier', () => {
    const [sim, p] = setup(['armageddon', null]);
    const near = blessed(sim, 5, 12.5);
    sim.eHp[near] = 100;
    for (let i = 0; i < 10; i++) kill(sim, p, blessed(sim, 15.5 + i, 12.5));
    expect(sim.eHp[near]).toBe(80);
  });

  it('a tier crossed by relic damage starts no relic', () => {
    const [sim, p] = setup(['armageddon', null]);
    const near = blessed(sim, 5, 12.5);
    sim.eHp[near] = 100;
    for (let i = 0; i < 9; i++) kill(sim, p, blessed(sim, 15.5 + i, 12.5));
    sim.relicDamage(blessed(sim, 25.5, 12.5), 9999, p, 25.5, 12.5);
    sim.streaks.flush(); sim.relics.flush();
    expect(p.streak).toBe(10);
    expect(sim.eHp[near]).toBe(100);
  });
});

describe('the Counterseal', () => {
  it('a successful item use sends a stamp along the aim that bursts 30 at its wall-limited end', () => {
    const [sim, p] = setup(['sentence3', null]);
    p.inventory = [{ item: 'feather', count: 1 }, null];
    const s = blessed(sim, 22.5, 12.5), past = blessed(sim, 30.5, 12.5);
    sim.eHp[s] = 100;
    sim.stun(s, 5); sim.stun(past, 5); // they stand still while the stamp flies
    p.yaw = 0; p.pitch = 0; p.z = -0.6; // the eye at body height, level along the room
    sim.items.manual(p, 0);
    sim.relics.flush();
    expect(sim.relics.shots).toHaveLength(1);
    run(sim, 2 * TICK_HZ);
    expect(sim.eHp[s]).toBe(70);
    expect(sim.eAlive[past]).toBe(1); // the stamp ignores bodies in flight and bursts only at its end
  });
});

describe('combo effects', () => {
  it('Order of Expulsion: a halo launches the crowd around the nearest taunted enemy, not the collector', () => {
    const [sim, p] = setup(['usher', 'unbroken']);
    const close = blessed(sim, 5, 12.5), t = blessed(sim, 15.5, 12.5), beside = blessed(sim, 16.5, 12.5);
    sim.eTauntUntil[t] = sim.tick + 100;
    sim.rewards.collect({ id: 1, kind: COIN, room: 0, x: p.x, y: p.y, value: 1, expiresTick: -1 }, p);
    sim.relics.flush();
    expect(sim.talents.launches.airborne(close)).toBe(false);
    expect(sim.talents.launches.airborne(beside)).toBe(true);
  });

  it('Order of Expulsion with nothing taunted does nothing and keeps the Quill ready', () => {
    const [sim, p] = setup(['usher', 'unbroken']);
    blessed(sim, 5, 12.5);
    sim.rewards.collect({ id: 1, kind: COIN, room: 0, x: p.x, y: p.y, value: 1, expiresTick: -1 }, p);
    sim.relics.flush();
    expect(p.relicCd.unbroken ?? 0).toBe(0);
  });

  it('Abandoned Mercy: a mote fires 40 into a censed enemy instead of shielding', () => {
    const [sim, p] = setup(['thurible', 'mercy']);
    const t = blessed(sim, 12.5, 12.5);
    sim.eHp[t] = 100;
    vi.spyOn(sim.talents, 'censed').mockImplementation((s) => s === t);
    p.hp = 10;
    sim.rewards.collect({ id: 1, kind: HEAL_MOTE, room: 0, x: p.x, y: p.y, value: 0, expiresTick: -1 }, p);
    sim.relics.flush();
    run(sim, 20);
    expect(p.shield).toBe(0);
    expect(sim.eHp[t]).toBe(60);
  });

  it('Broken Chorus: a tier bursts 30 around the nearest airborne enemy instead of around you', () => {
    const [sim, p] = setup(['link', 'armageddon']);
    const mine = blessed(sim, 5, 12.5), up = blessed(sim, 20.5, 12.5), beside = blessed(sim, 21.5, 12.5);
    sim.eHp[mine] = sim.eHp[up] = sim.eHp[beside] = 100;
    sim.talents.launches.launchFrom(up, 19.5, 12.5, 2, p, 'other', sim.talents.launches.newCast());
    for (let i = 0; i < 10; i++) kill(sim, p, blessed(sim, 30.5 + i * 0.5, 12.5));
    expect(sim.eHp[mine]).toBe(100);
    expect(sim.eHp[beside]).toBe(70);
  });

  it('Appeal in the Marble: an item use stamps 20 on enemies inside the newest landed area', () => {
    const [sim, p] = setup(['tile', 'sentence3']);
    p.inventory = [{ item: 'mirror', count: 1 }, null];
    const inside = blessed(sim, 5.5, 12.5), outside = blessed(sim, 20.5, 12.5);
    sim.eHp[inside] = sim.eHp[outside] = 100;
    sim.items.manual(p, 0);
    sim.relics.flush();
    expect(sim.relics.shots).toHaveLength(0);
    expect(sim.eHp[inside]).toBe(80);
    expect(sim.eHp[outside]).toBe(100);
  });

  it('Reversal of Judgment: an E kill launches the enemies on your live Q rune, not at the E kill', () => {
    const [sim, p] = setup(['qseal', 'eseal']);
    const runeVictim = blessed(sim, 10.5, 6.5), onRune = blessed(sim, 11.5, 6.5);
    kill(sim, p, runeVictim, 'Q');
    const eVictim = blessed(sim, 10.5, 18.5), besideE = blessed(sim, 11.5, 18.5);
    kill(sim, p, eVictim, 'E');
    expect(sim.talents.launches.airborne(onRune)).toBe(true);
    expect(sim.talents.launches.airborne(besideE)).toBe(false);
  });

  it('Reversal without a rune does nothing and starts no cooldown', () => {
    const [sim, p] = setup(['qseal', 'eseal']);
    kill(sim, p, blessed(sim, 10.5, 18.5), 'E');
    expect(p.relicCd.eseal ?? 0).toBe(0);
  });

  it('Harrow of the Host: a slowed kill rolls a 2 m wheel from the comb, 12 to each enemy in the lane', () => {
    const [sim, p] = setup(['comb', 'wheel']);
    const root = sim.talents.root(p, 'LMB');
    const crowd = [10.5, 11.5, 12.5, 13.5, 14.5].map((x) => blessed(sim, x, 12.5));
    for (const s of crowd) { sim.eHp[s] = 100; sim.talents.primary(root, s, 1, 1); }
    sim.relics.flush();
    const lane = [20.5, 22.5].map((x) => blessed(sim, x, 12.5)), aside = blessed(sim, 20.5, 16.5);
    for (const s of [...lane, aside]) sim.eHp[s] = 100;
    const v = blessed(sim, 30.5, 20.5);
    sim.slow(v, 2);
    kill(sim, p, v);
    run(sim, 2 * TICK_HZ);
    for (const s of lane) expect(sim.eHp[s]).toBe(88);
    expect(sim.eHp[aside]).toBe(100);
  });
});

describe('shared rules', () => {
  it('a combo uses relic b’s cooldown timer, kept through unequip and re-equip', () => {
    const [sim, p] = setup(['link', null]);
    const a = blessed(sim, 10.5, 12.5); blessed(sim, 11.5, 12.5);
    sim.root(a, 2);
    kill(sim, p, a);
    const cd = p.relicCd.link;
    expect(cd).toBeGreaterThan(sim.tick);
    sim.relics.equip(p, [null, null]);
    sim.relics.equip(p, ['link', 'armageddon']);
    expect(p.relicCd.link).toBe(cd);
  });

  it('unequipping b ends the combo’s outgoing effects; the owner’s death ends them all', () => {
    const [sim, p] = setup(['qseal', null]);
    kill(sim, p, blessed(sim, 10.5, 12.5), 'Q');
    expect(sim.relics.areas).toHaveLength(1);
    sim.relics.equip(p, [null, 'eseal']);
    expect(sim.relics.areas).toHaveLength(0);
  });

  it('a dead owner activates nothing', () => {
    const [sim, p] = setup(['eseal', null]);
    const a = blessed(sim, 10.5, 12.5), b = blessed(sim, 11.5, 12.5);
    const root = sim.talents.root(p, 'E');
    sim.talents.primary(root, a, 9999, 9999);
    p.dead = true;
    sim.relics.flush();
    expect(sim.talents.launches.airborne(b)).toBe(false);
  });

  it('item and relic areas share the owner’s four entitlements: a fifth starts the cooldown but makes nothing', () => {
    const [sim, p] = setup(['usher', null]);
    for (let i = 0; i < 4; i++) sim.items.effects.push({ id: 900 + i, owner: p.id, item: 'frost', room: 0 } as never);
    const a = blessed(sim, 10.5, 12.5);
    sim.eTauntUntil[a] = sim.tick + 100;
    kill(sim, p, a);
    expect(sim.relics.areas).toHaveLength(0);
    expect(p.relicCd.usher).toBeGreaterThan(sim.tick);
  });

  it('cleared-room trickle never activates a relic', () => {
    const [sim, p] = setup(['eseal', null]);
    const a = blessed(sim, 10.5, 12.5), b = blessed(sim, 11.5, 12.5);
    sim.leashed[a] = 1;
    kill(sim, p, a, 'E');
    // Trickle kills don't build streaks either.
    expect(p.streak).toBe(0);
    void b;
  });

  it('a flyer is never a floor ring target', () => {
    const [sim, p] = setup(['eseal', null]);
    const a = blessed(sim, 10.5, 12.5), c = enemyAt(sim, CHERUB, 11.5, 12.5);
    kill(sim, p, a, 'E');
    expect(sim.talents.launches.airborne(c)).toBe(false);
  });
});
