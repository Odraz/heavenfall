/** Post-win timing uses host ticks; disconnected players and bots cannot hold the exit. */
export interface VictoryState {
  wonTick: number; clearTimeMs: number; x: number; y: number; z: number;
  firstEntryTick: number; allSinceTick: number; holdTicks: number; waiting: boolean;
}
export interface ExitHuman { connected: boolean; dead: boolean; bot: boolean; x: number; y: number; z: number; }
export class VictoryExit {
  readonly state: VictoryState;
  unclaimed = false;
  constructor(tick: number, clearTimeMs: number, at: { x: number; y: number; z: number }) {
    this.state = { wonTick: tick, clearTimeMs, ...at, firstEntryTick: -1, allSinceTick: -1, holdTicks: 0, waiting: false };
  }
  update(tick: number, players: readonly ExitHuman[], pendingChoice: boolean): boolean {
    const s = this.state, humans = players.filter(p => p.connected && !p.dead && !p.bot);
    const near = humans.filter(p => Math.hypot(p.x - s.x, p.y - s.y, p.z - s.z) <= 2).length;
    if (near > 0 && s.firstEntryTick < 0) s.firstEntryTick = tick;
    if (near === humans.length && near > 0) { if (s.allSinceTick < 0) s.allSinceTick = tick; }
    else s.allSinceTick = -1;
    const hard = tick - s.wonTick >= 3600;
    const due = hard || s.allSinceTick >= 0 && tick - s.allSinceTick >= 90 || s.firstEntryTick >= 0 && tick - s.firstEntryTick >= 900;
    s.waiting = !!(due && pendingChoice && !hard && s.holdTicks < 1800);
    if (s.waiting) { s.holdTicks++; return false; }
    if (due) this.unclaimed = pendingChoice;
    return due;
  }
}
