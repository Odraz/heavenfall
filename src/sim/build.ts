/**
 * The talent resolver (rogue game.md §9.3–§9.10): pure functions shared by the host's legality check,
 * the simulation's effects, the Rite offers and every card the client draws. No DOM, no randomness of
 * its own; the offer draw takes the caller's seeded generator.
 *
 * Saved versus temporary (§13.2): a profile character saves `talents` (learned node ids) and the
 * assigned `q`/`e`. Rites, their suppression and the offers live only in the host's run record and
 * vanish at the run's end, restoring the learned effects.
 */
import { ABILITIES, type AbilityDef } from '../data/weapons';
import type { ClassId } from '../data/classes';
import type { ItemId } from '../data/items';
import { ALT_ABILITIES, BASE_ABILITIES, HEAVEN_POINT_CAP, MAX_RITES, TALENT_NODES, talentNode, type EnemyState, type TalentNode } from '../data/talents';

export interface LearnedBuild { talents: readonly string[]; q: string; e: string }
export interface RunBuild extends LearnedBuild { rites: readonly string[] }

/** The resolved kit: what is equipped and which owned nodes actually produce effects. */
export interface Kit {
  classId: ClassId;
  q: string;
  e: string;
  /** Learned and Rite nodes together. */
  owned: ReadonlySet<string>;
  /** Owned nodes that produce effects now: not suppressed and not waiting for an unassigned ability. */
  active: ReadonlySet<string>;
  /** Learned augments a Rite displaces in its channel for the rest of the run, with that Rite. */
  suppressed: ReadonlyMap<string, string>;
  /** Owned nodes waiting for an unassigned ability. */
  dormant: readonly string[];
}

const SLOT_INDEX = { Q: 0, E: 1 } as const;
const baseAbility = (classId: ClassId, slot: 'Q' | 'E'): string => BASE_ABILITIES[classId][SLOT_INDEX[slot]];

/** The definition of an assigned ability: a base one or a taught alternative. */
export function abilityDef(classId: ClassId, slot: 'Q' | 'E', id: string): AbilityDef {
  return ALT_ABILITIES[id]?.slot === slot ? ALT_ABILITIES[id] : ABILITIES[classId][slot];
}

/** The abilities a slot may hold: the base one and every owned ability node's (§9.4). */
export function slotChoices(classId: ClassId, slot: 'Q' | 'E', owned: Iterable<string>): string[] {
  const out = [baseAbility(classId, slot)];
  for (const id of owned) {
    const n = talentNode(id);
    if (n?.classId === classId && n.teaches?.slot === slot && !out.includes(n.teaches.ability)) out.push(n.teaches.ability);
  }
  return out;
}

/** The named inputs a node's channel may occupy, assigned or not (for learned conflicts). */
function targetKeys(n: TalentNode): string[] {
  if (n.input === 'LMB' || n.input === 'RMB') return [n.input];
  if (n.input === 'Q' || n.input === 'E') return (n.targets ?? []).map((t) => `${n.input}:${t}`);
  return [];
}

/** The resolved named input of a node under this assignment, or null when it doesn't apply now. */
function resolvedKey(n: TalentNode, q: string, e: string): string | null {
  if (n.input === 'LMB' || n.input === 'RMB') return n.input;
  if (n.input === 'Q') return n.targets?.includes(q) ? `Q:${q}` : null;
  if (n.input === 'E') return n.targets?.includes(e) ? `E:${e}` : null;
  return null;
}

/** Distinct strictly lower-tier nodes the tier needs in its tree (§9.3). */
export const TIER_GATE = [0, 0, 1, 3, 5] as const;
const lowerTalents = (n: TalentNode): string => `${TIER_GATE[n.tier]} lower ${n.tree.toUpperCase()} talent${TIER_GATE[n.tier] === 1 ? '' : 's'}`;

function gateMet(n: TalentNode, owned: Iterable<string>): boolean {
  let lower = 0;
  for (const id of owned) {
    const o = talentNode(id);
    if (o && o.id !== n.id && o.classId === n.classId && o.tree === n.tree && o.tier < n.tier) lower++;
  }
  return lower >= TIER_GATE[n.tier];
}

