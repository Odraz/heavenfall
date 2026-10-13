import { CLASS_IDS, isClassId, type ClassId } from '../data/classes';
import { ITEMS, isItemId, emptyInventory, type Inventory } from '../data/items';

export const PROFILE_SCHEMA = 1;
export const MAX_SAVE_BYTES = 256 * 1024;
export const BASE_ABILITIES: Record<ClassId, [string, string]> = {
  fallen: ['blasphemy', 'fallingStar'], heretic: ['communion', 'shroud'],
  binder: ['chains', 'discord'], betrayer: ['field', 'shadowstep'],
};
export const RELIC_IDS = ['usher', 'thurible', 'link', 'tile', 'qseal', 'eseal', 'comb', 'wheel', 'quill', 'wax', 'fragment', 'counterseal'];
export const DEED_IDS = ['unbroken', 'mercy', 'armageddon', 'sentence3'];
export type Outcome = 'victory' | 'defeat' | 'leave' | 'hostLeft' | 'admissionAborted';
export interface Character {
  xp: number; talents: string[]; q: string; e: string; relics: [string | null, string | null];
  bestStreak: number; bestSentence: Record<number, number>;
}
export interface Profile {
  schema: 1; id: string; name: string; created: number; updated: number;
  characters: Record<ClassId, Character>; relics: string[]; deeds: string[]; inventory: Inventory;
  heavens: { unlocked: number[]; clears: Record<number, number>; bestTime: Record<string, { ticks: number; rulesVersion: string }>; lastEdicts: Record<number, number[]> };
  run: null | { runId: string; admissionId: number; admissionCommitted: boolean; heaven: number; classId: ClassId; carried: Inventory; xpBase: number };
  lastSettlement: null | { runId: string; classId: ClassId; revision: number; outcome: Outcome };
  codex: { itemsTried: string[] }; stats: { runs: number; wins: number };
}
export function newId(): string {
  return [...crypto.getRandomValues(new Uint8Array(16))].map(n => n.toString(16).padStart(2, '0')).join('');
}
export function createProfile(name: string, id = newId(), now = Date.now()): Profile {
  const characters = Object.fromEntries(CLASS_IDS.map(c => [c, { xp: 0, talents: [], q: BASE_ABILITIES[c][0], e: BASE_ABILITIES[c][1], relics: [null, null], bestStreak: 0, bestSentence: {} } as Character])) as Profile['characters'];
  return validateProfile({ schema: 1, id, name: name.trim(), created: now, updated: now, characters, relics: [], deeds: [], inventory: emptyInventory(), heavens: { unlocked: [1], clears: {}, bestTime: {}, lastEdicts: {} }, run: null, lastSettlement: null, codex: { itemsTried: [] }, stats: { runs: 0, wins: 0 } }).profile;
}
export function saturatingAdd(a: number, b: number): number { return Math.min(Number.MAX_SAFE_INTEGER, a + b); }
export function levelForXp(xp: number): number {
  for (let level = 10; level > 1; level--) if (xp >= xpForLevel(level)) return level;
  return 1;
}
export const xpForLevel = (level: number): number => 1500 * (level - 1) + 500 * (level - 1) * (level - 2);
export const absolutionForXp = (xp: number): number => Math.max(0, Math.floor((xp - xpForLevel(10)) / 10000));

