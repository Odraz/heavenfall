/**
 * Your kills, at once (M12 §4.4): the shooter's own screen predicts kills and bursts from its local ray
 * tests, flinches what it hits, and plays the kill marker and `killTick` on the prediction. Since
 * netcode stage 3 every prediction starts from the enemy's HP in the newest snapshot, less the damage
 * this screen's shots dealt that the host hasn't resolved yet (`OwnDamage`). Cosmetic and local. Pure:
 * no DOM or three.js.
 */
import { BOSS_PART, ENEMIES, GATEKEEPER } from '../data/enemies';
import { WEAPONS } from '../data/weapons';
import { BURST_LIGHT, silverBulletHits } from '../sim/combat';
import { pressDelta } from '../sim/fireLatch';

/** A predicted hit's outcome: 0 survives, 1 a kill, 2 a kill that bursts. */
export type Predicted = 0 | 1 | 2;

/**
 * A hit of `damage` on an enemy of `type` with `hp` left, the damage multiplied by `factor` (2 when
 * rooted, a Cantor's hymnal 0.2). A kill when it reaches `hp`, never the Gatekeeper; a burst when
 * `alwaysBursts` (the shotgun within 6 m, the Scourge) or the damage reaches 2× the type's max HP.
 */
export function predictHit(type: number, hp: number, damage: number, factor = 1, alwaysBursts = false): Predicted {
  // Boss parts: a grey opening eye refuses damage and the Seal's HP follows the living, so their deaths wait for the host.
  if (type === GATEKEEPER || type === BOSS_PART || !(hp > 0)) return 0;
  const d = damage * factor;
  if (d < hp - 1e-9) return 0;
  return alwaysBursts || d >= BURST_LIGHT * ENEMIES[type].hp - 1e-9 ? 2 : 1;
}

/** An enemy along one pellet's ray, as the local ray test found it. */
export interface PelletTarget {
  /** The enemy's index in the interpolated list. */
  i: number;
  /** Distance along the ray. */
  t: number;
  type: number;
  /** HP left before this shot (netcode stage 3). */
  hp: number;
  /** The damage multiplier: 2 when rooted, a Cantor's hymnal 0.2. */
  factor: number;
  /** Within 6 m of the Fallen's body center (the shotgun's burst range, M12 §5.1). */
  close: boolean;
}

/** One predicted hit of a shot: its target, its outcome and the damage it deals. */
export interface PelletHit {
  target: PelletTarget;
  result: Predicted;
  dealt: number;
}

/**
 * One hitscan shot's predictions (M12 §4.4): each pellet's targets, nearest first, hit up to `maxHits`;
 * an enemy an earlier pellet is predicted to kill is passed by later pellets, as on the host. The
 * pellets' damage adds up on an enemy (netcode stage 3), so two far shotgun pellets kill a Blessed. The
 * shotgun's pellets deal `closeDamage` within 6 m (and always burst what they kill there) and
 * `damage` beyond. Returns each pellet's hits.
 */
export function predictPellets(
  pellets: ReadonlyArray<readonly PelletTarget[]>,
  damage: number,
  maxHits: number,
  kind: 'shotgun' | 'other',
  closeDamage = damage,
): PelletHit[][] {
  const left = new Map<number, number>();
  return pellets.map((ts) => {
    const hits: PelletHit[] = [];
    for (const t of ts) {
      if (hits.length >= maxHits) break;
      const hp = left.get(t.i) ?? t.hp;
      if (hp <= 0) continue;
      const close = kind === 'shotgun' && t.close;
      const d = close ? closeDamage : damage;
      const result = predictHit(t.type, hp, d, t.factor, close);
      const dealt = Math.min(d * t.factor, hp);
      left.set(t.i, result ? 0 : hp - dealt);
      hits.push({ target: t, result, dealt });
    }
    return hits;
  });
}

/** An enemy along the Silver Bullet's line, nearest first. */
export interface BulletTarget {
  type: number;
  hp: number;
  factor: number;
  rooted: boolean;
  /** Taunted with Behind His Back: it costs the bullet half, like a bound one. */
  half: boolean;
}

