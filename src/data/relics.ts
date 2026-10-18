/**
 * The twelve relics and six combos (rogue items-relics.md §2.2–§2.3, game.md §8). Immutable content: the
 * host's relic effects (src/sim/relics.ts), the offers, the Lobby and Advocate views and every card read
 * these rows. Stable ids; never reorder RELIC_IDS (it is the stable evaluation order, §2.4 rule 4).
 */
import type { EnemyState } from './talents';

export const RELIC_IDS = ['usher', 'thurible', 'link', 'tile', 'qseal', 'eseal', 'comb', 'wheel', 'unbroken', 'mercy', 'armageddon', 'sentence3'] as const;
export type RelicId = typeof RELIC_IDS[number];
export const COMBO_IDS = ['expulsion', 'abandoned', 'chorus', 'appeal', 'reversal', 'harrow'] as const;
export type ComboId = typeof COMBO_IDS[number];
export type Rarity = 'common' | 'rare' | 'legendary';
export type DeedId = 'unbroken' | 'mercy' | 'armageddon' | 'sentence3';
export const DEED_IDS: readonly DeedId[] = ['unbroken', 'mercy', 'armageddon', 'sentence3'];

export interface RelicDef {
  id: RelicId;
  name: string;
  rarity: Rarity;
  /** `chest` relics come from the Reliquary and the bargain; deed relics only from their deed (§8.6). */
  source: 'chest' | DeedId;
  /** The trigger, as the card states it. */
  trigger: string;
  /** The one visible effect. */
  rule: string;
  numbers: string;
  reads?: EnemyState;
  applies?: readonly EnemyState[];
  combo: ComboId;
  /** Internal cooldown in seconds, shown on the icon. */
  cooldown: number;
  flavor: string;
}

export interface ComboDef {
  id: ComboId;
  name: string;
  /** Relic a keeps its own effect; the combo replaces relic b's (§8.4). */
  a: RelicId;
  b: RelicId;
  rule: string;
  numbers: string;
  /** What b's ordinary effect gave that the combo gives up (items-relics.md §2.3 "Lost benefits"). */
  lost: string;
  flavor: string;
}

