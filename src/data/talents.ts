/**
 * Talent catalogs (rogue game.md §9.3–§9.10) and the alternative abilities they teach. One registry
 * feeds the resolver, the simulation, the offers and every card, so a card's text always describes the
 * behavior the build actually resolves to. R4 ships the Betrayer pilot (classes-betrayer.md); the other
 * classes have empty catalogs until R5, so they keep their base kit and their Rite pages pay halos.
 */
import type { ClassId } from './classes';
import type { AbilityDef } from './weapons';

export type TreeId = 'a' | 'b' | 'c';
export type NodeKind = 'augment' | 'ability' | 'passive' | 'capstone';
export type Channel = 'delivery' | 'payload';
/** The named input a node modifies (§9.9 `Modifies`). */
export type NodeInput = 'LMB' | 'RMB' | 'Q' | 'E' | 'passive' | 'movement';
export type EnemyState = 'slowed' | 'bound' | 'taunted' | 'airborne';
/**
 * A Rite-only usefulness filter (§9.9 "for a Rite"): never a requirement for persistent ownership.
 * `slowSource`/`bindSource`: a producible state source in the party's effective kits, items or areas;
 * `blasphemy`: a living connected ally with Blasphemy assigned; `hazard`: an applicable environmental
 * hazard encounter or blast prop remains; `field`: Field of Blood is assigned.
 */
export type RiteNeed = 'slowSource' | 'bindSource' | 'blasphemy' | 'hazard' | 'field';

export interface TalentNode {
  id: string;
  classId: ClassId;
  tree: TreeId;
  tier: 1 | 2 | 3 | 4;
  name: string;
  kind: NodeKind;
  input: NodeInput;
  /** For Q/E augments: the ability ids it supports; it works only while one of them is assigned. */
  targets?: readonly string[];
  /** Delivery or Payload, for augments only (catalog composition table). */
  channel?: Channel;
  /** Counts toward the two effective kill-discharge talents (§9.3). */
  discharge?: boolean;
  /** For ability nodes: the ability taught and its slot. */
  teaches?: { slot: 'Q' | 'E'; ability: string };
  /** The card's one-line rule. */
  rule: string;
  applies?: readonly EnemyState[];
  reads?: EnemyState;
  rite?: RiteNeed;
  /** A passive that works only while this ability is assigned (dormant otherwise). */
  needs?: string;
  /** Extra exclusions beyond same input and channel (none in the Betrayer catalog). */
  excludes?: readonly string[];
}

/** Each class's base Q and E ability ids, as saved in a profile's character (§13.2). */
export const BASE_ABILITIES: Record<ClassId, [string, string]> = {
  fallen: ['blasphemy', 'fallingStar'],
  heretic: ['communion', 'shroud'],
  binder: ['chains', 'discord'],
  betrayer: ['field', 'shadowstep'],
};

/** The Pearly Gates point cap (§9.7) and the Rite cap (§9.10). */
export const HEAVEN_POINT_CAP = 9;
export const MAX_RITES = 4;
/** Six halos for a free earned Rite source that has no eligible node or meets the cap (§9.10). */
export const RITE_FALLBACK_HALOS = 6;

const betrayer = (n: Omit<TalentNode, 'classId'>): TalentNode => ({ classId: 'betrayer', ...n });

