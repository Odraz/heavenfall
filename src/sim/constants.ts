export const TICK_HZ = 30;
export const TICK_DT = 1 / TICK_HZ;
export const TICK_MS = 1000 / TICK_HZ;
/** At most this many ticks per worker loop iteration; the rest of the backlog is discarded. */
export const MAX_TICKS_PER_LOOP = 5;

export const GRAVITY = 20;
export const JUMP_VZ = 7;
export const STEP_UP = 0.5;
export const SUBSTEP = 0.25;
export const WALL_TOP = 16;
export const HEIGHT_STEP = 0.25;
export const MAX_MAP_SIZE = 256;

export const PLAYER_RADIUS = 0.4;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE = 1.6;

export const MAX_LIVING_ENEMIES = 1500;
export const ENEMY_SLOTS = 4096;
export const PROJECTILE_SLOTS = 1024;
/** A freed slot isn't reused for 1 s. */
export const SLOT_REUSE_TICKS = 30;

/** Comparison tolerance for heights. */
export const EPS = 1e-6;