/**
 * The Silver Bullet (M9 §2.4) from the enemies' HP (netcode stage 3), with the host's own rule: each
 * enemy it reaches takes what the bullet still carries, multiplied by its factor on the host; a burst
 * when the carried amount (times the factor) reaches 2× the type's max HP. Returns each reached enemy's
 * outcome and damage, and whether the bullet stops at the last.
 */
export function predictSilverBullet(line: readonly BulletTarget[], damage: number): { hits: Array<{ result: Predicted; dealt: number }>; stopped: boolean } {
  const r = silverBulletHits(line.map((t, s) => ({ s, hp: t.hp, rooted: t.rooted, boss: t.type === GATEKEEPER, half: t.half })), damage);
  return {
    stopped: r.stopped,
    hits: r.hits.map((h) => {
      const t = line[h.s];
      const dealt = Math.min(h.amount * t.factor, t.hp);
      const kills = predictHit(t.type, t.hp, h.amount, t.factor) !== 0;
      return { result: !kills ? 0 : h.carried * t.factor >= BURST_LIGHT * ENEMIES[t.type].hp - 1e-9 ? 2 : 1, dealt };
    }),
  };
}

/** The predicted damage of a shot is forgotten after this long, even if the host never resolves it. */
export const OWN_DAMAGE_MS = 1500;

/**
 * The damage this screen's shots dealt that the snapshots don't show yet (netcode stage 3). Each entry
 * carries its shot's counter; a snapshot's `shotsDone` says the host fired or dropped every shot up to
 * it, so their damage is in that snapshot's HP and their entries go.
 */
export class OwnDamage {
  private readonly entries: Array<{ shot: number; slot: number; incarnation: number; amount: number; at: number }> = [];

  add(shot: number, slot: number, incarnation: number, amount: number, now: number): void {
    if (amount > 0) this.entries.push({ shot: shot & 0xff, slot, incarnation, amount, at: now });
  }

  /** The snapshot's `shotsDone`: every shot up to it is resolved; entries older than OWN_DAMAGE_MS go too. */
  settle(done: number, now: number): void {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const e = this.entries[i];
      if (pressDelta(e.shot, done) === 0 || now - e.at > OWN_DAMAGE_MS) this.entries.splice(i, 1);
    }
  }

  /** The damage still owed to an enemy by unresolved shots. */
  pending(slot: number, incarnation: number): number {
    let sum = 0;
    for (const e of this.entries) if (e.slot === slot && e.incarnation === incarnation) sum += e.amount;
    return sum;
  }

  get count(): number {
    return this.entries.length;
  }

  clear(): void {
    this.entries.length = 0;
  }
}

/** The shotgun's far damage, for tests and the cosmetic shot. */
export const SHOTGUN_FAR_DAMAGE = WEAPONS.fallen.damage;

/** Predicted kills within this long climb the `killTick` pitch ladder. */
export const LADDER_MS = 500;
/** The snapshot's own kill marker is skipped this long after a predicted one. */
export const PREDICTED_KILL_HOLD_MS = 400;

/**
 * `killTick`'s playback rate: 2^(min(k, 7) / 12), with k the predicted kills in the last 0.5 s before
 * this one, so a lone kill plays at 1 and a streak climbs a semitone each, up to 7.
 */
export function ladderRate(k: number): number {
  return 2 ** (Math.min(k, 7) / 12);
}

/** The local player's predicted kills: the ladder and when the last one was. */
export class PredictedKills {
  private readonly times: number[] = [];
  lastAt = -Infinity;

  /** A predicted kill now; returns `killTick`'s rate. */
  kill(now: number): number {
    while (this.times.length && now - this.times[0] > LADDER_MS) this.times.shift();
    const rate = ladderRate(this.times.length);
    this.times.push(now);
    this.lastAt = now;
    return rate;
  }

  /** Whether the snapshot's kill marker is skipped now. */
  holdsMarker(now: number): boolean {
    return now - this.lastAt < PREDICTED_KILL_HOLD_MS;
  }
}

/** A flinch's shape (M12 §4.4). */
export interface FlinchKind {
  push: number;
  lift: number;
  /** Width and height scales. */
  wide: number;
  tall: number;
  /** Glow color and amount. */
  r: number;
  g: number;
  b: number;
  a: number;
  /** Full for this long, then easing back over `ease` (ms). */
  hold: number;
  ease: number;
}

