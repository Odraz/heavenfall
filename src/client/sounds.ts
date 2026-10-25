import type { CommanderCast } from '../data/commanders';
import { WATCHMAN_AIM_TICKS, type WatchmanAim } from '../data/watchman';
/**
 * The game's sound effects and music (M8 §9.1, §9.2), driven by what the client already knows: its
 * own input, snapshot changes and events.
 */
import { audio, setMusic, sfx, type SoundPos, type VoiceHandle } from '../audio/audio';
import { PRIO_ABILITY, PRIO_OTHERS } from '../audio/sfx';
import { ALT_START_CUE, CueLimiter, interactionCue, ITEM_LAND_CUE, ITEM_USE_CUE, LIMITED_CUES, TALENT_FX_CUE, type InteractKind } from './cueMap';
import type { ClassId } from '../data/classes';
import { COIN, GOLD_HALO, KEY } from '../data/pickups';
import { BLESSED, CARRIER, CHERUB, CHORISTER, DOMINION, GATEKEEPER, ST_ATTACKING, ST_WINDUP } from '../data/enemies';
import type { DominionRing } from './dominionView';
import type { SpawnWarning } from '../data/spawns';
import type { GameEvent } from '../net/messages';
import { PHASE_CLEARED, PHASE_COMBAT, PHASE_COUNTDOWN, type Snapshot } from '../net/protocol';
import { ENEMY_SLOTS, TICK_MS } from '../sim/constants';
import { roomCleared, type GameMap } from '../sim/map';
import { BOSS_CAST_JUDGMENT, BOSS_CAST_TOLL, BOSS_CAST_VOLLEY, PROJ_ARROW, PROJ_GLOBE } from '../sim/sim';
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
  private readonly lastShots = new Map<number, number>();
  private readonly lastShots2 = new Map<number, number>();
  /** Others' events play after the render delay, like their effects (seconds). */
  renderDelay = 0;
  private readonly enemyState = new Uint8Array(ENEMY_SLOTS).fill(NO_STATE);
  private tickSecond = 0;
  private readonly tells = new Map<number, VoiceHandle>();
  private readonly arrivalTells = new Map<number, VoiceHandle>();
  private fireAmbient: VoiceHandle | undefined;
  private incenseAmbient: VoiceHandle | undefined;
  private confessionalAmbient: VoiceHandle | undefined;
  /** State and relic cue families: at most four per second each (cueMap.ts). */
  private readonly limiter = new CueLimiter();
  /** Every cue this class played, by name: the repetition census (R8 stage 5). */
  readonly census: Record<string, number> = {};
  /** Ambient fire uses an admitted finite voice, so it shares the unchanged caps/stealing rules. */
  hazard(at: SoundPos | null): void {
    if (!at) { this.fireAmbient?.stop(); this.fireAmbient = undefined; return; }
    if (!this.fireAmbient?.playing()) this.fireAmbient = sfx('refinerFire', at, 0.55, 0, 0);
  }

  /** The nearest incense cloud within 12 m: one looped voice for all of them (asset-coverage.md). */
  incense(at: SoundPos | null): void {
    if (!at) { this.incenseAmbient?.stop(); this.incenseAmbient = undefined; return; }
    if (!this.incenseAmbient?.playing()) this.incenseAmbient = sfx('incense', at, 0.5, 0, 0);
  }

  /** The Confessional's air while the local player stands inside it. */
  confessional(inside: boolean): void {
    if (!inside) { this.confessionalAmbient?.stop(); this.confessionalAmbient = undefined; return; }
    if (!this.confessionalAmbient?.playing()) this.confessionalAmbient = sfx('confessionalAmbience', null, 1, 0, 0);
  }

  /** Plays a cue, applying the state/relic rate limit, and counts it for the census. */
  private play(name: SfxName, at: SoundPos | null = null, gain = 1, when = 0, priority?: number): void {
    if (LIMITED_CUES.has(name) && !this.limiter.admit(name, performance.now())) return;
    this.census[name] = (this.census[name] ?? 0) + 1;
    sfx(name, at, gain, when, priority);
  }

  /** The own interaction's result: purchase, Chart or refusal (never a success sound on refusal). */
  interaction(accepted: boolean, kind: InteractKind | undefined): void {
    const name = interactionCue(accepted, kind);
    if (name) this.play(name);
  }

  /** Own progression and route moments, each its own cue (asset-coverage.md R3–R6 rows). */
  riteOffer(): void { this.play('riteOffer'); }
  riteTaken(): void { this.play('riteTaken'); }
  relicClaim(): void { this.play('relicClaim'); }
  chestOpen(at: SoundPos): void { this.play('chestOpen', at); }
  bell(at: SoundPos): void { this.play('judgmentBell', at); }
  teleport(phase: 'start' | 'arrive', at: SoundPos | null): void { this.play(phase === 'start' ? 'teleportStart' : 'teleportArrive', at); }
  private readonly steps = new Map<number, { incarnation: number; x: number; y: number; distance: number }>();

  /** Resume only the remaining tell; snapshot omission/control/disposal stops the actual voice. */
  dominions(rings: readonly DominionRing[], tick: number): void {
    for (const [id, handle] of this.tells) if (!rings.some((c) => c.castId === id)) { handle.stop(); this.tells.delete(id); }
    for (const c of rings) {
      if (this.tells.get(c.castId)?.playing()) continue;
      const handle = sfx('dominionTell', c, 1, 0, undefined, 1, { elapsed: (tick - c.startTick) / 30, duration: (c.impactTick - c.startTick) / 30 });
      if (handle) this.tells.set(c.castId, handle);
    }
  }

  private readonly aimVoices = new Map<number, { key: string; handle?: VoiceHandle }>();
  /**
   * The Watchman's rising note (rogue rooms.md §6.4) over each aim, at the Watchman; a rejoin resumes
   * the remaining note. An aim that ends without its record (canceled) stops the note.
   */
  watchmen(aims: ReadonlyArray<{ aim: WatchmanAim; at: SoundPos }>, tick: number): void {
    const key = (a: WatchmanAim) => `${a.incarnation}:${a.fireTick}`;
    for (const [slot, v] of this.aimVoices) if (!aims.some(({ aim }) => aim.slot === slot && aim.phase === 'aim' && key(aim) === v.key)) { v.handle?.stop(); this.aimVoices.delete(slot); }
    for (const { aim, at } of aims) {
      if (aim.phase !== 'aim' || this.aimVoices.get(aim.slot)?.key === key(aim)) continue;
      const handle = sfx('watchmanAim', at, 1, 0, undefined, 1, { elapsed: Math.max(0, tick - (aim.fireTick - WATCHMAN_AIM_TICKS)) / 30, duration: WATCHMAN_AIM_TICKS / 30 });
      this.aimVoices.set(aim.slot, { key: key(aim), handle });
    }
  }

  /** One accepted Watchman shot, played once per `shot` counter change. */
  watchmanShot(at: SoundPos): void {
    sfx('watchmanShot', at, 1, 0, PRIO_ABILITY);
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
      const handle = sfx(name, c, c.phase === 'idle' ? 0.35 : 1, 0, c.phase === 'idle' ? 0 : undefined, 1,
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
    /** A player's assigned alternative ability in a slot, if it holds one (R4–R5). */
    private readonly altOf: (playerId: number, slot: 'Q' | 'E') => string | undefined = () => undefined,
    /** The drawn tick, so a fire update that only puts cells out stays silent. */
    private readonly tick: () => number = () => 0,
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

  levelUp(): void { this.play('levelUp'); }
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

  /** Relic sounds batch by kind: at most one per kind per 0.25 s (items-relics.md §2.4 rule 10). */
  private relicSound(name: SfxName, at: SoundPos): void {
    this.play(name, at, 0.6);
  }

  /** A game event's sound. `pose` gives a player's position. */
  event(e: GameEvent, pose: (id: number) => SoundPos | undefined): void {
    switch (e.type) {
      case 'itemUsed': {
        const name = ITEM_USE_CUE[e.item];
        if (name) this.play(name, e.playerId === this.localId ? null : { x: e.x, y: e.y });
        break;
      }
      case 'itemEffectActivated': {
        const name = ITEM_LAND_CUE[e.effect.item];
        if (name) this.play(name, { x: e.effect.x, y: e.effect.y });
        break;
      }
      case 'itemReflected':
        this.play('item-mirror-return', { x: e.x, y: e.y }, .6);
        break;
      case 'crest':
        sfx('crest');
        break;
      case 'relicArea':
        if (!e.end) this.relicSound('relic-rune', { x: e.area.x, y: e.area.y });
        break;
      case 'relicShot':
        if (!e.end) this.relicSound(e.shot.effect === 'sentence3' ? 'relic-stamp' : e.shot.effect === 'wheel' || e.shot.effect === 'harrow' ? 'relic-wheel' : 'relic-ember', { x: e.shot.x, y: e.shot.y });
        break;
      case 'relicFx':
        if (e.kind === 'shield') this.relicSound('shieldUp', { x: e.x, y: e.y });
        else if (e.kind === 'burst') this.relicSound(e.effect === 'appeal' ? 'relic-stamp' : e.effect === 'sentence3' ? 'relic-stamp' : 'relic-chorus', { x: e.x, y: e.y });
        else this.relicSound(e.effect === 'tile' ? 'state-bind' : 'relicRing', { x: e.x, y: e.y });
        break;
      case 'streak':
        // Your own tier only, rising with the tier (m12-followup-2.md §3.2).
        if (e.playerId === this.localId) sfx('streakTier', null, 1, 0, undefined, 2 ** (2 * e.tier / 12));
        break;

      // The Betrayer's three alternatives sound from their areas; fire areas go out with a hiss.
      case 'talentArea': {
        const at = { x: e.area.x, y: e.area.y };
        if (!e.end && e.area.kind === 'coin') this.play('judasCoinSpin', at);
        else if (!e.end && e.area.kind === 'wire') this.play('silverWirePlace', at);
        else if (!e.end && e.area.kind === 'shadow') this.play('wayBackMarker', at, 0.8);
        else if (e.end && e.reason === 'split') this.play('judasCoinSplit', at);
        else if (e.end && (e.area.kind === 'rain' || e.area.kind === 'furrow')) this.play('fireOut', at);
        break;
      }
      case 'wayBack':
        this.play('wayBackReturn', e.playerId === this.localId ? null : { x: e.x0, y: e.y0 }, 0.9);
        break;
      case 'talentFx': {
        // Payload cues, once per effect (never per enemy reached), at its first point after the render delay.
        const name = TALENT_FX_CUE[e.kind];
        if (name && e.pts.length >= 2) this.play(name, { x: e.pts[0], y: e.pts[1] }, 0.6, this.renderDelay);
        break;
      }
      case 'fire': {
        // A patch catches fire: only an update that adds burning cells, not one that puts cells out.
        const live = e.cells.findIndex((_, i) => e.ends[i] > this.tick());
        if (live >= 0) this.play('state-fire', { x: e.cells[live] % this.map.w + 0.5, y: Math.floor(e.cells[live] / this.map.w) + 0.5 }, 0.6, this.renderDelay);
        break;
      }
      case 'launched':
        if (e.slots.length) this.play('state-launch', e.playerId === this.localId ? null : (pose(e.playerId) ?? null), 0.7, e.playerId === this.localId ? 0 : this.renderDelay);
        break;
      case 'bargain':
        this.play('bargainAccept', e.playerId === this.localId ? null : (pose(e.playerId) ?? null));
        break;
      case 'abilityUsed': {
        const key = `${this.classOf(e.playerId)}:${e.slot}`;
        const at = { x: e.x, y: e.y };
        const alt = this.altOf(e.playerId, e.slot);
        if (alt) { if (ALT_START_CUE[alt]) this.play(ALT_START_CUE[alt], e.playerId === this.localId ? null : at); break; }
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
        this.play(e.kind === COIN || e.kind === GOLD_HALO ? 'goldPickup' : e.kind === KEY ? 'keyPickup' : 'motePickup', { x: e.x, y: e.y });
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
      case 'bossCast': {
        // Judgment keeps its drone, blast and breaking glass; the Toll and the Call have their own wind-ups.
        const cast = e.cast ?? BOSS_CAST_JUDGMENT;
        if (cast === BOSS_CAST_JUDGMENT) sfx(e.phase === 'start' ? 'judgmentCharge' : e.phase === 'completed' ? 'judgmentBlast' : 'interrupted');
        else if (cast === BOSS_CAST_TOLL) { if (e.phase === 'start') sfx('tollTell'); else if (e.phase === 'completed') sfx('tollImpact'); }
        break;
      }
      case 'called':
        if (e.phase === 'tell') sfx('callTell');
        break;
      case 'sealBroken': sfx('sealBreak', pose(e.playerId) ?? null); break;
      case 'judged': if (e.by === 'seal') sfx('callReleased'); break;
      case 'hostDescend': sfx('hostDescend'); break;
      case 'watchersOpen': sfx('watcherOpen'); break;
      case 'watcherBreak': sfx('watcherBreak', { x: e.x, y: e.y }); break;
      case 'bossPhase': if (e.phase === 2) this.play('bossTransition'); else if (e.phase === 0) this.play('bossDefeat'); break;
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

  /** A Gatekeeper cue the client decides itself (the ring's whoosh, Judgment's pre-warning). */
  bossCue(name: 'tollPersonalWhoosh' | 'judgmentPrewarn'): void {
    sfx(name);
  }

  dispose(): void {
    for (const v of this.familyVoices.values()) v.handle?.stop(); this.familyVoices.clear();
    for (const v of this.aimVoices.values()) v.handle?.stop(); this.aimVoices.clear();
    this.fireAmbient?.stop(); this.fireAmbient = undefined;
    this.incenseAmbient?.stop(); this.incenseAmbient = undefined;
    this.confessionalAmbient?.stop(); this.confessionalAmbient = undefined;
    for (const handle of this.tells.values()) handle.stop(); this.tells.clear(); this.steps.clear();
    for (const handle of this.arrivalTells.values()) handle.stop(); this.arrivalTells.clear();
    audio()?.music.keepStings(false);
  }
}
