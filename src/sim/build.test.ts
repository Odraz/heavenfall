import { describe, expect, it } from 'vitest';
import { BETRAYER_NODES, DEV_BUILDS, talentNode } from '../data/talents';
import { checkRite, dischargeCount, drawCards, eligibleRites, learnedError, removeLearned, resolveKit, runBuildError, type RunBuild, type SourceContext } from './build';
import { mulberry32 } from './rng';

const base: RunBuild = { talents: [], rites: [], q: 'field', e: 'shadowstep' };
const alone: SourceContext = { allies: [], items: [], areas: new Set(), hazard: false };
const b = (talents: string[], extra: Partial<RunBuild> = {}): RunBuild => ({ ...base, talents, ...extra });
const ids = (s: string) => s.split(' ').map((x) => `betrayer.${x}`);

describe('Betrayer catalog', () => {
  it('has 21 nodes: per tree 2/2/2/1 by tier, one ability node at tier 3 and one capstone', () => {
    expect(BETRAYER_NODES).toHaveLength(21);
    for (const tree of ['a', 'b', 'c'] as const) {
      const nodes = BETRAYER_NODES.filter((n) => n.tree === tree);
      expect([1, 2, 3, 4].map((t) => nodes.filter((n) => n.tier === t).length)).toEqual([2, 2, 2, 1]);
      expect(nodes.filter((n) => n.kind === 'ability').map((n) => n.tier)).toEqual([3]);
      expect(nodes.filter((n) => n.kind === 'capstone').map((n) => n.tier)).toEqual([4]);
    }
  });
  it('classifies every augment in exactly one channel and lists four kill-discharge nodes', () => {
    for (const n of BETRAYER_NODES) expect(!!n.channel).toBe(n.kind === 'augment');
    expect(BETRAYER_NODES.filter((n) => n.discharge).map((n) => n.id).sort()).toEqual(ids('a.1b a.cap c.2a c.2b').sort());
  });
  it('accepts every documented six-point capstone path and nine-point build', () => {
    const paths = ['a.1b a.2a a.2b a.3a a.1a a.cap', 'a.1b a.2a a.2b a.3a a.3b a.cap', 'b.1a b.1b b.2a b.2b b.3a b.cap', 'b.1a b.1b b.3b b.2b b.3a b.cap',
      'c.1a c.1b c.2a c.2b c.3a c.cap', 'c.1a c.2a c.2b c.3a c.3b c.cap',
      'a.1b a.2a a.2b a.3a a.1a a.cap b.1a b.2b b.2a', 'b.1a b.1b b.2a b.2b b.3a b.cap a.1b a.2a a.2b', 'c.1a c.1b c.2a c.2b c.3a c.cap a.1a a.2b b.1a',
      'a.1b a.2b a.1a b.1a b.2b b.2a c.1a c.1b c.2b'];
    for (const p of paths) expect(learnedError('betrayer', b(ids(p)), 10), p).toBeNull();
  });
  it('accepts every development quick build', () => {
    for (const [name, d] of Object.entries(DEV_BUILDS)) expect(learnedError('betrayer', { talents: d.talents, q: d.q ?? 'field', e: d.e ?? 'shadowstep' }, null), name).toBeNull();
  });
});

describe('learned legality', () => {
  it('needs points: level − 1, at most nine', () => {
    expect(learnedError('betrayer', b(ids('a.1a')), 1)).toBe('Not enough talent points');
    expect(learnedError('betrayer', b(ids('a.1a')), 2)).toBeNull();
  });
  it('counts only distinct strictly lower-tier learned nodes for a gate', () => {
    expect(learnedError('betrayer', b(ids('a.2a')), 10)).toMatch(/needs 1 lower/);
    expect(learnedError('betrayer', b(ids('a.1a a.2a a.2b')), 10)).toBeNull();
    expect(learnedError('betrayer', b(ids('a.1a a.2a a.3a')), 10)).toMatch(/needs 3 lower/);
    // A tier-2 node can't count itself or its own tier toward a tier-2 gate.
    expect(learnedError('betrayer', b(ids('a.2a a.2b')), 10)).toMatch(/needs 1 lower/);
  });
  it('allows one capstone', () => {
    expect(learnedError('betrayer', b(ids('a.1b a.2a a.2b a.3a a.1a a.cap b.1a b.1b b.2a')), 10)).toBeNull();
  });
  it('refuses two learned augments in the same channel, even across trees', () => {
    expect(learnedError('betrayer', b(ids('a.1a a.1b a.2a a.2b a.3b')), 10)).toMatch(/same thing/);
    expect(learnedError('betrayer', b(ids('b.1b c.1a')), 10)).toMatch(/same thing/);
    // Delivery and Payload on the RMB compose.
    expect(learnedError('betrayer', b(ids('a.1a c.1a')), 10)).toBeNull();
  });
  it('refuses a third kill-triggered talent', () => {
    expect(learnedError('betrayer', b(ids('a.1b c.1a c.2a c.2b')), 10)).toMatch(/two kill-triggered/);
  });
  it('assigns only owned abilities', () => {
    expect(learnedError('betrayer', b([], { q: 'judasCoin' }), 10)).toMatch(/Q holds/);
    expect(learnedError('betrayer', b(ids('a.1a a.1b a.2b a.3a'), { q: 'judasCoin' }), 10)).toBeNull();
  });
});

