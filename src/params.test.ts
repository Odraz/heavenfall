import { describe, expect, it } from 'vitest';
import { getDungeon } from './data/dungeons/index';
import { parseParams } from './params';
import { validName } from './ui/menus';

describe('URL parameters (§2.5)', () => {
  it('restricts held ready to explicit dev menus and keeps the elite fixture reproducible', () => {
    expect(parseParams('?dev=1&menu=1&readyHold=1&map=dominion')).toMatchObject({ devMenu: true, readyHold: true, mapId: 'dominion' });
    for (const q of ['?readyHold=1&menu=1', '?dev=1&readyHold=1', '?bench=1&dev=1&menu=1&readyHold=1']) expect(parseParams(q).readyHold).toBe(false);
  });
  it('opens the menus without dev=1 or bench=1', () => {
    const p = parseParams('');
    expect(p.dev).toBe(false);
    expect(p.benchArena).toBe(-1);
  });

  it('skips the menus with dev=1, defaulting an invalid map and class', () => {
    const p = parseParams('?dev=1&map=nowhere&class=angel');
    expect(p).toMatchObject({ dev: true, mapId: 'sandbox', classId: 'fallen' });
    expect(parseParams('?dev=1&map=pearly-gates&class=binder')).toMatchObject({ mapId: 'pearly-gates', classId: 'binder' });
  });

  it('starts in arena N with dev=1 (`arena=N`), clamped to the map; 0 otherwise', () => {
    expect(parseParams('?dev=1&map=pearly-gates&arena=2').startArena).toBe(2);
    expect(parseParams('?dev=1&map=pearly-gates&arena=9').startArena).toBe(3);
    expect(parseParams('?dev=1&map=pearly-gates&arena=x').startArena).toBe(0);
    expect(parseParams('?map=pearly-gates&arena=2').startArena).toBe(0);
    expect(parseParams('?dev=1&map=pearly-gates').startArena).toBe(0);
  });

  it('honors seed only together with dev=1', () => {
    expect(parseParams('?dev=1&seed=7').seed).toBe(7);
    expect(parseParams('?seed=7').seed).toBeNull();
  });

  it('selects the generated floor and distinguishes room=0 from normal Breach spawns', () => {
    expect(parseParams('?dev=1&map=rogue&seed=317434499&room=10')).toMatchObject({ mapId: 'rogue', seed: 0x12ebaa83, startRoom: 10, startArena: 0 });
    expect(parseParams('?dev=1&map=rogue&room=0').startRoom).toBe(0);
    for (const suffix of ['', '&room=x', '&room=-1']) expect(parseParams(`?dev=1&map=rogue${suffix}`).startRoom).toBeNull();
    expect(parseParams('?map=rogue&room=10').startRoom).toBeNull();
    expect(parseParams('?dev=1&map=pearly-gates&room=10').startRoom).toBeNull();
    expect(parseParams('?dev=1&map=rogue&room=9999999999999999999999999999').startRoom).toBe(31);
    expect(parseParams('?dev=1&map=rogue&seed=4294967296').seed).toBe(0);
  });

  it('benches a generated room by seed and room (R9 stage 4), the pinned crest room by default', () => {
    expect(parseParams('?bench=1&map=rogue&room=10&seed=7')).toMatchObject({ mapId: 'rogue', seed: 7, benchArena: 10, startRoom: null, dev: false });
    expect(parseParams('?bench=1&map=rogue')).toMatchObject({ mapId: 'rogue', seed: 0x12ebaa83, benchArena: 3 });
    expect(parseParams('?bench=1&map=rogue&room=x&view=gate')).toMatchObject({ benchArena: 3, benchView: 'gate' });
    expect(parseParams('?bench=1&map=rogue&room=99').benchArena).toBe(31);
    // Elsewhere the seed stays a dev switch.
    expect(parseParams('?bench=1&map=pearly-gates&seed=7').seed).toBeNull();
  });

  it('keeps bot and god with the menus', () => {
    expect(parseParams('?bot=1&god=1')).toMatchObject({ dev: false, bot: true, god: true });
  });

  it('ignores other parameters with bench=1', () => {
    expect(parseParams('?bench=1&dev=1&bot=1&god=1&seed=5')).toMatchObject({ benchArena: 0, dev: false, bot: false, god: false, seed: null, classId: 'betrayer', mapId: 'sandbox', benchView: 'turn', benchHudFire: false });
  });

  it('takes the class and the HUD fire with bench=1 (M11 §5)', () => {
    expect(parseParams('?bench=1&class=binder&hudfire=1')).toMatchObject({ classId: 'binder', benchHudFire: true });
    expect(parseParams('?bench=1&class=nobody')).toMatchObject({ classId: 'betrayer', benchHudFire: false });
    expect(parseParams('?dev=1&hudfire=1')).toMatchObject({ benchHudFire: false });
    // M12 §10: the benchmark's bursts, only with bench=1.
    expect(parseParams('?bench=1&burst=1')).toMatchObject({ benchBurst: true });
    expect(parseParams('?bench=1')).toMatchObject({ benchBurst: false });
    expect(parseParams('?dev=1&burst=1')).toMatchObject({ benchBurst: false });
  });

  it('takes the map and the view with bench=1 (M10 §2.3)', () => {
    expect(parseParams('?bench=1&map=pearly-gates&view=arcade')).toMatchObject({ benchArena: 0, mapId: 'pearly-gates', benchView: 'arcade' });
    expect(parseParams('?bench=1&map=nowhere')).toMatchObject({ mapId: 'sandbox', benchView: 'turn' });
  });

  it('benches the boss arena in the gate view (M10 gate §4)', () => {
    const boss = getDungeon('pearly-gates')!.rooms.findIndex((a) => a.boss);
    expect(boss).toBeGreaterThan(0);
    expect(parseParams('?bench=1&map=pearly-gates&view=gate')).toMatchObject({ benchView: 'gate', benchArena: boss });
    // A map with no boss arena benches arena 0.
    expect(getDungeon('sandbox')!.rooms.some((a) => a.boss)).toBe(false);
    expect(parseParams('?bench=1&view=gate')).toMatchObject({ mapId: 'sandbox', benchView: 'gate', benchArena: 0 });
  });
});

describe('player name (§3)', () => {
  it('is 1 to 16 characters after trimming', () => {
    expect(validName('')).toBeNull();
    expect(validName('   ')).toBeNull();
    expect(validName('  Ann  ')).toBe('Ann');
    expect(validName('x'.repeat(16))).toBe('x'.repeat(16));
    expect(validName('x'.repeat(17))).toBeNull();
  });
});

describe('R9 evidence and boss HP switches', () => {
  it('reads bosshp in [0, 1] only with dev=1 on the generated floor', () => {
    expect(parseParams('?dev=1&map=rogue&bosshp=0.52').bossHp).toBe(0.52);
    for (const q of ['?dev=1&map=rogue&bosshp=1.5', '?dev=1&map=rogue&bosshp=-1', '?dev=1&map=rogue&bosshp=x', '?dev=1&map=pearly-gates&bosshp=0.5', '?map=rogue&bosshp=0.5'])
      expect(parseParams(q).bossHp, q).toBeNull();
  });
  it('allows evidence=1 on a normal page', () => {
    expect(parseParams('?evidence=1')).toMatchObject({ evidence: true, dev: false });
    expect(parseParams('').evidence).toBe(false);
  });
});
