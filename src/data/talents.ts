/**
 * Talent catalogs (rogue game.md §9.3–§9.10) and the alternative abilities they teach. One registry
 * feeds the resolver, the simulation, the offers and every card, so a card's text always describes the
 * behavior the build actually resolves to. R4 shipped the Betrayer pilot (classes-betrayer.md); R5 adds
 * the Fallen, the Heretic Saint and the Binder (classes-fallen.md, classes-heretic.md, classes-binder.md).
 */
import type { ClassId } from './classes';
import type { AbilityDef } from './weapons';

export type TreeId = 'a' | 'b' | 'c';
export type NodeKind = 'augment' | 'ability' | 'passive' | 'capstone';
export type Channel = 'delivery' | 'payload';
/** The named input a node modifies (§9.9 `Modifies`). */
export type NodeInput = 'LMB' | 'RMB' | 'Q' | 'E' | 'passive' | 'movement';
export type EnemyState = 'slowed' | 'bound' | 'taunted' | 'airborne' | 'pooled' | 'censed' | 'silenced';
/**
 * A Rite-only usefulness filter (§9.9 "for a Rite"): never a requirement for persistent ownership.
 * `slowSource`/`bindSource`/`pooledSource`/`airborneSource`: a producible state source in the party's
 * effective kits, items or areas; `blasphemy`: a living connected ally with Blasphemy assigned;
 * `hazard`: an applicable environmental hazard encounter or blast prop remains; `field`: Field of Blood
 * is assigned. The `own…` needs read only the player's own effective kit: `ownLaunch` a native ground
 * launch, `ownQELaunch` an assigned Q/E that launches, `ownFire` own burning floor, `ownFireOrCensed`
 * own fire or any censed source, `ownIncense` an own incense cloud, `ownIncensePooled` own incense plus
 * a pooled source. `pitch` own incense or fire plus a slow, bind or launch source; `irons` a pooled
 * source and an enemy that survives a censer hit; `twoAllies` two other living players; `flyers` the
 * floor still has flyers and the kit binds them.
 */
export type RiteNeed = 'slowSource' | 'bindSource' | 'blasphemy' | 'hazard' | 'field' | 'pooledSource' | 'airborneSource'
  | 'ownLaunch' | 'ownQELaunch' | 'ownFire' | 'ownFireOrCensed' | 'ownIncense' | 'ownIncensePooled' | 'pitch' | 'irons' | 'twoAllies' | 'flyers';

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
  /** Son of the Morning only: Q abilities it also shapes, beside its E targets (classes-fallen.md `c.1b`). */
  qTargets?: readonly string[];
  /** Makes burning floor or a furrow of its owner's (an `ownFire` source). */
  fire?: boolean;
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

const fallen = (n: Omit<TalentNode, 'classId'>): TalentNode => ({ classId: 'fallen', ...n });
const STAR_SET = ['fallingStar', 'gatebreaker', 'rainOfFire'] as const;

