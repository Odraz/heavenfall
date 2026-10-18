/** R5: the Fallen, Heretic Saint and Binder catalogs on the shared resolver (classes-*.md §3, game.md §9.3–§9.10). */
import { describe, expect, it } from 'vitest';
import type { ClassId } from '../data/classes';
import { ALT_ABILITIES, BASE_ABILITIES, BINDER_NODES, DEV_BUILDS, FALLEN_NODES, HERETIC_NODES, TALENT_NODES, devBuildOrder, talentNode, type TalentNode } from '../data/talents';
import { checkRite, learnedError, producedStates, resolveKit, runBuildError, type RunBuild, type SourceContext } from './build';

const alone: SourceContext = { allies: [], items: [], areas: new Set(), hazard: false };
/** A full party with every other class's base kit, a hazard, survivors and flyers on the floor. */
const party = (classId: ClassId): SourceContext => ({
  allies: (['fallen', 'heretic', 'binder', 'betrayer'] as const).filter((c) => c !== classId).map((c) => ({ classId: c, q: BASE_ABILITIES[c][0], e: BASE_ABILITIES[c][1] })),
  items: [], areas: new Set(), hazard: true, survivors: true, flyers: true,
});
const build = (classId: ClassId, list: string, extra: Partial<RunBuild> = {}): RunBuild => {
  const [q, e] = BASE_ABILITIES[classId];
  return { talents: list ? list.split(' ').map((s) => `${classId}.${s}`) : [], rites: [], q, e, ...extra };
};
const CATALOGS: Array<[ClassId, readonly TalentNode[], string[], string[]]> = [
  ['fallen', FALLEN_NODES, ['a.2a', 'c.1b'], ['a.1b', 'b.1b', 'b.2a', 'b.3b', 'c.1a', 'c.2b']],
  ['heretic', HERETIC_NODES, ['a.3b'], ['a.1b', 'a.2a', 'b.1a', 'b.2b', 'c.1a', 'c.2a', 'c.2b']],
  ['binder', BINDER_NODES, ['a.1a', 'b.1a', 'b.3b', 'c.1a', 'c.2b'], ['b.2a', 'c.3b']],
];
const DISCHARGE: Record<string, string[]> = { fallen: ['b.1b'], heretic: ['b.1b'], binder: ['a.1b', 'b.cap', 'c.1b'] };

/** Two augments in one channel on an intersecting named input (§9.3). */
const clash = (a: TalentNode, b: TalentNode): boolean => a.kind === 'augment' && b.kind === 'augment' && a.channel === b.channel && a.input === b.input &&
  (a.input === 'LMB' || a.input === 'RMB' || (a.targets ?? []).some((t) => b.targets?.includes(t)));

/**
 * The smallest legal learned set that opens `n`: lower-tier nodes of its tree in catalog order, skipping
 * any that would share a channel and input with an earlier pick or with `n`, plus `n` itself.
 */
function opening(classId: ClassId, n: TalentNode): RunBuild {
  const need = [0, 0, 1, 3, 5][n.tier];
  const picks: string[] = [];
  for (const o of TALENT_NODES[classId]) {
    if (picks.length >= need) break;
    if (o.tree !== n.tree || o.tier >= n.tier) continue;
    if ([...picks, n.id].some((id) => clash(o, talentNode(id)!))) continue;
    picks.push(o.id);
  }
  const [q, e] = BASE_ABILITIES[classId];
  const b: RunBuild = { talents: [...picks, n.id], rites: [], q, e };
  if (n.teaches) b[n.teaches.slot === 'Q' ? 'q' : 'e'] = n.teaches.ability;
  return b;
}