function fail(): never { throw new Error('Invalid profile'); }
function record(v: unknown, keys?: readonly string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.getPrototypeOf(v) !== Object.prototype) return fail();
  const r = v as Record<string, unknown>;
  if (keys && (Object.keys(r).length !== keys.length || keys.some(k => !Object.hasOwn(r, k)))) return fail();
  return r;
}
function integer(v: unknown, max = Number.MAX_SAFE_INTEGER): number { if (!Number.isSafeInteger(v) || (v as number) < 0 || (v as number) > max) return fail(); return v as number; }
function string(v: unknown, max: number): string { if (typeof v !== 'string' || v.length > max) return fail(); return v; }
function id(v: unknown): string { const s = string(v, 32); if (!/^[a-f0-9]{32}$/.test(s)) return fail(); return s; }
function array(v: unknown, max: number): unknown[] { if (!Array.isArray(v) || v.length > max) return fail(); return v; }
function unique(v: unknown, max: number): string[] {
  const a = array(v, max).map(x => string(x, 80));
  if (new Set(a).size !== a.length) return fail();
  return a;
}
function heaven(v: unknown): number { const n = integer(v, 9); if (!n) return fail(); return n; }
function numberRecord(v: unknown, max: number): Record<number, number> {
  const r = record(v); if (Object.keys(r).length > 9) return fail();
  for (const [k, n] of Object.entries(r)) { if (!/^[1-9]$/.test(k)) return fail(); integer(n, max); }
  return { ...r } as Record<number, number>;
}
/** Schema 1 is the first shipped profile format. Add forward-only migrations here when it changes. */
export function validateProfile(input: unknown): { profile: Profile; repaired: boolean } {
  const v = record(input);
  if (typeof v.schema === 'number' && v.schema > PROFILE_SCHEMA) throw new Error('This save is from a newer version of the game');
  if (v.schema !== PROFILE_SCHEMA) throw new Error('Unsupported profile version');
  record(v, ['schema', 'id', 'name', 'created', 'updated', 'characters', 'relics', 'deeds', 'inventory', 'heavens', 'run', 'lastSettlement', 'codex', 'stats']);
  let repaired = false;
  const known = (value: unknown, ids: readonly string[], max: number): string[] => {
    const values = unique(value, max); const result = values.filter(x => ids.includes(x));
    repaired ||= result.length !== values.length; return result;
  };
  const inventory = (value: unknown): Inventory => {
    const slots = array(value, 2); if (slots.length !== 2) return fail();
    return slots.map(s => {
      if (s === null) return null;
      const r = record(s, ['item', 'count']); const item = string(r.item, 80); const count = integer(r.count, 3);
      if (!count) return fail();
      if (!isItemId(item)) { repaired = true; return null; }
      if (count > ITEMS[item].cap) return fail();
      return { item, count };
    }) as Inventory;
  };
  const relics = known(v.relics, RELIC_IDS, 128);
  const chars = record(v.characters, CLASS_IDS);
  const characters = Object.fromEntries(CLASS_IDS.map(c => {
    const r = record(chars[c], ['xp', 'talents', 'q', 'e', 'relics', 'bestStreak', 'bestSentence']);
    const talents = unique(r.talents, 128), q = string(r.q, 80), e = string(r.e, 80);
    // R4 introduces learned nodes. Unknown content resets this character, preserving XP.
    repaired ||= talents.length > 0 || q !== BASE_ABILITIES[c][0] || e !== BASE_ABILITIES[c][1];
    const equipment = array(r.relics, 2); if (equipment.length !== 2) return fail();
    const equipped = equipment.map(x => { if (x === null) return null; const value = string(x, 80); if (!relics.includes(value)) { repaired = true; return null; } return value; }) as Character['relics'];
    if (equipped[0] && equipped[0] === equipped[1]) return fail();
    return [c, { xp: integer(r.xp), talents: [], q: BASE_ABILITIES[c][0], e: BASE_ABILITIES[c][1], relics: equipped, bestStreak: integer(r.bestStreak), bestSentence: numberRecord(r.bestSentence, 5) } as Character];
  })) as Profile['characters'];
  const h = record(v.heavens, ['unlocked', 'clears', 'bestTime', 'lastEdicts']);
  const unlocked = array(h.unlocked, 9).map(heaven);
  if (!unlocked.includes(1) || new Set(unlocked).size !== unlocked.length) return fail();
  const times = record(h.bestTime); if (Object.keys(times).length > 512) return fail();
  const bestTime: Profile['heavens']['bestTime'] = {};
  for (const [key, value] of Object.entries(times)) {
    if (!/^[1-9]:(fallen|heretic|binder|betrayer):[1-4]:[0-3]:\d{1,2}:(?:(?:fallen|heretic|binder|betrayer)-[hb],?){1,4}$/.test(key)) return fail();
    const t = record(value, ['ticks', 'rulesVersion']); bestTime[key] = { ticks: integer(t.ticks), rulesVersion: string(t.rulesVersion, 80) };
  }
  const edicts = record(h.lastEdicts); if (Object.keys(edicts).length > 9) return fail();
  const lastEdicts: Record<number, number[]> = {};
  for (const [k, value] of Object.entries(edicts)) {
    if (!/^[1-9]$/.test(k)) return fail();
    const ids = array(value, 5).map(x => integer(x, 5));
    if (ids.includes(0) || new Set(ids).size !== ids.length) return fail(); lastEdicts[Number(k)] = ids;
  }
  let run: Profile['run'] = null;
  if (v.run !== null) {
    const r = record(v.run, ['runId', 'admissionId', 'admissionCommitted', 'heaven', 'classId', 'carried', 'xpBase']);
    if (!isClassId(r.classId) || typeof r.admissionCommitted !== 'boolean') return fail();
    run = { runId: id(r.runId), admissionId: integer(r.admissionId, 0xffffffff), admissionCommitted: r.admissionCommitted, heaven: heaven(r.heaven), classId: r.classId, carried: inventory(r.carried), xpBase: integer(r.xpBase) };
    if (run.admissionId === 0 || run.xpBase > characters[run.classId].xp) return fail();
  }
  let lastSettlement: Profile['lastSettlement'] = null;
  if (v.lastSettlement !== null) {
    const s = record(v.lastSettlement, ['runId', 'classId', 'revision', 'outcome']);
    if (!isClassId(s.classId) || !['victory', 'defeat', 'leave', 'hostLeft', 'admissionAborted'].includes(String(s.outcome))) return fail();
    lastSettlement = { runId: id(s.runId), classId: s.classId, revision: integer(s.revision, 0xffffffff), outcome: s.outcome as Outcome };
  }
  if (run && lastSettlement && (run.runId !== lastSettlement.runId || run.classId !== lastSettlement.classId)) return fail();
  const inv = inventory(v.inventory); if (run && inv.some(Boolean)) return fail();
  const codex = record(v.codex, ['itemsTried']), stats = record(v.stats, ['runs', 'wins']);
  const name = string(v.name, 16); if (!name.trim() || name !== name.trim()) return fail();
  const profile: Profile = { schema: 1, id: id(v.id), name, created: integer(v.created), updated: integer(v.updated), characters, relics, deeds: known(v.deeds, DEED_IDS, 128), inventory: inv,
    heavens: { unlocked, clears: numberRecord(h.clears, Number.MAX_SAFE_INTEGER), bestTime, lastEdicts }, run, lastSettlement,
    codex: { itemsTried: known(codex.itemsTried, Object.keys(ITEMS), 128) }, stats: { runs: integer(stats.runs), wins: integer(stats.wins) } };
  return { profile, repaired };
}
export function parseProfile(text: string): ReturnType<typeof validateProfile> {
  if (text.length > MAX_SAVE_BYTES || new TextEncoder().encode(text).length > MAX_SAVE_BYTES) throw new Error('Save exceeds 256 KiB');
  return validateProfile(JSON.parse(text));
}
/** Import never reconstructs a live attempt. Checkpoint XP survives; staked charges do not. */
export function importProfile(input: unknown, otherIds: readonly string[], makeId = newId): { profile: Profile; copied: boolean; repaired: boolean } {
  const { profile, repaired } = validateProfile(input);
  if (profile.run) { profile.inventory = emptyInventory(); profile.run = null; }
  profile.lastSettlement = null;
  const copied = otherIds.includes(profile.id); if (copied) profile.id = makeId();
  return { profile, copied, repaired };
}
