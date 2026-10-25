import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SFX } from '../audio/sfx';
import { ITEM_IDS, ITEMS } from '../data/items';
import { ALT_ABILITIES } from '../data/talents';
import { ALT_START_CUE, CUE_LIMIT_MS, CueLimiter, EVENT_CUES, interactionCue, ITEM_LAND_CUE, ITEM_USE_CUE, TALENT_FX_CUE } from './cueMap';

/** Prompt IDs in audio-prompts.md's S1–S7 checklists (one-shot events), without the S8 loops, S9 or voices. */
function promptIds(): string[] {
  const doc = readFileSync('docs/rogue/audio-prompts.md', 'utf8');
  const lists = doc.split('**S1 Required')[1].split('**S8')[0];
  return [...lists.matchAll(/\[[ x]\] `([a-zA-Z-]+)`/g)].map((m) => m[1]);
}

/** S6's wall stop has no host event yet (gatebreaker charges end silently in a wall). */
const NO_EVENT_YET = new Set(['gatebreakerWall']);

describe('the event-to-cue map (R8)', () => {
  it('names a synthesized or recorded cue for every S1–S7 prompt ID, so a recording replaces it by file name', () => {
    const ids = promptIds();
    expect(ids.length).toBeGreaterThan(90);
    expect(ids.filter((id) => !NO_EVENT_YET.has(id) && !Object.hasOwn(SFX, id))).toEqual([]);
  });

  it('maps every game event to existing cues or states why it is silent', () => {
    for (const [type, rule] of Object.entries(EVENT_CUES)) {
      if (typeof rule === 'string') expect(rule, type).toMatch(/^silent: \S/);
      else for (const name of rule) expect(Object.hasOwn(SFX, name), `${type}: ${name}`).toBe(true);
    }
  });

  it('plays talent payloads from the shared state cues, never a per-enemy sound', () => {
    const used = new Set(Object.values(TALENT_FX_CUE).filter((n) => n !== null));
    expect([...used].sort()).toEqual(['motePickup', 'porcelainBreak', 'revive', 'state-bind', 'state-fire', 'state-land', 'state-launch']);
  });

  it('gives every item one use cue or one landing cue, never both (no second use sound on landing)', () => {
    for (const item of ITEM_IDS) {
      const use = ITEM_USE_CUE[item], land = ITEM_LAND_CUE[item];
      expect(use !== null || land !== null, item).toBe(true);
      if (ITEMS[item].kind === 'thrown') { expect(use).toBe('item-throw'); expect(land).not.toBeNull(); }
      else if (ITEMS[item].kind === 'placed') { expect(use).toBeNull(); expect(land).toBe('item-mirror-place'); }
      else { expect(use).toBe(`item-${item}`); expect(land).toBeNull(); }
    }
  });

  it('gives each non-Betrayer alternative its own cast cue', () => {
    const betrayer = ['judasCoin', 'wayBack', 'silverWire'];
    for (const id of Object.keys(ALT_ABILITIES)) {
      if (betrayer.includes(id)) expect(ALT_START_CUE[id], id).toBeUndefined();
      else expect(Object.hasOwn(SFX, ALT_START_CUE[id]), id).toBe(true);
    }
    expect(new Set(Object.values(ALT_START_CUE)).size).toBe(Object.keys(ALT_START_CUE).length);
  });

  it('never plays a success cue for a refused interaction', () => {
    for (const kind of ['buy', 'chart', 'other', undefined] as const) expect(interactionCue(false, kind)).toBe('interactionReject');
    expect(interactionCue(true, 'buy')).toBe('purchase');
    expect(interactionCue(true, 'chart')).toBe('chartReveal');
    // Chest and Bell sound from their state change; unrelated accepted results stay quiet.
    expect(interactionCue(true, 'other')).toBeNull();
    expect(interactionCue(true, undefined)).toBeNull();
  });

  it('limits a state cue family to four per second, independently per family', () => {
    const l = new CueLimiter();
    let bind = 0, fire = 0;
    for (let t = 0; t < 1000; t += 10) { if (l.admit('state-bind', t)) bind++; if (l.admit('state-fire', t + 5)) fire++; }
    expect(CUE_LIMIT_MS).toBe(250);
    expect(bind).toBe(4); expect(fire).toBe(4);
  });
});
