/**
 * The game's sound effects and music (M8 §9.1, §9.2), driven by what the client already knows: its
 * own input, snapshot changes and events.
 */
import { audio, setMusic, sfx, type SoundPos } from '../audio/audio';
import { PRIO_OTHERS } from '../audio/sfx';
import type { ClassId } from '../data/classes';
import { BLESSED, CHERUB, CHORISTER, GATEKEEPER, ST_ATTACKING, ST_WINDUP } from '../data/enemies';
import type { TrackId } from '../data/music';
import type { GameEvent } from '../net/messages';
import { PHASE_CLEARED, PHASE_COMBAT, PHASE_COUNTDOWN, PHASE_IDLE, type Snapshot } from '../net/protocol';
import { ENEMY_SLOTS, TICK_MS } from '../sim/constants';
import type { GameMap } from '../sim/map';
import { BOSS_CAST_VOLLEY, PROJ_ARROW, PROJ_ORB } from '../sim/sim';
import type { SfxName } from '../audio/sfx';

const WEAPON_SFX: Record<ClassId, SfxName> = { fallen: 'shotgun', heretic: 'censerLaunch', binder: 'chaingun', betrayer: 'revolver' };
const ABILITY_SFX: Record<string, SfxName> = {
  'fallen:Q': 'blasphemy',
  'heretic:Q': 'communion',
  'heretic:E': 'shroud',
  'binder:Q': 'chains',
  'binder:E': 'discord',
  'betrayer:Q': 'kiss',
  'betrayer:E': 'shadowstep',
};
/** Falling Star lands this long after the press. */
const LEAP_S = 0.4;
/** An enemy melee blow: a Blessed attacking within this horizontal distance. */
const MELEE_REACH = 1.6;
const NO_STATE = 255;

export class GameSounds {
  private readonly lastShots = new Map<number, number>();
  private readonly enemyState = new Uint8Array(ENEMY_SLOTS).fill(NO_STATE);
  private tickSecond = 0;

  constructor(
    private readonly map: GameMap,
    private readonly localId: number,
    private readonly classOf: (playerId: number) => ClassId | undefined,
  ) {
    audio()?.music.keepStings(true);
  }

  /** The local player's own shot. */
  ownShot(classId: ClassId): void {
    sfx(WEAPON_SFX[classId]);
  }

  hit(): void {
    sfx('hitTick');
  }

  kill(): void {
    sfx('killTick');
  }

  /** An enemy disappeared (died), when its feather burst plays. */
  enemyDeath(type: number, at: SoundPos): void {
    if (type !== GATEKEEPER) sfx('blessedDeath', at);
  }

  censerBurst(at: SoundPos): void {
    sfx('censerBurst', at);
  }

  abilityReady(): void {
    sfx('abilityReady');
  }

  /** A complete snapshot: others' shots, enemy casts, new projectiles, the Gatekeeper, own HP changes, music. */
  snapshot(s: Snapshot, prev: Snapshot | null): void {
    // The countdown's last 5 s: a tick with each number (M8 §5).
    const second = s.arenaPhase === PHASE_COUNTDOWN ? Math.ceil(s.countdown / 10 - 1e-6) : 0;
    if (second >= 1 && second <= 5 && second !== this.tickSecond) sfx('countdownTick');
    this.tickSecond = second;
    // Others' shots: the difference in each player's counter, spread over the time to the next snapshot.
    const gap = prev ? ((s.tick - prev.tick) * TICK_MS) / 1000 : 0;
    for (const p of s.players) {
      const last = this.lastShots.get(p.id);
      this.lastShots.set(p.id, p.shots);
      if (p.id === this.localId || last === undefined || p.dead) continue;
      const n = (p.shots - last) & 0xff;
      const cls = this.classOf(p.id);
      if (!cls) continue;
      for (let i = 0; i < n; i++) sfx(WEAPON_SFX[cls], p, 1, (i * gap) / n, PRIO_OTHERS);
    }
    // Enemy wind-ups.
    for (let i = 0; i < s.enemyCount; i++) {
      const slot = s.enemySlot[i];
      const st = s.enemyState[i];
      const type = s.enemyType[i];
      if (st === ST_WINDUP && this.enemyState[slot] !== ST_WINDUP) {
        const at = { x: s.enemyX[i], y: s.enemyY[i] };
        if (type === CHORISTER) sfx('choristerWindup', at);
        else if (type === CHERUB) sfx('cherubWindup', at);
      }
      this.enemyState[slot] = st;
    }
    if (!prev) return;
    // The Gatekeeper's Volley: its wind-up, then the 8 orbs it fires (one sound for them).
    const boss = this.bossPos(s);
    const volleyFired = prev.bossCast === BOSS_CAST_VOLLEY && s.bossCast !== BOSS_CAST_VOLLEY;
    if (s.bossCast === BOSS_CAST_VOLLEY && prev.bossCast !== BOSS_CAST_VOLLEY && boss) sfx('volleyWindup', boss);
    if (volleyFired && boss) sfx('volleyFired', boss);
    // New projectiles: orbs and arrows fired.
    const old = new Set(prev.projSlot.subarray(0, prev.projectileCount));
    for (let i = 0; i < s.projectileCount; i++) {
      if (old.has(s.projSlot[i])) continue;
      const at = { x: s.projX[i], y: s.projY[i] };
      if (s.projKind[i] === PROJ_ORB && !volleyFired) sfx('orbFired', at);
      else if (s.projKind[i] === PROJ_ARROW) sfx('arrowFired', at);
    }
    // Own HP and shield.
    const me = s.players.find((p) => p.id === this.localId);
    const was = prev.players.find((p) => p.id === this.localId);
    if (me && was && !me.dead && !was.dead) {
      if (me.hp + me.shield < was.hp + was.shield) {
        sfx('hurt');
        if (this.blessedStriking(s, me)) sfx('meleeHit');
      } else if (me.hp > was.hp) sfx('healed');
      if (me.shield > 0 && me.shield > was.shield) sfx('shieldUp');
      else if (was.shield > 0 && me.shield === 0) sfx('shieldBroken');
    }
    this.music(s);
  }

