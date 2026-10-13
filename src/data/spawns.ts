/** Accepted one-second safe-spawn warning; no persistent marker is created by a floor fallback. */
export const SPAWN_WARNING_TICKS = 30;
export const SPAWN_WARNING_CAP = 64;
export interface SpawnWarning { id: number; room: number; x: number; y: number; z: number; startTick: number; readyTick: number }
