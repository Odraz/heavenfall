/**
 * Every sound effect as a synthesizer parameter set (M8 §9.1). Each is a named entry, so a file can
 * replace one later without touching its callers.
 */
import type { SoundDef, SynthPart } from './synth';

/**
 * Voice-stealing priority (M8 §9.1): warnings of incoming damage (rogue game.md §1.3: audible through
 * the crest) > own weapon and hurt (and the UI) > abilities, revive and the Gatekeeper > others'
 * weapons > enemies > hits.
 */
export const PRIO_WARNING = 5;
export const PRIO_OWN = 4;
export const PRIO_ABILITY = 3;
export const PRIO_OTHERS = 2;
export const PRIO_ENEMY = 1;
export const PRIO_HIT = 0;

export interface SfxDef extends SoundDef {
  priority: number;
  /** UI sounds play without the ±5% pitch variation. */
  ui?: boolean;
  /** Loops while playing (the revive hum), its pitch set by the caller. */
  loop?: boolean;
}

/** A part with the envelope's defaults filled in. */
function part(p: Partial<SynthPart> & Pick<SynthPart, 'wave' | 'freq'>): SynthPart {
  return { attack: 0.002, decay: 0.05, sustain: 0.5, hold: 0, release: 0.08, volume: 0.5, ...p };
}

