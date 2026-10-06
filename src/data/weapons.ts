/** Attacks and abilities per class (§6, M9 §2.3). */
import type { ClassId } from './classes';

const DEG = Math.PI / 180;

/**
 * How an attack resolves: hitscan rays (pellets), the censer projectile, Sacrament's heal on the
 * ally target, the Scourge's melee sweep, or the Silver Bullet's damage carried through a line (M9 §2.3).
 */
export type AttackKind = 'hitscan' | 'censer' | 'sacrament' | 'scourge' | 'silverBullet';

export interface WeaponDef {
  name: string;
  /** The class card's tooltip (M8 §2.4). */
  description: string;
  kind: AttackKind;
  /** Seconds between shots. */
  interval: number;
  pellets: number;
  /** Damage per hit; Sacrament's heal; the Silver Bullet's damage to carry. */
  damage: number;
  /** Uniform spread, ± radians. */
  spreadYaw: number;
  spreadPitch: number;
  /** Meters; the Scourge's reach from the body center. */
  range: number;
  /** Most enemies one ray (or one Scourge swing) hits (1 = stops at the first). */
  maxHits: number;
  /** Slows each enemy hit for this many seconds (0 = no slow). */
  slow: number;
}

/** Primary attacks, left mouse (M9 §2.3). */
export const WEAPONS: Record<ClassId, WeaponDef> = {
  fallen: { name: 'Brimstone Shotgun', description: '8 pellets of hellfire. Deadly up close, and blasts back what survives.', kind: 'hitscan', interval: 0.8, pellets: 8, damage: 12, spreadYaw: 8 * DEG, spreadPitch: 4 * DEG, range: 20, maxHits: 1, slow: 0 },
  heretic: { name: 'Censer Launcher', description: 'Fires a censer that breaks on the enemy it hits, leaving a cloud of incense that slowly burns the enemies inside.', kind: 'censer', interval: 1.0, pellets: 1, damage: 40, spreadYaw: 0, spreadPitch: 0, range: 25, maxHits: 1, slow: 0 },
  binder: { name: 'Chain Gun', description: 'Fast and accurate. Slows every enemy it hits.', kind: 'hitscan', interval: 1 / 12, pellets: 1, damage: 12, spreadYaw: 2 * DEG, spreadPitch: 2 * DEG, range: 40, maxHits: 1, slow: 1 },
  betrayer: { name: 'Silver Revolver', description: 'Fast, precise shots, one enemy at a time.', kind: 'hitscan', interval: 0.2, pellets: 1, damage: 40, spreadYaw: 0, spreadPitch: 0, range: 60, maxHits: 1, slow: 0 },
};

/** Secondary attacks, right mouse (M9 §2.3). */
export const SECONDARIES: Record<ClassId, WeaponDef> = {
  fallen: { name: 'Brimstone Slug', description: "One heavy slug for a single enemy out of the shotgun's reach.", kind: 'hitscan', interval: 1.0, pellets: 1, damage: 60, spreadYaw: 0, spreadPitch: 0, range: 50, maxHits: 1, slow: 0 },
  heretic: { name: 'Sacrament', description: 'Hold on the ally you aim at to heal them.', kind: 'sacrament', interval: 0.5, pellets: 1, damage: 10, spreadYaw: 0, spreadPitch: 0, range: 40, maxHits: 1, slow: 0 },
  binder: { name: 'Scourge', description: 'Swing your chain at the enemies in front of you, slowing them.', kind: 'scourge', interval: 0.8, pellets: 1, damage: 25, spreadYaw: 0, spreadPitch: 0, range: 3, maxHits: 6, slow: 1 },
  betrayer: { name: 'Silver Bullet', description: "A slow shot whose damage carries through every enemy in a line until it's spent.", kind: 'silverBullet', interval: 1.5, pellets: 1, damage: 300, spreadYaw: 0, spreadPitch: 0, range: 60, maxHits: Infinity, slow: 0 },
};

/** Which attack fires (M9 §2.1): none, the primary or the secondary. */
export const ATTACK_NONE = 0;
export const ATTACK_PRIMARY = 1;
export const ATTACK_SECONDARY = 2;
export type AttackSlot = typeof ATTACK_NONE | typeof ATTACK_PRIMARY | typeof ATTACK_SECONDARY;

/** The `fire` input's bits (M9 §10). */
export const FIRE_LEFT = 1;
export const FIRE_RIGHT = 2;
/** The right button was pressed after the left; used only while both are held. */
export const FIRE_RIGHT_LAST = 4;

/** The Scourge's arc: enemies within this angle of the horizontal aim, either side (M9 §2.6). */
export const SCOURGE_HALF_ARC = 60 * DEG;

/**
 * Picks the attack from the held buttons (M9 §2.1): the one pressed last while both are held; but
 * the Heretic's beam comes first whenever Sacrament can fire, and its right button doesn't count
 * as held when it can't.
 */