/** The Fallen (classes-fallen.md §3): The Walls of Dis, The Burning Sand, The War in Heaven. */
export const FALLEN_NODES: readonly TalentNode[] = [
  fallen({ id: 'fallen.a.1a', tree: 'a', tier: 1, name: 'Red Iron', kind: 'passive', input: 'passive',
    rule: 'A melee blow you survive sparks back into its attacker for 10.' }),
  fallen({ id: 'fallen.a.1b', tree: 'a', tier: 1, name: 'Weight of Sin', kind: 'augment', input: 'Q', targets: ['blasphemy'], channel: 'payload', applies: ['slowed'],
    rule: 'Blasphemy slows the crowd it taunts for 3 s instead of stunning it.' }),
  fallen({ id: 'fallen.a.2a', tree: 'a', tier: 2, name: 'Through the Ranks', kind: 'augment', input: 'LMB', channel: 'delivery',
    rule: 'Within 6 m, a pellet that kills goes on into the enemy behind it.' }),
  fallen({ id: 'fallen.a.2b', tree: 'a', tier: 2, name: 'Unbowed', kind: 'passive', input: 'movement',
    rule: "Unbound crowds don't slow you; you shoulder them aside." }),
  fallen({ id: 'fallen.a.3a', tree: 'a', tier: 3, name: 'Gatebreaker', kind: 'ability', input: 'E', teaches: { slot: 'E', ability: 'gatebreaker' }, applies: ['airborne'],
    rule: 'Teaches Gatebreaker for E: hold E to charge through the swarm, bowling it aside.' }),
  fallen({ id: 'fallen.a.3b', tree: 'a', tier: 3, name: 'Underfoot', kind: 'passive', input: 'passive', reads: 'slowed', rite: 'slowSource',
    rule: 'Slowed enemies pressing on you are trampled for 20.' }),
  fallen({ id: 'fallen.a.cap', tree: 'a', tier: 4, name: 'Wrath of Dis', kind: 'capstone', input: 'passive',
    rule: 'Every 100 damage you survive erupts from your hide: 40 to every enemy within 4 m.' }),

  fallen({ id: 'fallen.b.1a', tree: 'b', tier: 1, name: 'Brimstone Tread', kind: 'passive', input: 'passive', applies: ['pooled'], fire: true,
    rule: 'Your footsteps burn: the floor you walk on burns for 3 s.' }),
  fallen({ id: 'fallen.b.1b', tree: 'b', tier: 1, name: 'Fire and Brimstone', kind: 'augment', input: 'LMB', channel: 'payload', discharge: true, applies: ['pooled'], fire: true,
    rule: 'The shotgun kindles its close kills instead of shoving survivors.' }),
  fallen({ id: 'fallen.b.2a', tree: 'b', tier: 2, name: 'Brand', kind: 'augment', input: 'RMB', channel: 'payload', applies: ['pooled'], fire: true,
    rule: 'The slug sets the floor within 2 m of where it stops burning for 4 s.' }),
  fallen({ id: 'fallen.b.2b', tree: 'b', tier: 2, name: 'Pyre', kind: 'passive', input: 'passive', reads: 'censed', rite: 'ownFireOrCensed',
    rule: 'Censed enemies burn, and enemies leaving your fire carry its flame for 2 s.' }),
  fallen({ id: 'fallen.b.3a', tree: 'b', tier: 3, name: 'Rain of Fire', kind: 'ability', input: 'E', teaches: { slot: 'E', ability: 'rainOfFire' }, applies: ['pooled'], fire: true,
    rule: 'Teaches Rain of Fire for E: call fire down on a 5 m circle where you aim, for 6 s.' }),
  fallen({ id: 'fallen.b.3b', tree: 'b', tier: 3, name: "Blasphemer's Ring", kind: 'augment', input: 'Q', targets: ['blasphemy'], channel: 'payload', applies: ['pooled'], fire: true,
    rule: 'Blasphemy sets the ground within 4 m of you burning instead of stunning.' }),
  fallen({ id: 'fallen.b.cap', tree: 'b', tier: 4, name: 'The Burning Plain', kind: 'capstone', input: 'passive', applies: ['pooled'], rite: 'ownFire',
    rule: 'An enemy that dies in your fire sets the floor around it burning.' }),

  fallen({ id: 'fallen.c.1a', tree: 'c', tier: 1, name: 'Heave', kind: 'augment', input: 'LMB', channel: 'payload', applies: ['airborne'],
    rule: "The shotgun launches what it doesn't kill 3 m away, out to 12 m." }),
  fallen({ id: 'fallen.c.1b', tree: 'c', tier: 1, name: 'Son of the Morning', kind: 'augment', input: 'E', targets: STAR_SET, qTargets: ['castOut'], channel: 'delivery',
    rule: 'Your Falling Star, Gatebreaker, Rain of Fire or Cast Out covers a visibly wider footprint.' }),
  fallen({ id: 'fallen.c.2a', tree: 'c', tier: 2, name: 'As We Fell', kind: 'passive', input: 'passive', reads: 'airborne', rite: 'ownLaunch',
    rule: 'Every enemy you launch takes 20 when it lands.' }),
  fallen({ id: 'fallen.c.2b', tree: 'c', tier: 2, name: 'Wormwood', kind: 'augment', input: 'RMB', channel: 'payload', applies: ['airborne'],
    rule: 'Where the slug stops, the enemies within 2.5 m are launched.' }),
  fallen({ id: 'fallen.c.3a', tree: 'c', tier: 3, name: 'Cast Out', kind: 'ability', input: 'Q', teaches: { slot: 'Q', ability: 'castOut' }, applies: ['airborne'],
    rule: 'Teaches Cast Out for Q: a blast that hurls everything in front of you 6 m away.' }),
  fallen({ id: 'fallen.c.3b', tree: 'c', tier: 3, name: 'Broken Wings', kind: 'passive', input: 'passive', reads: 'airborne', applies: ['bound'], rite: 'ownLaunch',
    rule: 'Every enemy you launch lands bound for 1 s.' }),
  fallen({ id: 'fallen.c.cap', tree: 'c', tier: 4, name: 'A Third of the Stars', kind: 'capstone', input: 'passive', reads: 'airborne', rite: 'ownQELaunch',
    rule: 'What your Q or E launches comes down like falling stars, hitting those around it for 20.' }),
];

const heretic = (n: Omit<TalentNode, 'classId'>): TalentNode => ({ classId: 'heretic', ...n });