export const SFX = {
  cantorHum: { priority: PRIO_ENEMY, parts: [part({ wave: 'sine', freq: 130, attack: 0.2, hold: 0.6, release: 0.2, volume: 0.12 })] },
  cantorBook: { priority: PRIO_ENEMY, parts: [part({ wave: 'noise', freq: 350, decay: 0.04, release: 0.12, volume: 0.22, lowpass: 600 })] },
  cantorTell: { priority: PRIO_WARNING, parts: [part({ wave: 'triangle', freq: 220, freqEnd: 440, attack: 0.1, hold: 2.2, release: 0.15, volume: 0.22 }), part({ wave: 'sine', freq: 330, freqEnd: 660, attack: 0.2, hold: 2.1, release: 0.15, volume: 0.15 })] },
  cantorBeam: { priority: PRIO_ABILITY, parts: [part({ wave: 'triangle', freq: 440, attack: 0.05, hold: 2.8, release: 0.1, volume: 0.22 }), part({ wave: 'sine', freq: 660, attack: 0.05, hold: 2.8, release: 0.1, volume: 0.15 })] },
  carrierHum: { priority: PRIO_ENEMY, parts: [part({ wave: 'sine', freq: 260, freqEnd: 220, attack: 0.2, hold: 0.6, release: 0.2, volume: 0.12 })] },
  carrierMark: { priority: PRIO_WARNING, parts: [part({ wave: 'triangle', freq: 330, freqEnd: 1320, attack: 0.1, hold: 0.7, release: 0.15, volume: 0.22 })] },
  carrierSwoop: { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 2200, attack: 0.15, hold: 0.15, release: 0.15, lowpass: 2200, volume: 0.25 })] },
  carrierWings: { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 500, attack: 0.12, decay: 0.12, hold: 0.25, release: 0.2, lowpass: 900, volume: 0.25 })] },
  carrierRelease: { priority: PRIO_ENEMY, parts: [part({ wave: 'noise', freq: 900, attack: 0.1, release: 0.4, lowpass: 1200, volume: 0.16 })] },
  dominionStep: { priority: PRIO_ENEMY, parts: [part({ wave: 'noise', freq: 500, decay: 0.03, release: 0.09, volume: 0.15, lowpass: 900 }), part({ wave: 'sine', freq: 85, freqEnd: 45, decay: 0.06, release: 0.08, volume: 0.25 })] },
  spawnWarning: { priority: PRIO_OTHERS, parts: [part({ wave: 'triangle', freq: 440, freqEnd: 660, attack: 0.04, decay: 0.08, hold: 0.65, release: 0.12, volume: 0.2 })] },
  crest: { priority: PRIO_ABILITY, parts: [part({ wave: 'triangle', freq: 220, attack: 0.12, decay: 0.3, hold: 0.6, release: 0.3, volume: 0.2 }), part({ wave: 'sine', freq: 330, attack: 0.15, decay: 0.3, hold: 0.6, release: 0.3, volume: 0.18 })] },
  dominionTell: { priority: PRIO_WARNING, parts: [part({ wave: 'triangle', freq: 150, freqEnd: 540, attack: 0.08, decay: 0.2, hold: 1.02, release: 0.2, volume: 0.35 }), part({ wave: 'noise', freq: 3000, attack: 0.08, decay: 0.15, release: 0.15, volume: 0.12, lowpass: 1400 })] },
  // The Watchman (rooms.md §6.4): a single rising brass note over the 1 s aim, then a sharp crack with a brass bark.
  watchmanAim: { priority: PRIO_WARNING, parts: [part({ wave: 'saw', freq: 233, freqEnd: 466, attack: 0.06, decay: 0.1, sustain: 0.8, hold: 0.84, release: 0.06, volume: 0.16, lowpass: 1800 }), part({ wave: 'triangle', freq: 466, freqEnd: 932, attack: 0.1, hold: 0.8, release: 0.06, volume: 0.1 })] },
  watchmanShot: { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 9000, decay: 0.03, release: 0.1, volume: 0.5, lowpass: 6000, lowpassEnd: 1200 }), part({ wave: 'saw', freq: 520, freqEnd: 260, decay: 0.05, release: 0.12, volume: 0.22, lowpass: 2400 })] },
  dominionSlam: { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 2600, decay: 0.1, release: 0.2, volume: 0.55, lowpass: 2400 }), part({ wave: 'sine', freq: 110, freqEnd: 32, decay: 0.1, release: 0.3, volume: 0.65 })] },
  refinerIgnite: { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 4000, attack: 0.05, decay: 0.3, release: 0.5, volume: 0.3, lowpass: 2500 })] },
  refinerFire: { priority: PRIO_ENEMY, loop: true, parts: [part({ wave: 'noise', freq: 4500, attack: 0.1, decay: 0.1, hold: 0.8, release: 0.1, volume: 0.12, lowpass: 2600 })] },
  incense: { priority: PRIO_ENEMY, loop: true, parts: [part({ wave: 'noise', freq: 6500, attack: 0.1, decay: 0.1, hold: 0.8, release: 0.1, volume: 0.08, lowpass: 3200 })] },
  porcelainBreak: { priority: PRIO_OTHERS, parts: [part({ wave: 'noise', freq: 7000, decay: 0.02, release: 0.14, volume: 0.35 }), part({ wave: 'sine', freq: 1700, decay: 0.05, release: 0.12, volume: 0.15 })] },
  blastLampCrack: { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 11000, decay: 0.02, release: 0.09, volume: 0.25 })] },
  blastLampBurst: { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 1500, decay: 0.08, release: 0.2, volume: 0.6, lowpass: 2200 }), part({ wave: 'sine', freq: 90, freqEnd: 35, decay: 0.1, release: 0.25, volume: 0.5 })] },
  chaliceHeal: { priority: PRIO_ABILITY, parts: [part({ wave: 'sine', freq: 660, freqEnd: 880, decay: 0.12, release: 0.25, volume: 0.25 }), part({ wave: 'sine', freq: 990, decay: 0.08, release: 0.3, volume: 0.1 })] },
  // R6 relics and streaks: synthesized stand-ins until the S5 recordings (asset-manifest.md relic-* rows).
  'relic-rune': { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 900, attack: 0.02, decay: 0.2, release: 0.3, volume: 0.22, lowpass: 900 }), part({ wave: 'triangle', freq: 392, freqEnd: 294, decay: 0.15, release: 0.25, volume: 0.15 })] },
  'relic-ember': { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 5000, decay: 0.05, release: 0.2, volume: 0.2, lowpass: 3000 }), part({ wave: 'sine', freq: 520, freqEnd: 780, decay: 0.08, release: 0.15, volume: 0.12 })] },
  'relic-wheel': { priority: PRIO_ABILITY, parts: [part({ wave: 'square', freq: 180, freqEnd: 240, attack: 0.02, decay: 0.2, hold: 0.25, release: 0.15, volume: 0.1, duty: 0.3 }), part({ wave: 'noise', freq: 2500, attack: 0.02, hold: 0.3, release: 0.15, volume: 0.1, lowpass: 1800 })] },
  'relic-stamp': { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 1800, decay: 0.06, release: 0.18, volume: 0.45, lowpass: 1600 }), part({ wave: 'sine', freq: 120, freqEnd: 50, decay: 0.1, release: 0.2, volume: 0.45 })] },
  'relic-chorus': { priority: PRIO_ABILITY, parts: [part({ wave: 'triangle', freq: 523, attack: 0.02, decay: 0.2, hold: 0.15, release: 0.3, volume: 0.18 }), part({ wave: 'triangle', freq: 659, attack: 0.03, decay: 0.2, hold: 0.15, release: 0.3, volume: 0.14 }), part({ wave: 'triangle', freq: 784, attack: 0.04, decay: 0.2, hold: 0.15, release: 0.3, volume: 0.12 })] },
  relicRing: { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 3500, attack: 0.01, decay: 0.08, release: 0.25, volume: 0.25, lowpass: 2600 }), part({ wave: 'sine', freq: 880, freqEnd: 1320, decay: 0.06, release: 0.15, volume: 0.1 })] },
  judgmentBell: { priority: PRIO_ABILITY, parts: [part({ wave: 'sine', freq: 196, attack: 0.005, decay: 0.4, sustain: 0.4, hold: 0.6, release: 1.6, volume: 0.45 }), part({ wave: 'sine', freq: 466, attack: 0.005, decay: 0.3, sustain: 0.3, hold: 0.4, release: 1.2, volume: 0.18 }), part({ wave: 'triangle', freq: 98, attack: 0.01, decay: 0.5, hold: 0.5, release: 1.4, volume: 0.25 })] },
  streakTier: { priority: PRIO_ABILITY, parts: [part({ wave: 'sine', freq: 70, freqEnd: 45, decay: 0.12, release: 0.2, volume: 0.45 }), part({ wave: 'triangle', freq: 392, attack: 0.02, decay: 0.2, hold: 0.2, release: 0.3, volume: 0.2 }), part({ wave: 'triangle', freq: 494, attack: 0.03, decay: 0.2, hold: 0.2, release: 0.3, volume: 0.16 }), part({ wave: 'triangle', freq: 587, attack: 0.04, decay: 0.2, hold: 0.2, release: 0.3, volume: 0.14 })] },
  goldPickup: { priority: PRIO_ABILITY, parts: [part({ wave: 'sine', freq: 1200, freqEnd: 1800, decay: 0.06, release: 0.15, volume: 0.25 })] },
  motePickup: { priority: PRIO_ABILITY, parts: [part({ wave: 'sine', freq: 660, freqEnd: 990, decay: 0.08, release: 0.2, volume: 0.2 })] },
  // ---------------------------------------------------------------- weapons
  /** A deep blast with a crunchy tail. */
  shotgun: {
    priority: PRIO_OWN,
    parts: [
      part({ wave: 'noise', freq: 9000, attack: 0.001, decay: 0.08, sustain: 0.35, hold: 0.02, release: 0.22, volume: 0.75, lowpass: 5000, lowpassEnd: 500 }),
      part({ wave: 'square', freq: 140, freqEnd: 45, decay: 0.06, sustain: 0.4, release: 0.15, volume: 0.45, lowpass: 900, bits: 5 }),
    ],
  },
  /** A hollow thunk as the censer leaves the launcher. */
  censerLaunch: {
    priority: PRIO_OWN,
    parts: [
      part({ wave: 'triangle', freq: 260, freqEnd: 90, decay: 0.05, sustain: 0.3, release: 0.1, volume: 0.6 }),
      part({ wave: 'noise', freq: 4000, decay: 0.03, sustain: 0.2, release: 0.08, volume: 0.35, lowpass: 2500, lowpassEnd: 600 }),
    ],
  },
  /** A muffled burst of embers. */
  /** The censer breaking (M9 §5.2): a bronze clank and a soft hiss of incense. */
  censerBreak: {
    priority: PRIO_OTHERS,
    parts: [
      part({ wave: 'triangle', freq: 1240, freqEnd: 980, attack: 0.001, decay: 0.05, sustain: 0.25, release: 0.18, volume: 0.35, vibratoRate: 31, vibratoDepth: 0.6 }),
      part({ wave: 'square', freq: 620, freqEnd: 410, decay: 0.03, sustain: 0.2, release: 0.1, volume: 0.15, duty: 0.3, bits: 5 }),
      part({ wave: 'noise', freq: 9000, delay: 0.04, attack: 0.05, decay: 0.2, sustain: 0.3, hold: 0.25, release: 0.4, volume: 0.22, lowpass: 5000, lowpassEnd: 1800 }),
    ],
  },
  /** Short and light: it plays 12 times per second. */
  chaingun: {
    priority: PRIO_OWN,
    parts: [
      part({ wave: 'noise', freq: 12000, attack: 0.001, decay: 0.025, sustain: 0.15, release: 0.03, volume: 0.45, lowpass: 7000, lowpassEnd: 1500 }),
      part({ wave: 'square', freq: 220, freqEnd: 110, decay: 0.02, sustain: 0.2, release: 0.03, volume: 0.25, bits: 4 }),
    ],
  },
  /** A sharp crack with a ringing tail. */
  revolver: {
    priority: PRIO_OWN,
    parts: [
      part({ wave: 'noise', freq: 14000, attack: 0.001, decay: 0.04, sustain: 0.2, release: 0.18, volume: 0.7, lowpass: 9000, lowpassEnd: 1200 }),
      part({ wave: 'square', freq: 520, freqEnd: 160, decay: 0.03, sustain: 0.3, release: 0.12, volume: 0.3, bits: 5 }),
      part({ wave: 'sine', freq: 1900, decay: 0.02, sustain: 0.15, release: 0.25, volume: 0.12 }),
    ],
  },

  /** The Brimstone Slug (M9 §5.2): deeper and longer than the shotgun blast. */
  slug: {
    priority: PRIO_OWN,
    parts: [
      part({ wave: 'noise', freq: 7000, attack: 0.001, decay: 0.12, sustain: 0.4, hold: 0.04, release: 0.35, volume: 0.8, lowpass: 3500, lowpassEnd: 250 }),
      part({ wave: 'square', freq: 95, freqEnd: 30, decay: 0.1, sustain: 0.5, hold: 0.05, release: 0.3, volume: 0.5, lowpass: 600, bits: 5 }),
      part({ wave: 'sine', freq: 60, freqEnd: 28, decay: 0.15, sustain: 0.5, release: 0.3, volume: 0.45 }),
    ],
  },
  /** Sacrament (M9 §5.2): a soft, rising chime at the healed ally, twice a second. */
  sacrament: {
    priority: PRIO_OWN,
    parts: [
      part({ wave: 'sine', freq: 784, freqEnd: 1046.5, attack: 0.01, decay: 0.08, sustain: 0.4, release: 0.15, volume: 0.16 }),
      part({ wave: 'triangle', freq: 1568, delay: 0.03, attack: 0.01, decay: 0.06, sustain: 0.3, release: 0.12, volume: 0.07, vibratoRate: 9, vibratoDepth: 0.3 }),
    ],
  },
  /** The Scourge (M9 §5.2): a whoosh with a chain clank. */
  scourge: {
    priority: PRIO_OWN,
    parts: [
      part({ wave: 'noise', freq: 7000, attack: 0.04, decay: 0.1, sustain: 0.3, release: 0.08, volume: 0.45, lowpass: 700, lowpassEnd: 5000 }),
      part({ wave: 'noise', freq: 9000, delay: 0.1, decay: 0.03, sustain: 0.3, hold: 0.06, release: 0.1, volume: 0.3, lowpass: 7000, vibratoRate: 30, vibratoDepth: 12 }),
      part({ wave: 'square', freq: 1500, delay: 0.1, decay: 0.03, sustain: 0.2, hold: 0.04, release: 0.08, volume: 0.1, duty: 0.2, vibratoRate: 24, vibratoDepth: 6 }),
    ],
  },
  /** The Silver Bullet (M9 §5.2): a heavy crack with a ringing tail. */
  silverBullet: {
    priority: PRIO_OWN,
    parts: [
      part({ wave: 'noise', freq: 14000, attack: 0.001, decay: 0.06, sustain: 0.35, hold: 0.03, release: 0.3, volume: 0.85, lowpass: 8000, lowpassEnd: 600 }),
      part({ wave: 'square', freq: 260, freqEnd: 70, decay: 0.06, sustain: 0.4, release: 0.25, volume: 0.35, bits: 5 }),
      part({ wave: 'sine', freq: 2093, decay: 0.05, sustain: 0.35, hold: 0.1, release: 0.8, volume: 0.14, vibratoRate: 6, vibratoDepth: 0.1 }),
    ],
  },

  // ---------------------------------------------------------------- hits
  /** Own hits: a quiet tick. */
  hitTick: { priority: PRIO_HIT, parts: [part({ wave: 'square', freq: 1800, decay: 0.012, sustain: 0, release: 0.01, volume: 0.18, duty: 0.25 })] },
  /** Own kills: slightly brighter. */
  killTick: {
    priority: PRIO_HIT,
    parts: [part({ wave: 'square', freq: 2400, freqEnd: 3200, decay: 0.03, sustain: 0.2, release: 0.03, volume: 0.22, duty: 0.25 })],
  },

  // ---------------------------------------------------------------- enemies
  /**
   * A burst death (M12 §4.3): porcelain cracking, a body blow, a flutter of feathers. Played at
   * PRIO_ABILITY for your own bursts, PRIO_OTHERS for others'.
   */
  burstPop: {
    priority: PRIO_OTHERS,
    parts: [
      part({ wave: 'noise', freq: 14000, attack: 0.001, decay: 0.02, sustain: 0.2, release: 0.06, volume: 0.55, lowpass: 11000, lowpassEnd: 3000 }),
      part({ wave: 'sine', freq: 3150, decay: 0.02, sustain: 0.25, release: 0.12, volume: 0.1, vibratoRate: 40, vibratoDepth: 1 }),
      part({ wave: 'sine', freq: 4730, delay: 0.01, decay: 0.02, sustain: 0.2, release: 0.09, volume: 0.08 }),
      part({ wave: 'sine', freq: 140, freqEnd: 42, decay: 0.07, sustain: 0.35, release: 0.14, volume: 0.75 }),
      part({ wave: 'square', freq: 220, freqEnd: 70, decay: 0.04, sustain: 0.2, release: 0.08, volume: 0.18, lowpass: 1200, bits: 5 }),
      part({ wave: 'noise', freq: 7000, delay: 0.03, attack: 0.02, decay: 0.08, sustain: 0.35, hold: 0.08, release: 0.15, volume: 0.22, lowpass: 5000, lowpassEnd: 1500, vibratoRate: 26, vibratoDepth: 10 }),
    ],
  },
  /** Many bursts at once (M12 §4.3): a sub hit, a blast, a flock taking off and a shimmer. */
  massKill: {
    priority: PRIO_OTHERS,
    parts: [
      part({ wave: 'sine', freq: 75, freqEnd: 28, decay: 0.18, sustain: 0.5, hold: 0.05, release: 0.35, volume: 0.85 }),
      part({ wave: 'noise', freq: 9000, decay: 0.1, sustain: 0.35, release: 0.35, volume: 0.5, lowpass: 4000, lowpassEnd: 300 }),
      part({ wave: 'noise', freq: 9000, delay: 0.05, attack: 0.05, hold: 0.15, release: 0.3, volume: 0.25, lowpass: 9000, lowpassEnd: 3000, vibratoRate: 22, vibratoDepth: 12 }),
      part({ wave: 'sine', freq: 1568, delay: 0.04, release: 0.35, volume: 0.08 }),
      part({ wave: 'sine', freq: 2093, delay: 0.08, release: 0.35, volume: 0.07 }),
      part({ wave: 'sine', freq: 2637, delay: 0.12, release: 0.35, volume: 0.06 }),
    ],
  },
  /** Blessed death: a soft feathery chirp. */
  blessedDeath: {
    priority: PRIO_ENEMY,
    parts: [
      part({ wave: 'sine', freq: 1500, freqEnd: 2600, attack: 0.005, decay: 0.05, sustain: 0.2, release: 0.06, volume: 0.25, vibratoRate: 30, vibratoDepth: 1 }),
      part({ wave: 'noise', freq: 9000, attack: 0.01, decay: 0.06, sustain: 0.1, release: 0.1, volume: 0.12, lowpass: 6000, lowpassEnd: 2500 }),
    ],
  },
  /** Chorister wind-up: a rising choir-like tone over the 1 s wind-up. */
  choristerWindup: {
    priority: PRIO_ENEMY,
    parts: [
      part({ wave: 'triangle', freq: 330, freqEnd: 660, attack: 0.15, decay: 0.2, sustain: 0.7, hold: 0.5, release: 0.15, volume: 0.3, vibratoRate: 5.5, vibratoDepth: 0.3 }),
      part({ wave: 'sine', freq: 495, freqEnd: 990, attack: 0.2, decay: 0.2, sustain: 0.6, hold: 0.45, release: 0.15, volume: 0.2, vibratoRate: 5, vibratoDepth: 0.3 }),
    ],
  },
  orbFired: {
    priority: PRIO_ENEMY,
    parts: [part({ wave: 'sine', freq: 900, freqEnd: 300, decay: 0.1, sustain: 0.3, release: 0.12, volume: 0.35, vibratoRate: 18, vibratoDepth: 1.5 })],
  },
  /**
   * A globe shatters (M12 follow-up §1.3): a glassy crack with a ringing tail, about 0.35 s. Shot down,
   * it plays at rate 1.2.
   */
  globeShatter: {
    priority: PRIO_ABILITY,
    parts: [
      part({ wave: 'noise', freq: 11000, attack: 0.002, decay: 0.04, sustain: 0.2, release: 0.08, volume: 0.45, lowpass: 9000, lowpassEnd: 3500 }),
      part({ wave: 'sine', freq: 2640, freqEnd: 2600, delay: 0.01, decay: 0.06, sustain: 0.35, release: 0.27, volume: 0.16, vibratoRate: 22, vibratoDepth: 0.4 }),
      part({ wave: 'triangle', freq: 3960, freqEnd: 3900, delay: 0.02, decay: 0.05, sustain: 0.25, release: 0.22, volume: 0.09 }),
      part({ wave: 'sine', freq: 1760, freqEnd: 1700, delay: 0.015, decay: 0.08, sustain: 0.3, release: 0.25, volume: 0.1 }),
    ],
  },
  cherubWindup: {
    priority: PRIO_ENEMY,
    parts: [part({ wave: 'triangle', freq: 600, freqEnd: 1200, attack: 0.1, decay: 0.15, sustain: 0.6, hold: 0.15, release: 0.1, volume: 0.22, vibratoRate: 8, vibratoDepth: 0.5 })],
  },
  /** An arrow's whistle. */
  arrowFired: {
    priority: PRIO_ENEMY,
    parts: [part({ wave: 'sine', freq: 2200, freqEnd: 1400, attack: 0.01, decay: 0.1, sustain: 0.4, hold: 0.05, release: 0.15, volume: 0.25, vibratoRate: 25, vibratoDepth: 0.4 })],
  },
  /** An enemy's melee blow on you: a thud. */
  meleeHit: {
    priority: PRIO_OWN,
    parts: [
      part({ wave: 'sine', freq: 120, freqEnd: 50, decay: 0.06, sustain: 0.3, release: 0.08, volume: 0.7 }),
      part({ wave: 'noise', freq: 2000, decay: 0.03, sustain: 0.1, release: 0.05, volume: 0.3, lowpass: 1200 }),
    ],
  },

  // ---------------------------------------------------------------- the Gatekeeper
  volleyWindup: {
    priority: PRIO_WARNING,
    parts: [part({ wave: 'saw', freq: 200, freqEnd: 400, attack: 0.1, decay: 0.2, sustain: 0.7, hold: 0.1, release: 0.1, volume: 0.3, lowpass: 1200, lowpassEnd: 3000 })],
  },
  volleyFired: {
    priority: PRIO_ABILITY,
    parts: [
      part({ wave: 'sine', freq: 800, freqEnd: 250, decay: 0.15, sustain: 0.3, release: 0.2, volume: 0.4, vibratoRate: 20, vibratoDepth: 2 }),
      part({ wave: 'noise', freq: 6000, decay: 0.1, sustain: 0.2, release: 0.15, volume: 0.25, lowpass: 4000, lowpassEnd: 800 }),
    ],
  },
  /** Judgment charge: a 3 s rising drone. */
  judgmentCharge: {
    priority: PRIO_WARNING,
    parts: [
      part({ wave: 'saw', freq: 55, freqEnd: 220, slide: 3, attack: 0.4, decay: 0.2, sustain: 0.8, hold: 2.3, release: 0.1, volume: 0.35, lowpass: 400, lowpassEnd: 4000 }),
      part({ wave: 'triangle', freq: 110, freqEnd: 440, slide: 3, attack: 0.6, decay: 0.2, sustain: 0.8, hold: 2.1, release: 0.1, volume: 0.3, vibratoRate: 6, vibratoDepth: 0.4 }),
      part({ wave: 'sine', freq: 660, freqEnd: 1320, slide: 3, attack: 1.5, decay: 0.2, sustain: 0.6, hold: 1.2, release: 0.1, volume: 0.15 }),
    ],
  },
  judgmentBlast: {
    priority: PRIO_ABILITY,
    parts: [
      part({ wave: 'noise', freq: 10000, decay: 0.25, sustain: 0.4, hold: 0.2, release: 0.8, volume: 0.8, lowpass: 8000, lowpassEnd: 400 }),
      part({ wave: 'sine', freq: 90, freqEnd: 30, decay: 0.3, sustain: 0.5, hold: 0.2, release: 0.6, volume: 0.6 }),
    ],
  },
  // The authored Gatekeeper (rogue bosses.md §3.5): synthesized stand-ins until the S7 recordings.
  // Every move keeps its own wind-up; the phase warning is a choir chord, never a sounded trumpet.
  /** The Toll's wind-up: a great bell swelling over 1.5 s. */
  tollTell: { priority: PRIO_WARNING, parts: [part({ wave: 'triangle', freq: 98, attack: 0.6, decay: 0.3, sustain: 0.8, hold: 0.5, release: 0.2, volume: 0.35, vibratoRate: 4, vibratoDepth: 0.3 }), part({ wave: 'sine', freq: 196, attack: 0.8, hold: 0.5, release: 0.2, volume: 0.2 })] },
  /** The Toll's strike: a bell hit with a long tail. */
  tollImpact: { priority: PRIO_ABILITY, parts: [part({ wave: 'sine', freq: 147, decay: 0.4, sustain: 0.4, hold: 0.3, release: 1.2, volume: 0.5 }), part({ wave: 'triangle', freq: 441, decay: 0.2, sustain: 0.2, release: 0.8, volume: 0.25 }), part({ wave: 'noise', freq: 4000, decay: 0.05, release: 0.2, volume: 0.25, lowpass: 3000 })] },
  /** The ring's front 1 s away: a rising whoosh. */
  tollPersonalWhoosh: { priority: PRIO_WARNING, parts: [part({ wave: 'noise', freq: 1200, attack: 0.7, decay: 0.1, sustain: 0.8, hold: 0.1, release: 0.2, volume: 0.35, lowpass: 600, lowpassEnd: 5000 })] },
  /** Called's wind-up: a bright chime and a chain's rattle, heard by all. */
  callTell: { priority: PRIO_WARNING, parts: [part({ wave: 'sine', freq: 1568, decay: 0.15, sustain: 0.3, hold: 0.3, release: 0.4, volume: 0.25 }), part({ wave: 'noise', freq: 6000, attack: 0.2, decay: 0.1, hold: 0.5, release: 0.2, volume: 0.18, lowpass: 5000, bits: 4 })] },
  /** The Seal shot open: a padlock snapping and a bright release. */
  sealBreak: { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 9000, decay: 0.04, release: 0.15, volume: 0.45 }), part({ wave: 'triangle', freq: 880, freqEnd: 1320, decay: 0.12, release: 0.3, volume: 0.25 })] },
  /** The Seal slams shut: he takes his due. */
  callReleased: { priority: PRIO_ABILITY, parts: [part({ wave: 'sine', freq: 110, freqEnd: 55, decay: 0.2, release: 0.4, volume: 0.5 }), part({ wave: 'noise', freq: 1500, decay: 0.08, release: 0.2, volume: 0.35, lowpass: 1500 })] },
  /** The Host descends: a choir swell. */
  hostDescend: { priority: PRIO_OTHERS, parts: [part({ wave: 'triangle', freq: 262, attack: 0.5, decay: 0.3, hold: 0.6, release: 0.6, volume: 0.16 }), part({ wave: 'triangle', freq: 330, attack: 0.6, decay: 0.3, hold: 0.5, release: 0.6, volume: 0.13 }), part({ wave: 'triangle', freq: 392, attack: 0.7, decay: 0.3, hold: 0.4, release: 0.6, volume: 0.11 })] },
  /** The Watchers open: a shimmering chord of many high voices. */
  watcherOpen: { priority: PRIO_ABILITY, parts: [part({ wave: 'sine', freq: 1047, attack: 0.4, hold: 1.2, release: 0.5, volume: 0.12, vibratoRate: 9, vibratoDepth: 0.6 }), part({ wave: 'sine', freq: 1319, attack: 0.5, hold: 1.1, release: 0.5, volume: 0.1, vibratoRate: 11, vibratoDepth: 0.6 }), part({ wave: 'sine', freq: 1568, attack: 0.6, hold: 1.0, release: 0.5, volume: 0.09, vibratoRate: 13, vibratoDepth: 0.6 })] },
  /** An eye bursts and its tether snaps into him: a glass ping and a deep crack. */
  watcherBreak: { priority: PRIO_ABILITY, parts: [part({ wave: 'sine', freq: 2637, decay: 0.05, release: 0.3, volume: 0.25 }), part({ wave: 'sine', freq: 80, freqEnd: 40, delay: 0.08, decay: 0.12, release: 0.25, volume: 0.45 })] },
  /** The 50% threshold: a choir warning chord (the first trumpet stays silent). */
  bossTransition: { priority: PRIO_ABILITY, parts: [part({ wave: 'saw', freq: 147, attack: 0.3, decay: 0.4, hold: 1.0, release: 0.8, volume: 0.18, lowpass: 1500 }), part({ wave: 'triangle', freq: 175, attack: 0.3, hold: 1.0, release: 0.8, volume: 0.16 }), part({ wave: 'triangle', freq: 220, attack: 0.4, hold: 0.9, release: 0.8, volume: 0.14 })] },
  /** Judgment's pre-warning at c 22: the drone begins quietly. */
  judgmentPrewarn: { priority: PRIO_WARNING, parts: [part({ wave: 'saw', freq: 55, attack: 1.2, decay: 0.3, sustain: 0.7, hold: 1.0, release: 0.5, volume: 0.12, lowpass: 300, lowpassEnd: 900 })] },
  /** Interrupted: breaking glass. */
  interrupted: {
    priority: PRIO_ABILITY,
    parts: [
      part({ wave: 'noise', freq: 16000, attack: 0.001, decay: 0.05, sustain: 0.3, release: 0.35, volume: 0.6, lowpass: 12000, lowpassEnd: 4000 }),
      part({ wave: 'sine', freq: 3100, decay: 0.05, sustain: 0.3, release: 0.4, volume: 0.15, vibratoRate: 40, vibratoDepth: 1 }),
      part({ wave: 'sine', freq: 4700, delay: 0.04, decay: 0.05, sustain: 0.3, release: 0.3, volume: 0.12, vibratoRate: 35, vibratoDepth: 1 }),
    ],
  },

  // ---------------------------------------------------------------- players
  hurt: {
    priority: PRIO_OWN,
    parts: [part({ wave: 'square', freq: 300, freqEnd: 150, decay: 0.05, sustain: 0.3, release: 0.07, volume: 0.3, lowpass: 1500, bits: 5 })],
  },
  death: {
    priority: PRIO_ABILITY,
    parts: [
      part({ wave: 'square', freq: 400, freqEnd: 60, decay: 0.3, sustain: 0.5, hold: 0.2, release: 0.4, volume: 0.35, lowpass: 2000, lowpassEnd: 300, bits: 5 }),
      part({ wave: 'noise', freq: 3000, decay: 0.2, sustain: 0.3, release: 0.4, volume: 0.2, lowpass: 1500, lowpassEnd: 200 }),
    ],
  },
  /** Rising from the hellfire pillar. */
  revive: {
    priority: PRIO_ABILITY,
    parts: [
      part({ wave: 'saw', freq: 110, freqEnd: 440, attack: 0.05, decay: 0.2, sustain: 0.6, hold: 0.2, release: 0.4, volume: 0.3, lowpass: 600, lowpassEnd: 4000 }),
      part({ wave: 'noise', freq: 6000, attack: 0.05, decay: 0.3, sustain: 0.3, release: 0.4, volume: 0.25, lowpass: 2000, lowpassEnd: 6000 }),
      part({ wave: 'triangle', freq: 440, delay: 0.25, decay: 0.1, sustain: 0.5, hold: 0.2, release: 0.3, volume: 0.25 }),
    ],
  },
  healed: {
    priority: PRIO_ABILITY,
    parts: [part({ wave: 'sine', freq: 660, freqEnd: 990, attack: 0.02, decay: 0.15, sustain: 0.4, release: 0.2, volume: 0.25, vibratoRate: 7, vibratoDepth: 0.3 })],
  },
  shieldUp: {
    priority: PRIO_ABILITY,
    parts: [
      part({ wave: 'triangle', freq: 440, freqEnd: 880, attack: 0.02, decay: 0.15, sustain: 0.4, release: 0.25, volume: 0.3 }),
      part({ wave: 'sine', freq: 1320, delay: 0.05, decay: 0.1, sustain: 0.3, release: 0.25, volume: 0.15, vibratoRate: 12, vibratoDepth: 0.5 }),
    ],
  },
  shieldBroken: {
    priority: PRIO_ABILITY,
    parts: [
      part({ wave: 'noise', freq: 12000, decay: 0.05, sustain: 0.2, release: 0.2, volume: 0.4, lowpass: 9000, lowpassEnd: 2000 }),
      part({ wave: 'triangle', freq: 880, freqEnd: 330, decay: 0.1, sustain: 0.3, release: 0.15, volume: 0.25 }),
    ],
  },

  // ---------------------------------------------------------------- abilities
  /** Blasphemy: a low growl. */
  blasphemy: {
    priority: PRIO_ABILITY,
    parts: [
      part({ wave: 'saw', freq: 70, freqEnd: 55, attack: 0.03, decay: 0.2, sustain: 0.7, hold: 0.3, release: 0.3, volume: 0.45, lowpass: 700, vibratoRate: 22, vibratoDepth: 1.5 }),
      part({ wave: 'noise', freq: 800, attack: 0.03, decay: 0.2, sustain: 0.5, hold: 0.3, release: 0.3, volume: 0.25, lowpass: 600 }),
    ],
  },
  fallingStarLeap: {
    priority: PRIO_ABILITY,
    parts: [
      part({ wave: 'noise', freq: 6000, attack: 0.05, decay: 0.15, sustain: 0.5, hold: 0.1, release: 0.1, volume: 0.35, lowpass: 1000, lowpassEnd: 5000 }),
      part({ wave: 'square', freq: 200, freqEnd: 600, decay: 0.2, sustain: 0.3, hold: 0.1, release: 0.1, volume: 0.15, bits: 5 }),
    ],
  },
  fallingStarLand: {
    priority: PRIO_ABILITY,
    parts: [
      part({ wave: 'sine', freq: 100, freqEnd: 32, decay: 0.2, sustain: 0.5, release: 0.4, volume: 0.8 }),
      part({ wave: 'noise', freq: 5000, decay: 0.1, sustain: 0.4, release: 0.4, volume: 0.5, lowpass: 3000, lowpassEnd: 200 }),
    ],
  },
  /** Communion: a warm chord. */
  communion: {
    priority: PRIO_ABILITY,
    parts: [
      part({ wave: 'triangle', freq: 293.66, attack: 0.05, decay: 0.2, sustain: 0.6, hold: 0.3, release: 0.4, volume: 0.25 }),
      part({ wave: 'triangle', freq: 349.23, attack: 0.08, decay: 0.2, sustain: 0.6, hold: 0.27, release: 0.4, volume: 0.22 }),
      part({ wave: 'sine', freq: 440, attack: 0.11, decay: 0.2, sustain: 0.6, hold: 0.24, release: 0.4, volume: 0.22, vibratoRate: 5, vibratoDepth: 0.15 }),
    ],
  },
  /** Shroud: a shimmer. */
  shroud: {
    priority: PRIO_ABILITY,
    parts: [
      part({ wave: 'sine', freq: 1760, attack: 0.03, decay: 0.2, sustain: 0.4, hold: 0.1, release: 0.3, volume: 0.15, vibratoRate: 14, vibratoDepth: 0.8 }),
      part({ wave: 'sine', freq: 2217, delay: 0.05, attack: 0.03, decay: 0.2, sustain: 0.4, hold: 0.05, release: 0.3, volume: 0.12, vibratoRate: 11, vibratoDepth: 0.8 }),
      part({ wave: 'noise', freq: 14000, attack: 0.05, decay: 0.2, sustain: 0.2, release: 0.3, volume: 0.08, lowpass: 12000 }),
    ],
  },
  /** Chains: a rattle. */
  chains: {
    priority: PRIO_ABILITY,
    parts: [
      part({ wave: 'noise', freq: 7000, decay: 0.05, sustain: 0.4, hold: 0.25, release: 0.15, volume: 0.35, lowpass: 6000, vibratoRate: 18, vibratoDepth: 12 }),
      part({ wave: 'square', freq: 1300, decay: 0.03, sustain: 0.15, hold: 0.25, release: 0.1, volume: 0.1, duty: 0.2, vibratoRate: 16, vibratoDepth: 6 }),
    ],
  },
  /** Discord: a dissonant gong. */
  discord: {
    priority: PRIO_ABILITY,
    parts: [
      part({ wave: 'sine', freq: 196, attack: 0.005, decay: 0.3, sustain: 0.5, hold: 0.2, release: 0.7, volume: 0.35, vibratoRate: 3, vibratoDepth: 0.3 }),
      part({ wave: 'sine', freq: 277.18, attack: 0.005, decay: 0.3, sustain: 0.4, hold: 0.2, release: 0.6, volume: 0.25 }),
      part({ wave: 'triangle', freq: 415.3, attack: 0.005, decay: 0.2, sustain: 0.3, hold: 0.1, release: 0.5, volume: 0.15, vibratoRate: 7, vibratoDepth: 0.5 }),
    ],
  },
  /** Field of Blood (M9 §5.2): a jingle of coins, then a low liquid swell. */
  fieldOfBlood: {
    priority: PRIO_ABILITY,
    parts: [
      part({ wave: 'square', freq: 2637, attack: 0.002, decay: 0.03, sustain: 0.3, hold: 0.18, release: 0.08, volume: 0.12, duty: 0.2, vibratoRate: 26, vibratoDepth: 5 }),
      part({ wave: 'sine', freq: 3520, delay: 0.04, decay: 0.03, sustain: 0.3, hold: 0.14, release: 0.1, volume: 0.1, vibratoRate: 19, vibratoDepth: 4 }),
      part({ wave: 'saw', freq: 55, freqEnd: 82, delay: 0.25, attack: 0.25, decay: 0.3, sustain: 0.6, hold: 0.3, release: 0.5, volume: 0.35, lowpass: 300, lowpassEnd: 700, vibratoRate: 4, vibratoDepth: 0.4 }),
    ],
  },
  /** The Shroud's burst (M9 §5.2): a muffled ember blast. */
  shroudBurst: {
    priority: PRIO_ABILITY,
    parts: [
      part({ wave: 'noise', freq: 4000, attack: 0.002, decay: 0.12, sustain: 0.35, release: 0.3, volume: 0.7, lowpass: 2200, lowpassEnd: 250 }),
      part({ wave: 'sine', freq: 90, freqEnd: 35, decay: 0.12, sustain: 0.4, release: 0.25, volume: 0.55 }),
      part({ wave: 'triangle', freq: 880, freqEnd: 330, decay: 0.08, sustain: 0.2, release: 0.15, volume: 0.12 }),
    ],
  },
  /** Field entered (M9 §5.2): a deep heartbeat thump, for the local player. */
  fieldEntered: {
    priority: PRIO_ABILITY,
    parts: [
      part({ wave: 'sine', freq: 70, freqEnd: 40, attack: 0.005, decay: 0.09, sustain: 0.3, release: 0.12, volume: 0.7 }),
      part({ wave: 'sine', freq: 62, freqEnd: 36, delay: 0.2, attack: 0.005, decay: 0.08, sustain: 0.25, release: 0.12, volume: 0.5 }),
      part({ wave: 'noise', freq: 600, attack: 0.005, decay: 0.05, sustain: 0.2, release: 0.06, volume: 0.2, lowpass: 300 }),
    ],
  },
  /** Shadowstep: a whoosh. */
  shadowstep: {
    priority: PRIO_ABILITY,
    parts: [part({ wave: 'noise', freq: 8000, attack: 0.04, decay: 0.12, sustain: 0.3, release: 0.12, volume: 0.45, lowpass: 600, lowpassEnd: 5000 })],
  },
  /** Low HP's heartbeat (M12 §6.2): a deep double thump. */
  heartbeat: {
    priority: PRIO_OWN,
    parts: [
      part({ wave: 'sine', freq: 62, freqEnd: 40, attack: 0.005, decay: 0.06, sustain: 0.4, release: 0.12, volume: 0.85 }),
      part({ wave: 'noise', freq: 2000, attack: 0.003, decay: 0.03, sustain: 0.2, release: 0.06, volume: 0.25, lowpass: 260, lowpassEnd: 120 }),
      part({ wave: 'sine', freq: 56, freqEnd: 36, delay: 0.17, attack: 0.005, decay: 0.06, sustain: 0.35, release: 0.14, volume: 0.65 }),
      part({ wave: 'noise', freq: 2000, delay: 0.17, attack: 0.003, decay: 0.03, sustain: 0.2, release: 0.06, volume: 0.18, lowpass: 240, lowpassEnd: 110 }),
    ],
  },
  /** Shadowstep's dagger (M12 §5.7): a sharp metallic swish, about 0.25 s, rising through the air with a thin ring of steel. */
  daggerCut: {
    priority: PRIO_ABILITY,
    parts: [
      part({ wave: 'noise', freq: 12000, attack: 0.012, decay: 0.07, sustain: 0.3, release: 0.13, volume: 0.5, lowpass: 2200, lowpassEnd: 11000 }),
      part({ wave: 'sine', freq: 3400, freqEnd: 2700, delay: 0.03, decay: 0.05, sustain: 0.25, release: 0.15, volume: 0.12, vibratoRate: 45, vibratoDepth: 1 }),
      part({ wave: 'triangle', freq: 5200, freqEnd: 4800, delay: 0.045, decay: 0.03, sustain: 0.2, release: 0.1, volume: 0.06 }),
    ],
  },

  // ---------------------------------------------------------------- arena
  countdownTick: { priority: PRIO_ABILITY, parts: [part({ wave: 'square', freq: 880, decay: 0.04, sustain: 0.3, release: 0.05, volume: 0.25, duty: 0.25 })] },
  /** The doors seal: a heavy slam. */
  doorsSeal: {
    priority: PRIO_ABILITY,
    parts: [
      part({ wave: 'sine', freq: 70, freqEnd: 30, decay: 0.3, sustain: 0.4, release: 0.6, volume: 0.8 }),
      part({ wave: 'noise', freq: 3000, decay: 0.1, sustain: 0.3, release: 0.5, volume: 0.5, lowpass: 1500, lowpassEnd: 150 }),
      part({ wave: 'square', freq: 110, freqEnd: 55, decay: 0.1, sustain: 0.2, release: 0.2, volume: 0.15, bits: 4 }),
    ],
  },
  /** Arena cleared: a short fanfare (D, F, A, then D up an octave). */
  arenaCleared: {
    priority: PRIO_ABILITY,
    parts: [
      part({ wave: 'square', freq: 293.66, decay: 0.05, sustain: 0.6, hold: 0.07, release: 0.05, volume: 0.15, duty: 0.25 }),
      part({ wave: 'square', freq: 440, delay: 0.12, decay: 0.05, sustain: 0.6, hold: 0.07, release: 0.05, volume: 0.15, duty: 0.25 }),
      part({ wave: 'square', freq: 587.33, delay: 0.24, decay: 0.1, sustain: 0.6, hold: 0.35, release: 0.3, volume: 0.17, duty: 0.25, vibratoRate: 6, vibratoDepth: 0.2 }),
    ],
  },
  /**
   * A clear reward arriving (audit batch 3): one large handbell strike, its inharmonic partial and a
   * long ring-out. Synthesized until a recorded handbell take is made.
   */
  rewardArrive: {
    priority: PRIO_ABILITY,
    parts: [
      part({ wave: 'sine', freq: 784, attack: 0.003, decay: 0.08, sustain: 0.45, hold: 0.1, release: 1.6, volume: 0.26 }),
      part({ wave: 'sine', freq: 2164, attack: 0.002, decay: 0.05, sustain: 0.25, release: 0.7, volume: 0.09 }),
      part({ wave: 'sine', freq: 1568, delay: 0.01, decay: 0.06, sustain: 0.35, hold: 0.05, release: 1.1, volume: 0.11 }),
    ],
  },
  /** Used only when there's no music sting (M8 §9.2). */
  victory: {
    priority: PRIO_ABILITY,
    parts: [
      part({ wave: 'square', freq: 293.66, decay: 0.05, sustain: 0.6, hold: 0.15, release: 0.05, volume: 0.15, duty: 0.25 }),
      part({ wave: 'square', freq: 440, delay: 0.25, decay: 0.05, sustain: 0.6, hold: 0.15, release: 0.05, volume: 0.15, duty: 0.25 }),
      part({ wave: 'square', freq: 587.33, delay: 0.5, decay: 0.2, sustain: 0.7, hold: 0.8, release: 0.6, volume: 0.18, duty: 0.25, vibratoRate: 5, vibratoDepth: 0.25 }),
    ],
  },
  defeat: {
    priority: PRIO_ABILITY,
    parts: [
      part({ wave: 'triangle', freq: 293.66, decay: 0.1, sustain: 0.6, hold: 0.3, release: 0.1, volume: 0.25 }),
      part({ wave: 'triangle', freq: 277.18, delay: 0.45, decay: 0.1, sustain: 0.6, hold: 0.3, release: 0.1, volume: 0.25 }),
      part({ wave: 'triangle', freq: 146.83, delay: 0.9, decay: 0.3, sustain: 0.6, hold: 0.6, release: 0.8, volume: 0.3, vibratoRate: 4, vibratoDepth: 0.3 }),
    ],
  },

  // ---------------------------------------------------------------- R8: one cue per required event
  // Synthesized stand-ins named by their audio-prompts.md IDs (S3–S7), so a recording replaces each by
  // file name. Heaven is gold, glass and bells; the damned are iron, ember and leather.
  /** An item bought: coins dropped on a wooden tray and a small gold ping. */
  purchase: { priority: PRIO_OWN, parts: [part({ wave: 'square', freq: 2637, decay: 0.03, sustain: 0.2, hold: 0.08, release: 0.06, volume: 0.1, duty: 0.2, vibratoRate: 28, vibratoDepth: 5 }), part({ wave: 'noise', freq: 1200, decay: 0.03, release: 0.06, volume: 0.25, lowpass: 900 }), part({ wave: 'sine', freq: 1568, delay: 0.1, decay: 0.08, release: 0.25, volume: 0.16 })] },
  /** A refused interaction: a dull wooden knock, falling, never bright. */
  interactionReject: { priority: PRIO_OWN, ui: true, parts: [part({ wave: 'triangle', freq: 196, freqEnd: 147, decay: 0.06, sustain: 0.2, release: 0.08, volume: 0.35, lowpass: 900 }), part({ wave: 'triangle', freq: 165, freqEnd: 123, delay: 0.11, decay: 0.06, sustain: 0.2, release: 0.1, volume: 0.3, lowpass: 900 })] },
  /** The Chart: parchment unrolled, then a soft glassy chord. */
  chartReveal: { priority: PRIO_OWN, parts: [part({ wave: 'noise', freq: 5000, attack: 0.05, decay: 0.15, hold: 0.15, release: 0.1, volume: 0.18, lowpass: 3500, vibratoRate: 30, vibratoDepth: 8 }), part({ wave: 'sine', freq: 1047, delay: 0.25, decay: 0.2, release: 0.6, volume: 0.12 }), part({ wave: 'sine', freq: 1568, delay: 0.3, decay: 0.2, release: 0.6, volume: 0.09 })] },
  /** A Rite page opens: a page catching fire with a low hum. */
  riteOffer: { priority: PRIO_OWN, parts: [part({ wave: 'noise', freq: 4000, attack: 0.08, decay: 0.2, hold: 0.2, release: 0.3, volume: 0.2, lowpass: 2500 }), part({ wave: 'saw', freq: 73, attack: 0.15, decay: 0.2, hold: 0.3, release: 0.35, volume: 0.16, lowpass: 400 })] },
  /** A Rite taken: an iron seal pressed into wax, with an ember flare. */
  riteTaken: { priority: PRIO_OWN, parts: [part({ wave: 'sine', freq: 98, freqEnd: 49, decay: 0.12, release: 0.25, volume: 0.6 }), part({ wave: 'noise', freq: 1800, decay: 0.05, release: 0.12, volume: 0.35, lowpass: 1500 }), part({ wave: 'noise', freq: 6000, delay: 0.08, attack: 0.05, decay: 0.2, release: 0.35, volume: 0.14, lowpass: 4000 })] },
  /** The key taken: a heavy key lifted off stone, ringing once. */
  keyPickup: { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 3500, decay: 0.03, release: 0.06, volume: 0.25, lowpass: 3000 }), part({ wave: 'triangle', freq: 1175, delay: 0.03, decay: 0.1, sustain: 0.3, release: 0.5, volume: 0.18, vibratoRate: 6, vibratoDepth: 0.2 }), part({ wave: 'sine', freq: 2349, delay: 0.03, decay: 0.08, release: 0.35, volume: 0.07 })] },
  /** The Reliquary opens: a gold lid on hinges and a bright swell. */
  chestOpen: { priority: PRIO_ABILITY, parts: [part({ wave: 'square', freq: 220, freqEnd: 330, attack: 0.02, decay: 0.15, hold: 0.2, release: 0.1, volume: 0.08, duty: 0.3, lowpass: 1500 }), part({ wave: 'triangle', freq: 523, delay: 0.3, attack: 0.1, decay: 0.3, hold: 0.3, release: 0.6, volume: 0.15 }), part({ wave: 'triangle', freq: 784, delay: 0.35, attack: 0.1, decay: 0.3, hold: 0.25, release: 0.6, volume: 0.12 }), part({ wave: 'sine', freq: 1047, delay: 0.4, attack: 0.1, decay: 0.3, hold: 0.2, release: 0.6, volume: 0.1 })] },
  /** A relic claimed: a heavy gold object set down, and a short choir chord. */
  relicClaim: { priority: PRIO_OWN, parts: [part({ wave: 'sine', freq: 130, freqEnd: 70, decay: 0.1, release: 0.2, volume: 0.45 }), part({ wave: 'triangle', freq: 392, delay: 0.08, attack: 0.05, decay: 0.25, hold: 0.25, release: 0.5, volume: 0.14 }), part({ wave: 'triangle', freq: 587, delay: 0.1, attack: 0.05, decay: 0.25, hold: 0.2, release: 0.5, volume: 0.11 })] },
  /** The bargain signed: a quill scratch and a low iron toll. */
  bargainAccept: { priority: PRIO_OWN, parts: [part({ wave: 'noise', freq: 8000, attack: 0.02, decay: 0.15, hold: 0.15, release: 0.1, volume: 0.15, lowpass: 6000, vibratoRate: 22, vibratoDepth: 10 }), part({ wave: 'sine', freq: 82, delay: 0.35, decay: 0.3, sustain: 0.4, release: 0.8, volume: 0.45 }), part({ wave: 'triangle', freq: 233, delay: 0.35, decay: 0.2, release: 0.6, volume: 0.12 })] },
  /** A level gained: a rising three-note gold chime. */
  levelUp: { priority: PRIO_OWN, parts: [part({ wave: 'sine', freq: 784, decay: 0.08, release: 0.2, volume: 0.16 }), part({ wave: 'sine', freq: 988, delay: 0.09, decay: 0.08, release: 0.2, volume: 0.15 }), part({ wave: 'sine', freq: 1175, delay: 0.18, decay: 0.1, release: 0.4, volume: 0.15, vibratoRate: 6, vibratoDepth: 0.2 })] },
  /** Pilgrim's Return channel: a soft rising swell over the 1.5 s channel. */
  teleportStart: { priority: PRIO_ABILITY, parts: [part({ wave: 'triangle', freq: 392, freqEnd: 784, slide: 1.4, attack: 0.3, decay: 0.2, sustain: 0.8, hold: 0.9, release: 0.15, volume: 0.16 }), part({ wave: 'noise', freq: 6000, attack: 0.5, hold: 0.8, release: 0.2, volume: 0.06, lowpass: 5000 })] },
  /** Pilgrim's Return arrives: a bright gold landing chime. */
  teleportArrive: { priority: PRIO_ABILITY, parts: [part({ wave: 'sine', freq: 1568, decay: 0.08, release: 0.5, volume: 0.18 }), part({ wave: 'sine', freq: 2093, delay: 0.02, decay: 0.08, release: 0.4, volume: 0.1 }), part({ wave: 'sine', freq: 110, freqEnd: 70, decay: 0.08, release: 0.15, volume: 0.3 })] },
  /** Balm: a stopper pulled and a warm swallow. */
  'item-balm': { priority: PRIO_ABILITY, parts: [part({ wave: 'sine', freq: 600, freqEnd: 300, decay: 0.03, release: 0.04, volume: 0.3 }), part({ wave: 'sine', freq: 523, delay: 0.1, attack: 0.05, decay: 0.15, release: 0.3, volume: 0.18 }), part({ wave: 'sine', freq: 659, delay: 0.15, attack: 0.05, decay: 0.15, release: 0.3, volume: 0.12 })] },
  /** Wax Seal: wax pressed and a shield hum closing. */
  'item-seal': { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 1500, decay: 0.05, release: 0.1, volume: 0.3, lowpass: 1200 }), part({ wave: 'triangle', freq: 330, freqEnd: 660, delay: 0.05, decay: 0.15, sustain: 0.4, release: 0.25, volume: 0.2 })] },
  /** Feather: a quick flutter and a light lift. */
  'item-feather': { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 7000, attack: 0.02, decay: 0.12, hold: 0.06, release: 0.1, volume: 0.25, lowpass: 5000, vibratoRate: 26, vibratoDepth: 12 }), part({ wave: 'sine', freq: 880, freqEnd: 1320, decay: 0.1, release: 0.15, volume: 0.1 })] },
  /** Any thrown item leaves the hand: a short swish. */
  'item-throw': { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 6000, attack: 0.03, decay: 0.08, sustain: 0.3, release: 0.08, volume: 0.3, lowpass: 900, lowpassEnd: 4500 })] },
  /** Mirror Ward placed: a glass dome ringing up. */
  'item-mirror-place': { priority: PRIO_ABILITY, parts: [part({ wave: 'sine', freq: 1319, attack: 0.05, decay: 0.2, sustain: 0.4, hold: 0.2, release: 0.5, volume: 0.12, vibratoRate: 9, vibratoDepth: 0.4 }), part({ wave: 'sine', freq: 1976, delay: 0.05, attack: 0.05, decay: 0.2, hold: 0.15, release: 0.5, volume: 0.08 }), part({ wave: 'noise', freq: 1200, decay: 0.04, release: 0.08, volume: 0.15, lowpass: 900 })] },
  /** A projectile returned by the Ward: a glassy ping. */
  'item-mirror-return': { priority: PRIO_ABILITY, parts: [part({ wave: 'sine', freq: 2637, freqEnd: 3136, decay: 0.04, release: 0.12, volume: 0.16 }), part({ wave: 'noise', freq: 10000, decay: 0.02, release: 0.05, volume: 0.12, lowpass: 9000 })] },
  /** Bitter Water lands: a flask breaking into a hissing pool. */
  'item-water-land': { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 9000, decay: 0.03, release: 0.1, volume: 0.35, lowpass: 8000 }), part({ wave: 'noise', freq: 3000, delay: 0.05, attack: 0.05, decay: 0.2, hold: 0.2, release: 0.3, volume: 0.15, lowpass: 2000, vibratoRate: 14, vibratoDepth: 6 })] },
  /** Ash of Stillness lands: a dull puff of ash. */
  'item-ash-land': { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 800, attack: 0.01, decay: 0.15, release: 0.3, volume: 0.4, lowpass: 700 }), part({ wave: 'sine', freq: 90, freqEnd: 50, decay: 0.08, release: 0.15, volume: 0.25 })] },
  /** Chain Jar lands: a jar breaks and chains spill into a ring. */
  'item-chain-place': { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 8000, decay: 0.03, release: 0.08, volume: 0.3, lowpass: 7000 }), part({ wave: 'noise', freq: 7000, delay: 0.05, decay: 0.05, sustain: 0.4, hold: 0.2, release: 0.12, volume: 0.25, lowpass: 6000, vibratoRate: 18, vibratoDepth: 12 })] },
  /** Plume lands: a burst of wind and feathers. */
  'item-plume-land': { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 5000, attack: 0.01, decay: 0.15, release: 0.3, volume: 0.4, lowpass: 2500, lowpassEnd: 6000 }), part({ wave: 'noise', freq: 9000, delay: 0.05, attack: 0.03, decay: 0.1, hold: 0.1, release: 0.15, volume: 0.15, lowpass: 7000, vibratoRate: 24, vibratoDepth: 12 })] },
  /** An enemy bound: a short chain snap, once per binding action. */
  'state-bind': { priority: PRIO_OTHERS, parts: [part({ wave: 'noise', freq: 8000, decay: 0.02, sustain: 0.3, hold: 0.06, release: 0.08, volume: 0.3, lowpass: 7000, vibratoRate: 20, vibratoDepth: 12 }), part({ wave: 'square', freq: 1400, decay: 0.02, release: 0.05, volume: 0.06, duty: 0.2 })] },
  /** Enemies flung into the air: a rising whoosh. */
  'state-launch': { priority: PRIO_OTHERS, parts: [part({ wave: 'noise', freq: 6000, attack: 0.02, decay: 0.12, sustain: 0.3, release: 0.1, volume: 0.3, lowpass: 600, lowpassEnd: 4000 })] },
  /** Flung enemies land: a dull porcelain thud. */
  'state-land': { priority: PRIO_OTHERS, parts: [part({ wave: 'sine', freq: 110, freqEnd: 45, decay: 0.06, release: 0.12, volume: 0.45 }), part({ wave: 'noise', freq: 5000, decay: 0.02, release: 0.06, volume: 0.2, lowpass: 4000 })] },
  /** Floor catches fire: a soft whump of flame. */
  'state-fire': { priority: PRIO_OTHERS, parts: [part({ wave: 'noise', freq: 3000, attack: 0.03, decay: 0.15, release: 0.25, volume: 0.35, lowpass: 1800 }), part({ wave: 'sine', freq: 70, freqEnd: 45, decay: 0.1, release: 0.15, volume: 0.25 })] },
  /** A fire area goes out: a falling hiss. */
  fireOut: { priority: PRIO_ENEMY, parts: [part({ wave: 'noise', freq: 7000, attack: 0.02, decay: 0.2, sustain: 0.3, release: 0.25, volume: 0.15, lowpass: 5000, lowpassEnd: 800 })] },
  /** The Confessional's air: a low still drone, looped while you stand inside (whole cycles over 2 s). */
  confessionalAmbience: { priority: PRIO_HIT, loop: true, parts: [part({ wave: 'sine', freq: 55, attack: 0, decay: 0, sustain: 1, hold: 2, release: 0, volume: 0.12 }), part({ wave: 'sine', freq: 82.5, attack: 0, decay: 0, sustain: 1, hold: 2, release: 0, volume: 0.06, vibratoRate: 0.5, vibratoDepth: 0.1 })] },
  /** The Gatekeeper falls: a long collapsing chord over a deep impact. */
  bossDefeat: { priority: PRIO_WARNING, parts: [part({ wave: 'sine', freq: 65, freqEnd: 30, decay: 0.5, sustain: 0.5, release: 1.2, volume: 0.6 }), part({ wave: 'noise', freq: 6000, decay: 0.3, release: 0.9, volume: 0.35, lowpass: 4000, lowpassEnd: 300 }), part({ wave: 'triangle', freq: 392, freqEnd: 196, delay: 0.2, attack: 0.2, decay: 0.4, hold: 0.6, release: 1.0, volume: 0.15 })] },
  /** Judas Coin flicked: a silver coin's spinning ring. */
  judasCoinSpin: { priority: PRIO_ABILITY, parts: [part({ wave: 'sine', freq: 3136, decay: 0.05, sustain: 0.4, hold: 0.25, release: 0.3, volume: 0.1, vibratoRate: 18, vibratoDepth: 0.6 }), part({ wave: 'square', freq: 2637, decay: 0.02, release: 0.04, volume: 0.06, duty: 0.2 })] },
  /** A shot splits on the coin: a sharp silver ping in three. */
  judasCoinSplit: { priority: PRIO_ABILITY, parts: [part({ wave: 'sine', freq: 2349, decay: 0.03, release: 0.1, volume: 0.15 }), part({ wave: 'sine', freq: 2794, delay: 0.03, decay: 0.03, release: 0.1, volume: 0.13 }), part({ wave: 'sine', freq: 3520, delay: 0.06, decay: 0.03, release: 0.15, volume: 0.11 })] },
  /** The Way Back: a shadow left behind, a cold breath. */
  wayBackMarker: { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 2000, attack: 0.08, decay: 0.15, release: 0.3, volume: 0.2, lowpass: 1200, lowpassEnd: 400 }), part({ wave: 'sine', freq: 220, freqEnd: 165, attack: 0.05, decay: 0.2, release: 0.3, volume: 0.12 })] },
  /** The Way Back: the dash back to the shadow, a reversed whoosh. */
  wayBackReturn: { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 8000, attack: 0.12, decay: 0.05, sustain: 0.5, release: 0.05, volume: 0.4, lowpass: 5000, lowpassEnd: 700 })] },
  /** Silver Wire strung: a taut wire plucked. */
  silverWirePlace: { priority: PRIO_ABILITY, parts: [part({ wave: 'triangle', freq: 1760, decay: 0.05, sustain: 0.3, release: 0.4, volume: 0.12, vibratoRate: 12, vibratoDepth: 0.3 }), part({ wave: 'noise', freq: 9000, decay: 0.02, release: 0.04, volume: 0.12 })] },
  /** Gatebreaker: the charge begins, iron boots and a roar of embers. */
  // A shoulder into a door: a deep thud and a short wooden crunch (audio-prompts.md S6 `gatebreakerWall`).
  gatebreakerWall: { priority: PRIO_ABILITY, parts: [part({ wave: 'sine', freq: 70, freqEnd: 45, decay: 0.12, release: 0.3, volume: 0.5 }), part({ wave: 'noise', freq: 1200, decay: 0.04, release: 0.15, volume: 0.3, lowpass: 1500 })] },
  gatebreakerStart: { priority: PRIO_ABILITY, parts: [part({ wave: 'saw', freq: 82, freqEnd: 110, attack: 0.03, decay: 0.2, sustain: 0.5, hold: 0.2, release: 0.2, volume: 0.3, lowpass: 600 }), part({ wave: 'noise', freq: 3000, attack: 0.05, decay: 0.2, hold: 0.2, release: 0.2, volume: 0.25, lowpass: 2000 })] },
  /** Rain of Fire called down: a rising roar from above. */
  rainOfFireStart: { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 4000, attack: 0.25, decay: 0.2, sustain: 0.6, hold: 0.2, release: 0.3, volume: 0.35, lowpass: 800, lowpassEnd: 3000 }), part({ wave: 'sine', freq: 60, attack: 0.2, hold: 0.3, release: 0.3, volume: 0.25 })] },
  /** Cast Out: a heavy wing blast. */
  castOut: { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 2500, attack: 0.02, decay: 0.15, release: 0.3, volume: 0.5, lowpass: 1500 }), part({ wave: 'sine', freq: 90, freqEnd: 40, decay: 0.12, release: 0.2, volume: 0.45 }), part({ wave: 'noise', freq: 8000, delay: 0.05, attack: 0.03, decay: 0.1, release: 0.15, volume: 0.15, lowpass: 6000, vibratoRate: 24, vibratoDepth: 12 })] },
  /** Trial by Fire begins: a censer flare and a held chant tone. */
  trialByFireStart: { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 4000, decay: 0.1, release: 0.25, volume: 0.3, lowpass: 2500 }), part({ wave: 'triangle', freq: 294, attack: 0.1, decay: 0.2, hold: 0.4, release: 0.3, volume: 0.15 })] },
  /** Cloud of Witnesses gathers: soft swelling breath of incense and voices. */
  cloudOfWitnessesStart: { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 5000, attack: 0.3, decay: 0.2, hold: 0.3, release: 0.4, volume: 0.15, lowpass: 2500 }), part({ wave: 'triangle', freq: 440, attack: 0.3, hold: 0.4, release: 0.4, volume: 0.1 }), part({ wave: 'triangle', freq: 554, attack: 0.35, hold: 0.35, release: 0.4, volume: 0.08 })] },
  /** The Well of the Giants opens: a deep stone groan and a pull. */
  wellOfGiantsStart: { priority: PRIO_ABILITY, parts: [part({ wave: 'saw', freq: 55, freqEnd: 41, attack: 0.1, decay: 0.3, sustain: 0.6, hold: 0.3, release: 0.4, volume: 0.3, lowpass: 400 }), part({ wave: 'noise', freq: 1500, attack: 0.2, hold: 0.3, release: 0.3, volume: 0.15, lowpass: 800, lowpassEnd: 300 })] },
  /** Ring of the Giants: a ring of chains slammed into stone. */
  ringOfGiants: { priority: PRIO_ABILITY, parts: [part({ wave: 'sine', freq: 80, freqEnd: 40, decay: 0.15, release: 0.25, volume: 0.5 }), part({ wave: 'noise', freq: 7000, decay: 0.05, sustain: 0.4, hold: 0.2, release: 0.15, volume: 0.3, lowpass: 6000, vibratoRate: 18, vibratoDepth: 12 })] },
  /** The Boundary Chain laid: a long chain dragged and pinned. */
  boundaryChain: { priority: PRIO_ABILITY, parts: [part({ wave: 'noise', freq: 6000, attack: 0.05, decay: 0.1, sustain: 0.5, hold: 0.35, release: 0.1, volume: 0.25, lowpass: 5000, vibratoRate: 14, vibratoDepth: 10 }), part({ wave: 'sine', freq: 110, freqEnd: 60, delay: 0.45, decay: 0.08, release: 0.15, volume: 0.4 })] },

  // ---------------------------------------------------------------- UI
  buttonHover: { priority: PRIO_OWN, ui: true, parts: [part({ wave: 'square', freq: 1200, decay: 0.015, sustain: 0, release: 0.01, volume: 0.08, duty: 0.25 })] },
  buttonClick: {
    priority: PRIO_OWN,
    ui: true,
    parts: [part({ wave: 'square', freq: 660, freqEnd: 990, decay: 0.03, sustain: 0.3, release: 0.04, volume: 0.15, duty: 0.25 })],
  },
  /** An ability is ready again: a soft chime. */
  abilityReady: {
    priority: PRIO_OWN,
    parts: [
      part({ wave: 'sine', freq: 1046.5, attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.25, volume: 0.18 }),
      part({ wave: 'sine', freq: 1568, delay: 0.06, attack: 0.005, decay: 0.1, sustain: 0.25, release: 0.25, volume: 0.12 }),
    ],
  },
  /** Revive progress: a hum, looped while it plays; the caller raises its pitch with the progress. */
  reviveHum: {
    priority: PRIO_ABILITY,
    loop: true,
    // Whole cycles of every part fill the 0.5 s loop, so it loops without a click.
    parts: [
      part({ wave: 'saw', freq: 110, attack: 0, decay: 0, sustain: 1, hold: 0.5, release: 0, volume: 0.15, lowpass: 900 }),
      part({ wave: 'sine', freq: 220, attack: 0, decay: 0, sustain: 1, hold: 0.5, release: 0, volume: 0.2, vibratoRate: 6, vibratoDepth: 0.15 }),
    ],
  },
} satisfies Record<string, SfxDef>;

export type SfxName = keyof typeof SFX;
