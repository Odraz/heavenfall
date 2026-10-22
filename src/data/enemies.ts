/** Enemy type IDs, as encoded in snapshots (§9.4). */
export const BLESSED = 0;
export const CHORISTER = 1;
export const CHERUB = 2;
export const GATEKEEPER = 3;
export const DOMINION = 4;
/** 5 is reserved for the Gatekeeper's generic boss parts. */
export const CANTOR = 6;
export const CARRIER = 7;
/** An armed Blessed with an instant line-of-sight shot (rooms.md §6.4). */
export const WATCHMAN = 8;
export function isCommander(type: number): boolean { return type === DOMINION || type === CANTOR || type === CARRIER; }

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
  /**
   * The shot volume (R06 follow-up §5): what shots, hit markers and bots test, matching the drawn sprite;
   * movement and crowding keep `radius`/`height`. A cylinder of `radius`, from `base` (≤ 0) below the
   * feet up to `top` above them. Measured from each atlas's main pose at its `draw` scale: radius about
   * 0.4 × the median drawn width (never under the body's), top and base from the median frame.
   */
  shot: { radius: number; base: number; top: number };
}

/** Indexed by enemy type ID. */
export const ENEMIES: readonly EnemyDef[] = [
  // Blessed: §7.1 says 6 m/s; lowered to 4 after playtesting so every class can outrun them (decisions.md).
  { hp: 20, radius: 0.35, height: 1.6, speed: 4, flying: false, draw: 1, shot: { radius: 0.35, base: 0, top: 1.75 } },
  // Choristers and Cherubs are drawn bigger, to stand out in a crowd (M12 follow-up §1.2): the
  // Chorister 2.4 m tall (was 2.0). The radius stays under half a cell for movement, and the Cherub
  // keeps its 0.8 m, which sets the levels' headroom (heights.ts), so the walls don't change.
  { hp: 60, radius: 0.45, height: 2.4, speed: 3, flying: false, draw: 1.2, shot: { radius: 0.45, base: 0, top: 2.45 } },
  { hp: 30, radius: 0.4, height: 0.8, speed: 7, flying: true, draw: 1.15, shot: { radius: 0.6, base: 0, top: 1.2 } },
  // The Gatekeeper: 29 000 HP (M9 §4; M8's 45 000): Field of Blood replaced Kiss, and party damage on
  // one target fell to about 64% of M8's.
  { hp: 29000, radius: 2.0, height: 6.0, speed: 0, flying: false, draw: 1, shot: { radius: 2.0, base: 0, top: 6.0 } },
  { hp: 1500, radius: 0.45, height: 3.2, speed: 3.5, flying: false, draw: 1.9, shot: { radius: 0.85, base: 0, top: 3.3 } },
  { hp: 1, radius: 0.4, height: 1, speed: 0, flying: false, draw: 1, shot: { radius: 0.4, base: 0, top: 1 } }, // reserved boss part
  { hp: 1200, radius: 0.45, height: 3, speed: 2.5, flying: false, draw: 1.4, shot: { radius: 0.7, base: 0, top: 3.3 } },
  // The Carrier's sprite hangs about 2 m below its feet point (its talons and a carried player).
  { hp: 1000, radius: 0.4, height: 0.8, speed: 5, flying: true, draw: 2.5, shot: { radius: 1.25, base: -2.1, top: 2.5 } },
  // The Watchman (rooms.md §6.4): a Blessed's body, so it moves and wades in the crowd like one. 80 HP after the 2026-10-16 playtest (was 60).
  { hp: 80, radius: 0.35, height: 1.8, speed: 3.5, flying: false, draw: 1.15, shot: { radius: 0.35, base: 0, top: 2.5 } },
];

/** Falling Star's launched walking enemies fly an arc this high (M9 §3.2); drawn only. */
export const LAUNCH_HEIGHT = 1;

/** Cherubs hover with their feet this far above the ground height. */
export const CHERUB_HOVER = 4;
/** Maximum vertical speed of hovering, m/s. */
export const CHERUB_CLIMB = 6;
