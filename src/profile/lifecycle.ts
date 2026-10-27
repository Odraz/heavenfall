/** Client-side absolute checkpoint application. Transport acceptance and disk success are separate. */
import type { ClassId } from '../data/classes';
import { copyInventory, emptyInventory, isItemId, ITEMS, type Inventory, type ItemId } from '../data/items';
import { levelForXp, saturatingAdd, validateProfile, type Outcome, type Profile } from './model';
import { learnedError } from '../sim/build';
import { DEED_IDS, isRelicId, type DeedId } from '../data/relics';

const isDeedId = (d: unknown): d is DeedId => typeof d === 'string' && (DEED_IDS as readonly string[]).includes(d);

export interface Admission {
  runId: string; admissionId: number; progressionEnabled: boolean;
  kind: 'new' | 'resume' | 'settled'; classId: ClassId; heaven: number;
}
export interface ProgressState {
  runId: string; admissionId: number; progressionEnabled: boolean; admissionCommitted: boolean;
  classId: ClassId; heaven: number; revision: number; xp: number; runXp: number;
  inventory: Inventory; itemsTried: ItemId[]; outcome: Outcome | null;
  /** The learned build after accepted Advocate edits (§9.6); absent from older hosts. */
  talents?: string[]; q?: string; e?: string;
  /** R6: relics this run adds to the profile (chest claims; pawns at victory) and the saved relic loadout. */
  relics?: string[]; equipped?: [string | null, string | null];
  /** Deeds done (victory only), the run's best streak, and the Sentence the run was won under. */
  deeds?: string[]; bestStreak?: number; sentence?: number;
}
/** Returns a candidate stake for a mandatory durable save; it never mutates accepted memory. */
export function stakeProfile(current: Profile, admission: Admission): Profile {
  const p = validateProfile(current).profile;
  if (!admission.progressionEnabled) {
    if (p.run) throw new Error('Recover the normal attempt before starting a disposable run');
    return p;
  }
  if (admission.kind !== 'new') return p;
  if (p.run) {
    if (p.run.runId === admission.runId && p.run.admissionId === admission.admissionId && p.run.classId === admission.classId) return p;
    throw new Error('Recover the previous run before admitting a new attempt');
  }
  p.run = { runId: admission.runId, admissionId: admission.admissionId, admissionCommitted: false, heaven: admission.heaven,
    classId: admission.classId, carried: copyInventory(p.inventory), xpBase: p.characters[admission.classId].xp };
  p.inventory = emptyInventory(); p.lastSettlement = null;
  return validateProfile(p).profile;
}
/** Unsupported offline reconstruction resolves as loss, never as an inferred admission refund. */
export function abandonAttempt(current: Profile): Profile {
  const p = validateProfile(current).profile;
  if (p.run) {
    p.lastSettlement = { runId: p.run.runId, classId: p.run.classId, revision: 0xffffffff, outcome: 'defeat' };
    p.inventory = emptyInventory(); p.run = null;
  }
  return p;
}
export function applyProgress(current: Profile, state: ProgressState): Profile | null {
  if (!state.progressionEnabled || !Number.isSafeInteger(state.xp) || state.xp < 0 || !Number.isInteger(state.revision) || state.revision < 0 || state.revision > 0xffffffff) return null;
  if (!Array.isArray(state.inventory) || state.inventory.length !== 2 || state.inventory.some(s => s !== null && (!s || !isItemId(s.item) || !Number.isInteger(s.count) || s.count < 1 || s.count > ITEMS[s.item].cap)) ||
    !Array.isArray(state.itemsTried) || state.itemsTried.length > 8 || state.itemsTried.some(id => !isItemId(id))) return null;
  const run = current.run, last = current.lastSettlement;
  if (run ? run.runId !== state.runId || run.classId !== state.classId || run.admissionId !== state.admissionId
    : !last || last.runId !== state.runId || last.classId !== state.classId || last.outcome !== 'victory' || state.outcome !== 'victory') return null;
  if (last?.runId === state.runId && state.revision <= last.revision) return null;
  if (state.outcome === 'admissionAborted' && (state.admissionCommitted || run?.admissionCommitted)) return null;
  if (!state.admissionCommitted && state.outcome !== 'admissionAborted') return null;
  const p = validateProfile(current).profile;
  if (p.run && state.admissionCommitted && !p.run.admissionCommitted) {
    p.run.admissionCommitted = true; p.stats.runs = saturatingAdd(p.stats.runs, 1);
  }
  const character = p.characters[state.classId];
  character.xp = Math.max(character.xp, state.xp);
  // A learned build the host accepted at the Advocate; one that fails the learned check is ignored.
  if (Array.isArray(state.talents) && state.talents.every((t) => typeof t === 'string') && typeof state.q === 'string' && typeof state.e === 'string' &&
    learnedError(state.classId, { talents: state.talents, q: state.q, e: state.e }, levelForXp(character.xp)) === null) {
    character.talents = [...state.talents]; character.q = state.q; character.e = state.e;
  }
  p.codex.itemsTried = [...new Set([...p.codex.itemsTried, ...state.itemsTried])];
  // Deeds, records and relics only ever grow: a settlement can't take them back (§8.6, §10, §2.5).
  if (Array.isArray(state.deeds)) for (const d of state.deeds) if (isDeedId(d) && !p.deeds.includes(d)) p.deeds.push(d);
  if (Number.isSafeInteger(state.bestStreak) && state.bestStreak! > character.bestStreak) character.bestStreak = state.bestStreak!;
  if (state.outcome === 'victory' && Number.isInteger(state.sentence) && state.sentence! >= 0 && state.sentence! <= 5)
    character.bestSentence[state.heaven] = Math.max(character.bestSentence[state.heaven] ?? 0, state.sentence!);
  // Relics are ownership, never removed by a settlement: claims add at once, pawns with the victory.
  if (Array.isArray(state.relics)) for (const id of state.relics) if (isRelicId(id) && !p.relics.includes(id)) p.relics.push(id);
  if (Array.isArray(state.equipped) && state.equipped.length === 2) {
    const [a, b] = state.equipped;
    const ok = (id: unknown) => id === null || (typeof id === 'string' && p.relics.includes(id));
    if (ok(a) && ok(b) && !(a && a === b)) character.relics = [a, b];
  }
  if (state.outcome) {
    const firstVictory = state.outcome === 'victory' && last?.outcome !== 'victory';
    if (firstVictory) {
      p.stats.wins = saturatingAdd(p.stats.wins, 1);
      p.heavens.clears[state.heaven] = saturatingAdd(p.heavens.clears[state.heaven] ?? 0, 1);
      const next = Math.min(9, state.heaven + 1);
      if (!p.heavens.unlocked.includes(next)) p.heavens.unlocked.push(next);
    }
    p.inventory = state.outcome === 'victory' ? copyInventory(state.inventory)
      : (state.outcome === 'hostLeft' || state.outcome === 'admissionAborted') && p.run ? copyInventory(p.run.carried) : emptyInventory();
    p.run = null;
    p.lastSettlement = { runId: state.runId, classId: state.classId, revision: state.revision, outcome: state.outcome };
  }
  p.updated = Date.now();
  try { return validateProfile(p).profile; } catch { return null; }
}