/** Resolves the effective kit (§9.3, §9.10): dormancy, Rite substitution and the active set. */
export function resolveKit(classId: ClassId, build: RunBuild): Kit {
  const rites = new Set(build.rites);
  const owned = new Set([...build.talents, ...build.rites]);
  const live = new Map<string, string>();
  const dormant: string[] = [];
  for (const id of owned) {
    const n = talentNode(id);
    if (!n || n.classId !== classId) continue;
    if (n.kind === 'augment' && (n.input === 'Q' || n.input === 'E') && !resolvedKey(n, build.q, build.e)) { dormant.push(id); continue; }
    if (n.needs && build.q !== n.needs && build.e !== n.needs) { dormant.push(id); continue; }
    live.set(id, n.kind === 'augment' ? `${resolvedKey(n, build.q, build.e)}:${n.channel}` : '');
  }
  // A Rite augment displaces the learned augment in its own resolved channel (§9.10).
  const suppressed = new Map<string, string>();
  for (const [id, channel] of live) {
    if (!channel || !rites.has(id)) continue;
    for (const [other, c] of live) if (other !== id && c === channel && !rites.has(other)) suppressed.set(other, id);
  }
  const active = new Set([...live.keys()].filter((id) => !suppressed.has(id)));
  return { classId, q: build.q, e: build.e, owned, active, suppressed, dormant };
}

export const dischargeCount = (kit: Kit): number => [...kit.active].filter((id) => talentNode(id)?.discharge).length;

/**
 * The learned allocation alone (§9.5, §9.8): known distinct nodes of the class, points within the level
 * and the heaven cap, learned-only tier gates, one capstone, no learned same-channel conflict on
 * intersecting targets (even while unassigned), explicit exclusions, the kill-discharge cap and legal
 * Q/E. `level` null skips the point check (development quick builds). Returns the first problem or null.
 */
export function learnedError(classId: ClassId, build: LearnedBuild, level: number | null): string | null {
  const ids = build.talents;
  if (new Set(ids).size !== ids.length) return 'A talent is listed twice';
  const nodes: TalentNode[] = [];
  for (const id of ids) {
    const n = talentNode(id);
    if (!n || n.classId !== classId) return 'Unknown talent';
    nodes.push(n);
  }
  if (level !== null && ids.length > Math.min(level - 1, HEAVEN_POINT_CAP)) return 'Not enough talent points';
  for (const n of nodes) if (!gateMet(n, ids)) return `${n.name} needs ${lowerTalents(n)}`;
  if (nodes.filter((n) => n.kind === 'capstone').length > 1) return 'Only one capstone';
  for (const n of nodes) for (const x of n.excludes ?? []) if (ids.includes(x)) return `${n.name} excludes ${talentNode(x)?.name}`;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      if (a.kind !== 'augment' || b.kind !== 'augment' || a.channel !== b.channel) continue;
      if (targetKeys(a).some((k) => targetKeys(b).includes(k))) return `${a.name} and ${b.name} change the same thing`;
    }
  }
  const slotError = assignmentError(classId, build.q, build.e, ids);
  if (slotError) return slotError;
  if (dischargeCount(resolveKit(classId, { ...build, rites: [] })) > 2) return 'At most two kill-triggered talents';
  return null;
}

function assignmentError(classId: ClassId, q: string, e: string, owned: Iterable<string>): string | null {
  const list = [...owned];
  if (!slotChoices(classId, 'Q', list).includes(q)) return 'Q holds an ability you do not own';
  if (!slotChoices(classId, 'E', list).includes(e)) return 'E holds an ability you do not own';
  return null;
}

/**
 * The held Rites' own tier gates over the combined ownership (§9.5): a respec that would leave a Rite
 * without its gate is refused, naming the Rite. Rites can't be reset, so the learned part must cover it.
 */
export function riteGateError(classId: ClassId, build: RunBuild): string | null {
  const owned = [...build.talents, ...build.rites];
  for (const id of build.rites) {
    const n = talentNode(id);
    if (n?.classId === classId && !gateMet(n, owned)) return `Your Rite ${n.name} needs ${lowerTalents(n)}`;
  }
  return null;
}

/**
 * A whole run loadout (§9.5, §9.8): the learned part passes on its own, then the Rites keep their gates
 * and exclusions over the combined ownership, two Rites never share a channel, one capstone overall and
 * the effective kit keeps at most two kill discharges. Used for Confessional edits under held Rites.
 * `draft` leaves out the Rites' gates: an editor's intermediate step may break one (a tree reset) and
 * learn the gate back before applying; the host always checks the whole loadout.
 */