/** The Heretic Saint (classes-heretic.md §3): Forbidden Physic, The Burning Tombs, Martyrdom. */
export const HERETIC_NODES: readonly TalentNode[] = [
  heretic({ id: 'heretic.a.1a', tree: 'a', tier: 1, name: 'Cunning Folk', kind: 'passive', input: 'passive',
    rule: 'Heal motes within 8 m of you fly to the most hurt nearby player.' }),
  heretic({ id: 'heretic.a.1b', tree: 'a', tier: 1, name: 'Exorcism', kind: 'augment', input: 'Q', targets: ['communion'], channel: 'payload', applies: ['airborne'],
    rule: 'Unholy Communion also throws every enemy within 5 m of you 4 m away through the air.' }),
  heretic({ id: 'heretic.a.2a', tree: 'a', tier: 2, name: 'In Both Kinds', kind: 'augment', input: 'RMB', channel: 'payload', rite: 'twoAllies',
    rule: 'Sacrament forks from the ally you heal to a second ally near them.' }),
  heretic({ id: 'heretic.a.2b', tree: 'a', tier: 2, name: 'Lazarus', kind: 'passive', input: 'passive',
    rule: 'Your revivals and heal-mote pickups burst into cleansing light.' }),
  heretic({ id: 'heretic.a.3a', tree: 'a', tier: 3, name: 'Bread of Angels', kind: 'ability', input: 'E', teaches: { slot: 'E', ability: 'breadOfAngels' },
    rule: 'Teaches Bread of Angels for E: for 6 s, kills near you drop up to six heal motes.' }),
  heretic({ id: 'heretic.a.3b', tree: 'a', tier: 3, name: 'The Long Chain', kind: 'augment', input: 'LMB', channel: 'delivery',
    rule: 'Your censer flies through Blessed and breaks on anything else.' }),
  heretic({ id: 'heretic.a.cap', tree: 'a', tier: 4, name: 'Resurrection of the Body', kind: 'capstone', input: 'passive', needs: 'communion',
    rule: 'Communion raises souls at once and calls heal motes back to the living.' }),

  heretic({ id: 'heretic.b.1a', tree: 'b', tier: 1, name: 'Ploughshares', kind: 'augment', input: 'LMB', channel: 'payload', applies: ['pooled'], fire: true,
    rule: 'The censer leaves a burning furrow instead of an incense cloud.' }),
  heretic({ id: 'heretic.b.1b', tree: 'b', tier: 1, name: 'Kindling', kind: 'passive', input: 'passive', discharge: true, applies: ['pooled'], fire: true,
    rule: 'Your button kills leave the floor burning.' }),
  heretic({ id: 'heretic.b.2a', tree: 'b', tier: 2, name: 'Pitch', kind: 'passive', input: 'passive', reads: 'slowed', rite: 'pitch',
    rule: 'Slowed, bound or airborne enemies carry your smoke and fire for 2 s after leaving it.' }),
  heretic({ id: 'heretic.b.2b', tree: 'b', tier: 2, name: 'Wall of Fire', kind: 'augment', input: 'Q', targets: ['communion'], channel: 'payload', applies: ['pooled'], fire: true,
    rule: 'Communion also draws a ring of fire 4 m around you.' }),
  heretic({ id: 'heretic.b.3a', tree: 'b', tier: 3, name: 'Trial by Fire', kind: 'ability', input: 'E', teaches: { slot: 'E', ability: 'trialByFire' }, applies: ['pooled'], fire: true,
    rule: 'Teaches Trial by Fire for E: for 4 s, a broad trail of fire burns wherever you walk.' }),
  heretic({ id: 'heretic.b.3b', tree: 'b', tier: 3, name: 'Irons in the Fire', kind: 'passive', input: 'passive', reads: 'pooled', applies: ['bound'], rite: 'irons',
    rule: 'A censer direct hit pins a pooled survivor with hot irons for 1 s.' }),
  heretic({ id: 'heretic.b.cap', tree: 'b', tier: 4, name: 'The Sixth Circle', kind: 'capstone', input: 'passive', reads: 'pooled', applies: ['pooled'], rite: 'ownFire',
    rule: 'A death on your burning floor spreads the fire.' }),

  heretic({ id: 'heretic.c.1a', tree: 'c', tier: 1, name: 'The Stake', kind: 'augment', input: 'E', targets: ['shroud'], channel: 'payload', applies: ['bound'],
    rule: 'A broken Shroud binds the crowd for 1.5 s instead of exploding.' }),
  heretic({ id: 'heretic.c.1b', tree: 'c', tier: 1, name: 'Walk in the Smoke', kind: 'passive', input: 'movement', rite: 'ownIncense',
    rule: 'Players standing in your incense walk freely through the crowd.' }),
  heretic({ id: 'heretic.c.2a', tree: 'c', tier: 2, name: 'The Altar', kind: 'augment', input: 'LMB', channel: 'payload', applies: ['censed'],
    rule: "Your censer's cloud follows the nearest player at its impact." }),
  heretic({ id: 'heretic.c.2b', tree: 'c', tier: 2, name: 'Scapegoat', kind: 'augment', input: 'LMB', channel: 'payload', applies: ['censed'],
    rule: 'The censer leaves three small clouds across its impact instead of one.' }),
  heretic({ id: 'heretic.c.3a', tree: 'c', tier: 3, name: 'Cloud of Witnesses', kind: 'ability', input: 'Q', teaches: { slot: 'Q', ability: 'cloudOfWitnesses' }, applies: ['censed'],
    rule: 'Teaches Cloud of Witnesses for Q: put a wide incense mantle on you or an ally.' }),
  heretic({ id: 'heretic.c.3b', tree: 'c', tier: 3, name: 'The Common Cause', kind: 'passive', input: 'passive', reads: 'pooled', applies: ['slowed'], rite: 'ownIncensePooled',
    rule: 'Pooled enemies in your incense are dragged slow by chains.' }),
  heretic({ id: 'heretic.c.cap', tree: 'c', tier: 4, name: 'Pillar of Cloud', kind: 'capstone', input: 'passive', applies: ['censed'], rite: 'ownIncense',
    rule: "Your incense rises into 8 m pillars that reach Heaven's flyers." }),
];

