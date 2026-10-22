import type { ClassId } from '../data/classes';
import { copyInventory, emptyInventory, type Inventory, type ItemId } from '../data/items';
import { saturatingAdd, validateProfile, type Outcome, type Profile } from '../profile/model';
import type { Admission, ProgressState } from '../profile/lifecycle';
import { DEED_RELIC, DEED_IDS, type DeedId } from '../data/relics';

const isDeedId = (d: string): d is DeedId => (DEED_IDS as readonly string[]).includes(d);

export interface RunRecord {
  profileId: string; playerId: number; classId: ClassId; admissionId: number;
  xpBase: number; runXp: number; carried: Inventory; inventory: Inventory;
  wallet: number; itemsTried: ItemId[]; committed: boolean; connected: boolean;
  closed: boolean; outcome: Outcome | null; revision: number; presentAtStart: boolean;
  /** The learned build to save (§13.2): Advocate edits change it; Rites never enter it. */
  build: { talents: string[]; q: string; e: string };
  /** R6: chest relics claimed (saved at once), pawns (saved at victory) and the saved relic loadout. */
  claimed: string[]; pawned: string[]; savedRelics: [string | null, string | null];
  /** Deeds done at the boss's death (§8.6), the run's best streak and its Sentence. */
  deeds: string[]; bestStreak: number; sentence: number;
}
/** Host-owned records survive transport removal. Their IDs and accepted bases never come from a resume. */
export class RunRecords {
  readonly records = new Map<string, RunRecord>();
  private nextAdmission = 1;
  constructor(readonly runId: string, readonly progressionEnabled: boolean, readonly heaven = 1) {}
  reserve(playerId: number, classId: ClassId, input: Profile, atStart: boolean): Admission {
    const profile = validateProfile(input).profile;
    const old = this.records.get(profile.id);
    if (old) {
      if (old.playerId !== playerId || old.classId !== classId || old.closed) throw new Error('This profile cannot enter this run');
      return this.admission(old);
    }
    if (this.records.size >= 256 || this.nextAdmission > 0xffffffff || [...this.records.values()].some(r => !r.closed && (r.playerId === playerId || r.classId === classId))) throw new Error('Run slot reserved');
    if (profile.run) throw new Error('Recover the previous run first');
    const r: RunRecord = { profileId: profile.id, playerId, classId, admissionId: this.nextAdmission++, xpBase: profile.characters[classId].xp,
      runXp: 0, carried: copyInventory(profile.inventory), inventory: copyInventory(profile.inventory), wallet: 0,
      itemsTried: [], committed: false, connected: false, closed: false, outcome: null, revision: 0, presentAtStart: atStart,
      build: { talents: [...profile.characters[classId].talents], q: profile.characters[classId].q, e: profile.characters[classId].e },
      claimed: [], pawned: [], savedRelics: [profile.characters[classId].relics[0], profile.characters[classId].relics[1]], deeds: [], bestStreak: 0, sentence: 0 };
    this.records.set(profile.id, r); return this.admission(r);
  }
  admission(r: RunRecord): Admission {
    return { runId: this.runId, admissionId: r.admissionId, progressionEnabled: this.progressionEnabled,
      classId: r.classId, heaven: this.heaven, kind: r.outcome === 'victory' ? 'settled' : r.committed ? 'resume' : 'new' };
  }
  byPlayer(id: number): RunRecord | undefined { return [...this.records.values()].find(r => r.playerId === id && !r.closed); }
  ready(playerId: number, runId: string, token: number): RunRecord | null {
    const r = this.byPlayer(playerId);
    if (!r || r.closed || runId !== this.runId || r.admissionId !== token) return null;
    return r;
  }
  commit(r: RunRecord): ProgressState {
    r.committed = true; r.connected = true; return this.state(r);
  }
  state(r: RunRecord): ProgressState {
    if (r.revision >= 0xffffffff) throw new Error('Run revision exhausted');
    return { runId: this.runId, admissionId: r.admissionId, progressionEnabled: this.progressionEnabled, admissionCommitted: r.committed,
      classId: r.classId, heaven: this.heaven, revision: ++r.revision, xp: saturatingAdd(r.xpBase, Math.floor(r.runXp)), runXp: Math.floor(r.runXp),
      inventory: copyInventory(r.inventory), itemsTried: [...r.itemsTried], outcome: r.outcome,
      talents: [...r.build.talents], q: r.build.q, e: r.build.e,
      // Pawns become owned, and their slots saved, only with the victory settlement (§9.6, §13.5).
      relics: r.outcome === 'victory' ? [...r.claimed, ...r.pawned, ...r.deeds.flatMap((d) => (isDeedId(d) ? [DEED_RELIC[d]] : []))] : [...r.claimed],
      deeds: r.outcome === 'victory' ? [...r.deeds] : [], bestStreak: r.bestStreak, sentence: r.outcome === 'victory' ? r.sentence : undefined,
      equipped: r.outcome === 'victory' ? this.victoryLoadout(r) : [r.savedRelics[0], r.savedRelics[1]] };
  }
  private victoryLoadout(r: RunRecord): [string | null, string | null] {
    return [r.savedRelics[0], r.savedRelics[1]];
  }
  settle(r: RunRecord, outcome: Outcome): ProgressState {
    if (r.outcome !== 'victory' && !r.closed) {
      if (outcome === 'admissionAborted' && r.committed) throw new Error('Playable admission cannot be refunded');
      r.outcome = outcome;
      if (outcome !== 'victory') {
        r.closed = true; r.connected = false;
        r.inventory = outcome === 'hostLeft' || outcome === 'admissionAborted' ? copyInventory(r.carried) : emptyInventory();
      }
    }
    return this.state(r);
  }
}
/** Completed-run recovery is deliberately bounded to this host tab's last sixteen runs. */
export class SettlementCache {
  private runs = new Map<string, Map<string, ProgressState>>();
  save(records: RunRecords): void {
    const settled = new Map<string, ProgressState>();
    for (const r of records.records.values()) if (r.outcome) settled.set(r.profileId, records.state(r));
    this.runs.set(records.runId, settled);
    while (this.runs.size > 16) this.runs.delete(this.runs.keys().next().value!);
  }
  get(runId: string, profileId: string): ProgressState | null {
    const state = this.runs.get(runId)?.get(profileId); return state ? structuredClone(state) : null;
  }
}
