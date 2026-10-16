import { describe, expect, it } from 'vitest';
import { createProfile } from './model';
import { abandonAttempt, applyProgress, stakeProfile, type ProgressState } from './lifecycle';
import { RunRecords, SettlementCache } from '../net/runRecords';

const runId = 'a'.repeat(32);
function setup(enabled = true) {
  const p = createProfile('Tester', 'b'.repeat(32), 0); p.inventory[0] = { item: 'balm', count: 3 };
  const records = new RunRecords(runId, enabled), admission = records.reserve(0, 'fallen', p, true);
  return { p, records, admission, r: records.byPlayer(0)!, staked: stakeProfile(p, admission) };
}
describe('durable admission and absolute progression', () => {
  it('takes one stake on duplicate pending admission and counts only the first committed state', () => {
    const { p, records, admission, r, staked } = setup();
    expect(p.inventory[0]?.count).toBe(3); expect(staked.inventory).toEqual([null, null]);
    expect(stakeProfile(staked, admission)).toEqual(staked);
    expect(records.reserve(0, 'fallen', p, true)).toEqual(admission);
    expect(records.ready(1, runId, admission.admissionId)).toBeNull();
    expect(records.ready(0, 'c'.repeat(32), admission.admissionId)).toBeNull();
    const state = records.commit(r), saved = applyProgress(staked, state)!;
    expect(saved.stats.runs).toBe(1); expect(applyProgress(saved, records.state(r))!.stats.runs).toBe(1);
    r.runXp = 140.75; const xp = records.state(r);
    expect(applyProgress(saved, xp)!.characters.fallen.xp).toBe(140);
    expect(applyProgress(applyProgress(saved, xp)!, xp)!.characters.fallen.xp).toBe(140);
  });
  it('saves an Advocate edit from the run record, and ignores a build the level cannot pay for', () => {
    const p = createProfile('Tester', 'b'.repeat(32), 0); p.characters.betrayer.xp = 4000;
    const records = new RunRecords(runId, true), admission = records.reserve(0, 'betrayer', p, true);
    const staked = stakeProfile(p, admission), r = records.byPlayer(0)!;
    records.commit(r);
    r.build = { talents: ['betrayer.c.1a', 'betrayer.a.1a'], q: 'field', e: 'shadowstep' };
    const saved = applyProgress(staked, records.state(r))!;
    expect(saved.characters.betrayer.talents).toEqual(['betrayer.c.1a', 'betrayer.a.1a']);
    r.build = { talents: ['betrayer.c.1a', 'betrayer.a.1a', 'betrayer.b.1a'], q: 'field', e: 'shadowstep' };
    expect(applyProgress(saved, records.state(r))!.characters.betrayer.talents).toEqual(['betrayer.c.1a', 'betrayer.a.1a']);
  });
  it('aborts before play with carry restored and no attempt/XP/victory', () => {
    const { records, r, staked } = setup();
    const state = records.settle(r, 'admissionAborted'), saved = applyProgress(staked, state)!;
    expect(saved.inventory[0]?.count).toBe(3); expect(saved.run).toBeNull(); expect(saved.stats).toEqual({ runs: 0, wins: 0 });
    expect(applyProgress(saved, state)).toBeNull();
  });
  it.each(['defeat', 'leave', 'hostLeft'] as const)('%s preserves XP and applies its exact carry rule', outcome => {
    const { records, r, staked } = setup(); records.commit(r); r.runXp = 1550;
    const state = records.settle(r, outcome), saved = applyProgress(staked, state)!;
    expect(saved.stats).toEqual({ runs: 1, wins: 0 }); expect(saved.characters.fallen.xp).toBe(1550);
    expect(saved.inventory[0]?.count ?? 0).toBe(outcome === 'hostLeft' ? 3 : 0);
  });
  it('victory commits once, post-win inventory uses newer revisions and a new run closes old context', () => {
    const { records, r, staked } = setup(); records.commit(r); r.runXp = 4000; r.inventory[0]!.count = 1;
    const win = records.settle(r, 'victory'), p = applyProgress(staked, win)!;
    expect(p.stats).toEqual({ runs: 1, wins: 1 }); expect(p.heavens.clears[1]).toBe(1); expect(p.heavens.unlocked).toEqual([1, 2]);
    expect(applyProgress(p, win)).toBeNull(); r.inventory[0] = null;
    const later = records.state(r), next = applyProgress(p, later)!;
    expect(next.inventory).toEqual([null, null]); expect(next.stats.wins).toBe(1); expect(applyProgress(next, win)).toBeNull();
    const another = new RunRecords('d'.repeat(32), true); const newStake = stakeProfile(next, another.reserve(0, 'fallen', next, true));
    expect(applyProgress(newStake, later)).toBeNull();
  });
  it('disposable admission and even its victory leave every persistent field intact', () => {
    const { p, records, r, staked } = setup(false); expect(staked).toEqual(p);
    records.commit(r); r.runXp = 9999; expect(applyProgress(p, records.settle(r, 'victory'))).toBeNull();
    const normal = setup(); expect(() => stakeProfile(normal.staked, { ...normal.admission, progressionEnabled: false })).toThrow('Recover');
  });
  it('cannot locally infer a refund from an uncommitted abandoned stake', () => {
    const { staked } = setup(); const p = abandonAttempt(staked);
    expect(p.inventory).toEqual([null, null]); expect(p.stats.runs).toBe(0);
  });
  it('does not restore charges with an aborted settlement after commitment', () => {
    const { records, r, staked } = setup(); const p = applyProgress(staked, records.commit(r))!;
    expect(() => records.settle(r, 'admissionAborted')).toThrow();
    const invalid: ProgressState = { ...records.state(r), admissionCommitted: false, outcome: 'admissionAborted' };
    expect(applyProgress(p, invalid)).toBeNull();
  });
  it('resumes retained accepted bases, refuses duplicate identities/classes and bounds completed recovery', () => {
    const { records, r, p } = setup(); records.commit(r); r.runXp = 123; r.wallet = 17;
    p.characters.fallen.xp = 9999; expect(records.reserve(0, 'fallen', p, false).kind).toBe('resume'); expect(r.xpBase).toBe(0);
    expect(() => records.reserve(1, 'binder', p, false)).toThrow();
    const other = createProfile('Other', 'c'.repeat(32)); expect(() => records.reserve(1, 'fallen', other, false)).toThrow();
    records.settle(r, 'victory'); const cache = new SettlementCache(); cache.save(records);
    expect(cache.get(runId, p.id)?.xp).toBe(123);
    for (let i = 1; i <= 16; i++) cache.save(new RunRecords(i.toString(16).padStart(32, '0'), true));
    expect(cache.get(runId, p.id)).toBeNull();
  });
});