describe('effective kit', () => {
  it('leaves an augment of an unassigned ability dormant', () => {
    const kit = resolveKit('betrayer', b(ids('c.1b b.1a b.2a b.1b b.3a'), { e: 'wayBack', q: 'field' }));
    expect(kit.active.has('betrayer.c.1b')).toBe(true);
    expect(kit.active.has('betrayer.b.2a')).toBe(true);
    const coin = resolveKit('betrayer', b(ids('c.1b a.1a a.1b a.2b a.3a'), { q: 'judasCoin' }));
    expect(coin.dormant).toContain('betrayer.c.1b');
    expect(coin.active.has('betrayer.c.1b')).toBe(false);
  });
  it("Potter's Field sleeps while Field of Blood isn't assigned", () => {
    const kit = resolveKit('betrayer', b(ids('c.1a c.1b c.2a c.2b c.3a c.cap a.1a a.1b a.2b a.3a'), { q: 'judasCoin' }));
    expect(kit.dormant).toContain('betrayer.c.cap');
  });
  it('a Rite augment suppresses the learned augment of its own channel only', () => {
    const kit = resolveKit('betrayer', { ...b(ids('c.1a a.1a')), rites: ids('b.1b') });
    expect([...kit.suppressed]).toEqual([['betrayer.c.1a', 'betrayer.b.1b']]);
    expect(kit.active.has('betrayer.a.1a')).toBe(true);
    expect(kit.active.has('betrayer.b.1b')).toBe(true);
  });
});

describe('Rites', () => {
  it('offers the six tier-1 nodes on a fresh base kit, minus readers without a source', () => {
    expect(eligibleRites('betrayer', base, alone)).toEqual(ids('a.1a a.1b b.1a b.1b c.1a c.1b'));
  });
  it('filters a state reader until a source exists, and does not let it qualify on what it would remove', () => {
    const run = { ...b(ids('a.1a')), rites: [] as string[] };
    expect(checkRite('betrayer', run, alone, 'betrayer.a.2a')).toMatchObject({ ok: false });
    expect(checkRite('betrayer', run, { ...alone, items: ['frost'] }, 'betrayer.a.2a')).toMatchObject({ ok: true });
    expect(checkRite('betrayer', run, { ...alone, allies: [{ classId: 'binder', q: 'chains', e: 'discord' }] }, 'betrayer.a.2a')).toMatchObject({ ok: true });
    // Broken Vessel with only the Nail as a bind source; Recoil would remove the Nail, so its card can still come.
    const nail = { ...b(ids('c.1a')), rites: [] as string[] };
    expect(checkRite('betrayer', nail, alone, 'betrayer.c.2b')).toMatchObject({ ok: true });
  });
  it('names the surrendered learned effect and refuses displacing another Rite', () => {
    const run = { ...b(ids('c.1a')), rites: [] as string[] };
    expect(checkRite('betrayer', run, alone, 'betrayer.b.1b')).toMatchObject({ ok: true, surrenders: 'betrayer.c.1a' });
    const held = { ...base, rites: ids('c.1a') };
    expect(checkRite('betrayer', held, alone, 'betrayer.b.1b')).toMatchObject({ ok: false });
  });
  it('lets Rites open higher Rite tiers but never learned gates', () => {
    const run = { ...base, rites: ids('a.1a') };
    expect(checkRite('betrayer', run, alone, 'betrayer.a.2b')).toMatchObject({ ok: true });
    expect(learnedError('betrayer', b(ids('a.2b')), 10)).not.toBeNull();
  });
  it('puts an ability Rite in its slot and names what it replaces and what goes dormant', () => {
    const run = { ...b(ids('c.1b a.1a a.1b')), rites: ids('a.2b') };
    const r = checkRite('betrayer', run, alone, 'betrayer.a.3a');
    expect(r).toMatchObject({ ok: true, replaces: 'field', dormant: ['betrayer.c.1b'] });
    if (r.ok) expect(r.build.q).toBe('judasCoin');
  });
  it('enforces the four-Rite cap and the kill-discharge cap', () => {
    const four = { ...base, rites: ids('a.1a b.1a b.1b c.1b') };
    expect(checkRite('betrayer', four, alone, 'betrayer.c.1a')).toMatchObject({ ok: false, reason: 'Four Rites already' });
    const two = { ...b(ids('a.1b c.1a c.2b')), rites: [] as string[] };
    expect(checkRite('betrayer', two, alone, 'betrayer.c.2a')).toMatchObject({ ok: false, reason: 'A third kill-triggered talent' });
  });
  it('needs an ally with Blasphemy for Behind His Back', () => {
    const run = { ...b(ids('a.1b a.2a a.2b')), rites: [] as string[] };
    expect(checkRite('betrayer', run, alone, 'betrayer.a.3b')).toMatchObject({ ok: false });
    expect(checkRite('betrayer', run, { ...alone, allies: [{ classId: 'fallen', q: 'blasphemy', e: 'fallingStar' }] }, 'betrayer.a.3b')).toMatchObject({ ok: true });
  });
  it('draws two distinct cards, reproducibly', () => {
    const pool = ids('a.1a a.1b b.1a b.1b c.1a c.1b');
    const one = drawCards(pool, mulberry32(7)), two = drawCards(pool, mulberry32(7));
    expect(one).toEqual(two);
    expect(new Set(one).size).toBe(2);
    expect(drawCards(pool.slice(0, 1), mulberry32(1))).toEqual(pool.slice(0, 1));
    expect(drawCards([], mulberry32(1))).toEqual([]);
  });
});