export const RELICS: Record<RelicId, RelicDef> = {
  usher: { id: 'usher', name: "Usher's Badge", rarity: 'common', source: 'chest', trigger: 'You kill a taunted enemy',
    rule: 'Leave a slowing circle where it died.', numbers: '4 m circle, slows by half for 4 s · cooldown 4 s', reads: 'taunted', applies: ['slowed', 'pooled'],
    combo: 'expulsion', cooldown: 4, flavor: 'It marked the usher responsible for removing a rejected appeal.' },
  thurible: { id: 'thurible', name: 'Broken Thurible', rarity: 'common', source: 'chest', trigger: 'You kill a censed enemy',
    rule: 'An ember flies to the nearest remaining enemy.', numbers: '20 damage, within 12 m · cooldown 2 s', reads: 'censed',
    combo: 'abandoned', cooldown: 2, flavor: 'It hung above the gate before the last petition was heard.' },
  link: { id: 'link', name: 'Last Link', rarity: 'common', source: 'chest', trigger: 'You kill a bound enemy',
    rule: 'The broken chain launches the survivors beside it.', numbers: '3 m ring, no damage · cooldown 3 s', reads: 'bound', applies: ['airborne'],
    combo: 'chorus', cooldown: 3, flavor: 'This link secured the final prisoner brought before the Gate.' },
  tile: { id: 'tile', name: "Petitioner's Tile", rarity: 'common', source: 'chest', trigger: 'You kill a pooled enemy',
    rule: 'Chains close on the survivors around it.', numbers: '2.5 m ring, binds 0.5 s · cooldown 4 s', reads: 'pooled', applies: ['bound'],
    combo: 'appeal', cooldown: 4, flavor: 'Names were written on these tiles, then polished away.' },
  qseal: { id: 'qseal', name: 'Seal of the First Plea', rarity: 'rare', source: 'chest', trigger: 'Your Q kills an enemy',
    rule: 'A slowing rune burns where it died.', numbers: '4 m rune, slows by half for 4 s · cooldown 5 s', applies: ['slowed', 'pooled'],
    combo: 'reversal', cooldown: 5, flavor: 'The first plea was stamped for consideration before it was denied.' },
  eseal: { id: 'eseal', name: 'Seal of the Last Plea', rarity: 'rare', source: 'chest', trigger: 'Your E kills an enemy',
    rule: 'The survivors beside it are launched.', numbers: '3 m ring, no damage · cooldown 5 s', applies: ['airborne'],
    combo: 'reversal', cooldown: 5, flavor: 'The last plea reached the same desk as the first.' },
  comb: { id: 'comb', name: 'Comb of the Host', rarity: 'rare', source: 'chest', trigger: 'One of your attacks hits 5 or more enemies',
    rule: 'A slowing comb lies across the struck crowd.', numbers: '6 × 2 m across your aim, slows by half for 4 s · cooldown 5 s', applies: ['slowed', 'pooled'],
    combo: 'harrow', cooldown: 5, flavor: 'The Host used its teeth to keep the ranks in order.' },
  wheel: { id: 'wheel', name: 'Wheel of Review', rarity: 'legendary', source: 'chest', trigger: 'You kill a slowed enemy',
    rule: 'A gold wheel rolls into the nearest remaining enemy.', numbers: '30 damage, within 12 m · cooldown 3 s', reads: 'slowed',
    combo: 'harrow', cooldown: 3, flavor: 'Every rejected name passed beneath the turning wheel.' },
  unbroken: { id: 'unbroken', name: 'Unbroken Quill', rarity: 'common', source: 'unbroken', trigger: 'You pick up a halo',
    rule: 'Enemies around you are launched as you take it.', numbers: '3 m ring, no damage · cooldown 4 s', applies: ['airborne'],
    combo: 'expulsion', cooldown: 4, flavor: 'The verdict was written with this quill, which the condemned could not break.' },
  mercy: { id: 'mercy', name: "Mercy's Wax", rarity: 'common', source: 'mercy', trigger: 'You pick up a heal mote',
    rule: 'Wax closes around you as a small shield.', numbers: '20 shield for 4 s, not over a stronger shield · cooldown 4 s',
    combo: 'abandoned', cooldown: 4, flavor: 'A petitioner left this wax beneath the Sundial while waiting for mercy.' },
  armageddon: { id: 'armageddon', name: 'Choral Fragment', rarity: 'rare', source: 'armageddon', trigger: 'Your kill streak crosses a tier',
    rule: 'A choral ring bursts through the enemies around you.', numbers: '20 damage to the nearest 12 within 4 m · cooldown 4 s',
    combo: 'chorus', cooldown: 4, flavor: 'A broken stave from the hymn appointed to announce the end of the world.' },
  sentence3: { id: 'sentence3', name: 'Counterseal', rarity: 'legendary', source: 'sentence3', trigger: 'You use an item',
    rule: 'A counterseal flies along your aim and bursts.', numbers: 'up to 20 m, 30 damage to the nearest 12 within 3 m · cooldown 6 s',
    combo: 'appeal', cooldown: 6, flavor: 'Hell pressed this seal against the Sentence entered by Heaven.' },
};

export const COMBOS: Record<ComboId, ComboDef> = {
  expulsion: { id: 'expulsion', name: 'Order of Expulsion', a: 'usher', b: 'unbroken',
    rule: 'A halo pickup launches the nearest taunted crowd instead of yours.', numbers: 'taunted enemy within 20 m in sight; 3 m ring · cooldown 4 s',
    lost: "the Quill's escape ring around you", flavor: "The usher's order directs the verdict to its subject." },
  abandoned: { id: 'abandoned', name: 'Abandoned Mercy', a: 'thurible', b: 'mercy',
    rule: 'A mote pickup fires an ember into a censed enemy instead of shielding you.', numbers: '40 damage to a censed enemy within 20 m · cooldown 4 s',
    lost: "the Wax's shield", flavor: 'The petition for mercy is returned to the altar that refused it.' },
  chorus: { id: 'chorus', name: 'Broken Chorus', a: 'link', b: 'armageddon',
    rule: 'A streak tier bursts around the nearest airborne enemy instead of you.', numbers: '30 damage to the nearest 8 within 3 m of it · cooldown 4 s',
    lost: 'the reliable burst around you', flavor: 'A freed voice breaks the harmony of the Host.' },
  appeal: { id: 'appeal', name: 'Appeal in the Marble', a: 'tile', b: 'sentence3',
    rule: 'An item use stamps your newest landed item area instead of casting a seal.', numbers: '20 damage to the nearest 16 inside it, within 20 m · cooldown 6 s',
    lost: "the Counterseal's aimed range, and self items' reliability", flavor: 'The names polished from the floor return beneath Hell’s seal.' },
  reversal: { id: 'reversal', name: 'Reversal of Judgment', a: 'qseal', b: 'eseal',
    rule: 'An E kill launches the enemies on your burning Q rune instead.', numbers: 'rune within 20 m; 6 m ring, 24 enemies · cooldown 5 s',
    lost: 'the launch at the E kill itself', flavor: 'The final plea is sent back to the first hearing.' },
  harrow: { id: 'harrow', name: 'Harrow of the Host', a: 'comb', b: 'wheel',
    rule: 'A slowed kill rolls a broad wheel from your comb along its lane.', numbers: '2 m wide, 16 m, 12 damage to each of 12 · cooldown 3 s',
    lost: "the Wheel's own 30-damage single target", flavor: 'The instrument that held the ranks now tears through them.' },
};