const binder = (n: Omit<TalentNode, 'classId'>): TalentNode => ({ classId: 'binder', ...n });

/** The Binder (classes-binder.md §3): Keeper of the Well, Breaker of Giants, Warden of the Boundary. */
export const BINDER_NODES: readonly TalentNode[] = [
  binder({ id: 'binder.a.1a', tree: 'a', tier: 1, name: 'Cast Down', kind: 'augment', input: 'Q', targets: ['chains'], channel: 'delivery',
    rule: 'Chains of Tartarus drops its pile where your crosshair meets the floor, up to 15 m away.' }),
  binder({ id: 'binder.a.1b', tree: 'a', tier: 1, name: 'The Chain Holds', kind: 'passive', input: 'passive', discharge: true, reads: 'bound', applies: ['bound'],
    rule: 'Killing an enemy you bound passes its remaining chain to another enemy.' }),
  binder({ id: 'binder.a.2a', tree: 'a', tier: 2, name: 'Where They Fall', kind: 'passive', input: 'passive', reads: 'airborne', applies: ['bound'], rite: 'airborneSource',
    rule: 'Launched enemies landing within 20 m of you are chained for 2 s.' }),
  binder({ id: 'binder.a.2b', tree: 'a', tier: 2, name: 'Brought Low', kind: 'passive', input: 'passive', reads: 'bound', rite: 'flyers',
    rule: 'Flyers you bind are dragged down to the floor and stay there while bound.' }),
  binder({ id: 'binder.a.3a', tree: 'a', tier: 3, name: 'The Well of the Giants', kind: 'ability', input: 'E', teaches: { slot: 'E', ability: 'well' }, applies: ['pooled'],
    rule: 'Teaches The Well of the Giants for E: a pit that drags every ground enemy within 7 m toward it for 5 s.' }),
  binder({ id: 'binder.a.3b', tree: 'a', tier: 3, name: 'Sunk in the Lake', kind: 'passive', input: 'passive', reads: 'pooled', rite: 'pooledSource',
    rule: 'Your binds hold while the enemy stands in a pool, up to 6 s from the cast.' }),
  binder({ id: 'binder.a.cap', tree: 'a', tier: 4, name: 'All of Tartarus', kind: 'capstone', input: 'passive', applies: ['bound'], needs: 'chains',
    rule: 'Your Chains of Tartarus reaches every direction at once (cooldown 12 s).' }),

  binder({ id: 'binder.b.1a', tree: 'b', tier: 1, name: 'Whirl', kind: 'augment', input: 'RMB', channel: 'delivery',
    rule: 'The Scourge swings all the way around you, 1.2 s between swings.' }),
  binder({ id: 'binder.b.1b', tree: 'b', tier: 1, name: 'Iron Stride', kind: 'passive', input: 'movement',
    rule: 'Slowed enemies no longer hold you back when you wade through them.' }),
  binder({ id: 'binder.b.2a', tree: 'b', tier: 2, name: 'Voice of the Pit', kind: 'augment', input: 'E', targets: ['discord'], channel: 'payload', applies: ['airborne'],
    rule: "Discord's shout also throws the close front ranks 4 m back." }),
  binder({ id: 'binder.b.2b', tree: 'b', tier: 2, name: 'Fettered Hands', kind: 'passive', input: 'passive', reads: 'bound',
    rule: "Enemies you bound can't strike in melee." }),
  binder({ id: 'binder.b.3a', tree: 'b', tier: 3, name: 'Ring of the Giants', kind: 'ability', input: 'Q', teaches: { slot: 'Q', ability: 'ring' }, applies: ['bound'],
    rule: 'Teaches Ring of the Giants for Q: drag every enemy within 7 m into a bound ring 2.5 m around you.' }),
  binder({ id: 'binder.b.3b', tree: 'b', tier: 3, name: 'The Long Flail', kind: 'augment', input: 'RMB', channel: 'delivery',
    rule: "The Scourge's chain reaches 4 m instead of 3 m, in the same arc." }),
  binder({ id: 'binder.b.cap', tree: 'b', tier: 4, name: 'The Chains Shatter', kind: 'capstone', input: 'passive', discharge: true, reads: 'bound',
    rule: 'Your bound kills shatter their chains: 20 to every enemy within 2 m.' }),

  binder({ id: 'binder.c.1a', tree: 'c', tier: 1, name: 'Barbed Rounds', kind: 'augment', input: 'LMB', channel: 'delivery',
    rule: 'Each Chain Gun bullet goes on through the first enemy it hits into the next one.' }),
  binder({ id: 'binder.c.1b', tree: 'c', tier: 1, name: 'Frost of Cocytus', kind: 'passive', input: 'passive', discharge: true, applies: ['pooled', 'slowed'],
    rule: 'Your kills leave up to eight patches of slowing frost.' }),
  binder({ id: 'binder.c.2a', tree: 'c', tier: 2, name: 'The Procession', kind: 'passive', input: 'passive', applies: ['bound'],
    rule: 'An enemy caught by your chain draws the one behind it into a bound line.' }),
  binder({ id: 'binder.c.2b', tree: 'c', tier: 2, name: 'The Whip', kind: 'augment', input: 'RMB', channel: 'delivery',
    rule: 'The Scourge lashes a straight line 7 m long in front of you instead of a 3 m arc.' }),
  binder({ id: 'binder.c.3a', tree: 'c', tier: 3, name: 'The Boundary Chain', kind: 'ability', input: 'Q', teaches: { slot: 'Q', ability: 'boundary' }, applies: ['bound', 'pooled'],
    rule: 'Teaches The Boundary Chain for Q: an 8 s floor chain binds each crossing enemy for 2.5 s.' }),
  binder({ id: 'binder.c.3b', tree: 'c', tier: 3, name: 'Shattered Hymn', kind: 'augment', input: 'E', targets: ['discord'], channel: 'payload',
    rule: "Discord's shout also breaks enemy projectiles in its cone." }),
  binder({ id: 'binder.c.cap', tree: 'c', tier: 4, name: 'The Wind of Cocytus', kind: 'capstone', input: 'passive', reads: 'silenced', applies: ['bound'], needs: 'discord',
    rule: "Discord's freezing wind chains enemies for 2.5 s when their silence ends." }),
];

