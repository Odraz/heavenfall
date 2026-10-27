/**
 * The acceptance evidence log (R9 stage 3, `evidence=1`): one record per room the party fought and one
 * per run, on the host's simulation clock. It only reads the simulation (its events, rooms and players)
 * and the worker's measured tick time; nothing here feeds back into a rule. Bounded: at most
 * `EVIDENCE_ROOM_CAP` room records and one run record, each kept under `EVIDENCE_RECORD_BYTES`.
 */
import { TICK_HZ } from './constants';
import { PHASE_CLEARED, PHASE_COMBAT } from '../net/protocol';
import { levelForXp } from '../profile/model';
import type { GameEvent } from '../net/messages';
import type { Simulation, SimPlayer } from './sim';

export const EVIDENCE_ROOM_CAP = 32;
export const EVIDENCE_RECORD_BYTES = 2048;

/** The decisions counted per human (slice-acceptance.md "meaningful choice rate"). */
export type DecisionKind = 'item' | 'purchase' | 'reward' | 'rewardPass' | 'rite' | 'ritePass' | 'bell' | 'bargain' | 'route';
export type Decisions = Record<DecisionKind, number>;
const noDecisions = (): Decisions => ({ item: 0, purchase: 0, reward: 0, rewardPass: 0, rite: 0, ritePass: 0, bell: 0, bargain: 0, route: 0 });

export interface RoomEvidence {
  record: 'room';
  /** The room's index on the floor and its stable def id, kind and template. */
  room: number; id: string; kind: string; template: string | null;
  /** Simulation-clock seconds from the run's start. */
  sealedS: number; clearedS: number | null;
  peakAlive: number;
  /** The crest's arrival: first to last placement of its wave, seconds; null without a crest. */
  crestS: number | null;
  simMsAvg: number; simMsMax: number;
  deaths: number; revives: number;
  /** Decisions since the previous room record (the travel and shopping before this room included), by player id. */
  decisions: Record<number, Decisions>;
}

export interface RunEvidence {
  record: 'run';
  seed: number; build: string;
  roster: Array<{ id: number; classId: string; level: number; talents: string[]; q: string; e: string; bot: boolean }>;
  edicts: number[];
  sundial: string;
  result: 'victory' | 'defeat';
  runS: number;
  /** Filled in by the host's page, which measured them (null in the worker). */
  loadMs: number | null; mapBuildMs: number | null;
  rooms: number;
  /** Room records beyond the cap that were not written. */
  roomsDropped: number;
  decisions: Record<number, Decisions>;
}

export type EvidenceRecord = RoomEvidence | RunEvidence;

const round = (v: number, places = 1): number => { const f = 10 ** places; return Math.round(v * f) / f; };
const seconds = (tick: number): number => round(tick / TICK_HZ);

interface OpenRoom { room: number; sealed: number; peak: number; ms: number; msMax: number; ticks: number; crestFrom: number; crestTo: number; crestWave: number }

export class EvidenceLog {
  private open: OpenRoom | null = null;
  /** Deaths, revives and decisions since the last room record. */
  private deaths = 0;
  private revives = 0;
  private window = new Map<number, Decisions>();
  private readonly totals = new Map<number, Decisions>();
  /** Discovered rooms not yet visited: a visit while two or more were open was a route choice. */
  private readonly frontier = new Set<number>();
  private written = 0;
  private dropped = 0;
  private done = false;

  constructor(private readonly sim: Simulation, private readonly build: string, private readonly out: (r: EvidenceRecord) => void) {
    sim.rooms.forEach((r, i) => { if (r.knowledge === 1) this.frontier.add(i); });
  }

  /** A human's decision, counted once its request was accepted. */
  decision(p: SimPlayer, kind: DecisionKind): void {
    if (p.bot || this.done) return;
    for (const m of [this.window, this.totals]) {
      let d = m.get(p.id);
      if (!d) { d = noDecisions(); m.set(p.id, d); }
      d[kind]++;
    }
  }

