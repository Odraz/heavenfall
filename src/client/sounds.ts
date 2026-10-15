import type { CommanderCast } from '../data/commanders';
/**
 * The game's sound effects and music (M8 §9.1, §9.2), driven by what the client already knows: its
 * own input, snapshot changes and events.
 */
import { audio, setMusic, sfx, type SoundPos, type VoiceHandle } from '../audio/audio';
import { PRIO_ABILITY, PRIO_OTHERS } from '../audio/sfx';
import type { ClassId } from '../data/classes';
import { COIN, GOLD_HALO } from '../data/pickups';
import { BLESSED, CARRIER, CHERUB, CHORISTER, DOMINION, GATEKEEPER, ST_ATTACKING, ST_WINDUP } from '../data/enemies';
import type { DominionRing } from './dominionView';
import type { SpawnWarning } from '../data/spawns';
import type { GameEvent } from '../net/messages';
import { PHASE_CLEARED, PHASE_COMBAT, PHASE_COUNTDOWN, type Snapshot } from '../net/protocol';
import { ENEMY_SLOTS, TICK_MS } from '../sim/constants';
import { roomCleared, type GameMap } from '../sim/map';
import { BOSS_CAST_VOLLEY, PROJ_ARROW, PROJ_GLOBE } from '../sim/sim';
import type { SfxName } from '../audio/sfx';
import type { MassKillPlay } from './massKill';
import { roomTrack } from './roomTrack';

const WEAPON_SFX: Record<ClassId, SfxName> = { fallen: 'shotgun', heretic: 'censerLaunch', binder: 'chaingun', betrayer: 'revolver' };
/** Secondary attacks (M9 §5.2); others' Silver Bullets sound from their event instead. */
const SECONDARY_SFX: Record<ClassId, SfxName> = { fallen: 'slug', heretic: 'sacrament', binder: 'scourge', betrayer: 'silverBullet' };
const ABILITY_SFX: Record<string, SfxName> = {
  'fallen:Q': 'blasphemy',
  'heretic:Q': 'communion',
  'heretic:E': 'shroud',
  'binder:Q': 'chains',
  'binder:E': 'discord',
  'betrayer:Q': 'fieldOfBlood',
  'betrayer:E': 'shadowstep',
};
/** An enemy melee blow: a Blessed attacking within this horizontal distance. */
const MELEE_REACH = 1.6;
const NO_STATE = 255;

export class GameSounds {
  private lastReflection = -Infinity;
  private readonly lastShots = new Map<number, number>();
  private readonly lastShots2 = new Map<number, number>();
  /** Others' events play after the render delay, like their effects (seconds). */
  renderDelay = 0;
  private readonly enemyState = new Uint8Array(ENEMY_SLOTS).fill(NO_STATE);
  private tickSecond = 0;
  private readonly tells = new Map<number, VoiceHandle>();
  private readonly arrivalTells = new Map<number, VoiceHandle>();
  private fireAmbient: VoiceHandle | undefined;
  /** Ambient fire uses an admitted finite voice, so it shares the unchanged caps/stealing rules. */
  hazard(at: SoundPos | null): void {
    if (!at) { this.fireAmbient?.stop(); this.fireAmbient = undefined; return; }
    if (!this.fireAmbient?.playing()) this.fireAmbient = sfx('refinerFire', at, 0.55, 0, 0);
  }
  private readonly steps = new Map<number, { incarnation: number; x: number; y: number; distance: number }>();

  /** Resume only the remaining tell; snapshot omission/control/disposal stops the actual voice. */
  dominions(rings: readonly DominionRing[], tick: number): void {
    for (const [id, handle] of this.tells) if (!rings.some((c) => c.castId === id)) { handle.stop(); this.tells.delete(id); }
    for (const c of rings) {
      if (this.tells.get(c.castId)?.playing()) continue;
      const handle = sfx('dominionTell', c, 1, 0, PRIO_ABILITY, 1, { elapsed: (tick - c.startTick) / 30, duration: (c.impactTick - c.startTick) / 30 });
      if (handle) this.tells.set(c.castId, handle);
    }
  }

