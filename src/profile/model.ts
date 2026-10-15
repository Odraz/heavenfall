/** The persistent profile (rogue game.md §2.4): its schema, the XP curve (§9.1–§9.2) and strict validation. */
import { CLASS_IDS, isClassId, type ClassId } from '../data/classes';
import { ITEMS, isItemId, emptyInventory, type Inventory } from '../data/items';

export const PROFILE_SCHEMA = 1;
export const MAX_SAVE_BYTES = 256 * 1024;
export const BASE_ABILITIES: Record<ClassId, [string, string]> = {
  fallen: ['blasphemy', 'fallingStar'],
  heretic: ['communion', 'shroud'],
  binder: ['chains', 'discord'],
  betrayer: ['field', 'shadowstep'],
};
export const RELIC_IDS = ['usher', 'thurible', 'link', 'tile', 'qseal', 'eseal', 'comb', 'wheel', 'unbroken', 'mercy', 'armageddon', 'sentence3'];
export const DEED_IDS = ['unbroken', 'mercy', 'armageddon', 'sentence3'];
export type Outcome = 'victory' | 'defeat' | 'leave' | 'hostLeft' | 'admissionAborted';
const OUTCOMES: readonly string[] = ['victory', 'defeat', 'leave', 'hostLeft', 'admissionAborted'];

/** The XP curve's top level; beyond it every 10 000 XP is one Absolution (§9.2). */
const MAX_LEVEL = 10;
const XP_PER_ABSOLUTION = 10000;
/** Best clear times by `heaven:class:party:bots:sentence:roster`. */
const BEST_TIME_KEY = /^[1-9]:(fallen|heretic|binder|betrayer):[1-4]:[0-3]:\d{1,2}:(?:(?:fallen|heretic|binder|betrayer)-[hb],?){1,4}$/;
/** Bounds on how much a save may hold. */
const MAX_NAME = 16;
const MAX_TEXT = 80;
const MAX_IDS = 128;
const MAX_BEST_TIMES = 512;
const MAX_HEAVEN = 9;
const MAX_EDICTS = 5;
const MAX_SENTENCE = 5;

export interface Character {
  xp: number;
  talents: string[];
  q: string;
  e: string;
  relics: [string | null, string | null];
  bestStreak: number;
  bestSentence: Record<number, number>;
}

export interface Profile {
  schema: 1;
  id: string;
  name: string;
  created: number;
  updated: number;
  characters: Record<ClassId, Character>;
  relics: string[];
  deeds: string[];
  inventory: Inventory;
  heavens: {
    unlocked: number[];
    clears: Record<number, number>;
    bestTime: Record<string, { ticks: number; rulesVersion: string }>;
    lastEdicts: Record<number, number[]>;
  };
  /** The staked attempt in progress, if any (§2.4). */
  run: null | { runId: string; admissionId: number; admissionCommitted: boolean; heaven: number; classId: ClassId; carried: Inventory; xpBase: number };
  lastSettlement: null | { runId: string; classId: ClassId; revision: number; outcome: Outcome };
  codex: { itemsTried: string[] };
  stats: { runs: number; wins: number };
}

export function newId(): string {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((n) => n.toString(16).padStart(2, '0')).join('');
}

export function createProfile(name: string, id = newId(), now = Date.now()): Profile {
  const characters = Object.fromEntries(CLASS_IDS.map((c) => {
    const character: Character = { xp: 0, talents: [], q: BASE_ABILITIES[c][0], e: BASE_ABILITIES[c][1], relics: [null, null], bestStreak: 0, bestSentence: {} };
    return [c, character];
  })) as Profile['characters'];
  return validateProfile({
    schema: 1, id, name: name.trim(), created: now, updated: now, characters, relics: [], deeds: [], inventory: emptyInventory(),
    heavens: { unlocked: [1], clears: {}, bestTime: {}, lastEdicts: {} },
    run: null, lastSettlement: null, codex: { itemsTried: [] }, stats: { runs: 0, wins: 0 },
  }).profile;
}

export function saturatingAdd(a: number, b: number): number {
  return Math.min(Number.MAX_SAFE_INTEGER, a + b);
}

export function levelForXp(xp: number): number {
  for (let level = MAX_LEVEL; level > 1; level--) if (xp >= xpForLevel(level)) return level;
  return 1;
}

/** The total XP a level needs: 1 500, 4 000, 7 500, … 49 500 at level 10 (§9.2). */
export const xpForLevel = (level: number): number => 1500 * (level - 1) + 500 * (level - 1) * (level - 2);
export const absolutionForXp = (xp: number): number => Math.max(0, Math.floor((xp - xpForLevel(MAX_LEVEL)) / XP_PER_ABSOLUTION));

