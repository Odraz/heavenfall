/** Ray and swept-segment tests against vertical cylinders (§5.3, §5.4). Shared by the host and the client's cosmetic rays. */

/**
 * Distance along a ray (unit direction) to where it enters a vertical cylinder with its feet at
 * (cx, cy, cz), radius r and height h; 0 if the origin is inside, Infinity if it misses.
 */
export function rayCylinder(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  cx: number,
  cy: number,
  cz: number,
  r: number,
  h: number,
): number {
  const hx = ox - cx;
  const hy = oy - cy;
  const top = cz + h;
  const c = hx * hx + hy * hy - r * r;
  if (c <= 0 && oz >= cz && oz <= top) return 0;
  let best = Infinity;
  const a = dx * dx + dy * dy;
  if (a > 1e-12) {
    const b = 2 * (hx * dx + hy * dy);
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t >= 0) {
        const z = oz + dz * t;
        if (z >= cz && z <= top) best = t;
      }
    }
  }
  if (Math.abs(dz) > 1e-12) {
    for (const zc of [cz, top]) {
      const t = (zc - oz) / dz;
      if (t < 0 || t >= best) continue;
      const x = hx + dx * t;
      const y = hy + dy * t;
      if (x * x + y * y <= r * r) best = t;
    }
  }
  return best;
}

/** Unit aim direction from yaw and pitch (§2.3). */
export function aimDir(yaw: number, pitch: number): [number, number, number] {
  const cp = Math.cos(pitch);
  return [cp * Math.cos(yaw), cp * Math.sin(yaw), Math.sin(pitch)];
}
