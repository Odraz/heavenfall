/** Primary weapons and abilities per class (§6). */
import type { ClassId } from './classes';

const DEG = Math.PI / 180;

export interface WeaponDef {
  name: string;
  /** The class card's tooltip (M8 §2.4). */
  description: string;
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
}

export const WEAPONS: Record<ClassId, WeaponDef> = {
  fallen: { name: 'Brimstone Shotgun', description: '8 pellets of hellfire. Deadly up close.', interval: 0.9, hitscan: true, pellets: 8, damage: 10, spreadYaw: 8 * DEG, spreadPitch: 4 * DEG, range: 20, maxHits: 1, slow: 0 },
  heretic: { name: 'Censer Launcher', description: 'Fires a censer that bursts on impact, hitting the enemies around it.', interval: 1.0, hitscan: false, pellets: 1, damage: 40, spreadYaw: 0, spreadPitch: 0, range: 25, maxHits: 1, slow: 0 },
  binder: { name: 'Chain Gun', description: 'Fast and accurate. Slows every enemy it hits.', interval: 0.1, hitscan: true, pellets: 1, damage: 12, spreadYaw: 2 * DEG, spreadPitch: 2 * DEG, range: 40, maxHits: 1, slow: 1 },
  betrayer: { name: 'Silver Revolver', description: 'Each shot pierces up to 6 enemies.', interval: 0.35, hitscan: true, pellets: 1, damage: 60, spreadYaw: 0, spreadPitch: 0, range: 60, maxHits: 3, slow: 0 },
};

export interface AbilityDef {
  name: string;
  /** The class card's tooltip (M8 §2.4). */
  description: string;
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
    Q: { name: 'Blasphemy', description: 'Every enemy within 15 m turns on you for 5 s.', cooldown: 12, movement: false, allyRange: 0, icon: 'icon-blasphemy' },
    E: { name: 'Falling Star', description: 'Aim at an ally and leap to them, smashing and scattering the enemies where you land.', cooldown: 15, movement: true, allyRange: 30, icon: 'icon-falling-star' },
  },
  heretic: {
    Q: { name: 'Unholy Communion', description: 'Heals everyone within 15 m, you included.', cooldown: 4, movement: false, allyRange: 0, icon: 'icon-communion' },
    E: { name: "Martyr's Shroud", description: 'Shields the ally you aim at. With no ally aimed at, shields you.', cooldown: 10, movement: false, allyRange: 40, icon: 'icon-shroud' },
  },
  binder: {
    Q: { name: 'Chains of Tartarus', description: 'Pulls the enemies in front of you into a clump and binds them. Bound enemies take double damage.', cooldown: 10, movement: false, allyRange: 0, icon: 'icon-chains' },
    E: { name: 'Discord', description: "Silences every enemy around the point you aim at. Stops casters and the Gatekeeper's Judgment.", cooldown: 12, movement: false, allyRange: 0, icon: 'icon-discord' },
  },
  betrayer: {
    Q: { name: 'Kiss of Betrayal', description: 'Marks the enemy under your crosshair: it takes triple damage from everyone.', cooldown: 10, movement: false, allyRange: 0, icon: 'icon-kiss' },
    E: { name: 'Shadowstep', description: "Dash the way you're moving, invulnerable for a moment.", cooldown: 6, movement: true, allyRange: 0, icon: 'icon-shadowstep' },
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

// Censer projectile (§6.2).
export const CENSER_SPEED = 20;
export const CENSER_RADIUS = 0.2;
// §6.2 says 40 dmg to all within 3 m; changed after playtesting to 40 for the enemy hit directly
// and 10 splash to the 6 nearest others within 2 m (decisions.md).
export const CENSER_BLAST = 2;
export const CENSER_SPLASH_DAMAGE = 10;
export const CENSER_SPLASH_MAX = 6;

export const SLOW_FACTOR = 0.7;