/** The chest's offer weights per eligible relic (§8.2). */
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, rare: 30, legendary: 10 };
export const CHEST_RELICS: readonly RelicId[] = RELIC_IDS.filter((id) => RELICS[id].source === 'chest');
export const DEED_RELIC: Record<DeedId, RelicId> = { unbroken: 'unbroken', mercy: 'mercy', armageddon: 'armageddon', sentence3: 'sentence3' };

export const DEEDS: Record<DeedId, { name: string; rule: string }> = {
  unbroken: { name: 'Unbroken', rule: 'Win a run without dying, as a character who has won before.' },
  mercy: { name: 'Mercy of the Sundial', rule: 'Seal the Gatekeeper before the Sundial goes dark, then win.' },
  armageddon: { name: 'Armageddon', rule: 'Reach a 200 kill streak in a won run.' },
  sentence3: { name: 'Under Sentence', rule: 'Win under a Sentence of 3 or more.' },
};

export const isRelicId = (v: unknown): v is RelicId => typeof v === 'string' && (RELIC_IDS as readonly string[]).includes(v);

/** The combo two equipped relics make, either order, or null. */
export function activeCombo(equipped: readonly (string | null)[]): ComboDef | null {
  const [x, y] = equipped;
  if (!x || !y) return null;
  for (const c of Object.values(COMBOS)) if ((c.a === x && c.b === y) || (c.a === y && c.b === x)) return c;
  return null;
}

/** The effect a relic slot produces: its own, or the combo that replaces it (it is the combo's b). */
export function relicEffect(id: RelicId, equipped: readonly (string | null)[]): RelicId | ComboId {
  const combo = activeCombo(equipped);
  return combo && combo.b === id ? combo.id : id;
}

export function effectName(effect: RelicId | ComboId): string {
  return (RELICS as Record<string, RelicDef>)[effect]?.name ?? COMBOS[effect as ComboId].name;
}

/** The art path stem: `relic-<id>` under assets/items. */
export const relicIcon = (id: RelicId): string => `relic-${id}`;

// Numbers (items-relics.md §2.2–§2.3). Seconds and meters.
export const RELIC = {
  stateRingTargets: 24,
  launchRing: 3, launchDistance: 2,
  usherRadius: 4, runeRadius: 4, areaSeconds: 4,
  tileRadius: 2.5, tileBind: 0.5,
  emberDamage: 20, emberRange: 12, emberSpeed: 18, emberLife: 1,
  wheelDamage: 30, wheelRange: 12, wheelSpeed: 16, wheelLife: 1,
  comb: { length: 6, width: 2 },
  quillRadius: 3,
  waxShield: 20, waxSeconds: 4,
  choral: { damage: 20, radius: 4, cap: 12 },
  counterseal: { range: 20, speed: 20, damage: 30, radius: 3, cap: 12 },
  expulsionRange: 20,
  abandoned: { damage: 40, range: 20, speed: 20, life: 1.5 },
  chorus: { range: 20, damage: 30, radius: 3, cap: 8 },
  appeal: { range: 20, damage: 20, cap: 16 },
  reversal: { range: 20, radius: 6 },
  harrow: { width: 2, range: 16, speed: 16, damage: 12, cap: 12 },
  /** Per owner: persistent item and relic areas together, and relic projectiles (§2.4 rule 5). */
  areaCap: 4, shotCap: 4,
} as const;
