/** Client-side absolute checkpoint application. Transport acceptance and disk success are separate. */
import type { ClassId } from '../data/classes';
import { copyInventory, emptyInventory, isItemId, ITEMS, type Inventory, type ItemId } from '../data/items';
import { saturatingAdd, validateProfile, type Outcome, type Profile } from './model';

export interface Admission {
  runId: string; admissionId: number; progressionEnabled: boolean;
  kind: 'new' | 'resume' | 'settled'; classId: ClassId; heaven: number;
}
export interface ProgressState {
  runId: string; admissionId: number; progressionEnabled: boolean; admissionCommitted: boolean;
  classId: ClassId; heaven: number; revision: number; xp: number; runXp: number;
  inventory: Inventory; itemsTried: ItemId[]; outcome: Outcome | null;
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
  p.characters[state.classId].xp = Math.max(p.characters[state.classId].xp, state.xp);
  p.codex.itemsTried = [...new Set([...p.codex.itemsTried, ...state.itemsTried])];
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