  /** A game event's sound. `pose` gives a player's position. */
  event(e: GameEvent, pose: (id: number) => SoundPos | undefined): void {
    switch (e.type) {
      case 'abilityUsed': {
        const key = `${this.classOf(e.playerId)}:${e.slot}`;
        const at = { x: e.x, y: e.y };
        if (key === 'fallen:E') {
          // The leap from where the Fallen is, the landing at the ally 0.4 s later.
          const from = pose(e.playerId);
          sfx('fallingStarLeap', from ?? at);
          sfx('fallingStarLand', at, 1, LEAP_S);
        } else if (ABILITY_SFX[key]) sfx(ABILITY_SFX[key], key === 'betrayer:Q' || key === 'binder:Q' || key === 'binder:E' ? at : (pose(e.playerId) ?? at));
        break;
      }
      case 'playerDied':
        sfx('death', e.playerId === this.localId ? null : (pose(e.playerId) ?? null));
        break;
      case 'playerRespawned':
      case 'playerRevived':
        sfx('revive', e.playerId === this.localId ? null : (pose(e.playerId) ?? null));
        break;
      case 'arenaStarted':
        sfx('doorsSeal');
        break;
      case 'arenaCleared':
        sfx('arenaCleared');
        break;
      case 'bossCast':
        sfx(e.phase === 'start' ? 'judgmentCharge' : e.phase === 'completed' ? 'judgmentBlast' : 'interrupted');
        break;
      case 'gameOver':
        // The playing track fades and the sting plays; without one, the synthesized sting.
        if (!audio()?.music.sting(e.result)) sfx(e.result);
        break;
    }
  }

  /** The arena's track in combat, the calm one otherwise; the next likely one is decoded ahead. */
  private music(s: Snapshot): void {
    const combat = s.arenaPhase === PHASE_COMBAT;
    const next = s.arenaPhase === PHASE_IDLE || s.arenaPhase === PHASE_COUNTDOWN ? s.arenaIndex : s.arenaPhase === PHASE_CLEARED ? s.arenaIndex + 1 : -1;
    if (combat) setMusic(this.track(s.arenaIndex), 'calm');
    else setMusic('calm', next >= 0 && next < this.map.arenas.length ? this.track(next) : null);
  }

  /** Arena i's track: 1–3 by order, the boss arena's own; the sandbox uses Arena 1's. */
  private track(i: number): TrackId {
    if (this.map.arenas[i]?.boss) return 'boss';
    if (this.map.id === 'sandbox') return 'arena-1';
    return (['arena-1', 'arena-2', 'arena-3'] as const)[Math.min(i, 2)];
  }

  private bossPos(s: Snapshot): SoundPos | null {
    for (let i = 0; i < s.enemyCount; i++) if (s.enemyType[i] === GATEKEEPER) return { x: s.enemyX[i], y: s.enemyY[i] };
    return null;
  }

  private blessedStriking(s: Snapshot, me: SoundPos): boolean {
    for (let i = 0; i < s.enemyCount; i++) {
      if (s.enemyType[i] !== BLESSED || s.enemyState[i] !== ST_ATTACKING) continue;
      if (Math.hypot(s.enemyX[i] - me.x, s.enemyY[i] - me.y) <= MELEE_REACH) return true;
    }
    return false;
  }

  dispose(): void {
    audio()?.music.keepStings(false);
  }
}