export const BETRAYER_NODES: readonly TalentNode[] = [
  betrayer({ id: 'betrayer.a.1a', tree: 'a', tier: 1, name: 'Glancing Silver', kind: 'augment', input: 'RMB', channel: 'delivery',
    rule: 'The Silver Bullet glances once off the first wall it reaches and goes on with what it has left.' }),
  betrayer({ id: 'betrayer.a.1b', tree: 'a', tier: 1, name: 'Judecca', kind: 'passive', input: 'passive', discharge: true, applies: ['slowed'],
    rule: 'Your kills leave frost: enemies near each body are slowed.' }),
  betrayer({ id: 'betrayer.a.2a', tree: 'a', tier: 2, name: 'The Halt and the Lame', kind: 'augment', input: 'LMB', channel: 'delivery', reads: 'slowed', rite: 'slowSource',
    rule: 'A revolver shot that kills a slowed enemy goes on through it to the next one.' }),
  betrayer({ id: 'betrayer.a.2b', tree: 'a', tier: 2, name: 'The Informer', kind: 'passive', input: 'passive',
    rule: 'Choristers, Cherubs and elites within 40 m of you show through walls to the whole party.' }),
  betrayer({ id: 'betrayer.a.3a', tree: 'a', tier: 3, name: 'Judas Coin', kind: 'ability', input: 'Q', teaches: { slot: 'Q', ability: 'judasCoin' },
    rule: 'Teaches Judas Coin for Q: toss a coin; your shot through it splits into three lines.' }),
  betrayer({ id: 'betrayer.a.3b', tree: 'a', tier: 3, name: 'Behind His Back', kind: 'augment', input: 'RMB', channel: 'delivery', reads: 'taunted', rite: 'blasphemy',
    rule: 'Taunted enemies cost the Silver Bullet half, as bound ones do.' }),
  betrayer({ id: 'betrayer.a.cap', tree: 'a', tier: 4, name: 'From Hand to Hand', kind: 'capstone', input: 'passive', discharge: true,
    rule: 'Your revolver and Silver Bullet kills pass a 20-damage spark to another angel.' }),

  betrayer({ id: 'betrayer.b.1a', tree: 'b', tier: 1, name: 'Through the Throng', kind: 'passive', input: 'movement',
    rule: "Enemies pressing on you don't slow you." }),
  betrayer({ id: 'betrayer.b.1b', tree: 'b', tier: 1, name: 'Recoil', kind: 'augment', input: 'RMB', channel: 'payload',
    rule: 'Firing the Silver Bullet throws you 5 m straight back from your aim.' }),
  betrayer({ id: 'betrayer.b.2a', tree: 'b', tier: 2, name: 'The Long Knife', kind: 'augment', input: 'E', targets: ['shadowstep', 'wayBack'], channel: 'delivery',
    rule: 'Your dash or return cuts a 3 m wide path.' }),
  betrayer({ id: 'betrayer.b.2b', tree: 'b', tier: 2, name: 'One of Them', kind: 'passive', input: 'passive',
    rule: "While you stand in the crowd, Choristers and Cherubs don't target you." }),
  betrayer({ id: 'betrayer.b.3a', tree: 'b', tier: 3, name: 'The Way Back', kind: 'ability', input: 'E', teaches: { slot: 'E', ability: 'wayBack' },
    rule: 'Teaches The Way Back for E: leave your shadow, then dash back to it through the crowd.' }),
  betrayer({ id: 'betrayer.b.3b', tree: 'b', tier: 3, name: 'Scattered Sheep', kind: 'augment', input: 'E', targets: ['shadowstep', 'wayBack'], channel: 'payload', applies: ['airborne'],
    rule: 'Your dash or return throws the crowd aside instead of cutting it.' }),
  betrayer({ id: 'betrayer.b.cap', tree: 'b', tier: 4, name: 'A Thousand Years Among Them', kind: 'capstone', input: 'passive',
    rule: 'Angels in the narrow path you run through are cut by your dagger.' }),

  betrayer({ id: 'betrayer.c.1a', tree: 'c', tier: 1, name: 'The Nail', kind: 'augment', input: 'RMB', channel: 'payload', applies: ['bound'],
    rule: 'Where the Silver Bullet stops, the survivors within 2 m are bound.' }),
  betrayer({ id: 'betrayer.c.1b', tree: 'c', tier: 1, name: 'Thrown Silver', kind: 'augment', input: 'Q', targets: ['field'], channel: 'delivery',
    rule: 'Field of Blood is thrown where you aim, up to 25 m, instead of 3 m ahead.' }),
  betrayer({ id: 'betrayer.c.2a', tree: 'c', tier: 2, name: 'Blood Money', kind: 'augment', input: 'LMB', channel: 'payload', discharge: true, applies: ['bound'],
    rule: 'Each revolver kill drops a silver coin; the next enemy to step on it is bound.' }),
  betrayer({ id: 'betrayer.c.2b', tree: 'c', tier: 2, name: 'Broken Vessel', kind: 'passive', input: 'passive', discharge: true, reads: 'bound', rite: 'bindSource',
    rule: 'Your kills of bound enemies shatter like clay, hitting enemies within 1.5 m for 20.' }),
  betrayer({ id: 'betrayer.c.3a', tree: 'c', tier: 3, name: 'Silver Wire', kind: 'ability', input: 'E', teaches: { slot: 'E', ability: 'silverWire' }, applies: ['bound'],
    rule: 'Teaches Silver Wire for E: string a wire that binds every enemy who walks into it.' }),
  betrayer({ id: 'betrayer.c.3b', tree: 'c', tier: 3, name: 'Known Ground', kind: 'passive', input: 'passive', rite: 'hazard',
    rule: "Heaven's hazards and blast props don't hurt you." }),
  betrayer({ id: 'betrayer.c.cap', tree: 'c', tier: 4, name: "The Potter's Field", kind: 'capstone', input: 'passive', applies: ['bound'], rite: 'field', needs: 'field',
    rule: 'Your Field of Blood binds each enemy for 1 s as it first enters.' }),
];

/** Each tree's name and playstyle line, for the talent view (classes-betrayer.md §3). */
export const TREES: Partial<Record<ClassId, Record<TreeId, { name: string; domain: string }>>> = {
  betrayer: {
    a: { name: 'The Long Watch', domain: 'Precision lines: bank, split and spark the shot' },
    b: { name: 'Sicarius', domain: 'Dashes and the knife, inside the horde' },
    c: { name: 'Akeldama', domain: 'Traps and binding: pin the crowd where it stands' },
  },
};

export const TALENT_NODES: Record<ClassId, readonly TalentNode[]> = { fallen: [], heretic: [], binder: [], betrayer: BETRAYER_NODES };
const BY_ID = new Map(Object.values(TALENT_NODES).flat().map((n) => [n.id, n]));
export const talentNode = (id: string): TalentNode | undefined => BY_ID.get(id);
export const hasCatalog = (classId: ClassId): boolean => TALENT_NODES[classId].length > 0;

