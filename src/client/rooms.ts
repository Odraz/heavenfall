/** Party knowledge from reliable messages; phases from the newest complete snapshot (R1.5). */
import type { FloorSync, GameEvent, RoomSync } from '../net/messages';
import { PHASE_CLEARED, PHASE_COMBAT, PHASE_COUNTDOWN, PHASE_IDLE } from '../net/protocol';
import type { GameMap } from '../sim/map';

export class ClientRooms {
  readonly states: RoomSync[];
  private readonly eventPhases: number[];
  private snapshotTick = -1;
  private syncRevision = -1;
  syncTick = -1;

  constructor(readonly map: GameMap, readonly runId: string) {
    this.states = map.rooms.map((r) => ({ phase: PHASE_IDLE, knowledge: 0, entrySocket: r.entry[0]?.socket ?? 0, refills: 3 }));
    this.eventPhases = this.states.map((r) => r.phase);
  }

  private valid(room: number, state: Omit<RoomSync, 'refills'>): boolean {
    return Number.isInteger(room) && room >= 0 && room < this.states.length &&
      [PHASE_IDLE, PHASE_COUNTDOWN, PHASE_COMBAT, PHASE_CLEARED].includes(state.phase) &&
      Number.isInteger(state.knowledge) && state.knowledge >= 0 && state.knowledge <= 2 &&
      this.map.rooms[room].entry.some((e) => e.socket === state.entrySocket);
  }

  sync(msg: FloorSync): boolean {
    if (msg.runId !== this.runId || !Number.isInteger(msg.tick) || msg.tick < 0 ||
      !Number.isInteger(msg.revision) || msg.revision < 0 || msg.revision < this.syncRevision ||
      !Array.isArray(msg.rooms) || msg.rooms.length !== this.states.length ||
      msg.rooms.some((s, i) => !s || !this.valid(i, s) || !Number.isInteger(s.refills) || s.refills < 0 || s.refills > 3)) return false;
    this.syncRevision = msg.revision;
    this.syncTick = msg.tick;
    msg.rooms.forEach((s, i) => {
      const phase = this.snapshotTick > msg.tick ? this.states[i].phase : s.phase;
      Object.assign(this.states[i], s, { phase, knowledge: Math.max(s.knowledge, this.states[i].knowledge) });
      this.eventPhases[i] = s.phase;
    });
    return true;
  }

  /** True only for a phase transition: discovery of an already cleared room is silent. */
  event(e: Extract<GameEvent, { type: 'roomState' }>, revision?: number): boolean {
    if (!this.valid(e.room, e) || (revision !== undefined && revision <= this.syncRevision)) return false;
    const changed = this.eventPhases[e.room] !== e.phase;
    this.eventPhases[e.room] = e.phase;
    const st = this.states[e.room];
    st.knowledge = Math.max(st.knowledge, e.knowledge);
    st.entrySocket = e.entrySocket;
    return changed;
  }

  snapshot(s: { tick: number; activeRoom: number; activePhase: number; clearedMask: number }): void {
    if (s.tick <= this.snapshotTick || s.tick < this.syncTick) return;
    this.snapshotTick = s.tick;
    this.states.forEach((r, i) => {
      r.phase = (s.clearedMask >>> i) & 1 ? PHASE_CLEARED : i === s.activeRoom ? s.activePhase : PHASE_IDLE;
    });
  }

  roomAt(x: number, y: number): number {
    const c = Math.floor(x), r = Math.floor(y);
    return c >= 0 && r >= 0 && c < this.map.w && r < this.map.h ? this.map.roomOf[r * this.map.w + c] : 255;
  }
}

export function roomMessage(model: ClientRooms, ownRoom: number, activeRoom: number, activePhase: number): string | null {
  const room = model.map.rooms[ownRoom];
  if (activeRoom !== 255 && ownRoom !== activeRoom && room?.kind === 'combat' &&
    model.states[ownRoom].phase === PHASE_IDLE && (activePhase === PHASE_COUNTDOWN || activePhase === PHASE_COMBAT)
  ) return 'Another room is sealing';
  // Generated-floor placeholders must be identified where players encounter them (r01.md).
  if (!room?.shape) return null;
  switch (room.kind) {
    case 'pardoner': return 'The Pardoner · Personal stock · Aim and press F to buy';
    case 'confessional': return 'The Confessional · Sanctuary · Press F at the grille: talents, relics and the bargain';
    // The authored Gatekeeper (R7): his identity rule before the seal; during the fight his bar speaks.
    case 'boss': return activeRoom === ownRoom && activePhase === PHASE_COMBAT ? null : 'The Gate · Judgment strikes everyone he can see: hide';
    default: return null;
  }
}