/** Each tree's name and playstyle line, for the talent view (each catalog's §3). */
export const TREES: Partial<Record<ClassId, Record<TreeId, { name: string; domain: string }>>> = {
  fallen: {
    a: { name: 'The Walls of Dis', domain: 'Melee and the charge: hold the crowd on your red-hot hide' },
    b: { name: 'The Burning Sand', domain: 'Fire on the floor: make the swarm cross it to reach you' },
    c: { name: 'The War in Heaven', domain: 'Launches: hurl the swarm up and let the fall kill it' },
  },
  heretic: {
    a: { name: 'Forbidden Physic', domain: 'Healing and revival: motes, forks and rescues' },
    b: { name: 'The Burning Tombs', domain: 'Fire on the floor: lead the horde through it' },
    c: { name: 'Martyrdom', domain: 'Incense on allies, binding and the high pillars' },
  },
  binder: {
    a: { name: 'Keeper of the Well', domain: 'Piles and holds: drag the room into one bound heap' },
    b: { name: 'Breaker of Giants', domain: 'Close combat: spin the chain inside the swarm' },
    c: { name: 'Warden of the Boundary', domain: 'Ranged lines, frost and traps across the path' },
  },
  betrayer: {
    a: { name: 'The Long Watch', domain: 'Precision lines: bank, split and spark the shot' },
    b: { name: 'Sicarius', domain: 'Dashes and the knife, inside the horde' },
    c: { name: 'Akeldama', domain: 'Traps and binding: pin the crowd where it stands' },
  },
};

export const TALENT_NODES: Record<ClassId, readonly TalentNode[]> = { fallen: FALLEN_NODES, heretic: HERETIC_NODES, binder: BINDER_NODES, betrayer: BETRAYER_NODES };
const BY_ID = new Map(Object.values(TALENT_NODES).flat().map((n) => [n.id, n]));
export const talentNode = (id: string): TalentNode | undefined => BY_ID.get(id);
export const hasCatalog = (classId: ClassId): boolean => TALENT_NODES[classId].length > 0;