/** Judas Coin (classes-betrayer.md §4): the coin, its split and its timing. */
export const JUDAS = { cooldown: 10, ahead: 6, wallBack: 0.5, life: 4, sink: 0.5, radius: 0.5, split: (15 * Math.PI) / 180 };
/** The Way Back (§4). */
export const WAY_BACK = { cooldown: 12, life: 5, range: 30, speed: 40, cut: 1, invulnAfter: 0.1 };
/** Silver Wire (§4). */
export const WIRE = { cooldown: 10, length: 15, height: 0.6, life: 6, bind: 1, margin: 0.1, feet: 1 };
/** Node numbers (§3). */
export const TALENT = {
  frostRadius: 2.5, slow: 1.5, bind: 1, airborne: 0.4, victims: 60,
  glances: 1, nailRadius: 2, sparkRange: 6, sparkDamage: 20, informer: 40,
  recoilDistance: 5, recoilTime: 0.15, longKnife: 1.5, sheepThrow: 3,
  sicariusRadius: 0.3, sicariusDamage: 20, sicariusFeet: 1.5, coinLife: 6, coinMax: 30, coinRadius: 0.5,
  vesselRadius: 1.5, vesselDamage: 20, thrownRange: 25, thrownFlight: 0.5, oneOfThemFeet: 1.5,
};

/** The alternatives (§4), in the same shape as the base abilities for the HUD, cards and hints. */
export const ALT_ABILITIES: Record<string, AbilityDef & { slot: 'Q' | 'E'; hint: string }> = {
  judasCoin: { slot: 'Q', name: 'Judas Coin', description: 'Flick a silver coin into the air ahead of you; your first shot through it splits into three lines. Gives up Field of Blood.', cooldown: JUDAS.cooldown, movement: false, allyRange: 0, icon: 'icon-judas-coin',
    hint: 'Q: toss the coin as the crowd closes, then shoot through it: three lines.' },
  wayBack: { slot: 'E', name: 'The Way Back', description: 'Press to leave your shadow; press again within 5 s to dash back to it, invulnerable, cutting every enemy on the way.', cooldown: WAY_BACK.cooldown, movement: true, allyRange: 0, icon: 'icon-way-back',
    hint: 'E: leave your shadow, lead the column away, then E again to return through it.' },
  silverWire: { slot: 'E', name: 'Silver Wire', description: 'String a wire up to 15 m ahead along the ground for 6 s; every ground enemy that walks into it is bound.', cooldown: WIRE.cooldown, movement: false, allyRange: 0, icon: 'icon-silver-wire',
    hint: 'E: string the wire along the approach, then fire down the bound row.' },
};

/**
 * Development quick builds (`build=<name>` with `dev=1`, or dev key B): reproducible plans to test
 * without leveling. They are ordinary learned allocations, so the resolver checks them as usual.
 */
export const DEV_BUILDS: Record<string, { label: string; talents: readonly string[]; q?: string; e?: string; rites?: readonly string[] }> = {
  marksman: { label: 'Plan 1 · Long Watch marksman (A6 + B 1a 2b 2a)', talents: ['betrayer.a.1b', 'betrayer.a.2a', 'betrayer.a.2b', 'betrayer.a.3a', 'betrayer.a.1a', 'betrayer.a.cap', 'betrayer.b.1a', 'betrayer.b.2b', 'betrayer.b.2a'], q: 'judasCoin' },
  saboteur: { label: 'Plan 2 · Akeldama saboteur (C6 + A 1a 2b + B 1a)', talents: ['betrayer.c.1a', 'betrayer.c.1b', 'betrayer.c.2a', 'betrayer.c.2b', 'betrayer.c.3a', 'betrayer.c.cap', 'betrayer.a.1a', 'betrayer.a.2b', 'betrayer.b.1a'], e: 'silverWire' },
  sicarius: { label: 'Sicarius blade-dancer (B6 + A 1b 2a 2b)', talents: ['betrayer.b.1a', 'betrayer.b.1b', 'betrayer.b.2a', 'betrayer.b.2b', 'betrayer.b.3a', 'betrayer.b.cap', 'betrayer.a.1b', 'betrayer.a.2a', 'betrayer.a.2b'], e: 'wayBack' },
  spread: { label: '3 + 3 + 3 generalist', talents: ['betrayer.a.1b', 'betrayer.a.2b', 'betrayer.a.1a', 'betrayer.b.1a', 'betrayer.b.2b', 'betrayer.b.2a', 'betrayer.c.1a', 'betrayer.c.1b', 'betrayer.c.2b'] },
  bank: { label: 'Bank and nail (Glancing + Nail)', talents: ['betrayer.a.1a', 'betrayer.c.1a'] },
  base: { label: 'Base kit', talents: [] },
};
export const DEV_BUILD_ORDER = ['marksman', 'saboteur', 'sicarius', 'spread', 'bank', 'base'] as const;
