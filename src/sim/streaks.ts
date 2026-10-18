/**
 * Kill streaks with assists (rogue game.md §10, m12-followup-2.md §3). A counted kill within 1.0 s of
 * the player's last counted kill extends the streak; a kill counts for its killer and, once each, for
 * every other living human who damaged or taunted that enemy in the last 1.5 s. Tiers at 10, 25, 50,
 * 100 and 200 are announced once per streak; the highest tier crossed in a tick is one event.
 *
 * Bodies: ordinary combat enemies and boss summons count; the Gatekeeper's body and cleared-room
 * trickle don't. A tier crossed by a world or secondary death never starts a relic (§2.4 rule 3).
 */
import { ENEMY_SLOTS, PLAYER_SLOTS, TICK_HZ } from './constants';
import { GATEKEEPER } from '../data/enemies';
import type { Simulation, SimPlayer } from './sim';

export const STREAK_TIERS = [10, 25, 50, 100, 200] as const;
export const STREAK_NAMES = ['Sacrilege', 'Desecration', 'Massacre', 'Apocalypse', 'Armageddon'] as const;
/** A counted kill extends the streak within this many ticks of the last one (1.0 s). */
const STREAK_TICKS = TICK_HZ;
/** A touch this recent makes a kill an assist (1.5 s). */
const ASSIST_TICKS = Math.round(1.5 * TICK_HZ);

/** The tier index (0–4) a count reaches exactly, or -1. */
export function tierAt(count: number): number {
  return (STREAK_TIERS as readonly number[]).indexOf(count);
}

export class Streaks {
  /** The last tick each player index touched each enemy slot, +1 (0 = never), by slot × 4 + index. */
  private readonly touched = new Int32Array(ENEMY_SLOTS * PLAYER_SLOTS);
  /** This tick's highest tier per player, and whether a proc-eligible kill crossed one. */
  private readonly pending = new Map<number, { tier: number; count: number; proc: boolean }>();

  constructor(private readonly sim: Simulation) {}

  /** A new body in the slot: no old touches carry over. */
  spawned(slot: number): void {
    this.touched.fill(0, slot * PLAYER_SLOTS, slot * PLAYER_SLOTS + PLAYER_SLOTS);
  }

  /** A player damaged an enemy or applied a state to it. */
  touch(slot: number, index: number): void {
    if (index >= 0 && index < PLAYER_SLOTS) this.touched[slot * PLAYER_SLOTS + index] = this.sim.tick + 1;
  }

  /** At the start of a tick: streaks whose second ran out end, before that tick's damage. */
  update(): void {
    const sim = this.sim;
    for (const p of sim.players) if (p.streak > 0 && sim.tick - p.streakTick > STREAK_TICKS) this.end(p);
  }

  /** The streak ends (time out, death, the game's end). */
  end(p: SimPlayer): void {
    if (p.streak >= STREAK_TIERS[0]) this.sim.emit('all', { type: 'streakEnd', playerId: p.id, count: p.streak });
    p.streak = 0;
  }

  /** An enemy died; `killer` is the credited player index or -1; `proc` when its killing hit was native or a direct item. */
  killed(slot: number, killer: number, proc: boolean): void {
    const sim = this.sim;
    if (sim.eType[slot] === GATEKEEPER || sim.leashed[slot]) { this.spawned(slot); return; }
    for (let i = 0; i < PLAYER_SLOTS; i++) {
      const p = sim.slots[i];
      if (!p || p.bot || !p.connected || p.dead) continue;
      const at = this.touched[slot * PLAYER_SLOTS + i];
      if (i !== killer && !(at > 0 && sim.tick + 1 - at <= ASSIST_TICKS)) continue;
      p.streak = p.streak > 0 && sim.tick - p.streakTick <= STREAK_TICKS ? p.streak + 1 : 1;
      p.streakTick = sim.tick;
      if (p.streak > p.bestStreak) { p.bestStreak = p.streak; p.bestStreakTick = sim.tick; }
      if (i === killer) p.streakKills++; else p.assists++;
      const tier = tierAt(p.streak);
      if (tier < 0) continue;
      const now = this.pending.get(p.id);
      if (!now || tier > now.tier) this.pending.set(p.id, { tier, count: p.streak, proc: proc || !!now?.proc });
      else if (proc) now.proc = true;
    }
    this.spawned(slot);
  }

  /** The tick's tiers: one event per player, and the proc-eligible ones for the relics. */
  flush(): void {
    const sim = this.sim;
    for (const [id, t] of this.pending) {
      sim.emit('all', { type: 'streak', playerId: id, count: t.count, tier: t.tier });
      const p = sim.playerById(id);
      if (p && t.proc) sim.relics.streakTier(p);
    }
    this.pending.clear();
  }
}