// Strict readers: any shape the game didn't write is refused with one message.
function fail(): never {
  throw new Error('Invalid profile');
}

/** A plain object; with `keys`, exactly those keys. */
function record(v: unknown, keys?: readonly string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.getPrototypeOf(v) !== Object.prototype) return fail();
  const r = v as Record<string, unknown>;
  if (keys && (Object.keys(r).length !== keys.length || keys.some((k) => !Object.hasOwn(r, k)))) return fail();
  return r;
}

function integer(v: unknown, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(v) || (v as number) < 0 || (v as number) > max) return fail();
  return v as number;
}

function string(v: unknown, max: number): string {
  if (typeof v !== 'string' || v.length > max) return fail();
  return v;
}

function id(v: unknown): string {
  const s = string(v, 32);
  if (!/^[a-f0-9]{32}$/.test(s)) return fail();
  return s;
}

function array(v: unknown, max: number): unknown[] {
  if (!Array.isArray(v) || v.length > max) return fail();
  return v;
}

function unique(v: unknown, max: number): string[] {
  const a = array(v, max).map((x) => string(x, MAX_TEXT));
  if (new Set(a).size !== a.length) return fail();
  return a;
}

function heaven(v: unknown): number {
  const n = integer(v, MAX_HEAVEN);
  if (!n) return fail();
  return n;
}

/** A record keyed by heaven 1–9. */
function numberRecord(v: unknown, max: number): Record<number, number> {
  const r = record(v);
  if (Object.keys(r).length > MAX_HEAVEN) return fail();
  for (const [k, n] of Object.entries(r)) {
    if (!/^[1-9]$/.test(k)) return fail();
    integer(n, max);
  }
  return { ...r } as Record<number, number>;
}

/**
 * Schema 1 is the first shipped profile format. Add forward-only migrations here when it changes.
 * Removed content is dropped and reported as `repaired`; anything malformed is refused.
 */
