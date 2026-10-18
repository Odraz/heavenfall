/** R6: Edicts and the Sentence, the four deeds, records and the streak crown (game.md §2.5, §8.6, §10). */
import { describe, expect, it } from 'vitest';
import { generateFloor } from '../gen';
import { PINNED } from '../gen/pinned';
import { PEARLY_POOL } from '../data/rooms/1';
import { COIN, CURRENCY_LIFETIME, HEAL_MOTE } from '../data/pickups';
import { roman, sentenceFactor, sentenceLabel, cleanEdicts } from '../data/edicts';
import type { GameEvent } from '../net/messages';
import { createProfile } from '../profile/model';
import { RunRecords } from '../net/runRecords';
import { applyProgress, stakeProfile } from '../profile/lifecycle';
import { Simulation } from './sim';
import { XP_GAIN } from './rewards';
import { sealNow } from './testutil/sims';
import { Lobby } from '../net/lobby';

const g = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL);
const classes = ['fallen', 'heretic', 'binder', 'betrayer'] as const;

function bossSim(edicts: number[] = [], players = 1, winsBefore = 1, progression = true) {
  const profiles = Array.from({ length: players }, (_, i) => {
    const p = createProfile(`P${i}`, String(i + 1).repeat(32), 1);
    if (winsBefore) p.heavens.clears[1] = winsBefore;
    return p;
  });
  const sim = new Simulation({ dungeon: g.def, floor: g.floor, seed: 1, startRoom: g.floor.boss, progressionEnabled: progression, edicts,
    players: profiles.map((profile, id) => ({ id, name: profile.name, classId: classes[id], profile })) });
  sim.step(); sealNow(sim, g.floor.boss);
  return { sim, profiles };
}
const win = (sim: Simulation) => { sim.damageEnemy(sim.bossSlot, 1e6, 0); sim.step(); };
function events<T extends GameEvent['type']>(sim: Simulation, type: T): Array<Extract<GameEvent, { type: T }>> {
  return sim.events.flatMap((e) => (e.event.type === type ? [e.event as Extract<GameEvent, { type: T }>] : []));
}

describe('the Sentence', () => {
  it('multiplies every XP gain by 1 + 0.15 per Edict', () => {
    expect(sentenceFactor(3)).toBeCloseTo(1.45);
    expect(sentenceLabel(3)).toBe('Sentence 3 · XP ×1.45');
    expect(sentenceLabel(0)).toBeNull();
    const { sim } = bossSim([1, 3, 4]);
    const p = sim.players[0], before = p.runXp;
    sim.rewards.awardXp(100);
    expect(p.runXp - before).toBeCloseTo(100 * XP_GAIN * 1.45);
  });

  it('keeps only known distinct Edicts, sorted', () => {
    expect(cleanEdicts([3, 1, 3, 9, 'x', 2.5])).toEqual([1, 3]);
    expect(roman(4)).toBe('IV');
    expect(roman(3999)).toBe('MMMCMXCIX');
    expect(roman(4000)).toBe('4000');
  });
});

describe('Edict rules', () => {
  it('Poverty: coins and gold halos fade after 10 s; motes keep 20 s', () => {
    const { sim } = bossSim([4]);
    const coin = sim.pickups.drop(COIN, g.floor.boss, sim.players[0].x, sim.players[0].y, sim.tick)!;
    const mote = sim.pickups.drop(HEAL_MOTE, g.floor.boss, sim.players[0].x, sim.players[0].y, sim.tick)!;
    expect(coin.expiresTick - sim.tick).toBe(300);
    expect(mote.expiresTick - sim.tick).toBe(CURRENCY_LIFETIME);
  });

  it('Penance: the living are not healed at victory; without it they are', () => {
    for (const penance of [false, true]) {
      const { sim } = bossSim(penance ? [2] : []);
      const p = sim.players[0];
      p.hp = 10;
      win(sim);
      expect(p.hp).toBe(penance ? 10 : Math.min(p.maxHp, 10 + p.maxHp * 0.3));
    }
  });

  it('the Trumpet calls the first Judgment at the start of the fight', () => {
    expect(bossSim([5]).sim.judgmentDue - bossSim([]).sim.judgmentDue).toBeLessThan(0);
  });

  it('the Lobby takes Edicts from the host only, once its profile has cleared the heaven', () => {
    const host = createProfile('H', '1'.repeat(32), 1);
    const locked = new Lobby({ heaven: 1, fixture: null, password: '', version: 'v', hostName: 'H', profile: host, progressionEnabled: true });
    expect(locked.setEdicts(0, [1, 2])).toBe(false);
    host.heavens.clears[1] = 1;
    const lobby = new Lobby({ heaven: 1, fixture: null, password: '', version: 'v', hostName: 'H', profile: host, progressionEnabled: true });
    expect(lobby.setEdicts(1, [1])).toBe(false);
    expect(lobby.setEdicts(0, [3, 1])).toBe(true);
    expect(lobby.lobbyMessage().edicts).toEqual([1, 3]);
  });
});

