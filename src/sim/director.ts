/**
 * The director (M12 §2.3): decides when each wave of a combat arena starts, from how hard-pressed the
 * party is: build up, peak, relax, repeat. It doesn't choose what spawns or where. Host only, pure.
 */
import { PLAYER_SLOTS, TICK_HZ } from './constants';

/** `done` once the last wave has started: the director stops. */
export type DirectorPhase = 'build' | 'peak' | 'relax' | 'done';

/** What the worker sends the local client with each snapshot, for the F3 overlay (M12 §2.3). */
export interface DirectorInfo {
  phase: DirectorPhase;
  /** Seconds in the phase. */
  phaseTime: number;
  /** The party's intensity, 0–100. */
  intensity: number;
  /** The latest started wave, 0-based. */
  wave: number;
  /** The arena's living enemies. */
  alive: number;
  /** The latest wave's total (scaled). */
  waveTotal: number;
}

export const INTENSITY_MAX = 100;
/** Losing all of max HP adds this much: 15 for 10%. */
export const HURT_INTENSITY = 150;
/** Each enemy removed within this many meters (horizontally) of a living player adds 1 to it. */
export const KILL_NEAR_RADIUS = 5;
/** A player is engaged while a living enemy is within this many meters horizontally... */
export const ENGAGED_RADIUS = 8;
/** ...or a hit removed their HP or shield in the last this many ticks. */
export const ENGAGED_HIT_TICKS = 30;
/** Intensity lost per second while not engaged. */
export const DECAY_PER_S = 20;
/** Build up turns to peak at this party intensity. */
export const PEAK_INTENSITY = 70;
/** Relax starts the next wave after the party's intensity stayed below this... */
export const QUIET_INTENSITY = 25;
/** ...for this many ticks in a row. */
export const QUIET_TICKS = 2 * TICK_HZ;
export const PEAK_TICKS = 4 * TICK_HZ;
/** Relax's limit: after this long, the next wave starts once few enough are left. */
export const RELAX_LIMIT_TICKS = 10 * TICK_HZ;
/** "Few left": the arena's living enemies at most this fraction of the latest wave's total. */
export const FEW_LEFT = 0.3;
/** In single player, relax lasts at least this long before it can start the next wave (M12 follow-up §3.1). */
export const SOLO_RELAX_MIN_TICKS = 6 * TICK_HZ;

const DECAY_PER_TICK = DECAY_PER_S / TICK_HZ;

export class Director {
  phase: DirectorPhase = 'build';
  /** Ticks since the phase started (0 on the tick it starts). */
  phaseTicks = 0;
  /** Ticks in a row in relax with the party's intensity below 25. */
  private quietTicks = 0;
  /** Each player's intensity by index, 0–100. */
  readonly intensity = new Float64Array(PLAYER_SLOTS);

  /**
   * `waves`: the arena's wave count. `cap`: the arena's largest wave (each type scaled, then summed);
   * no wave starts while more than that are alive. `solo`: single player, where the 30% rule leads to
   * a breath of at least 6 s instead of the next wave (M12 follow-up §3.1).
   */
  constructor(
    readonly waves: number,
    readonly cap: number,
    readonly solo = false,
  ) {}

  /** Wave `n` was queued: build up, or the director stops after the last one. */
  waveStarted(n: number): void {
    this.setPhase(n >= this.waves - 1 ? 'done' : 'build');
  }

  /** A `damagePlayer` hit took `lost` HP and shield (HP counted down to 0 only). */
  hurt(i: number, lost: number, maxHp: number): void {
    if (lost > 0) this.add(i, (HURT_INTENSITY * lost) / maxHp);
  }

  /** An enemy was removed within 5 m of living player `i`. */
  killNear(i: number): void {
    this.add(i, 1);
  }

  /** Once per tick for each living player who isn't engaged. */
  decay(i: number): void {
    this.intensity[i] = Math.max(0, this.intensity[i] - DECAY_PER_TICK);
  }

  /** A living player died (or left): their intensity is 0, and a death is a peak unless the last wave started. */
  died(i: number): void {
    this.intensity[i] = 0;
    if (this.phase !== 'done') this.setPhase('peak');
  }

  /** Clears one player's intensity without a peak (a player left, or a slot was taken again). */
  clear(i: number): void {
    this.intensity[i] = 0;
  }

  /** The party's intensity: the highest among the living players (`living[i]`). */
  party(living: ArrayLike<boolean>): number {
    let m = 0;
    for (let i = 0; i < PLAYER_SLOTS; i++) if (living[i] && this.intensity[i] > m) m = this.intensity[i];
    return m;
  }

  /**
   * Evaluates once per tick, after decay and before placement. `party`: the party's intensity;
   * `fullySpawned`, `waveTotal`: the latest wave's; `alive`: the arena's living enemies. Returns true
   * when the next wave starts now (the caller starts it, which calls `waveStarted`).
   */
  step(party: number, fullySpawned: boolean, alive: number, waveTotal: number): boolean {
    if (this.phase === 'done') return false;
    this.phaseTicks++;
    const fewLeft = alive <= FEW_LEFT * waveTotal + 1e-9;
    const room = alive <= this.cap;
    switch (this.phase) {
      case 'build':
        if (!fullySpawned) return false;
        // Both on one tick: the 30% rule wins. In single player it leads to a breath first.
        if (fewLeft) {
          if (this.solo) this.setPhase('relax');
          else if (room) return true;
        } else if (party >= PEAK_INTENSITY - 1e-9) this.setPhase('peak');
        return false;
      case 'peak':
        if (this.phaseTicks >= PEAK_TICKS) this.setPhase('relax');
        return false;
      case 'relax':
        this.quietTicks = party < QUIET_INTENSITY ? this.quietTicks + 1 : 0;
        if (!fullySpawned || !room || (this.solo && this.phaseTicks < SOLO_RELAX_MIN_TICKS)) return false;
        return this.quietTicks >= QUIET_TICKS || (this.phaseTicks >= RELAX_LIMIT_TICKS && fewLeft);
    }
  }

  private setPhase(phase: DirectorPhase): void {
    this.phase = phase;
    this.phaseTicks = 0;
    this.quietTicks = 0;
  }

  private add(i: number, v: number): void {
    this.intensity[i] = Math.min(INTENSITY_MAX, this.intensity[i] + v);
  }
}