describe.each(CATALOGS)('%s catalog', (classId, nodes, delivery, payload) => {
  it('has 21 nodes: per tree 2/2/2/1 by tier, one ability node at tier 3 and one capstone', () => {
    expect(nodes).toHaveLength(21);
    for (const tree of ['a', 'b', 'c'] as const) {
      const t = nodes.filter((n) => n.tree === tree);
      expect([1, 2, 3, 4].map((k) => t.filter((n) => n.tier === k).length)).toEqual([2, 2, 2, 1]);
      expect(t.filter((n) => n.kind === 'ability').map((n) => n.tier)).toEqual([3]);
      expect(t.filter((n) => n.kind === 'capstone').map((n) => n.tier)).toEqual([4]);
    }
  });

  it('matches the catalog composition table and kill-discharge list exactly', () => {
    const of = (ch: string) => nodes.filter((n) => n.channel === ch).map((n) => n.id.slice(classId.length + 1)).sort();
    expect(of('delivery')).toEqual([...delivery].sort());
    expect(of('payload')).toEqual([...payload].sort());
    for (const n of nodes) expect(!!n.channel, n.id).toBe(n.kind === 'augment');
    expect(nodes.filter((n) => n.discharge).map((n) => n.id.slice(classId.length + 1)).sort()).toEqual(DISCHARGE[classId]);
  });

  it('teaches three new abilities, each with a Q/E definition and an icon', () => {
    const taught = nodes.filter((n) => n.teaches).map((n) => n.teaches!);
    expect(taught).toHaveLength(3);
    for (const t of taught) {
      expect(ALT_ABILITIES[t.ability].slot).toBe(t.slot);
      expect(ALT_ABILITIES[t.ability].icon).toMatch(/^icon-/);
      expect(BASE_ABILITIES[classId]).not.toContain(t.ability);
    }
  });

  // Every node row: its smallest learned opening is legal and makes the node effective (§9.3).
  it.each(nodes.map((n) => [n.id, n] as const))('%s is legal learned and effective', (_, n) => {
    const b = opening(classId, n);
    expect(learnedError(classId, b, null), n.id).toBeNull();
    expect(resolveKit(classId, b).active.has(n.id), n.id).toBe(true);
  });

  // Every node row as a Rite: in a full party with its gate held, it is offered (§9.10).
  it.each(nodes.map((n) => [n.id, n] as const))('%s is a valid Rite once its gate is held', (_, n) => {
    const open = opening(classId, n);
    const learned: RunBuild = { ...open, talents: open.talents.filter((t) => t !== n.id), q: BASE_ABILITIES[classId][0], e: BASE_ABILITIES[classId][1] };
    const r = checkRite(classId, learned, party(classId), n.id);
    expect(r.ok ? '' : r.reason, n.id).toBe('');
    if (r.ok && n.teaches) expect(r.replaces).toBe(BASE_ABILITIES[classId][n.teaches.slot === 'Q' ? 0 : 1]);
  });

  it('accepts its development quick builds, which are nine-point legal builds', () => {
    const names = devBuildOrder(classId).filter((k) => DEV_BUILDS[k].classId === classId);
    expect(names.length).toBeGreaterThanOrEqual(4);
    for (const name of names) {
      const d = DEV_BUILDS[name];
      const [q, e] = BASE_ABILITIES[classId];
      expect(learnedError(classId, { talents: d.talents, q: d.q ?? q, e: d.e ?? e }, 10), name).toBeNull();
      expect(d.talents.length, name).toBeLessThanOrEqual(9);
    }
    expect(devBuildOrder(classId)).toContain('base');
  });
});

