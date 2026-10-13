import { parseProfile, validateProfile, type Profile } from './model';

export type ProfileSlot = 1 | 2 | 3;
export const PROFILE_SLOTS: readonly ProfileSlot[] = [1, 2, 3];
export const profileKey = (slot: ProfileSlot): string => `heavenfall.profile.${slot}`;
export const STORAGE_WARNING = 'Progress is in memory; export before closing';
export interface SaveStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export interface ProfileRead { profile: Profile | null; message: string; raw: [string | null, string | null]; corrupt: boolean }
export function readProfile(storage: SaveStorage, slot: ProfileSlot): ProfileRead {
  const raw: ProfileRead['raw'] = [null, null];
  for (let i = 0; i < 2; i++) {
    try { raw[i] = storage.getItem(profileKey(slot) + (i ? '.bak' : '')); }
    catch { return { profile: null, message: STORAGE_WARNING, raw, corrupt: true }; }
  }
  for (let i = 0; i < 2; i++) {
    if (raw[i] === null) continue;
    try {
      const { profile, repaired } = parseProfile(raw[i]!);
      return { profile, message: i ? 'Recovered previous save' : repaired ? 'Unavailable content removed; character talents reset where needed' : '', raw, corrupt: false };
    } catch (error) {
      // A future main is intentional data, not corruption; don't silently roll back to an old backup.
      if (error instanceof Error && error.message.includes('newer version')) return { profile: null, message: error.message, raw, corrupt: true };
    }
  }
  const corrupt = raw.some(x => x !== null);
  return { profile: null, message: corrupt ? 'Cannot read this profile; export the original data for recovery' : '', raw, corrupt };
}

/** The caller must own the exclusive Web Lock for this slot throughout this synchronous write. */
export function writeProfile(storage: SaveStorage, slot: ProfileSlot, profile: Profile): boolean {
  try {
    const next = JSON.stringify(validateProfile(profile).profile);
    // Roundtrip applies the same size bound as reads; no write can create an unreadable save.
    parseProfile(next);
    const key = profileKey(slot), previous = storage.getItem(key);
    if (previous !== null) {
      try { parseProfile(previous); }
      catch (error) {
        if (error instanceof Error && error.message.includes('newer version')) return false;
        storage.setItem(key, next); return true; // Preserve the existing known-good backup.
      }
      storage.setItem(`${key}.bak`, previous);
    }
    storage.setItem(key, next);
    return true;
  } catch { return false; }
}
export interface ProfileLock { release(): void }
export async function lockProfile(slot: ProfileSlot, locks: LockManager | undefined = navigator.locks): Promise<ProfileLock> {
  if (!locks) throw new Error('A secure-context browser with Web Locks is required for persistent profiles');
  return new Promise((resolve, reject) => {
    void locks.request(profileKey(slot), { ifAvailable: true }, lock => {
      if (!lock) { reject(new Error('Open in another tab')); return; }
      return new Promise<void>(release => resolve({ release }));
    }).catch(reject);
  });
}
/** A session exposes accepted memory state even when an ordinary checkpoint cannot reach disk. */
export class ProfileSession {
  message = '';
  private closed = false;
  constructor(readonly slot: ProfileSlot, public profile: Profile, private readonly storage: SaveStorage, private readonly lock: ProfileLock) {}
  save(next: Profile, durable = false): boolean {
    if (this.closed) throw new Error('Profile lock released');
    const validated = validateProfile(next).profile;
    const saved = writeProfile(this.storage, this.slot, validated);
    if (saved || !durable) this.profile = validated;
    this.message = saved ? '' : STORAGE_WARNING;
    return saved;
  }
  close(): void { if (!this.closed) { this.closed = true; this.lock.release(); } }
}