  private readonly familyVoices = new Map<number, { key: string; handle?: VoiceHandle }>();
  commanders(casts: readonly CommanderCast[], tick: number): void {
    for (const [slot, voice] of this.familyVoices) if (!casts.some((c) => c.slot === slot)) { voice.handle?.stop(); this.familyVoices.delete(slot); }
    for (const c of casts) {
      const key = `${c.incarnation}:${c.castId}:${c.phase}`, old = this.familyVoices.get(c.slot);
      if (old?.key === key && (old.handle?.playing() || c.phase === 'recover')) continue;
      old?.handle?.stop();
      if (c.kind === 'beam' && c.phase === 'tell' && old?.key !== key) sfx('cantorBook', c);
      const name: SfxName = c.kind === 'beam' ? c.phase === 'tell' ? 'cantorTell' : c.phase === 'active' ? 'cantorBeam' : c.phase === 'recover' ? 'cantorBook' : 'cantorHum'
        : c.phase === 'tell' ? 'carrierMark' : c.phase === 'active' ? 'carrierSwoop' : c.phase === 'carry' ? 'carrierWings' : c.phase === 'recover' ? 'carrierRelease' : 'carrierHum';
      const duration = c.phase === 'idle' ? 1 : Math.max(0.01, (c.endTick - c.phaseTick) / 30);
      const handle = sfx(name, c, c.phase === 'idle' ? 0.35 : 1, 0, c.phase === 'idle' ? 0 : PRIO_ABILITY, 1,
        c.phase === 'idle' || c.phase === 'carry' ? undefined : { elapsed: (tick - c.phaseTick) / 30, duration });
      this.familyVoices.set(c.slot, { key, handle });
    }
  }

  arrivals(warnings: readonly SpawnWarning[], tick: number): void {
    for (const [id, handle] of this.arrivalTells) if (!warnings.some((w) => w.id === id && tick < w.readyTick)) { handle.stop(); this.arrivalTells.delete(id); }
    for (const w of warnings) {
      if (this.arrivalTells.has(w.id) || tick < w.startTick || tick >= w.readyTick) continue;
      const handle = sfx('spawnWarning', w, 1, 0, PRIO_OTHERS, 1, { elapsed: (tick - w.startTick) / 30, duration: 1 });
      if (handle) this.arrivalTells.set(w.id, handle);
    }
  }

  constructor(
    private readonly map: GameMap,
    private readonly localId: number,
    private readonly classOf: (playerId: number) => ClassId | undefined,
  ) {
    audio()?.music.keepStings(true);
  }

  /** The local player's own attack; Sacrament's chime plays at the healed ally. */
  ownShot(classId: ClassId, secondary: boolean, at: SoundPos | null = null): void {
    sfx(secondary ? SECONDARY_SFX[classId] : WEAPON_SFX[classId], at);
  }

  hit(): void {
    sfx('hitTick');
  }

  /** Low HP's heartbeat (M12 §6.2). */
  heartbeat(): void {
    sfx('heartbeat');
  }

  /** Your Falling Star lands, as its leap ends (M12 §5.2). */
  ownLanding(): void {
    sfx('fallingStarLand');
  }

  /** Your Shadowstep's dagger cut, with the first-person slash as the dash starts (M12 §5.7). */
  ownDaggerCut(): void {
    sfx('daggerCut');
  }

  /** An own kill; a predicted one climbs the pitch ladder at an exact `rate` (M12 §4.4). */
  kill(rate?: number): void {
    sfx('killTick', null, 1, 0, undefined, rate);
  }

  /** A burst death bursts (M12 §4.3): your own at PRIO_ABILITY, others' at PRIO_OTHERS. */
  burstPop(at: SoundPos, mine: boolean): void {
    sfx('burstPop', at, 1, 0, mine ? PRIO_ABILITY : PRIO_OTHERS);
  }

  /** A mass kill (M12 §4.3): yours without position at PRIO_ABILITY, others' at its position. */
  massKill(m: MassKillPlay): void {
    if (m.mine) sfx('massKill', null, m.gain, 0, PRIO_ABILITY, m.rate);
    else sfx('massKill', { x: m.x, y: m.y }, m.gain, 0, PRIO_OTHERS, m.rate);
  }

  /** An enemy disappeared (died), when its feather burst plays. */
  enemyDeath(type: number, at: SoundPos): void {
    if (type !== GATEKEEPER) sfx('blessedDeath', at);
  }

  /** A censer broke (M9 §5.2). */
  censerBreak(at: SoundPos): void {
    sfx('censerBreak', at);
  }

  /** The local player stepped into a Field of Blood (M9 §5.2). */
  fieldEntered(): void {
    sfx('fieldEntered');
  }

  abilityReady(): void {
    sfx('abilityReady');
  }

  levelUp(): void { sfx('abilityReady'); sfx('goldPickup', null, .6, .12); }
  /** A clear reward arriving from the sky (audit batch 3); heard room-wide, not positional. */
  rewardArrived(): void { sfx('rewardArrive'); }