/** Judas Coin (classes-betrayer.md §4): the coin, its split and its timing. */
export const JUDAS = { cooldown: 10, ahead: 6, wallBack: 0.5, life: 4, sink: 0.5, radius: 0.5, split: (15 * Math.PI) / 180 };
/** The Way Back (§4). */
export const WAY_BACK = { cooldown: 12, life: 5, range: 30, speed: 40, cut: 1, invulnAfter: 0.1 };
/** Silver Wire (§4). */
export const WIRE = { cooldown: 10, length: 15, height: 0.6, life: 6, bind: 1, margin: 0.1, feet: 1 };
/** The Fallen's numbers (classes-fallen.md §3–§4). */
export const FALLEN = {
  redIron: 10, sinSlow: 3, ranksRange: 6, shove: 1, shoveTime: 0.2, shoveEvery: 0.5, shoveCone: Math.PI / 3,
  underfoot: 20, underfootEvery: 1, wrathEvery: 100, wrathDamage: 40, wrathRadius: 4,
  fireDamage: 5, fireCap: 600, treadTime: 3, kindleTime: 3, kindleMax: 8, brandRadius: 2, brandTime: 4,
  pyreCarry: 2, ringRadius: 4, ringTime: 5, plainTime: 3,
  heaveRange: 12, heave: 3, launchTime: 0.4, starRing: 8, landDamage: 20, wingsBind: 1, wormRadius: 2.5, worm: 3, crash: 1.2, crashDamage: 20,
};
/** Gatebreaker (classes-fallen.md §4): the charge envelope and its lanes. */
export const GATEBREAKER = { cooldown: 10, speed: 15, minTime: 0.3, maxTime: 1.2, turn: Math.PI, lane: 1, side: 2.5, sideWide: 3.5, damage: 40, sideDamage: 10, fling: 4, maxPath: 18 };
/** Rain of Fire (§4). */
export const RAIN = { cooldown: 12, radius: 5, wide: 7, range: 30, delay: 0.5, life: 6 };
/** Cast Out (§4). */
export const CAST_OUT = { cooldown: 10, range: 10, half: Math.PI / 4, wideHalf: Math.PI / 3, damage: 10, throw: 6 };

/** The Heretic Saint's numbers (classes-heretic.md §3–§4). */
export const HERETIC = {
  cunning: 8, exorcismRadius: 5, exorcism: 4, forkRange: 10, lazarusRevive: 50, lazarusReviveRadius: 3.5, lazarusMote: 20, lazarusMoteRadius: 2, lazarusEvery: 0.5,
  rallyTime: 4, rallyRadius: 15,
  furrowLength: 6, furrowWidth: 1.5, fireCap: 400, kindleTime: 3, kindleMax: 60, pitch: 2, wallRadius: 4, wallWidth: 1, wallTime: 4, ironsBind: 1, circleTime: 3,
  stakeBind: 1.5, stakeRadius: 3.5, altarReach: 3, scapegoatRadius: 2, scapegoatSide: 3, commonSlow: 1, pillar: 8,
};
/** Bread of Angels (§4). */
export const BREAD = { cooldown: 18, life: 6, radius: 8, motes: 6, moteLife: 20 };
/** Trial by Fire (§4). */
export const TRIAL = { cooldown: 14, life: 4, radius: 1.5, burn: 4 };
/** Cloud of Witnesses (§4). */
export const WITNESSES = { cooldown: 16, radius: 5, life: 6, range: 40 };

/** The Binder's numbers (classes-binder.md §3–§4). */
export const BINDER = {
  castDown: 15, castDownMin: 1.5, holdsRange: 4, holdsMin: 0.3, holdsMax: 40, fallRange: 20, fallBind: 2, ceiling: 6, broughtDrop: 0.3, tartarusCooldown: 12,
  whirlInterval: 1.2, voiceRange: 10, voice: 4, flail: 4, shatterRadius: 2, shatterDamage: 20, shatterMax: 60,
  frostRadius: 2, frostTime: 4, frostMax: 8, frostMerge: 1.5, processionBehind: 3, processionCone: Math.PI / 12, processionGap: 1, processionMax: 40,
  whipLength: 7, whipHalf: 0.75, windBind: 2.5,
};
/** The Well of the Giants (§4). */
export const WELL = { cooldown: 14, min: 3, max: 20, radius: 7, life: 5, drag: 3, stop: 1 };
/** Ring of the Giants (§4). */
export const RING = { cooldown: 10, radius: 7, ring: 2.5 };
/** The Boundary Chain (§4). */
export const BOUNDARY = { cooldown: 12, min: 4, max: 20, length: 12, margin: 0.5, feet: 1, life: 8, bind: 2.5 };

