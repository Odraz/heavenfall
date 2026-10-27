/** The Gate's continuous W-facing frame, shared by all four facings (rogue rooms.md §2.2). */
import type { GateDef } from '../data/dungeons/types';
import type { GameMap } from './map';

/** Rotate a canonical vector: +x faces the room; +y runs along the gate. */
export function gateVector(g: GateDef, x: number, y: number): [number, number] {
  switch (g.facing) {
    case 'W': return [x, y];
    case 'N': return [-y, x];
    case 'E': return [-x, -y];
    case 'S': return [y, -x];
  }
}

/** A point relative to the wall plane and its center line, in world coordinates. */
export function gatePoint(g: GateDef, x: number, y: number): [number, number] {
  const [dx, dy] = gateVector(g, x, y);
  const vertical = g.facing === 'W' || g.facing === 'E';
  return [dx + (vertical ? g.plane : g.uCenter), dy + (vertical ? g.uCenter : g.plane)];
}

/** World coordinates back to offsets in the canonical frame. */
export function gateLocal(g: GateDef, x: number, y: number): [number, number] {
  const vertical = g.facing === 'W' || g.facing === 'E';
  const dx = x - (vertical ? g.plane : g.uCenter);
  const dy = y - (vertical ? g.uCenter : g.plane);
  switch (g.facing) {
    case 'W': return [dx, dy];
    case 'N': return [dy, -dx];
    case 'E': return [-dx, -dy];
    case 'S': return [-dy, dx];
  }
}

/** The plane may be just beyond E/S's last cell; always sample the adjacent interior floor. */
export function gateFloor(map: GameMap): number {
  const g = map.gate!;
  const [x, y] = gatePoint(g, 0.5, 0);
  return map.floor[Math.floor(y) * map.w + Math.floor(x)];
}

/** Cell-space terrain outside the continuous plane, replaced by the painted Gate. */
export function gateOutside(g: GateDef, c: number, r: number): boolean {
  const vertical = g.facing === 'W' || g.facing === 'E';
  const u = vertical ? r : c;
  if (u < g.u0 || u >= g.u1) return false;
  switch (g.facing) {
    case 'W': return c < g.plane;
    case 'N': return r < g.plane;
    case 'E': return c >= g.plane;
    case 'S': return r >= g.plane;
  }
}
