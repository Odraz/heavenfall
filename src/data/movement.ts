/** Ordinary movement is slower when travelling against the direction of aim (0.8 → 0.7 after the R06 follow-up). */
export const BACKPEDAL_SPEED_FACTOR = 0.7;
export function directionalSpeedFactor(yaw: number, dx: number, dy: number): number {
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return 1;
  const backward = Math.max(0, -(Math.cos(yaw) * dx + Math.sin(yaw) * dy) / length);
  return 1 - (1 - BACKPEDAL_SPEED_FACTOR) * backward;
}
