import { COMMANDER_PHASES, type CommanderCast } from '../data/commanders';

export const COMMANDER_BYTES = 66;
const FLOATS = ['yaw', 'pitch', 'x', 'y', 'z', 'targetX', 'targetY', 'targetZ', 'dropX', 'dropY'] as const;
export function writeCommander(v: DataView, o: number, c: CommanderCast): void {
  v.setUint16(o, c.slot, true);
  [c.incarnation, c.castId, c.startTick, c.phaseTick, c.endTick].forEach((n, i) => v.setUint32(o + 2 + i * 4, n, true));
  v.setUint8(o + 22, c.room); v.setUint8(o + 23, c.kind === 'beam' ? 0 : 1);
  v.setUint8(o + 24, COMMANDER_PHASES.indexOf(c.phase)); v.setInt8(o + 25, c.targetId);
  FLOATS.forEach((key, i) => v.setFloat32(o + 26 + i * 4, c[key], true));
}
export function readCommander(v: DataView, o: number): CommanderCast | null {
  const kind = v.getUint8(o + 23), phase = COMMANDER_PHASES[v.getUint8(o + 24)];
  if (kind > 1 || !phase) return null;
  return { slot: v.getUint16(o, true), incarnation: v.getUint32(o + 2, true), castId: v.getUint32(o + 6, true), startTick: v.getUint32(o + 10, true),
    phaseTick: v.getUint32(o + 14, true), endTick: v.getUint32(o + 18, true), room: v.getUint8(o + 22), kind: kind === 0 ? 'beam' : 'carry', phase, targetId: v.getInt8(o + 25),
    ...Object.fromEntries(FLOATS.map((key, i) => [key, v.getFloat32(o + 26 + i * 4, true)])) } as CommanderCast;
}