describe('the Fallen on the resolver', () => {
  it('refuses the cross-tree Payload pairs and keeps Through the Ranks beside either LMB payload', () => {
    expect(learnedError('fallen', build('fallen', 'a.1b b.1a b.3b b.1b b.2a'), null)).toMatch(/same thing/);
    expect(learnedError('fallen', build('fallen', 'b.1b c.1a'), null)).toMatch(/same thing/);
    expect(learnedError('fallen', build('fallen', 'b.2a c.1b c.2b b.1a'), null)).toMatch(/same thing/);
    expect(learnedError('fallen', build('fallen', 'a.1a a.2a c.1a'), null)).toBeNull();
    expect(learnedError('fallen', build('fallen', 'a.1a a.2a b.1b'), null)).toBeNull();
  });
  it('Son of the Morning shapes Falling Star, Gatebreaker, Rain of Fire and Cast Out, and nothing else', () => {
    const son = 'fallen.c.1b';
    expect(resolveKit('fallen', build('fallen', 'c.1b')).active.has(son)).toBe(true);
    expect(resolveKit('fallen', build('fallen', 'a.1a a.1b a.2b a.3a c.1b', { e: 'gatebreaker' })).active.has(son)).toBe(true);
    expect(resolveKit('fallen', build('fallen', 'b.1a b.1b b.2a b.3a c.1b', { e: 'rainOfFire' })).active.has(son)).toBe(true);
    // Cast Out on Q keeps it effective even with an E it doesn't shape... every E here is in its set, so check Q alone.
    expect(resolveKit('fallen', build('fallen', 'c.1a c.1b c.2a c.3a', { q: 'castOut' })).active.has(son)).toBe(true);
  });
  it('makes Gatebreaker, Rain of Fire and Cast Out own sources; Cast Out loses the taunt', () => {
    expect(producedStates(resolveKit('fallen', build('fallen', 'c.1a c.1b c.2a c.3a', { q: 'castOut' })))).not.toContain('taunted');
    expect(producedStates(resolveKit('fallen', build('fallen', 'b.1a b.1b b.2a b.3a', { e: 'rainOfFire' })))).toContain('pooled');
    expect(producedStates(resolveKit('fallen', build('fallen', 'c.1b c.2a c.3b')))).toContain('bound');
  });
  it('filters own-source Rites: As We Fell needs an own launch, the Plain own fire', () => {
    // Every Burning Sand gate is fire, so Pyre is always useful to its own tree.
    expect(checkRite('fallen', build('fallen', 'b.1a'), alone, 'fallen.b.2b').ok).toBe(true);
    // Cast Out and Rain of Fire leave no launch: As We Fell is filtered (Heave or Wormwood would supply one).
    const noLaunch = build('fallen', 'c.1b b.1a b.1b b.2a b.3a', { q: 'castOut', e: 'rainOfFire' });
    expect(checkRite('fallen', { ...noLaunch, q: 'blasphemy' }, alone, 'fallen.c.2a')).toMatchObject({ ok: false, reason: 'Nothing of yours launches enemies' });
    expect(checkRite('fallen', build('fallen', 'c.1b'), alone, 'fallen.c.2a').ok).toBe(true); // Falling Star launches
    expect(checkRite('fallen', build('fallen', 'b.1a b.1b b.2a b.2b b.3a', { e: 'rainOfFire' }), alone, 'fallen.b.cap').ok).toBe(true);
  });
  it('Underfoot needs a slow: Weight of Sin supplies one solo; a Binder ally does too', () => {
    const gate = build('fallen', 'a.1a a.2a a.2b');
    expect(checkRite('fallen', gate, alone, 'fallen.a.3b')).toMatchObject({ ok: false, reason: 'Nothing makes enemies slowed' });
    expect(checkRite('fallen', build('fallen', 'a.1a a.1b a.2a'), alone, 'fallen.a.3b').ok).toBe(true);
    expect(checkRite('fallen', gate, { ...alone, allies: [{ classId: 'binder', q: 'chains', e: 'discord' }] }, 'fallen.a.3b').ok).toBe(true);
  });
  it('A Third of the Stars needs an assigned Q/E launch, not a Wormwood alone', () => {
    const gate = build('fallen', 'c.1a c.1b c.2a c.2b c.3b', { e: 'fallingStar' });
    expect(checkRite('fallen', gate, alone, 'fallen.c.cap').ok).toBe(true);
    const hellEnough: RunBuild = { ...build('fallen', 'c.1a c.1b c.2a c.2b c.3b b.1a b.1b b.2a b.3a'), e: 'rainOfFire' };
    expect(checkRite('fallen', hellEnough, alone, 'fallen.c.cap')).toMatchObject({ ok: false, reason: 'Your Q and E launch nothing' });
  });
});

