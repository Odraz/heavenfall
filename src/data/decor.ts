/** Decorations (§8.1, §11.2): drawn only; the simulation ignores them. */

export interface DecorDef {
  /** Billboard height in meters. */
  height: number;
  /** Large decorations must stand on cells players can't reach (§8.1 level validation). */
  large: boolean;
}

export const DECOR = {
  candelabrum: { height: 1.8, large: false },
  'lily-urn': { height: 1.0, large: false },
  harp: { height: 1.4, large: false },
  'cloud-tuft': { height: 1.0, large: false },
  'angel-statue': { height: 3.0, large: true },
  fountain: { height: 2.0, large: true },
} as const satisfies Record<string, DecorDef>;

export type DecorId = keyof typeof DECOR;

export const DECOR_IDS = Object.keys(DECOR) as DecorId[];

export function isDecorId(v: unknown): v is DecorId {
  return typeof v === 'string' && Object.hasOwn(DECOR, v);
}

/** The sprite of a decoration. */
export function decorSprite(id: DecorId): string {
  return `decor-${id}`;
}
