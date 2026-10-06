/** The sun (M10 §5.2): one fixed direction for all levels. */

/** Degrees above the horizon. */
export const SUN_ELEVATION_DEG = 35;

/**
 * The horizontal direction toward the sun in map coordinates (x east, y south): north-east, so it
 * shines in through the most arcades of the Pearly Gates.
 */
export const SUN_DIR_X = Math.SQRT1_2;
export const SUN_DIR_Y = -Math.SQRT1_2;

/** The sun's azimuth in three.js space (three.x = x, three.z = y), as atan2(z, x). */
export const SUN_AZIMUTH = Math.atan2(SUN_DIR_Y, SUN_DIR_X);