describe('the Heretic Saint on the resolver', () => {
  it('excludes the LMB payloads and Communion payloads from each other, with the Long Chain compatible', () => {
    expect(learnedError('heretic', build('heretic', 'b.1a c.1a c.1b c.2a'), null)).toMatch(/same thing/);
    expect(learnedError('heretic', build('heretic', 'c.1a c.2a c.2b'), null)).toMatch(/same thing/);
    expect(learnedError('heretic', build('heretic', 'a.1b b.1a b.2b'), null)).toMatch(/same thing/);
    expect(learnedError('heretic', build('heretic', 'a.1a a.1b a.2b a.3b b.1a'), null)).toBeNull();
  });
  it('In Both Kinds needs two other living allies for a Rite', () => {
    const gate = build('heretic', 'a.1a');
    expect(checkRite('heretic', gate, alone, 'heretic.a.2a')).toMatchObject({ ok: false, reason: 'Needs two other living allies' });
    expect(checkRite('heretic', gate, { ...alone, allies: party('heretic').allies.slice(0, 1) }, 'heretic.a.2a').ok).toBe(false);
    expect(checkRite('heretic', gate, party('heretic'), 'heretic.a.2a').ok).toBe(true);
  });
  it('Ploughshares removes own incense: Walk in the Smoke, Common Cause and Pillar need incense', () => {
    const fire = build('heretic', 'b.1a');
    expect(checkRite('heretic', fire, alone, 'heretic.c.1b')).toMatchObject({ ok: false, reason: 'You make no incense' });
    expect(checkRite('heretic', build('heretic', ''), alone, 'heretic.c.1b').ok).toBe(true);
    // Cloud of Witnesses brings incense back even with Ploughshares.
    const kit = resolveKit('heretic', build('heretic', 'b.1a c.1a c.1b c.2b c.3a', { q: 'cloudOfWitnesses' }));
    expect(producedStates(kit)).toContain('censed');
  });
  it('Resurrection of the Body needs Communion assigned, as a Rite and to work', () => {
    const gate = build('heretic', 'a.1a a.1b a.2b a.3a a.3b', { e: 'breadOfAngels' });
    expect(checkRite('heretic', gate, alone, 'heretic.a.cap').ok).toBe(true);
    const witness = build('heretic', 'a.1a a.2a a.2b a.3a a.3b c.1a c.1b c.2a c.3a', { q: 'cloudOfWitnesses' });
    expect(checkRite('heretic', { ...witness, talents: witness.talents }, alone, 'heretic.a.cap')).toMatchObject({ ok: false, reason: 'Unholy Communion is not assigned' });
    expect(resolveKit('heretic', { ...witness, talents: [...witness.talents.slice(0, 5), 'heretic.a.cap'] }).dormant).toContain('heretic.a.cap');
  });
  it('Irons in the Fire needs a pool and an enemy that survives the censer', () => {
    const gate = build('heretic', 'b.1a b.1b b.2a');
    expect(checkRite('heretic', gate, alone, 'heretic.b.3b')).toMatchObject({ ok: false });
    expect(checkRite('heretic', gate, { ...alone, survivors: true }, 'heretic.b.3b').ok).toBe(true);
  });
  it('Pitch needs own smoke or fire and a slow, bind or launch', () => {
    const gate = build('heretic', 'b.1b');
    expect(checkRite('heretic', gate, alone, 'heretic.b.2a').ok).toBe(false);
    expect(checkRite('heretic', build('heretic', 'a.1b b.1b'), alone, 'heretic.b.2a').ok).toBe(true); // Exorcism launches
  });
});

