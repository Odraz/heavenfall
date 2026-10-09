/**
 * Every sound effect as a synthesizer parameter set (M8 §9.1). Each is a named entry, so a file can
 * replace one later without touching its callers.
 */
import type { SoundDef, SynthPart } from './synth';

/**
 * Voice-stealing priority (M8 §9.1): own weapon and hurt (and the UI) > abilities, revive and the
 * Gatekeeper > others' weapons > enemies > hits.
 */
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
    priority: PRIO_ABILITY,
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
    priority: PRIO_ABILITY,
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