/** The Betrayer's node numbers (classes-betrayer.md §3). */
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
  gatebreaker: { slot: 'E', name: 'Gatebreaker', description: 'Hold to charge along the ground for up to 1.2 s, steering with the mouse: what you hit head-on bursts, the rest is bowled aside into the air. Replaces Falling Star.', cooldown: GATEBREAKER.cooldown, movement: true, allyRange: 0, icon: 'icon-gatebreaker',
    hint: 'E (hold): charge through the crowd; steer with the mouse, release to stop.' },
  rainOfFire: { slot: 'E', name: 'Rain of Fire', description: 'Hold to aim a 5 m circle within 30 m; release to call fire down on that floor for 6 s. Replaces Falling Star.', cooldown: RAIN.cooldown, movement: false, allyRange: 0, icon: 'icon-rain-of-fire',
    hint: 'E (hold, release): rain fire where the crowd will walk, then Blasphemy them through it.' },
  castOut: { slot: 'Q', name: 'Cast Out', description: 'A blast from your wings: every enemy within 10 m in front of you takes 10 and is hurled 6 m away through the air. No taunt. Replaces Blasphemy.', cooldown: CAST_OUT.cooldown, movement: false, allyRange: 0, icon: 'icon-cast-out',
    hint: 'Q: throw the crowd off an ally, then shotgun them as they fall.' },
  breadOfAngels: { slot: 'E', name: 'Bread of Angels', description: "For 6 s, enemies killed within 8 m of you drop heal motes, up to six. Replaces Martyr's Shroud.", cooldown: BREAD.cooldown, movement: false, allyRange: 0, icon: 'icon-bread-of-angels',
    hint: 'E: just before a big clear, then gather the motes for whoever is hurt.' },
  trialByFire: { slot: 'E', name: 'Trial by Fire', description: "For 4 s, a 3 m wide trail of fire burns wherever you walk. Replaces Martyr's Shroud.", cooldown: TRIAL.cooldown, movement: false, allyRange: 0, icon: 'icon-trial-by-fire',
    hint: 'E: draw a burning lane across the chase, then shoot censers over it.' },
  cloudOfWitnesses: { slot: 'Q', name: 'Cloud of Witnesses', description: 'Cloak the ally you aim at, or yourself, in a 5 m incense cloud that follows them for 6 s. Replaces Unholy Communion.', cooldown: WITNESSES.cooldown, movement: false, allyRange: 40, icon: 'icon-cloud-of-witnesses',
    hint: 'Q: aim at whoever holds the crowd; the incense walks with them.' },
  well: { slot: 'E', name: 'The Well of the Giants', description: 'Open a well where you aim, 3 to 20 m away: for 5 s it drags every ground enemy within 7 m toward it. Replaces Discord.', cooldown: WELL.cooldown, movement: false, allyRange: 0, icon: 'icon-well-of-giants',
    hint: 'E: open the well on the chase, then Chains the knot.' },
  ring: { slot: 'Q', name: 'Ring of the Giants', description: 'Every enemy within 7 m is dragged into a ring 2.5 m around you and bound for 2.5 s. Replaces Chains of Tartarus.', cooldown: RING.cooldown, movement: false, allyRange: 0, icon: 'icon-ring-of-giants',
    hint: 'Q: when the swarm is on you, ring it, then swing the Scourge.' },
  boundary: { slot: 'Q', name: 'The Boundary Chain', description: 'Lay a 12 m red-hot chain across the floor where you aim; for 8 s every ground enemy that steps on it is bound for 2.5 s. Replaces Chains of Tartarus.', cooldown: BOUNDARY.cooldown, movement: false, allyRange: 0, icon: 'icon-boundary-chain',
    hint: 'Q: lay the chain across the stream, then fire down the bound line.' },
};

/**
 * Development quick builds (`build=<name>` with `dev=1`, or dev key B): reproducible plans to test
 * without leveling. They are ordinary learned allocations, so the resolver checks them as usual. Each
 * names its class; `base` fits every class.
 */
