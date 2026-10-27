/** Post-win timing uses host ticks; disconnected players and bots cannot hold the exit (rogue game.md §11.6). */

/** Humans this close to the Stair of light stand in it. */
const EXIT_REACH = 2;
/** The run ends when every living human has stood in the light for 3 s … */
const EXIT_ALL_IN_TICKS = 90;
/** … or 30 s after the first one entered it … */
const EXIT_FIRST_ENTRY_TICKS = 900;
/** … or 120 s after the boss died, whatever happens. */
const EXIT_HARD_TICKS = 3600;
/** An unclaimed earned choice holds the first two endings for at most 60 s in total. */
const EXIT_CHOICE_HOLD_TICKS = 1800;

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
  /** Advances one tick; returns whether the run ends now. */
  update(tick: number, players: readonly ExitHuman[], pendingChoice: boolean): boolean {
    const s = this.state;
    const humans = players.filter(p => p.connected && !p.dead && !p.bot);
    const near = humans.filter(p => Math.hypot(p.x - s.x, p.y - s.y, p.z - s.z) <= EXIT_REACH).length;
    if (near > 0 && s.firstEntryTick < 0) s.firstEntryTick = tick;
    if (near === humans.length && near > 0) {
      if (s.allSinceTick < 0) s.allSinceTick = tick;
    } else s.allSinceTick = -1;
    const hard = tick - s.wonTick >= EXIT_HARD_TICKS;
    const allIn = s.allSinceTick >= 0 && tick - s.allSinceTick >= EXIT_ALL_IN_TICKS;
    const entered = s.firstEntryTick >= 0 && tick - s.firstEntryTick >= EXIT_FIRST_ENTRY_TICKS;
    const due = hard || allIn || entered;
    s.waiting = !!(due && pendingChoice && !hard && s.holdTicks < EXIT_CHOICE_HOLD_TICKS);
    if (s.waiting) {
      s.holdTicks++;
      return false;
    }
    if (due) this.unclaimed = pendingChoice;
    return due;
  }
}