describe('respec', () => {
  it('removing a node removes the learned nodes that depended on it and resets its ability slot', () => {
    const run = { ...b(ids('a.1a a.1b a.2b a.3a'), { q: 'judasCoin' }), rites: [] as string[] };
    const next = removeLearned('betrayer', run, 'betrayer.a.1a');
    expect(next.talents).toEqual(ids('a.1b a.2b'));
    expect(next.q).toBe('field');
  });
  it('keeps an ability held as a Rite', () => {
    const run = { ...b(ids('a.1a a.1b a.2b')), rites: ids('a.3a'), q: 'judasCoin' };
    expect(runBuildError('betrayer', run, 10)).toBeNull();
    expect(removeLearned('betrayer', run, 'betrayer.a.1a').q).toBe('judasCoin');
  });
  it('refuses a respec that breaks a held Rite\'s gate', () => {
    const run = { ...b(ids('a.1a')), rites: ids('a.2b') };
    expect(runBuildError('betrayer', run, 10)).toBeNull();
    expect(runBuildError('betrayer', { ...run, talents: [] }, 10)).toBe('Your Rite The Informer needs 1 lower A talent');
  });
  it('lets an editor step break a Rite\'s gate and learn it back before applying', () => {
    // Three learned and one Rite: resetting tree A leaves The Informer without its gate for a moment.
    const run = { ...b(ids('a.1a b.1a c.1a')), rites: ids('a.2b') };
    const reset = { ...run, talents: ids('b.1a c.1a') };
    expect(runBuildError('betrayer', reset, 4)).toBe('Your Rite The Informer needs 1 lower A talent');
    expect(runBuildError('betrayer', reset, 4, true)).toBeNull();
    // The step check still refuses everything else: points, learned gates, exclusions.
    expect(runBuildError('betrayer', { ...reset, talents: ids('b.1a c.1a b.1b c.1b') }, 4, true)).toBe('Not enough talent points');
    expect(runBuildError('betrayer', { ...reset, talents: ids('b.1a c.1a a.1b') }, 4)).toBeNull();
  });
  it('allows learning the augment a Rite already suppresses', () => {
    expect(runBuildError('betrayer', { ...b(ids('c.1a')), rites: ids('b.1b') }, 10)).toBeNull();
    expect(dischargeCount(resolveKit('betrayer', { ...b(ids('a.1b c.2b')), rites: [] }))).toBe(2);
  });
  it('has a one-line rule on every card', () => {
    for (const n of BETRAYER_NODES) expect(talentNode(n.id)!.rule.length).toBeLessThan(110);
  });
});
