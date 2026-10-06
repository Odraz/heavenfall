/**
 * Baked lighting (M10 §5.2): computed once when the level is built. A floor lightmap at 4 texels per
 * meter (sun and shadow, and ambient occlusion at wall feet), the shading of vertical faces by their
 * direction, and the shadow line on every sun-facing face.
 */
import { raycastTerrain } from '../sim/los';
import type { GameMap } from '../sim/map';
import { K_DOOR, K_FLOOR } from '../sim/heights';
import { SUN_DIR_X, SUN_DIR_Y, SUN_ELEVATION_DEG } from './sun';

/** Lightmap texels per meter. */
export const LIGHTMAP_TEXELS = 4;

const EL = (SUN_ELEVATION_DEG * Math.PI) / 180;
/** The unit direction toward the sun, map coordinates (x east, y south, z up). */
export const SUN = { x: SUN_DIR_X * Math.cos(EL), y: SUN_DIR_Y * Math.cos(EL), z: Math.sin(EL) };

/** Light colors (linear): warm in the sun, cool in shadow. The darkest floor (shadow and full ambient
 * occlusion) keeps at least 60% of the lit floor's luminance (M10 §5.2). */
export const LIT: readonly [number, number, number] = [1.0, 0.95, 0.85];
export const SHADE: readonly [number, number, number] = [0.66, 0.71, 0.82];
/** Ambient occlusion: up to this much darker at the foot of a cell rising more than AO_RISE above. */
const AO_MAX = 0.15;
const AO_RISE = 0.5;
const AO_REACH = 1;
/** The shader multiplies the light by this, so the lit floor is about as bright as before. */
export const LIGHT_GAIN = 1.1;

export const lum = (c: readonly number[]): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
/** The darkest floor's luminance relative to the lit floor's. */
export const DARKEST = (lum(SHADE) * (1 - AO_MAX)) / lum(LIT);

/** The heightfield the sun's rays test: walls, pillars, parapets and closed doors at their heights. */
function blockers(map: GameMap): GameMap {
  return { ...map, top: map.heights.height };
}

let maxTopCache = new WeakMap<GameMap, number>();

function maxTop(map: GameMap): number {
  let m = maxTopCache.get(map);
  if (m === undefined) {
    m = -Infinity;
    for (const v of map.heights.height) if (v > m) m = v;
    maxTopCache.set(map, m);
  }
  return m;
}

/**
 * Whether a point is in shadow: a ray from it toward the sun passes below the top of a cell before it
 * rises above the map's highest cell top. `extra` adds blockers that aren't cells (the arcades' painted
 * faces and reveals, stage 6).
 */
export function inShadow(map: GameMap, x: number, y: number, z: number, extra?: (x: number, y: number, z: number) => boolean): boolean {
  const b = blockers(map);
  const dist = (maxTop(map) - z) / SUN.z;
  if (dist <= 0) return false;
  if (raycastTerrain(b, x, y, z, SUN.x, SUN.y, SUN.z, dist) < dist) return true;
  return extra ? extra(x, y, z) : false;
}

export interface Lightmap {
  /** Texels across and down: the map's size times LIGHTMAP_TEXELS. */
  w: number;
  h: number;
  /** RGBA, linear: the light color, and in alpha L, the brightness relative to the lit floor (0 the
   * darkest, 1 full sun), for the characters (M10 §5.4). */
  data: Uint8Array;
}

