/** Enemy type IDs, as encoded in snapshots (§9.4). */
export const BLESSED = 0;
export const CHORISTER = 1;
export const CHERUB = 2;
export const GATEKEEPER = 3;

/** Enemy states, as encoded in snapshots (§9.4). */
export const ST_IDLE = 0;
export const ST_MOVING = 1;
export const ST_WINDUP = 2;
export const ST_ATTACKING = 3;
export const ST_FALLING = 4;

export interface EnemyDef {
  hp: number;
  radius: number;
  height: number;
  /** m/s */
  speed: number;
  flying: boolean;
  /** The sprite is drawn this many times its atlas size, from its feet (M12 follow-up §1.2). */
  draw: number;
}

/** Indexed by enemy type ID. */
export const ENEMIES: readonly EnemyDef[] = [
  // Blessed: §7.1 says 6 m/s; lowered to 4 after playtesting so every class can outrun them (decisions.md).
  { hp: 20, radius: 0.35, height: 1.6, speed: 4, flying: false, draw: 1 },
  // Choristers and Cherubs are drawn bigger, to stand out in a crowd (M12 follow-up §1.2): the
  // Chorister 2.4 m tall (was 2.0). The radius stays under half a cell for movement, and the Cherub
  // keeps its 0.8 m, which sets the levels' headroom (heights.ts), so the walls don't change.
  { hp: 60, radius: 0.45, height: 2.4, speed: 3, flying: false, draw: 1.2 },
  { hp: 30, radius: 0.4, height: 0.8, speed: 7, flying: true, draw: 1.15 },
  // The Gatekeeper: 29 000 HP (M9 §4; M8's 45 000): Field of Blood replaced Kiss, and party damage on
  // one target fell to about 64% of M8's.
  { hp: 29000, radius: 2.0, height: 6.0, speed: 0, flying: false, draw: 1 },
];

/** Falling Star's launched walking enemies fly an arc this high (M9 §3.2); drawn only. */
export const LAUNCH_HEIGHT = 1;

/** Cherubs hover with their feet this far above the ground height. */
export const CHERUB_HOVER = 4;
/** Maximum vertical speed of hovering, m/s. */
export const CHERUB_CLIMB = 6;