export interface DevBuild { label: string; classId?: ClassId; talents: readonly string[]; q?: string; e?: string; rites?: readonly string[] }
const ids = (cls: ClassId, list: string): string[] => list.split(' ').map((s) => `${cls}.${s}`);
export const DEV_BUILDS: Record<string, DevBuild> = {
  marksman: { classId: 'betrayer', label: 'Plan 1 · Long Watch marksman (A6 + B 1a 2b 2a)', talents: ['betrayer.a.1b', 'betrayer.a.2a', 'betrayer.a.2b', 'betrayer.a.3a', 'betrayer.a.1a', 'betrayer.a.cap', 'betrayer.b.1a', 'betrayer.b.2b', 'betrayer.b.2a'], q: 'judasCoin' },
  saboteur: { classId: 'betrayer', label: 'Plan 2 · Akeldama saboteur (C6 + A 1a 2b + B 1a)', talents: ['betrayer.c.1a', 'betrayer.c.1b', 'betrayer.c.2a', 'betrayer.c.2b', 'betrayer.c.3a', 'betrayer.c.cap', 'betrayer.a.1a', 'betrayer.a.2b', 'betrayer.b.1a'], e: 'silverWire' },
  sicarius: { classId: 'betrayer', label: 'Sicarius blade-dancer (B6 + A 1b 2a 2b)', talents: ['betrayer.b.1a', 'betrayer.b.1b', 'betrayer.b.2a', 'betrayer.b.2b', 'betrayer.b.3a', 'betrayer.b.cap', 'betrayer.a.1b', 'betrayer.a.2a', 'betrayer.a.2b'], e: 'wayBack' },
  spread: { classId: 'betrayer', label: '3 + 3 + 3 generalist', talents: ['betrayer.a.1b', 'betrayer.a.2b', 'betrayer.a.1a', 'betrayer.b.1a', 'betrayer.b.2b', 'betrayer.b.2a', 'betrayer.c.1a', 'betrayer.c.1b', 'betrayer.c.2b'] },
  bank: { classId: 'betrayer', label: 'Bank and nail (Glancing + Nail)', talents: ['betrayer.a.1a', 'betrayer.c.1a'] },
  anvil: { classId: 'fallen', label: 'Anvil · Walls of Dis (A6 + C 1a 2a 2b), Gatebreaker', talents: ids('fallen', 'a.1a a.1b a.2b a.3a a.3b a.cap c.1a c.2a c.2b'), e: 'gatebreaker' },
  firewalker: { classId: 'fallen', label: 'Firewalker · Burning Sand (B7 + A 1a 2b), Rain of Fire', talents: ids('fallen', 'b.1a b.1b b.2a b.2b b.3a b.3b b.cap a.1a a.2b'), e: 'rainOfFire' },
  thrower: { classId: 'fallen', label: 'Thrower · War in Heaven (C6 + A 1a 2b + B 1a), Cast Out', talents: ids('fallen', 'c.1a c.1b c.2a c.2b c.3a c.cap a.1a a.2b b.1a'), q: 'castOut' },
  fallenSpread: { classId: 'fallen', label: 'Fallen 3 + 3 + 3, base kit', talents: ids('fallen', 'a.1a a.1b a.2b b.1a b.1b b.2b c.1b c.2a c.2b') },
  physician: { classId: 'heretic', label: 'Physician · Forbidden Physic (A6 + B 1b 2a + C 1b), Bread', talents: ids('heretic', 'a.1a a.1b a.2b a.3a a.3b a.cap b.1b b.2a c.1b'), e: 'breadOfAngels' },
  pyre: { classId: 'heretic', label: 'Pyre-walker · Burning Tombs (B6 + A 1a 1b 2b), Trial by Fire', talents: ids('heretic', 'b.1a b.1b b.2a b.3a b.3b b.cap a.1a a.1b a.2b'), e: 'trialByFire' },
  martyr: { classId: 'heretic', label: 'Martyr · Martyrdom (C6 + B 1b + A 1a 2b), Cloud of Witnesses', talents: ids('heretic', 'c.1a c.1b c.2a c.3a c.3b c.cap b.1b a.1a a.2b'), q: 'cloudOfWitnesses' },
  hereticSpread: { classId: 'heretic', label: 'Heretic 3 + 3 + 3, base kit', talents: ids('heretic', 'a.1a a.2a a.2b b.1b b.2a b.2b c.1a c.1b c.2a') },
  keeper: { classId: 'binder', label: 'Keeper · Keeper of the Well (A6 + B 1a 1b 2b), the Well', talents: ids('binder', 'a.1a a.1b a.2b a.3a a.3b a.cap b.1a b.1b b.2b'), e: 'well' },
  breaker: { classId: 'binder', label: 'Breaker · Breaker of Giants (B6 + C 1a 1b 2a), the Ring', talents: ids('binder', 'b.1a b.1b b.2a b.2b b.3a b.cap c.1a c.1b c.2a'), q: 'ring' },
  warden: { classId: 'binder', label: 'Warden · Warden of the Boundary (C6 + B 1b 2b + A 1b), the Boundary', talents: ids('binder', 'c.1a c.1b c.2a c.2b c.3a c.cap b.1b b.2b a.1b'), q: 'boundary' },
  binderSpread: { classId: 'binder', label: 'Binder 3 + 3 + 3, base kit', talents: ids('binder', 'a.1a a.1b a.2b b.1a b.1b b.2a c.1a c.1b c.2a') },
  base: { label: 'Base kit', talents: [] },
};
/** The quick builds dev key B cycles through for a class, in catalog order. */
export const devBuildOrder = (classId: ClassId): string[] => Object.keys(DEV_BUILDS).filter((k) => !DEV_BUILDS[k].classId || DEV_BUILDS[k].classId === classId);