export function runBuildError(classId: ClassId, build: RunBuild, level: number | null, draft = false): string | null {
  const rites = build.rites;
  if (rites.length > MAX_RITES) return 'Too many Rites';
  if (rites.some((id) => build.talents.includes(id))) return 'That talent is held as a Rite this run';
  const learned = learnedError(classId, { talents: build.talents, q: slotChoices(classId, 'Q', build.talents).includes(build.q) ? build.q : baseAbility(classId, 'Q'), e: slotChoices(classId, 'E', build.talents).includes(build.e) ? build.e : baseAbility(classId, 'E') }, level);
  if (learned) return learned;
  const owned = [...build.talents, ...rites];
  for (const id of rites) {
    const n = talentNode(id);
    if (!n || n.classId !== classId) return 'Unknown Rite';
    for (const x of n.excludes ?? []) if (owned.includes(x)) return 'A Rite excludes this node';
    for (const x of build.talents) if (talentNode(x)?.excludes?.includes(id)) return 'A Rite excludes this node';
  }
  if (!draft) {
    const gate = riteGateError(classId, build);
    if (gate) return gate;
  }
  if (owned.filter((id) => talentNode(id)?.kind === 'capstone').length > 1) return 'Only one capstone';
  const riteNodes = rites.map((id) => talentNode(id)!);
  for (let i = 0; i < riteNodes.length; i++) for (let j = i + 1; j < riteNodes.length; j++) {
    const a = riteNodes[i], b = riteNodes[j];
    if (a.kind === 'augment' && b.kind === 'augment' && a.channel === b.channel && targetKeys(a).some((k) => targetKeys(b).includes(k))) return 'Two Rites change the same thing';
  }
  const slotError = assignmentError(classId, build.q, build.e, owned);
  if (slotError) return slotError;
  if (dischargeCount(resolveKit(classId, build)) > 2) return 'At most two kill-triggered talents';
  return null;
}

// ------------------------------------------------------------------ Rite offers (§9.10)

/** What the party and the room can produce right now, for Rite usefulness (§9.9 "present source"). */
export interface SourceContext {
  /** Living connected teammates (humans or active bots) with their resolved kits. */
  allies: ReadonlyArray<{ classId: ClassId; q: string; e: string }>;
  /** Items the player can use now (carried stacks). */
  items: readonly ItemId[];
  /** Accepted same-room areas still supplying these states for their remaining lifetime. */
  areas: ReadonlySet<EnemyState>;
  /** An applicable environmental hazard encounter or a surviving blast prop remains. */
  hazard: boolean;
}

/** The states a kit produces by itself; every Betrayer trigger is reachable from its native attacks. */
function producedStates(kit: Kit): Set<EnemyState> {
  const out = new Set<EnemyState>();
  for (const id of kit.active) for (const s of talentNode(id)?.applies ?? []) {
    // An ability node's state comes only from the assigned ability.
    const n = talentNode(id)!;
    if (n.kind !== 'ability' || n.teaches?.ability === kit.q || n.teaches?.ability === kit.e) out.add(s);
  }
  if (kit.q === 'chains') out.add('bound');
  if (kit.classId === 'binder') out.add('slowed');
  if (kit.q === 'blasphemy') out.add('taunted');
  if (kit.e === 'fallingStar') out.add('airborne');
  return out;
}

function stateAvailable(state: EnemyState, kit: Kit, ctx: SourceContext): boolean {
  if (producedStates(kit).has(state) || ctx.areas.has(state)) return true;
  if (state === 'slowed' && ctx.items.includes('frost')) return true;
  if (state === 'bound' && ctx.items.includes('chain')) return true;
  return ctx.allies.some((a) => producedStates(resolveKit(a.classId, { talents: [], rites: [], q: a.q, e: a.e })).has(state));
}

function useful(n: TalentNode, kit: Kit, ctx: SourceContext): boolean {
  switch (n.rite) {
    case undefined: return true;
    case 'slowSource': return stateAvailable('slowed', kit, ctx);
    case 'bindSource': return stateAvailable('bound', kit, ctx);
    case 'blasphemy': return ctx.allies.some((a) => a.q === 'blasphemy');
    case 'hazard': return ctx.hazard;
    case 'field': return kit.q === 'field';
  }
}

export type RiteCheck =
  | { ok: true; id: string; build: RunBuild; surrenders: string | null; replaces: string | null; dormant: string[] }
  | { ok: false; id: string; reason: string };

/**
 * Whether one node can be taken as a Rite now (§9.10), and what taking it costs: the proposed kit is
 * resolved first, including any surrendered learned effect, and only then is the node's usefulness
 * checked, so it can't qualify on a source it would remove.
 */
