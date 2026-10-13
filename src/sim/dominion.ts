import { DOMINION_CAST_CAP, DOMINION_COOLDOWN_TICKS, DOMINION_RECOVERY_TICKS, DOMINION_TELL_TICKS, type DominionCast, type DominionPhase } from '../data/dominion';
import { ENEMY_SLOTS } from './constants';

interface CastState { incarnation: number; room: number; grounded: boolean; stunned: boolean; silenced: boolean; inRange: boolean; }

/** Host-only accepted deadlines; control refreshes cannot reschedule a canceled slam. */
export class Dominions {
  readonly active = new Map<number, DominionCast>();
  readonly recoveryUntil = new Float64Array(ENEMY_SLOTS);
  readonly readyAt = new Float64Array(ENEMY_SLOTS);
  private nextId = 1;
  exhausted = 0;
  constructor(private readonly emit: (phase: DominionPhase, cast: DominionCast) => void) {}
  holding(slot: number, tick: number): boolean { return this.active.has(slot) || tick < this.recoveryUntil[slot]; }
  reset(slot: number): void { this.active.delete(slot); this.recoveryUntil[slot] = 0; this.readyAt[slot] = 0; }
  cancel(slot: number, tick: number): boolean {
    const cast = this.active.get(slot);
    if (!cast) return false;
    this.end(cast, tick, 'cancel'); return true;
  }
  private end(cast: DominionCast, tick: number, phase: 'strike' | 'cancel'): void {
    this.active.delete(cast.slot);
    this.recoveryUntil[cast.slot] = tick + DOMINION_RECOVERY_TICKS;
    this.readyAt[cast.slot] = tick + DOMINION_COOLDOWN_TICKS;
    this.emit(phase, { ...cast });
  }
  update(slot: number, tick: number, state: CastState): void {
    const blocked = !state.grounded || state.stunned || state.silenced;
    const cast = this.active.get(slot);
    if (cast) {
      if (blocked || state.incarnation !== cast.incarnation || state.room !== cast.room) this.cancel(slot, tick);
      else if (tick >= cast.impactTick) this.end(cast, tick, 'strike');
      return;
    }
    if (blocked || !state.inRange || tick < this.readyAt[slot] || this.active.size >= DOMINION_CAST_CAP) return;
    if (this.nextId > 0xffffffff || tick + DOMINION_TELL_TICKS > 0xffffffff) { this.exhausted++; return; }
    const next: DominionCast = { slot, incarnation: state.incarnation, room: state.room, castId: this.nextId++, startTick: tick, impactTick: tick + DOMINION_TELL_TICKS };
    this.active.set(slot, next); this.emit('start', { ...next });
  }
  checkpoint(): DominionCast[] { return [...this.active.values()].sort((a, b) => a.slot - b.slot).map((c) => ({ ...c })); }
}