export function chooseAttack(classId: ClassId, fire: number, canSacrament: boolean): AttackSlot {
  const left = (fire & FIRE_LEFT) !== 0;
  let right = (fire & FIRE_RIGHT) !== 0;
  if (classId === 'heretic') {
    if (!canSacrament) right = false;
    if (right) return ATTACK_SECONDARY;
    return left ? ATTACK_PRIMARY : ATTACK_NONE;
  }
  if (left && right) return fire & FIRE_RIGHT_LAST ? ATTACK_SECONDARY : ATTACK_PRIMARY;
  return right ? ATTACK_SECONDARY : left ? ATTACK_PRIMARY : ATTACK_NONE;
}

/** The attack definition for a slot. */
export function attackDef(classId: ClassId, slot: AttackSlot): WeaponDef {
  return slot === ATTACK_SECONDARY ? SECONDARIES[classId] : WEAPONS[classId];
}

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
    Q: { name: 'Blasphemy', description: 'Every enemy within 12 m turns on you for 5 s.', cooldown: 12, movement: false, allyRange: 0, icon: 'icon-blasphemy' },
    E: { name: 'Falling Star', description: 'Aim at an ally and leap to them, dealing a little damage and hurling the enemies where you land into the air.', cooldown: 15, movement: true, allyRange: 30, icon: 'icon-falling-star' },
  },
  heretic: {
    Q: { name: 'Unholy Communion', description: 'Heals everyone within 15 m, you included.', cooldown: 4, movement: false, allyRange: 0, icon: 'icon-communion' },
    E: { name: "Martyr's Shroud", description: 'Shields the ally you aim at, or you. When enemies break it, it explodes.', cooldown: 10, movement: false, allyRange: 40, icon: 'icon-shroud' },
  },
  binder: {
    Q: { name: 'Chains of Tartarus', description: 'Pulls the enemies in front of you into a clump and binds them. Bound enemies take double damage.', cooldown: 8, movement: false, allyRange: 0, icon: 'icon-chains' },
    E: { name: 'Discord', description: "Silences every enemy around the point you aim at. Stops casters and the Gatekeeper's Judgment.", cooldown: 12, movement: false, allyRange: 0, icon: 'icon-discord' },
  },
  betrayer: {
    Q: { name: 'Field of Blood', description: 'Toss the thirty pieces just in front of you. Everyone standing in the field fires twice as fast.', cooldown: 30, movement: false, allyRange: 0, icon: 'icon-field-of-blood' },
    E: { name: 'Shadowstep', description: "Dash the way you're moving, invulnerable for a moment.", cooldown: 6, movement: true, allyRange: 0, icon: 'icon-shadowstep' },
  },
};

// Ability numbers (§6).
export const BLASPHEMY_RADIUS = 12;
export const BLASPHEMY_DURATION = 5;
export const FALLING_STAR_TIME = 0.4;
/** The landing's damage is small on purpose: the knockback is the point (M9 §3.2). */
export const FALLING_STAR_DAMAGE = 10;
export const FALLING_STAR_RADIUS = 5;
export const KNOCKBACK_DIST = 4;
/** Falling Star's knockback takes 0.4 s (M9 §3.2); others take 0.2 s (MVP §5.6). */
export const FALLING_STAR_KNOCKBACK_TIME = 0.4;
export const KNOCKBACK_TIME = 0.2;
/** The shotgun knocks back survivors within 6 m of the Fallen by 2 m, once per shot (M9 §3.1). */
export const SHOTGUN_KNOCKBACK_DIST = 2;
export const SHOTGUN_KNOCKBACK_RANGE = 6;
export const COMMUNION_RADIUS = 15;
export const COMMUNION_HEAL = 80;
export const SHROUD_AMOUNT = 150;
export const SHROUD_DURATION = 8;
/** A shield broken by damage bursts for 50 to the 8 nearest enemies within 5 m (M9 §3.3). */
export const SHROUD_BURST_DAMAGE = 50;
export const SHROUD_BURST_RADIUS = 5;
export const SHROUD_BURST_MAX = 8;
export const CHAINS_RANGE = 20;
export const CHAINS_ANGLE = 30 * DEG;
export const CHAINS_STEP = 0.25;
export const CHAINS_MAX = 5;
export const CHAINS_PULL_TIME = 0.3;
export const CHAINS_ROOT = 1.5;
export const DISCORD_RANGE = 40;
export const DISCORD_RADIUS = 8;
export const DISCORD_SILENCE = 4;
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
// The censer breaks on what it hits, 40 dmg to that enemy only, and leaves an incense cloud (M9 §2.8):
// 2.5 dmg every 0.5 s to every enemy within 2.5 m for 4 s, not stacking, at most 4 clouds. (Its
// splash, last 20 dmg to the 8 nearest within 2.5 m, made the healer a grenade launcher.)
export const CLOUD_RADIUS = 2.5;
export const CLOUD_TIME = 4;
export const CLOUD_DAMAGE = 2.5;
export const CLOUD_PULSE_TICKS = 15;
export const CLOUD_MAX = 4;

export const SLOW_FACTOR = 0.7;