  /**
   * A complete snapshot: others' shots, enemy casts, new projectiles, the Gatekeeper, own HP changes,
   * music. While `beamed` (a Sacrament beam is on the local player), HP rising doesn't chime (M9 §5.1).
   */
  snapshot(s: Snapshot, prev: Snapshot | null, beamed = false): void {
    // The countdown's last 5 s: a tick with each number (M8 §5).
    const second = s.activePhase === PHASE_COUNTDOWN ? Math.ceil(s.countdown / 10 - 1e-6) : 0;
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
    // Others' secondaries (M9 §5.2): Sacrament chimes at the healed ally; Silver Bullets sound from their event.
    for (const p of s.players) {
      const last = this.lastShots2.get(p.id);
      this.lastShots2.set(p.id, p.shots2);
      if (p.id === this.localId || last === undefined || p.dead) continue;
      const n = (p.shots2 - last) & 0xff;
      const cls = this.classOf(p.id);
      if (!cls || cls === 'betrayer') continue;
      const at = cls === 'heretic' ? (s.players.find((q) => q.id === p.beam) ?? p) : p;
      for (let i = 0; i < n; i++) sfx(SECONDARY_SFX[cls], at, 1, (i * gap) / n, PRIO_OTHERS);
    }
    // Enemy wind-ups.
    const liveDominions = new Set<number>();
    for (let i = 0; i < s.enemyCount; i++) {
      const slot = s.enemySlot[i];
      const st = s.enemyState[i];
      const type = s.enemyType[i];
      if (type === DOMINION) {
        liveDominions.add(slot);
        const x = s.enemyX[i], y = s.enemyY[i], incarnation = s.enemyIncarnation[i];
        let step = this.steps.get(slot);
        if (!step || step.incarnation !== incarnation) {
          step = { incarnation, x, y, distance: 0 }; this.steps.set(slot, step); sfx('dominionStep', { x, y }, 1, 0, PRIO_OTHERS);
        } else {
          const distance = Math.hypot(x - step.x, y - step.y); step.x = x; step.y = y;
          if (distance < 2) step.distance += distance;
          if (step.distance >= 1.2) { step.distance %= 1.2; sfx('dominionStep', { x, y }, 1, 0, PRIO_OTHERS); }
        }
      }
      if (st === ST_WINDUP && this.enemyState[slot] !== ST_WINDUP) {
        const at = { x: s.enemyX[i], y: s.enemyY[i] };
        if (type === CHORISTER) sfx('choristerWindup', at);
        else if (type === CHERUB || type === CARRIER) sfx('cherubWindup', at);
      }
      this.enemyState[slot] = st;
    }
    for (const slot of this.steps.keys()) if (!liveDominions.has(slot)) this.steps.delete(slot);
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
      if (s.projKind[i] === PROJ_GLOBE && !volleyFired) sfx('orbFired', at);
      else if (s.projKind[i] === PROJ_ARROW) sfx('arrowFired', at);
    }
    // Own HP and shield.
    const me = s.players.find((p) => p.id === this.localId);
    const was = prev.players.find((p) => p.id === this.localId);
    if (me && was && !me.dead && !was.dead) {
      if (me.hp + me.shield < was.hp + was.shield) {
        sfx('hurt');
        if (this.blessedStriking(s, me)) sfx('meleeHit');
      } else if (me.hp > was.hp && !beamed) sfx('healed');
      if (me.shield > 0 && me.shield > was.shield) sfx('shieldUp');
      else if (was.shield > 0 && me.shield === 0) sfx('shieldBroken');
    }
    this.music(s);
  }

  /** A game event's sound. `pose` gives a player's position. */
  event(e: GameEvent, pose: (id: number) => SoundPos | undefined): void {
    switch (e.type) {
      case 'itemUsed':
        sfx(e.item === 'balm' ? 'motePickup' : e.item === 'seal' ? 'shroud' : e.item === 'feather' ? 'fallingStarLeap' : 'porcelainBreak', { x: e.x, y: e.y }, .55);
        break;
      case 'itemEffectActivated':
        sfx(e.effect.item === 'chain' ? 'chains' : e.effect.item === 'mirror' ? 'shroud' : 'censerBreak', { x: e.effect.x, y: e.effect.y }, .45);
        break;
      case 'itemReflected': {
        const now = performance.now();
        if (now - this.lastReflection >= 250) { sfx('goldPickup', { x: e.x, y: e.y }, .5); this.lastReflection = now; }
        break;
      }
      case 'crest':
        sfx('crest');
        break;
      case 'abilityUsed': {
        const key = `${this.classOf(e.playerId)}:${e.slot}`;
        const at = { x: e.x, y: e.y };
        if (key === 'fallen:E') {
          // The leap from where the Fallen is; the landing sounds when it lands (M12 §5.2).
          sfx('fallingStarLeap', e.playerId === this.localId ? null : (pose(e.playerId) ?? at));
        } else if (ABILITY_SFX[key]) sfx(ABILITY_SFX[key], key === 'betrayer:Q' || key === 'binder:Q' || key === 'binder:E' ? at : (pose(e.playerId) ?? at));
        break;
      }
      case 'shroudBurst':
        sfx('shroudBurst', { x: e.x, y: e.y });
        break;
      case 'starLanded':
        // Others' landings after the render delay, where they land; the own one played as its leap ended.
        if (e.playerId !== this.localId) sfx('fallingStarLand', { x: e.x, y: e.y }, 1, this.renderDelay);
        break;
      case 'dashCut':
        // Others' dagger cuts at the streak's start, after the render delay (M12 §5.7).
        if (e.playerId !== this.localId) sfx('daggerCut', { x: e.x0, y: e.y0 }, 1, this.renderDelay);
        break;
      case 'globeShatter':
        // Shot down, a little higher (M12 follow-up §1.3).
        sfx('globeShatter', { x: e.x, y: e.y }, e.by >= 0 ? 1.2 : 1, this.renderDelay);
        break;
      case 'silverBullet':
        if (e.playerId !== this.localId) sfx('silverBullet', { x: e.x, y: e.y }, 1, this.renderDelay, PRIO_OTHERS);
        break;
      case 'playerDied':
        sfx('death', e.playerId === this.localId ? null : (pose(e.playerId) ?? null));
        break;
      case 'playerRespawned':
      case 'playerRevived':
        sfx('revive', e.playerId === this.localId ? null : (pose(e.playerId) ?? null));
        break;
      case 'roomState':
        if (e.phase === PHASE_COMBAT) {
          sfx('doorsSeal');
          const p = pose(this.localId), r = this.map.rooms[e.room];
          if (r.hazards?.length && p && this.map.roomOf[Math.floor(p.y) * this.map.w + Math.floor(p.x)] === e.room) sfx('refinerIgnite', null);
        }
        else if (e.phase === PHASE_CLEARED && this.map.rooms[e.room].kind === 'combat') sfx('arenaCleared');
        break;
      case 'pickupCollected':
        sfx(e.kind === COIN || e.kind === GOLD_HALO ? 'goldPickup' : 'motePickup', { x: e.x, y: e.y });
        break;
      case 'propBroken':
        sfx(e.family === 'loot' ? 'porcelainBreak' : e.family === 'blast' ? 'blastLampCrack' : 'chaliceHeal', { x: e.x, y: e.y });
        break;
      case 'propBlast':
        sfx('blastLampBurst', { x: e.x, y: e.y });
        break;
      case 'dominionCast':
        if (e.phase !== 'start') { this.tells.get(e.cast.castId)?.stop(); this.tells.delete(e.cast.castId); }
        if (e.phase === 'strike') sfx('dominionSlam', { x: e.x, y: e.y }, 1, 0, PRIO_ABILITY);
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

  /**
   * The active room's track in combat, the calm one otherwise; the next likely one (the room counting
   * down, or the first room not cleared) is decoded ahead.
   */
  private music(s: Snapshot): void {
    if (s.activePhase === PHASE_COMBAT) {
      setMusic(roomTrack(this.map, s.activeRoom), 'calm');
      return;
    }
    let next = s.activePhase === PHASE_COUNTDOWN ? s.activeRoom : -1;
    for (let i = 0; next < 0 && i < this.map.rooms.length; i++) if (!roomCleared(s.clearedMask, i)) next = i;
    setMusic('calm', next >= 0 && next < this.map.rooms.length ? roomTrack(this.map, next) : null);
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
    for (const v of this.familyVoices.values()) v.handle?.stop(); this.familyVoices.clear();
    this.fireAmbient?.stop(); this.fireAmbient = undefined;
    for (const handle of this.tells.values()) handle.stop(); this.tells.clear(); this.steps.clear();
    for (const handle of this.arrivalTells.values()) handle.stop(); this.arrivalTells.clear();
    audio()?.music.keepStings(false);
  }
}
