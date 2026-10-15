/** The persistent profile in browser storage (rogue game.md §2.4): one save, a backup and a Web Lock. */
import { createProfile, parseProfile, validateProfile, type Profile } from './model';

/**
 * The one save key. It keeps the `.1` from R03 stage 2's three-slot screen so existing saves load;
 * that screen's slots 2 and 3 are no longer read (audit E5).
 */
export const PROFILE_KEY = 'heavenfall.profile.1';
const BACKUP_KEY = `${PROFILE_KEY}.bak`;
const RECOVERY_KEY = `${PROFILE_KEY}.recovery`;

export const STORAGE_WARNING = 'Progress is in memory; export before closing';

export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ProfileRead {
  profile: Profile | null;
  message: string;
  /** The main and backup strings as found, kept for recovery. */
  raw: [string | null, string | null];
  corrupt: boolean;
}

export async function openCurrentProfile(name: string, storage: SaveStorage = localStorage, recovery = false): Promise<ProfileSession> {
  const lock = await lockProfile();
  try {
    const read = readProfile(storage);
    if (read.corrupt) {
      if (!recovery || !read.raw.some((x) => x !== null)) throw new Error(read.message);
      return new ProfileSession(createProfile(name), storage, lock, read);
    }
    const profile = read.profile ?? createProfile(name);
    profile.name = name;
    if (!writeProfile(storage, profile)) throw new Error('Cannot save this profile');
    return new ProfileSession(profile, storage, lock);
  } catch (error) {
    lock.release();
    throw error;
  }
}

/** Reads the main save, falling back to the backup; never repairs storage itself. */
export function readProfile(storage: SaveStorage): ProfileRead {
  const raw: ProfileRead['raw'] = [null, null];
  const keys = [PROFILE_KEY, BACKUP_KEY];
  for (let i = 0; i < 2; i++) {
    try {
      raw[i] = storage.getItem(keys[i]);
    } catch {
      return { profile: null, message: STORAGE_WARNING, raw, corrupt: true };
    }
  }
  for (let i = 0; i < 2; i++) {
    if (raw[i] === null) continue;
    try {
      const { profile, repaired } = parseProfile(raw[i]!);
      const message = i ? 'Recovered previous save' : repaired ? 'Unavailable content removed; character talents reset where needed' : '';
      return { profile, message, raw, corrupt: false };
    } catch (error) {
      // A future main is intentional data, not corruption; don't silently roll back to an old backup.
      if (error instanceof Error && error.message.includes('newer version')) return { profile: null, message: error.message, raw, corrupt: true };
    }
  }
  const corrupt = raw.some((x) => x !== null);
  return { profile: null, message: corrupt ? 'Cannot read this profile; export the original data for recovery' : '', raw, corrupt };
}

/** The caller must own the exclusive Web Lock throughout this synchronous write. */
export function writeProfile(storage: SaveStorage, profile: Profile): boolean {
  try {
    const next = JSON.stringify(validateProfile(profile).profile);
    // Roundtrip applies the same size bound as reads; no write can create an unreadable save.
    parseProfile(next);
    const previous = storage.getItem(PROFILE_KEY);
    if (previous !== null) {
      try {
        parseProfile(previous);
      } catch (error) {
        if (error instanceof Error && error.message.includes('newer version')) return false;
        // Preserve the existing known-good backup.
        storage.setItem(PROFILE_KEY, next);
        return true;
      }
      storage.setItem(BACKUP_KEY, previous);
    }
    storage.setItem(PROFILE_KEY, next);
    return true;
  } catch {
    return false;
  }
}

export interface ProfileLock { release(): void }

/** One tab at a time owns the profile. */
export async function lockProfile(locks: LockManager | undefined = navigator.locks): Promise<ProfileLock> {
  if (!locks) throw new Error('A secure-context browser with Web Locks is required for persistent profiles');
  return new Promise((resolve, reject) => {
    void locks.request(PROFILE_KEY, { ifAvailable: true }, (lock) => {
      if (!lock) {
        reject(new Error('Open in another tab'));
        return;
      }
      return new Promise<void>((release) => resolve({ release }));
    }).catch(reject);
  });
}

/** A session exposes accepted memory state even when an ordinary checkpoint cannot reach disk. */
export class ProfileSession {
  message = '';
  private closed = false;

  constructor(public profile: Profile, private readonly storage: SaveStorage, private readonly lock: ProfileLock, public recovery: ProfileRead | null = null) {}

  save(next: Profile, durable = false): boolean {
    if (this.closed) throw new Error('Profile lock released');
    if (this.recovery) {
      this.message = this.recovery.message;
      return false;
    }
    const validated = validateProfile(next).profile;
    const saved = writeProfile(this.storage, validated);
    if (saved || !durable) this.profile = validated;
    this.message = saved ? '' : STORAGE_WARNING;
    return saved;
  }

  /** Explicit, confirmed replacement can recover unreadable data without silently erasing it. */
  replace(next: Profile): boolean {
    if (!this.recovery) return this.save(next, true);
    if (this.closed) throw new Error('Profile lock released');
    try {
      const validated = parseProfile(JSON.stringify(validateProfile(next).profile)).profile;
      // Keep both original strings before replacing even a newer-schema save.
      this.storage.setItem(RECOVERY_KEY, JSON.stringify(this.recovery.raw));
      this.storage.setItem(PROFILE_KEY, JSON.stringify(validated));
      this.profile = validated;
      this.recovery = null;
      this.message = '';
      return true;
    } catch {
      this.message = STORAGE_WARNING;
      return false;
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.lock.release();
  }
}
