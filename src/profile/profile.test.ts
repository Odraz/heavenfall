import { describe, expect, it } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { copyInventory, storeItem, type Inventory } from '../data/items';
import { absolutionForXp, createProfile, importProfile, levelForXp, parseProfile, saturatingAdd, validateProfile, xpForLevel } from './model';
import { crc32, exportCode, importCode, exportFilename } from './codec';
import { PROFILE_KEY, ProfileSession, readProfile, writeProfile, type SaveStorage } from './storage';

const id = 'a'.repeat(32);
function profile() { return createProfile('Tomas', id, 100); }
class MemoryStorage implements SaveStorage {
  data = new Map<string, string>(); failKey = '';
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { if (k === this.failKey) throw new Error('Quota exceeded'); this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
const key = PROFILE_KEY;
describe('profile schema and compatibility', () => {
  it('roundtrips independent characters and two carried stacks', () => {
    const p = profile(); p.characters.binder.xp = 7500; p.inventory = [{ item: 'seal', count: 2 }, { item: 'seal', count: 1 }];
    expect(parseProfile(JSON.stringify(p)).profile).toEqual(p);
    expect(levelForXp(p.characters.binder.xp)).toBe(4); expect(levelForXp(p.characters.fallen.xp)).toBe(1);
  });
  it('keeps the exact curve, capped levels and safe counters', () => {
    expect(Array.from({ length: 9 }, (_, i) => xpForLevel(i + 2))).toEqual([1500, 4000, 7500, 12000, 17500, 24000, 31500, 40000, 49500]);
    expect(levelForXp(1499)).toBe(1); expect(levelForXp(Number.MAX_SAFE_INTEGER)).toBe(10);
    expect(absolutionForXp(59500)).toBe(1); expect(saturatingAdd(Number.MAX_SAFE_INTEGER, 1)).toBe(Number.MAX_SAFE_INTEGER);
  });
  it('drops removed content and resets only invalid character allocations, preserving XP', () => {
    const p = profile(); p.characters.binder.xp = 4000; p.characters.binder.talents = ['removed']; p.characters.binder.q = 'removed'; p.relics = ['usher', 'removed'];
    const result = validateProfile(p);
    expect(result.repaired).toBe(true); expect(result.profile.relics).toEqual(['usher']);
    expect(result.profile.characters.binder).toMatchObject({ xp: 4000, talents: [], q: 'chains' });
  });
  it('keeps a legal learned build and its assigned alternative, and resets one beyond the level', () => {
    const p = profile(); p.characters.betrayer.xp = 7500;
    Object.assign(p.characters.betrayer, { talents: ['betrayer.a.1a', 'betrayer.a.1b', 'betrayer.a.2b'], q: 'field', e: 'shadowstep' });
    expect(validateProfile(p)).toMatchObject({ repaired: false, profile: { characters: { betrayer: { talents: ['betrayer.a.1a', 'betrayer.a.1b', 'betrayer.a.2b'] } } } });
    p.characters.betrayer.talents.push('betrayer.a.3a'); p.characters.betrayer.q = 'judasCoin';
    // Four points need level 5 (12 000 XP): the save check resets the build, never the XP.
    const r = validateProfile(p);
    expect(r.repaired).toBe(true);
    expect(r.profile.characters.betrayer).toMatchObject({ xp: 7500, talents: [], q: 'field', e: 'shadowstep' });
    p.characters.betrayer.xp = 12000;
    expect(validateProfile(p).profile.characters.betrayer).toMatchObject({ talents: ['betrayer.a.1a', 'betrayer.a.1b', 'betrayer.a.2b', 'betrayer.a.3a'], q: 'judasCoin' });
  });
  it.each([NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects unsafe XP %s', n => {
    const p = profile(); p.characters.fallen.xp = n; expect(() => validateProfile(p)).toThrow();
  });
  it('rejects future/unknown schemas, malformed shapes, duplicate ids and oversized stacks', () => {
    expect(() => validateProfile({ ...profile(), schema: 2 })).toThrow('newer version');
    expect(() => validateProfile({ ...profile(), schema: 0 })).toThrow('Unsupported');
    expect(() => validateProfile({ ...profile(), surprise: true })).toThrow();
    const p = profile(); p.relics = ['usher', 'usher']; expect(() => validateProfile(p)).toThrow();
    p.relics = []; p.inventory = [{ item: 'seal', count: 3 }, null]; expect(() => validateProfile(p)).toThrow();
  });
  it('abandons imported stakes and assigns a new identity for a copy', () => {
    const p = profile(); p.characters.fallen.xp = 250;
    p.run = { runId: 'b'.repeat(32), admissionId: 1, admissionCommitted: true, heaven: 1, classId: 'fallen', xpBase: 0, carried: [{ item: 'balm', count: 3 }, null] };
    const imported = importProfile(p, [id], () => 'c'.repeat(32));
    expect(imported.copied).toBe(true); expect(imported.profile).toMatchObject({ id: 'c'.repeat(32), run: null, lastSettlement: null, inventory: [null, null] });
    expect(imported.profile.characters.fallen.xp).toBe(250); expect(p.run).not.toBeNull();
  });
  it('fills matching stacks before the lowest free slot without mutating a copied inventory', () => {
    const inventory: Inventory = [null, { item: 'balm', count: 2 }], copy = copyInventory(inventory);
    expect(storeItem(copy, 'balm')).toBe(true); expect(copy).toEqual([null, { item: 'balm', count: 3 }]);
    expect(storeItem(copy, 'seal')).toBe(true); expect(storeItem(copy, 'plume')).toBe(false);
    expect(inventory[1]?.count).toBe(2);
  });
});
describe('bounded raw-DEFLATE profile codes', () => {
  it('roundtrips compressed and portable codes with a stable CRC', async () => {
    expect(crc32('123456789')).toBe('cbf43926');
    expect(await importCode(await exportCode(profile()))).toEqual(profile());
    expect(await importCode(await exportCode(profile(), true), true)).toEqual(profile());
  });
  it('accepts externally generated raw-DEFLATE and refuses it safely without the codec', async () => {
    const part = deflateRawSync(JSON.stringify(profile())).toString('base64url'); const code = `MG1.${part}.${crc32(part)}`;
    expect(await importCode(code)).toEqual(profile());
    await expect(importCode(code, true)).rejects.toThrow('unavailable');
  });
  it('rejects a compressed expansion bomb before JSON parsing', async () => {
    const part = deflateRawSync(' '.repeat(300000)).toString('base64url');
    await expect(importCode(`MG1.${part}.${crc32(part)}`)).rejects.toThrow('256 KiB');
  });
  it('rejects excessive input, damaged checksums, invalid UTF-8 and future schemas', async () => {
    await expect(importCode('x'.repeat(65537))).rejects.toThrow('64 KiB');
    await expect(importCode((await exportCode(profile())).slice(0, -1) + 'z')).rejects.toThrow('checksum');
    for (const input of [Buffer.from([255]), Buffer.from(JSON.stringify({ ...profile(), schema: 2 }))]) {
      const part = deflateRawSync(input).toString('base64url'); await expect(importCode(`MG1.${part}.${crc32(part)}`)).rejects.toThrow();
    }
    expect(exportFilename({ ...profile(), name: '../<bad>' })).toBe('meatgrinder-____bad_.txt');
  });
});
describe('atomic profile storage boundaries', () => {
  it('keeps one save under the existing slot-1 key and leaves old slot 2-3 saves untouched (audit E5)', () => {
    expect(key).toBe('heavenfall.profile.1');
    const storage = new MemoryStorage(), p = profile();
    const legacy = JSON.stringify({ ...p, id: 'c'.repeat(32) });
    storage.setItem('heavenfall.profile.2', legacy);
    expect(readProfile(storage).profile).toBeNull();
    expect(writeProfile(storage, p)).toBe(true);
    expect(readProfile(storage).profile).toEqual(p);
    expect(storage.getItem('heavenfall.profile.2')).toBe(legacy);
  });
  it('backs up only a good main and recovers without overwriting corrupt data', () => {
    const storage = new MemoryStorage(), p = profile(); expect(writeProfile(storage, p)).toBe(true);
    p.stats.runs = 1; expect(writeProfile(storage, p)).toBe(true);
    storage.setItem(key, '{broken');
    expect(readProfile(storage)).toMatchObject({ profile: { stats: { runs: 0 } }, message: 'Recovered previous save' });
    const backup = storage.getItem(`${key}.bak`); expect(writeProfile(storage, p)).toBe(true); expect(storage.getItem(`${key}.bak`)).toBe(backup);
  });
  it('preserves a future main and both corrupt strings for recovery', () => {
    const storage = new MemoryStorage(); storage.setItem(key, JSON.stringify({ ...profile(), schema: 2 })); storage.setItem(`${key}.bak`, JSON.stringify(profile()));
    expect(readProfile(storage).message).toContain('newer version'); expect(writeProfile(storage, profile())).toBe(false);
    storage.setItem(key, 'bad'); storage.setItem(`${key}.bak`, 'also bad');
    expect(readProfile(storage)).toMatchObject({ profile: null, corrupt: true, raw: ['bad', 'also bad'] });
  });
  it('requires explicit recovery replacement and preserves originals before any destructive write', () => {
    const storage = new MemoryStorage(), raw = JSON.stringify({ ...profile(), schema: 2 });
    storage.setItem(key, raw); storage.setItem(`${key}.bak`, 'broken backup');
    const session = new ProfileSession(profile(), storage, { release() {} }, readProfile(storage));
    expect(session.save(profile(), true)).toBe(false); expect(storage.getItem(key)).toBe(raw);
    storage.failKey = `${key}.recovery`;
    expect(session.replace(profile())).toBe(false); expect(storage.getItem(key)).toBe(raw);
    storage.failKey = key;
    expect(session.replace(profile())).toBe(false); expect(session.recovery).not.toBeNull();
    storage.failKey = '';
    expect(session.replace(profile())).toBe(true); expect(session.recovery).toBeNull();
    expect(JSON.parse(storage.getItem(`${key}.recovery`)!)).toEqual([raw, 'broken backup']);
    expect(readProfile(storage).profile).toEqual(profile());
  });
  it('does not accept a failed stake but retains an accepted checkpoint in memory for export', () => {
    const storage = new MemoryStorage(), p = profile(); writeProfile(storage, p); storage.failKey = key;
    let released = false; const session = new ProfileSession(p, storage, { release: () => { released = true; } });
    const next = profile(); next.characters.binder.xp = 100;
    expect(session.save(next, true)).toBe(false); expect(session.profile.characters.binder.xp).toBe(0);
    expect(session.save(next)).toBe(false); expect(session.profile.characters.binder.xp).toBe(100);
    expect(parseProfile(storage.getItem(key)!).profile.characters.binder.xp).toBe(0);
    session.close(); expect(released).toBe(true); expect(() => session.save(next)).toThrow('released');
  });
});