export function checkRite(classId: ClassId, build: RunBuild, ctx: SourceContext, id: string): RiteCheck {
  const fail = (reason: string): RiteCheck => ({ ok: false, id, reason });
  const n = talentNode(id);
  if (!n || n.classId !== classId) return fail('Not your class');
  if (build.rites.length >= MAX_RITES) return fail('Four Rites already');
  const owned = [...build.talents, ...build.rites];
  if (owned.includes(id)) return fail('Already yours');
  if (!gateMet(n, owned)) return fail(`Needs ${lowerTalents(n)}`);
  if (n.kind === 'capstone' && owned.some((o) => talentNode(o)?.kind === 'capstone')) return fail('You hold a capstone');
  for (const o of owned) if (talentNode(o)?.excludes?.includes(id) || n.excludes?.includes(o)) return fail(`Excluded by ${talentNode(o)?.name}`);
  if (n.kind === 'augment' && !resolvedKey(n, build.q, build.e)) return fail('Its ability is not assigned');
  const now = resolveKit(classId, build);
  let surrenders: string | null = null;
  if (n.kind === 'augment') {
    const key = `${resolvedKey(n, build.q, build.e)}:${n.channel}`;
    for (const o of now.active) {
      const m = talentNode(o)!;
      if (m.kind !== 'augment' || `${resolvedKey(m, build.q, build.e)}:${m.channel}` !== key) continue;
      if (build.rites.includes(o)) return fail(`A Rite already changes that: ${m.name}`);
      surrenders = o;
    }
  }
  let replaces: string | null = null;
  const next: RunBuild = { talents: build.talents, rites: [...build.rites, id], q: build.q, e: build.e };
  if (n.teaches) {
    replaces = n.teaches.slot === 'Q' ? build.q : build.e;
    if (n.teaches.slot === 'Q') next.q = n.teaches.ability; else next.e = n.teaches.ability;
  }
  const kit = resolveKit(classId, next);
  if (dischargeCount(kit) > 2) return fail('A third kill-triggered talent');
  if (!useful(n, kit, ctx)) return fail(n.rite === 'blasphemy' ? 'Needs an ally with Blasphemy' : n.rite === 'hazard' ? 'No hazard left to walk' : n.rite === 'field' ? 'Field of Blood is not assigned' : `Nothing makes enemies ${n.reads}`);
  const dormant = kit.dormant.filter((d) => !now.dormant.includes(d));
  return { ok: true, id, build: next, surrenders, replaces, dormant };
}

/** Every node of the class that could be offered now, in catalog order. */
export function eligibleRites(classId: ClassId, build: RunBuild, ctx: SourceContext): string[] {
  return TALENT_NODES[classId].filter((n) => checkRite(classId, build, ctx, n.id).ok).map((n) => n.id);
}

/** Two distinct cards drawn uniformly from the eligible nodes, or one, or none (§9.10). */
export function drawCards(eligible: readonly string[], random: () => number): string[] {
  const pool = [...eligible];
  const cards: string[] = [];
  while (cards.length < 2 && pool.length) cards.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return cards;
}

/** The ability a slot falls back to when its ability node is removed and not held as a Rite (§9.5). */
export function repairAssignment(classId: ClassId, build: RunBuild): RunBuild {
  const owned = [...build.talents, ...build.rites];
  return {
    ...build,
    q: slotChoices(classId, 'Q', owned).includes(build.q) ? build.q : baseAbility(classId, 'Q'),
    e: slotChoices(classId, 'E', owned).includes(build.e) ? build.e : baseAbility(classId, 'E'),
  };
}

/**
 * A respec draft step (§9.5): removing a learned node also removes the learned nodes whose gates
 * depended on it, then repairs the Q/E assignment. The host still validates the final result.
 */
export function removeLearned(classId: ClassId, build: RunBuild, id: string): RunBuild {
  let talents = build.talents.filter((t) => t !== id);
  for (let changed = true; changed;) {
    changed = false;
    for (const t of talents) {
      const n = talentNode(t);
      if (n && !gateMet(n, talents)) { talents = talents.filter((x) => x !== t); changed = true; break; }
    }
  }
  return repairAssignment(classId, { ...build, talents });
}

/** Learned points available at a level in the Pearly Gates (§9.2, §9.7). */
export const pointsFor = (level: number): number => Math.min(HEAVEN_POINT_CAP, Math.max(0, level - 1));