describe('deeds', () => {
  it('a prior winner present at the start who wins without dying, Sundial-sealed, at Sentence 3 does three deeds', () => {
    const { sim } = bossSim([1, 2, 3]);
    const p = sim.players[0];
    expect(p.sundialQualified).toBe(true);
    win(sim);
    expect(p.deedsEarned.sort()).toEqual(['mercy', 'sentence3', 'unbroken']);
    expect(p.ownedRelics).toEqual(expect.arrayContaining(['unbroken', 'mercy', 'sentence3']));
  });

  it('a streak of 200 is Armageddon; a death breaks Unbroken', () => {
    const { sim } = bossSim();
    const p = sim.players[0];
    p.bestStreak = 200; p.deaths = 1;
    win(sim);
    expect(p.deedsEarned.sort()).toEqual(['armageddon', 'mercy']);
  });

  it('no deed for a first victory, a disposable run, a mid-run join or an already-done deed', () => {
    expect(((s) => { win(s); return s.players[0].deedsEarned; })(bossSim([], 1, 0).sim)).toEqual([]);
    expect(((s) => { win(s); return s.players[0].deedsEarned; })(bossSim([], 1, 1, false).sim)).toEqual([]);
    const late = bossSim().sim; late.players[0].presentAtStart = false; win(late);
    expect(late.players[0].deedsEarned).toEqual([]);
    const done = bossSim().sim; done.players[0].profileDeeds = ['unbroken', 'mercy']; win(done);
    expect(done.players[0].deedsEarned).toEqual([]);
  });

  it('the victory settlement saves the deeds, their relics, the best streak and the Sentence won', () => {
    const profile = createProfile('P', '1'.repeat(32), 1);
    profile.heavens.clears[1] = 1;
    const records = new RunRecords('c'.repeat(32), true);
    let saved = stakeProfile(profile, records.reserve(0, 'heretic', profile, true));
    const r = records.byPlayer(0)!;
    saved = applyProgress(saved, records.commit(r))!;
    r.deeds = ['unbroken', 'sentence3']; r.bestStreak = 57; r.sentence = 3;
    saved = applyProgress(saved, records.settle(r, 'victory'))!;
    expect(saved.deeds.sort()).toEqual(['sentence3', 'unbroken']);
    expect(saved.relics.sort()).toEqual(['sentence3', 'unbroken']);
    expect(saved.characters.heretic.bestStreak).toBe(57);
    expect(saved.characters.heretic.bestSentence[1]).toBe(3);
  });
});

describe('the streak crown', () => {
  it('goes to the best streak of the run, the earlier on a tie', () => {
    const { sim } = bossSim([], 3);
    const [a, b, c] = sim.players;
    a.bestStreak = 40; a.bestStreakTick = 500;
    b.bestStreak = 40; b.bestStreakTick = 300;
    c.bestStreak = 12;
    sim.finish('defeat');
    const over = events(sim, 'gameOver')[0];
    expect(over.crown).toBe(b.id);
    expect(over.stats[a.id].bestStreak).toBe(40);
  });
});
