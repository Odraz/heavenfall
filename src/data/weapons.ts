/** Primary weapons and abilities per class (§6). */
import type { ClassId } from './classes';

const DEG = Math.PI / 180;

export interface WeaponDef {
  name: string;
  /** Seconds between shots. */
  interval: number;
  /** Hitscan weapons; the Censer Launcher fires a projectile instead. */
  hitscan: boolean;
  pellets: number;
  damage: number;
  /** Uniform spread, ± radians. */
  spreadYaw: number;
  spreadPitch: number;
  range: number;
  /** Most enemies one ray hits (1 = stops at the first). */
  maxHits: number;
  /** Slows each enemy hit for this many seconds (0 = no slow). */
  slow: number;
  /** First-person sprite. */
  sprite: string;
}

export const WEAPONS: Record<ClassId, WeaponDef> = {
  fallen: { name: 'Brimstone Shotgun', interval: 0.9, hitscan: true, pellets: 8, damage: 10, spreadYaw: 8 * DEG, spreadPitch: 4 * DEG, range: 20, maxHits: 1, slow: 0, sprite: 'weapon-shotgun' },
  heretic: { name: 'Censer Launcher', interval: 1.0, hitscan: false, pellets: 1, damage: 40, spreadYaw: 0, spreadPitch: 0, range: 25, maxHits: 1, slow: 0, sprite: 'weapon-censer' },
  binder: { name: 'Chain Gun', interval: 0.1, hitscan: true, pellets: 1, damage: 12, spreadYaw: 2 * DEG, spreadPitch: 2 * DEG, range: 40, maxHits: 1, slow: 1, sprite: 'weapon-chaingun' },
  betrayer: { name: 'Silver Revolver', interval: 0.35, hitscan: true, pellets: 1, damage: 60, spreadYaw: 0, spreadPitch: 0, range: 60, maxHits: 3, slow: 0, sprite: 'weapon-revolver' },
};

export interface AbilityDef {
  name: string;
  /** Seconds. */
  cooldown: number;
  /** Executed by the client (Falling Star, Shadowstep). */
  movement: boolean;
  /** Uses an ally target, with this range (0 = none). */
  allyRange: number;
  icon: string;
}

export const ABILITIES: Record<ClassId, { Q: AbilityDef; E: AbilityDef }> = {
  fallen: {
    Q: { name: 'Blasphemy', cooldown: 12, movement: false, allyRange: 0, icon: 'icon-blasphemy' },
    E: { name: 'Falling Star', cooldown: 15, movement: true, allyRange: 30, icon: 'icon-falling-star' },
  },
  heretic: {
    Q: { name: 'Unholy Communion', cooldown: 4, movement: false, allyRange: 0, icon: 'icon-communion' },
    E: { name: "Martyr's Shroud", cooldown: 10, movement: false, allyRange: 40, icon: 'icon-shroud' },
  },
  binder: {
    Q: { name: 'Chains of Tartarus', cooldown: 10, movement: false, allyRange: 0, icon: 'icon-chains' },
    E: { name: 'Discord', cooldown: 12, movement: false, allyRange: 0, icon: 'icon-discord' },
  },
  betrayer: {
    Q: { name: 'Kiss of Betrayal', cooldown: 10, movement: false, allyRange: 0, icon: 'icon-kiss' },
    E: { name: 'Shadowstep', cooldown: 6, movement: true, allyRange: 0, icon: 'icon-shadowstep' },
  },
};

// Ability numbers (§6).
export const BLASPHEMY_RADIUS = 15;
export const BLASPHEMY_DURATION = 5;
export const FALLING_STAR_TIME = 0.4;
export const FALLING_STAR_DAMAGE = 30;
export const FALLING_STAR_RADIUS = 5;
export const KNOCKBACK_DIST = 4;
export const KNOCKBACK_TIME = 0.2;
export const COMMUNION_RADIUS = 15;
export const COMMUNION_HEAL = 80;
export const SHROUD_AMOUNT = 150;
export const SHROUD_DURATION = 8;
export const CHAINS_RANGE = 20;
export const CHAINS_ANGLE = 30 * DEG;
export const CHAINS_STEP = 0.25;
export const CHAINS_MAX = 5;
export const CHAINS_PULL_TIME = 0.3;
export const CHAINS_ROOT = 1.5;
export const DISCORD_RANGE = 40;
export const DISCORD_RADIUS = 8;
export const DISCORD_SILENCE = 4;
export const KISS_RANGE = 50;
export const KISS_DURATION = 6;
export const SHADOWSTEP_SPEED = 40;
export const SHADOWSTEP_TIME = 0.2;
export const SHADOWSTEP_INVULN = 0.5;
/** Movement abilities are accepted when the cooldown has this much or less remaining (§9.3). */
export const MOVEMENT_GRACE = 0.25;
/** The speed check is skipped this long after an accepted movement ability (§9.3). */
export const MOVEMENT_SPEED_CHECK_SKIP = 0.6;
export const ALLY_TARGET_ANGLE = 10 * DEG;

// Censer projectile (§6.2).
export const CENSER_SPEED = 20;
export const CENSER_RADIUS = 0.2;
export const CENSER_BLAST = 3;

export const SLOW_FACTOR = 0.7;
