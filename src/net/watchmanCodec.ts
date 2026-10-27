import { WATCHMAN_PHASES, type WatchmanAim } from '../data/watchman';

/** One Watchman aim record (rogue rooms.md §6.4): slot u16, incarnation u32, target u8, phase u8, fireTick u32, shot u8, end x/y/z u16 in 1/64 m. */
export const WATCHMAN_BYTES = 19;
const SCALE = 64;
const pos16 = (v: number) => Math.max(0, Math.min(0xffff, Math.round(v * SCALE)));

export function writeWatchman(v: DataView, o: number, a: WatchmanAim): void {
  v.setUint16(o, a.slot, true); v.setUint32(o + 2, a.incarnation, true);
  v.setUint8(o + 6, a.targetId); v.setUint8(o + 7, WATCHMAN_PHASES.indexOf(a.phase));
  v.setUint32(o + 8, a.fireTick, true); v.setUint8(o + 12, a.shot & 0xff);
  v.setUint16(o + 13, pos16(a.x), true); v.setUint16(o + 15, pos16(a.y), true); v.setUint16(o + 17, pos16(a.z), true);
}

export function readWatchman(v: DataView, o: number): WatchmanAim | null {
  const phase = WATCHMAN_PHASES[v.getUint8(o + 7)];
  if (!phase) return null;
  return { slot: v.getUint16(o, true), incarnation: v.getUint32(o + 2, true), targetId: v.getUint8(o + 6), phase,
    fireTick: v.getUint32(o + 8, true), shot: v.getUint8(o + 12),
    x: v.getUint16(o + 13, true) / SCALE, y: v.getUint16(o + 15, true) / SCALE, z: v.getUint16(o + 17, true) / SCALE };
}