/** Bakes the floor lightmap. Deterministic. */
export function bakeLightmap(map: GameMap, extra?: (x: number, y: number, z: number) => boolean): Lightmap {
  const { w, h } = map;
  const hz = map.heights;
  const tw = w * LIGHTMAP_TEXELS;
  const th = h * LIGHTMAP_TEXELS;
  const data = new Uint8Array(tw * th * 4);
  const litLum = lum(LIT);
  const darkLum = DARKEST * litLum;
  for (let ty = 0; ty < th; ty++) {
    for (let tx = 0; tx < tw; tx++) {
      const x = (tx + 0.5) / LIGHTMAP_TEXELS;
      const y = (ty + 0.5) / LIGHTMAP_TEXELS;
      const c = Math.floor(x);
      const r = Math.floor(y);
      const i = r * w + c;
      const o = (ty * tw + tx) * 4;
      const k = hz.kind[i];
      if (k !== K_FLOOR && k !== K_DOOR) {
        // Not floor: lit, so filtering at a floor's edge doesn't bleed darkness into it.
        data.set([255, 255, 255, 255], o);
        continue;
      }
      const f = map.floor[i];
      const base = inShadow(map, x, y, f + 0.05, extra) ? SHADE : LIT;
      // Ambient occlusion within AO_REACH of a cell rising more than AO_RISE above this floor.
      let d = AO_REACH;
      for (let rr = r - 2; rr <= r + 2; rr++) {
        for (let cc = c - 2; cc <= c + 2; cc++) {
          if (cc < 0 || rr < 0 || cc >= w || rr >= h) continue;
          const t = hz.height[rr * w + cc];
          if (!(t - f > AO_RISE)) continue;
          const dx = Math.max(cc - x, 0, x - (cc + 1));
          const dy = Math.max(rr - y, 0, y - (rr + 1));
          d = Math.min(d, Math.hypot(dx, dy));
        }
      }
      const ao = 1 - AO_MAX * (1 - d / AO_REACH);
      const col = [base[0] * ao, base[1] * ao, base[2] * ao];
      const L = Math.min(1, Math.max(0, (lum(col) - darkLum) / (litLum - darkLum)));
      data[o] = Math.round(col[0] * 255);
      data[o + 1] = Math.round(col[1] * 255);
      data[o + 2] = Math.round(col[2] * 255);
      data[o + 3] = Math.round(L * 255);
    }
  }
  return { w: tw, h: th, data };
}

/**
 * The height up to which a vertical face is in shadow at one point along it (M10 §5.2): the lowest
 * lit point from its foot up, to 0.1 m. A higher point's ray toward the sun runs above a lower one's,
 * so once lit, everything above is lit: found by bisection. `nx, ny` is the face's normal; the point
 * is taken 1 cm in front of the face. Returns `foot` if the foot is lit and `top` if nothing is.
 */
export function shadowZ(map: GameMap, x: number, y: number, nx: number, ny: number, foot: number, top: number, extra?: (x: number, y: number, z: number) => boolean): number {
  const px = x + nx * 0.01;
  const py = y + ny * 0.01;
  const lit = (z: number) => !inShadow(map, px, py, z, extra);
  if (lit(foot + 0.01)) return foot;
  if (!lit(top - 0.01)) return top;
  let lo = foot;
  let hi = top;
  while (hi - lo > 0.1) {
    const mid = (lo + hi) / 2;
    if (lit(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Whether a vertical face with horizontal normal (nx, ny) is turned toward the sun. */
export function facesSun(nx: number, ny: number): boolean {
  return nx * SUN_DIR_X + ny * SUN_DIR_Y > 1e-6;
}

/**
 * A vertical face's vertex color from its direction (M10 §5.2): faces toward the sun lighter and warm,
 * faces away cooler and darker; `deep` (the inside of a reveal or window, a crown's underside) is shaded
 * as facing away and a further 15% darker.
 */
export function faceColor(nx: number, ny: number, deep = false): [number, number, number] {
  const f = deep ? -1 : nx * SUN_DIR_X + ny * SUN_DIR_Y;
  const t = (f + 1) / 2;
  const b = (0.74 + 0.22 * t) * (deep ? 0.85 : 1);
  // Half-strength tints, so walls stay close to their painted colors.
  const hue = [0, 1, 2].map((k) => SHADE[k] + (LIT[k] - SHADE[k]) * t);
  const l = lum(hue);
  return [0, 1, 2].map((k) => b * (1 + 0.5 * (hue[k] / l - 1))) as [number, number, number];
}

/**
 * A character's light (M10 §5.4) from the lightmap's L at its anchor: brightness 0.85 + 0.15 L, never
 * darker than 85%; the floor's warm-to-cool hue at half strength. A billboard flying more than 1 m above
 * the floor under it takes full light. The billboard shader computes the same.
 */
export function lightTint(L: number, flying: boolean): { brightness: number; rgb: [number, number, number] } {
  const l = flying ? 1 : L;
  const brightness = 0.85 + 0.15 * l;
  const rgb = [0, 1, 2].map((k) => {
    const hue = (SHADE[k] + (LIT[k] - SHADE[k]) * l) / (lum(SHADE) + (lum(LIT) - lum(SHADE)) * l);
    return brightness * (1 + 0.5 * (hue - 1));
  }) as [number, number, number];
  return { brightness, rgb };
}

/** Resets cached values (tests that edit a map's heights). */
export function resetLightmapCache(): void {
  maxTopCache = new WeakMap();
}