  /** After each tick, before its events are sent: `ms` is the tick's measured simulation time. */
  observe(ms: number): void {
    if (this.done) return;
    const sim = this.sim;
    for (const { event } of sim.events) this.event(event);
    const o = this.open;
    if (o) {
      o.peak = Math.max(o.peak, sim.rooms[o.room].alive);
      o.ms += ms; o.msMax = Math.max(o.msMax, ms); o.ticks++;
      if (o.crestWave >= 0 && o.crestTo < 0 && sim.rooms[o.room].waveFullySpawned[o.crestWave]) o.crestTo = sim.tick;
    }
  }

  private event(e: GameEvent): void {
    const sim = this.sim;
    switch (e.type) {
      case 'roomState': {
        if (e.knowledge === 1 && !this.frontier.has(e.room) && e.phase !== PHASE_CLEARED) this.frontier.add(e.room);
        if (e.knowledge === 2 && this.frontier.has(e.room)) {
          if (this.frontier.size >= 2) for (const p of sim.players) if (p.connected) this.decision(p, 'route');
          this.frontier.delete(e.room);
        }
        if (e.phase === PHASE_COMBAT && this.open?.room !== e.room) {
          if (this.open) this.closeRoom(null);
          this.open = { room: e.room, sealed: sim.tick, peak: 0, ms: 0, msMax: 0, ticks: 0, crestFrom: -1, crestTo: -1, crestWave: -1 };
        } else if (e.phase === PHASE_CLEARED && this.open?.room === e.room) this.closeRoom(sim.tick);
        break;
      }
      case 'crest':
        if (this.open?.room === e.room && this.open.crestWave < 0) { this.open.crestWave = e.wave; this.open.crestFrom = sim.tick; }
        break;
      case 'itemUsed': { const p = sim.playerById(e.playerId); if (p) this.decision(p, 'item'); break; }
      case 'bargain': { const p = sim.playerById(e.playerId); if (p) this.decision(p, 'bargain'); break; }
      case 'playerDied': this.deaths++; break;
      case 'playerRevived': this.revives++; break;
      case 'gameOver': this.finish(e.result); break;
    }
  }

  private closeRoom(clearedTick: number | null): void {
    const o = this.open!, sim = this.sim, def = sim.map.rooms[o.room];
    this.open = null;
    if (this.written >= EVIDENCE_ROOM_CAP) { this.dropped++; return; }
    this.written++;
    this.out({
      record: 'room', room: o.room, id: def.id, kind: def.kind, template: def.templateId ?? null,
      sealedS: seconds(o.sealed), clearedS: clearedTick === null ? null : seconds(clearedTick), peakAlive: o.peak,
      crestS: o.crestFrom < 0 ? null : seconds((o.crestTo < 0 ? sim.tick : o.crestTo) - o.crestFrom),
      simMsAvg: round(o.ticks ? o.ms / o.ticks : 0, 2), simMsMax: round(o.msMax, 2),
      deaths: this.deaths, revives: this.revives, decisions: Object.fromEntries(this.window),
    });
    this.deaths = 0; this.revives = 0; this.window = new Map();
  }

  /** The run ended (`gameOver`). A run the host leaves keeps only its room records. */
  private finish(result: RunEvidence['result']): void {
    if (this.done) return;
    const sim = this.sim;
    if (this.open) this.closeRoom(null);
    this.done = true;
    this.out({
      record: 'run', seed: sim.floor?.seed ?? sim.seed, build: this.build,
      roster: sim.players.map((p) => ({ id: p.id, classId: p.classId, level: levelForXp(p.xpBase + Math.floor(p.runXp)), talents: [...p.build.talents, ...p.build.rites], q: p.build.q, e: p.build.e, bot: p.bot })),
      edicts: [...sim.edicts], sundial: sim.route.sundial, result, runS: seconds(sim.tick), loadMs: null, mapBuildMs: null,
      rooms: this.written, roomsDropped: this.dropped, decisions: Object.fromEntries(this.totals),
    });
  }
}