export const HIT_FLINCH: FlinchKind = { push: 0.15, lift: 0, wide: 1.1, tall: 0.92, r: 1, g: 1, b: 1, a: 0.4, hold: 50, ease: 120 };
export const KILL_FLINCH: FlinchKind = { push: 0.3, lift: 0.12, wide: 1.15, tall: 0.88, r: 1, g: 0.8, b: 0.4, a: 0.6, hold: 60, ease: 140 };
/** Every flinch also moves this far along the camera's right. */
export const FLINCH_RIGHT = 0.05;
export const MAX_FLINCHES = 64;

/** A flinch at one moment: the offset along the shot (m), the lift, the scales and the glow amount. */
export interface FlinchPose {
  dx: number;
  dy: number;
  /** Along the camera's right (m). */
  right: number;
  dz: number;
  wide: number;
  tall: number;
  kind: FlinchKind;
  /** The glow's amount now. */
  glow: number;
}

/** The enemies flinching from the local player's hits: at most 64, a new one replacing the oldest. */
export class Flinches {
  private readonly list: Array<{ slot: number; start: number; dx: number; dy: number; kind: FlinchKind }> = [];
  private readonly pose: FlinchPose = { dx: 0, dy: 0, right: 0, dz: 0, wide: 1, tall: 1, kind: HIT_FLINCH, glow: 0 };

  /** A hit on `slot` along the horizontal direction (dx, dy); a new hit on a flinching enemy restarts it. */
  add(slot: number, now: number, dx: number, dy: number, kind: FlinchKind): void {
    const len = Math.hypot(dx, dy);
    const ux = len > 1e-9 ? dx / len : 0;
    const uy = len > 1e-9 ? dy / len : 0;
    const i = this.list.findIndex((f) => f.slot === slot);
    if (i >= 0) this.list.splice(i, 1);
    else if (this.list.length >= MAX_FLINCHES) this.list.shift();
    this.list.push({ slot, start: now, dx: ux, dy: uy, kind });
  }

  get count(): number {
    return this.list.length;
  }

  /** Drops the flinches that ended. */
  expire(now: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      if (now - f.start >= f.kind.hold + f.kind.ease) this.list.splice(i, 1);
    }
  }

  /** The flinch of a slot now, or null. The returned object is reused. */
  at(slot: number, now: number): FlinchPose | null {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      if (f.slot !== slot) continue;
      const t = now - f.start;
      const k = f.kind;
      if (t < 0 || t >= k.hold + k.ease) return null;
      // Full while held, then easing back (smoothly) to nothing.
      const u = t <= k.hold ? 1 : 1 - (t - k.hold) / k.ease;
      const e = u * u * (3 - 2 * u);
      const p = this.pose;
      p.dx = f.dx * k.push * e;
      p.dy = f.dy * k.push * e;
      p.right = FLINCH_RIGHT * e;
      p.dz = k.lift * e;
      p.wide = 1 + (k.wide - 1) * e;
      p.tall = 1 + (k.tall - 1) * e;
      p.kind = k;
      p.glow = k.a * e;
      return p;
    }
    return null;
  }
}

/** A predicted kill not gone from the snapshots after this long counts as missed. */
export const CONFIRM_MS = 1500;

/**
 * How many of the shooter's predicted kills the host confirmed (netcode stage, 2026-10-22): a kill is
 * confirmed when its enemy slot leaves the snapshots within CONFIRM_MS, and missed otherwise. Shown on
 * F3 and read by the lag test: the share of kill markers that came true is how shooting feels.
 */
export class KillConfirmations {
  private readonly pending = new Map<number, number>();
  predicted = 0;
  confirmed = 0;
  missed = 0;

  /** A predicted kill of `slot` at `now`; a second one on the same slot only restarts its wait. */
  add(slot: number, now: number): void {
    if (!this.pending.has(slot)) this.predicted++;
    this.pending.set(slot, now);
  }

  /** Settles the predictions: `present` tells whether a slot is still in the newest snapshot. */
  update(now: number, present: (slot: number) => boolean): void {
    for (const [slot, at] of this.pending) {
      if (!present(slot)) { this.confirmed++; this.pending.delete(slot); }
      else if (now - at > CONFIRM_MS) { this.missed++; this.pending.delete(slot); }
    }
  }
}
