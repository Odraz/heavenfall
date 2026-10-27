/**
 * R9 stage 1: the required-content census (rogue game.md §15.1, slice-acceptance.md). Counts what the
 * data modules ship, so a missing template, relic or talent fails here rather than in a play session.
 * Row rules already owned by other tests are imported, not repeated: the template rules come from
 * `validateTemplate` (pool.test.ts runs them per orientation), the per-tree talent shape from
 * buildClasses.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { PEARLY_POOL } from './data/rooms/1/index';
import { validateTemplate } from './data/rooms/validate';
import { fallbackLayout } from './gen/fallback';
import { BLESSED, BOSS_PART, CANTOR, CARRIER, CHERUB, CHORISTER, DOMINION, ENEMIES, GATEKEEPER, WATCHMAN } from './data/enemies';
import { ITEM_IDS } from './data/items';
import { COMBOS, COMBO_IDS, DEEDS, DEED_IDS, RELICS, RELIC_IDS } from './data/relics';
import { EDICTS } from './data/edicts';
import { BASE_ABILITIES, TALENT_NODES, type EnemyState } from './data/talents';
import { CLASS_IDS } from './data/classes';
import { producedStates, resolveKit, stateAvailable } from './sim/build';

const STATES: readonly EnemyState[] = ['slowed', 'bound', 'taunted', 'airborne', 'pooled', 'censed', 'silenced'];

describe('§15.1 rooms', () => {
  const combat = PEARLY_POOL.filter((t) => t.kind === 'combat');
  it('ships 20 combat templates that pass the focus, band and spawn-point rules', () => {
    expect(combat).toHaveLength(20);
    for (const t of combat) {
      expect(validateTemplate(t), t.id).toEqual([]);
      expect(t.focus, t.id).toBeDefined();
      expect(t.bands[0] >= 1 && t.bands[1] <= 3 && t.bands[0] <= t.bands[1], t.id).toBe(true);
      expect(t.markers.join('').includes('x'), t.id).toBe(true);
    }
  });
  it('ships the four special templates and a fallback floor built from the pool', () => {
    for (const kind of ['breach', 'pardoner', 'confessional', 'boss'] as const) expect(PEARLY_POOL.filter((t) => t.kind === kind), kind).toHaveLength(1);
    expect(() => fallbackLayout(PEARLY_POOL, 1)).not.toThrow();
  });
});

describe('§15.1 enemies and states', () => {
  it('has the full roster: Blessed, Chorister, Cherub, Dominion, Cantor, Carrier, Watchman, the Gatekeeper and its parts', () => {
    const ids = [BLESSED, CHORISTER, CHERUB, GATEKEEPER, DOMINION, BOSS_PART, CANTOR, CARRIER, WATCHMAN];
    expect(new Set(ids).size).toBe(9);
    for (const id of ids) expect(ENEMIES[id], `enemy ${id}`).toBeDefined();
    expect(ENEMIES).toHaveLength(9);
  });
  it('makes all seven enemy states producible by the four base kits together', () => {
    const made = new Set<EnemyState>();
    for (const c of CLASS_IDS) {
      const [q, e] = BASE_ABILITIES[c];
      for (const s of producedStates(resolveKit(c, { talents: [], rites: [], q, e }))) made.add(s);
    }
    expect([...made].sort()).toEqual([...STATES].sort());
  });
});

describe('§15.1 items, relics, deeds and Edicts', () => {
  it('ships 8 items, at least 2 of them applying a state', () => {
    expect(ITEM_IDS).toHaveLength(8);
    const kit = resolveKit('fallen', { talents: [], rites: [], q: 'nothing', e: 'nothing' });
    const applying = ITEM_IDS.filter((item) => STATES.some((s) => stateAvailable(s, kit, { allies: [], items: [item], areas: new Set(), hazard: false })));
    expect(applying.length).toBeGreaterThanOrEqual(2);
  });
  it('ships 12 relics and 6 combos; each combo replaces a different relic b', () => {
    expect(RELIC_IDS).toHaveLength(12);
    expect(COMBO_IDS).toHaveLength(6);
    for (const id of RELIC_IDS) expect(RELICS[id].id).toBe(id);
    const bs = COMBO_IDS.map((id) => COMBOS[id].b);
    expect(new Set(bs).size).toBe(6);
    for (const id of COMBO_IDS) {
      const c = COMBOS[id];
      expect(c.a).not.toBe(c.b);
      expect(RELICS[c.a].combo, id).toBe(id);
      expect(RELICS[c.b].combo, id).toBe(id);
    }
  });
  it('ships 4 deeds, each owning one deed relic, and 5 Edicts with stable ids 1–5', () => {
    expect(DEED_IDS).toHaveLength(4);
    for (const d of DEED_IDS) {
      expect(DEEDS[d].rule.length).toBeGreaterThan(0);
      expect(RELIC_IDS.filter((r) => RELICS[r].source === d)).toHaveLength(1);
    }
    expect(EDICTS.map((e) => e.id)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('§15.1 talents', () => {
  const all = CLASS_IDS.flatMap((c) => TALENT_NODES[c]);
  it('ships 84 nodes, 12 of them teaching an alternative ability, 7 per tree', () => {
    expect(all).toHaveLength(84);
    expect(new Set(all.map((n) => n.id)).size).toBe(84);
    expect(all.filter((n) => n.teaches)).toHaveLength(12);
    for (const c of CLASS_IDS) for (const tree of ['a', 'b', 'c'] as const) expect(TALENT_NODES[c].filter((n) => n.tree === tree), `${c}.${tree}`).toHaveLength(7);
  });
  it('gives every tree at least one node that applies or reads a state', () => {
    for (const c of CLASS_IDS) for (const tree of ['a', 'b', 'c'] as const) {
      expect(TALENT_NODES[c].some((n) => n.tree === tree && (n.applies?.length || n.reads)), `${c}.${tree}`).toBe(true);
    }
  });
});