export function validateProfile(input: unknown): { profile: Profile; repaired: boolean } {
  const v = record(input);
  if (typeof v.schema === 'number' && v.schema > PROFILE_SCHEMA) throw new Error('This save is from a newer version of the game');
  if (v.schema !== PROFILE_SCHEMA) throw new Error('Unsupported profile version');
  record(v, ['schema', 'id', 'name', 'created', 'updated', 'characters', 'relics', 'deeds', 'inventory', 'heavens', 'run', 'lastSettlement', 'codex', 'stats']);
  let repaired = false;

  /** Unique IDs, keeping only the ones this build knows. */
  const known = (value: unknown, ids: readonly string[], max: number): string[] => {
    const values = unique(value, max);
    const result = values.filter((x) => ids.includes(x));
    repaired ||= result.length !== values.length;
    return result;
  };

  /** Two slots, each empty or one item stack within its cap (§7.1). */
  const inventory = (value: unknown): Inventory => {
    const slots = array(value, 2);
    if (slots.length !== 2) return fail();
    return slots.map((s) => {
      if (s === null) return null;
      const r = record(s, ['item', 'count']);
      const item = string(r.item, MAX_TEXT);
      const count = integer(r.count, 3);
      if (!count) return fail();
      if (!isItemId(item)) {
        repaired = true;
        return null;
      }
      if (count > ITEMS[item].cap) return fail();
      return { item, count };
    }) as Inventory;
  };

  const relics = known(v.relics, RELIC_IDS, MAX_IDS);
  const chars = record(v.characters, CLASS_IDS);
  const characters = Object.fromEntries(CLASS_IDS.map((c) => {
    const r = record(chars[c], ['xp', 'talents', 'q', 'e', 'relics', 'bestStreak', 'bestSentence']);
    const talents = unique(r.talents, MAX_IDS);
    const q = string(r.q, MAX_TEXT);
    const e = string(r.e, MAX_TEXT);
    // R4 introduces learned nodes. Unknown content resets this character, preserving XP.
    repaired ||= talents.length > 0 || q !== BASE_ABILITIES[c][0] || e !== BASE_ABILITIES[c][1];
    const equipment = array(r.relics, 2);
    if (equipment.length !== 2) return fail();
    const equipped = equipment.map((x) => {
      if (x === null) return null;
      const value = string(x, MAX_TEXT);
      if (!relics.includes(value)) {
        repaired = true;
        return null;
      }
      return value;
    }) as Character['relics'];
    if (equipped[0] && equipped[0] === equipped[1]) return fail();
    const character: Character = {
      xp: integer(r.xp), talents: [], q: BASE_ABILITIES[c][0], e: BASE_ABILITIES[c][1], relics: equipped,
      bestStreak: integer(r.bestStreak), bestSentence: numberRecord(r.bestSentence, MAX_SENTENCE),
    };
    return [c, character];
  })) as Profile['characters'];

  const h = record(v.heavens, ['unlocked', 'clears', 'bestTime', 'lastEdicts']);
  const unlocked = array(h.unlocked, MAX_HEAVEN).map(heaven);
  if (!unlocked.includes(1) || new Set(unlocked).size !== unlocked.length) return fail();
  const times = record(h.bestTime);
  if (Object.keys(times).length > MAX_BEST_TIMES) return fail();
  const bestTime: Profile['heavens']['bestTime'] = {};
  for (const [key, value] of Object.entries(times)) {
    if (!BEST_TIME_KEY.test(key)) return fail();
    const t = record(value, ['ticks', 'rulesVersion']);
    bestTime[key] = { ticks: integer(t.ticks), rulesVersion: string(t.rulesVersion, MAX_TEXT) };
  }
  const edicts = record(h.lastEdicts);
  if (Object.keys(edicts).length > MAX_HEAVEN) return fail();
  const lastEdicts: Record<number, number[]> = {};
  for (const [k, value] of Object.entries(edicts)) {
    if (!/^[1-9]$/.test(k)) return fail();
    const ids = array(value, MAX_EDICTS).map((x) => integer(x, MAX_EDICTS));
    if (ids.includes(0) || new Set(ids).size !== ids.length) return fail();
    lastEdicts[Number(k)] = ids;
  }

  let run: Profile['run'] = null;
  if (v.run !== null) {
    const r = record(v.run, ['runId', 'admissionId', 'admissionCommitted', 'heaven', 'classId', 'carried', 'xpBase']);
    if (!isClassId(r.classId) || typeof r.admissionCommitted !== 'boolean') return fail();
    run = {
      runId: id(r.runId), admissionId: integer(r.admissionId, 0xffffffff), admissionCommitted: r.admissionCommitted,
      heaven: heaven(r.heaven), classId: r.classId, carried: inventory(r.carried), xpBase: integer(r.xpBase),
    };
    if (run.admissionId === 0 || run.xpBase > characters[run.classId].xp) return fail();
  }
  let lastSettlement: Profile['lastSettlement'] = null;
  if (v.lastSettlement !== null) {
    const s = record(v.lastSettlement, ['runId', 'classId', 'revision', 'outcome']);
    if (!isClassId(s.classId) || !OUTCOMES.includes(String(s.outcome))) return fail();
    lastSettlement = { runId: id(s.runId), classId: s.classId, revision: integer(s.revision, 0xffffffff), outcome: s.outcome as Outcome };
  }
  if (run && lastSettlement && (run.runId !== lastSettlement.runId || run.classId !== lastSettlement.classId)) return fail();
  // While a run is staked, its charges live in `run.carried`, not the inventory.
  const inv = inventory(v.inventory);
  if (run && inv.some(Boolean)) return fail();
  const codex = record(v.codex, ['itemsTried']);
  const stats = record(v.stats, ['runs', 'wins']);
  const name = string(v.name, MAX_NAME);
  if (!name.trim() || name !== name.trim()) return fail();
  const profile: Profile = {
    schema: 1, id: id(v.id), name, created: integer(v.created), updated: integer(v.updated),
    characters, relics, deeds: known(v.deeds, DEED_IDS, MAX_IDS), inventory: inv,
    heavens: { unlocked, clears: numberRecord(h.clears, Number.MAX_SAFE_INTEGER), bestTime, lastEdicts },
    run, lastSettlement,
    codex: { itemsTried: known(codex.itemsTried, Object.keys(ITEMS), MAX_IDS) },
    stats: { runs: integer(stats.runs), wins: integer(stats.wins) },
  };
  return { profile, repaired };
}

export function parseProfile(text: string): ReturnType<typeof validateProfile> {
  if (text.length > MAX_SAVE_BYTES || new TextEncoder().encode(text).length > MAX_SAVE_BYTES) throw new Error('Save exceeds 256 KiB');
  return validateProfile(JSON.parse(text));
}

/** Import never reconstructs a live attempt. Checkpoint XP survives; staked charges do not. */
export function importProfile(input: unknown, otherIds: readonly string[], makeId = newId): { profile: Profile; copied: boolean; repaired: boolean } {
  const { profile, repaired } = validateProfile(input);
  if (profile.run) {
    profile.inventory = emptyInventory();
    profile.run = null;
  }
  profile.lastSettlement = null;
  const copied = otherIds.includes(profile.id);
  if (copied) profile.id = makeId();
  return { profile, copied, repaired };
}