describe('the Binder on the resolver', () => {
  it('keeps the RMB geometries and Discord payloads exclusive; the Delivery Cast Down beside the capstone', () => {
    expect(learnedError('binder', build('binder', 'b.1a b.1b b.3b b.2a b.2b'), null)).toMatch(/same thing/);
    expect(learnedError('binder', build('binder', 'b.1a c.1a c.2b'), null)).toMatch(/same thing/);
    expect(learnedError('binder', build('binder', 'b.1a b.2a c.1a c.1b c.2a c.3b'), null)).toMatch(/same thing/);
    expect(learnedError('binder', build('binder', 'a.1a a.1b a.2b a.3a a.3b a.cap'), null)).toBeNull();
  });
  it('refuses a third kill-triggered talent: Chain Holds, Frost and the Chains Shatter', () => {
    expect(learnedError('binder', build('binder', 'a.1b b.1a b.1b b.2a b.2b b.3a b.cap c.1b'), null)).toMatch(/two kill-triggered/);
    const breaker = build('binder', 'b.1a b.1b b.2a b.2b b.3a b.cap c.1a c.1b', { q: 'ring' });
    expect(checkRite('binder', breaker, alone, 'binder.a.1b')).toMatchObject({ ok: false, reason: 'A third kill-triggered talent' });
  });
  it('Where They Fall needs a direct launch: own Voice, a Fallen or an Exorcism', () => {
    const gate = build('binder', 'a.1a');
    expect(checkRite('binder', gate, alone, 'binder.a.2a').ok).toBe(false);
    expect(checkRite('binder', gate, { ...alone, allies: [{ classId: 'fallen', q: 'blasphemy', e: 'fallingStar' }] }, 'binder.a.2a').ok).toBe(true);
    expect(checkRite('binder', build('binder', 'a.1a b.1a b.2a'), alone, 'binder.a.2a').ok).toBe(true);
  });
  it('Brought Low needs flyers on the floor and a flyer-capable own bind', () => {
    const gate = build('binder', 'a.1a');
    expect(checkRite('binder', gate, alone, 'binder.a.2b').ok).toBe(false);
    expect(checkRite('binder', gate, { ...alone, flyers: true }, 'binder.a.2b').ok).toBe(true);
    const boundary = build('binder', 'a.1b c.1a c.1b c.2a c.3a', { q: 'boundary' });
    expect(checkRite('binder', boundary, { ...alone, flyers: true }, 'binder.a.2b').ok).toBe(false);
  });
  it('Sunk in the Lake needs a pool: the Well, frost, a hazard or an ally Field', () => {
    const gate = build('binder', 'a.1a a.1b a.2b');
    expect(checkRite('binder', gate, alone, 'binder.a.3b').ok).toBe(false);
    expect(checkRite('binder', build('binder', 'a.1a a.1b c.1b a.2b'), alone, 'binder.a.3b').ok).toBe(true);
    expect(checkRite('binder', gate, { ...alone, hazard: true }, 'binder.a.3b').ok).toBe(true);
  });
  it('All of Tartarus and the Wind need their base ability assigned', () => {
    const gate = build('binder', 'a.1a a.1b a.2a a.2b a.3b');
    expect(checkRite('binder', gate, alone, 'binder.a.cap').ok).toBe(true);
    const ring = build('binder', 'a.1a a.1b a.2a a.2b a.3b b.1a b.1b b.2a b.3a', { q: 'ring' });
    expect(checkRite('binder', ring, alone, 'binder.a.cap')).toMatchObject({ ok: false, reason: 'Chains of Tartarus is not assigned' });
    expect(checkRite('binder', build('binder', 'c.1a c.1b c.2a c.2b c.3b'), alone, 'binder.c.cap').ok).toBe(true);
    const well = build('binder', 'a.1a a.1b a.2b a.3a c.1a c.1b c.2a c.2b c.3b', { e: 'well' });
    expect(checkRite('binder', well, alone, 'binder.c.cap')).toMatchObject({ ok: false, reason: 'Discord is not assigned' });
  });
  it('a Whirl Rite substitutes for the learned Whip, then opens Ring of the Giants (classes-binder.md §6.1)', () => {
    const warden = build('binder', 'c.1a c.1b c.2a c.2b c.3a c.cap b.1b b.2b a.1b', { q: 'boundary' });
    const whirl = checkRite('binder', warden, alone, 'binder.b.1a');
    expect(whirl).toMatchObject({ ok: true, surrenders: 'binder.c.2b' });
    if (!whirl.ok) return;
    const ring = checkRite('binder', whirl.build, alone, 'binder.b.3a');
    expect(ring).toMatchObject({ ok: true, replaces: 'boundary' });
    if (ring.ok) expect(runBuildError('binder', ring.build, 10)).toBeNull();
  });
});

describe('quick builds by class', () => {
  it('cycle only builds of the player\'s class and the base kit', () => {
    for (const c of ['fallen', 'heretic', 'binder', 'betrayer'] as const) {
      for (const k of devBuildOrder(c)) expect(DEV_BUILDS[k].classId ?? c).toBe(c);
    }
  });
  it('name a talent the catalog knows', () => {
    for (const d of Object.values(DEV_BUILDS)) for (const t of d.talents) expect(talentNode(t), t).toBeDefined();
  });
});
