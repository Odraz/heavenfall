/**
 * Whether a relic's trigger is presently usable by a kit and its party (rogue items-relics.md §2.1.1):
 * the chest's first-card rule and every card's dormancy note. Pure; the Lobby passes no allies, the
 * host passes the living party and the room's live sources.
 */
import type { RelicId } from '../data/relics';
import { ownIncense, stateAvailable, type Kit, type SourceContext } from './build';

/** Whether the assigned Q's native hit can kill enemies (items-relics.md §2.1.1 table). */
export function qDamages(kit: Kit): boolean {
  if (kit.classId === 'fallen') return kit.q === 'castOut' || (kit.q === 'blasphemy' && kit.active.has('fallen.b.3b'));
  if (kit.classId === 'heretic') return kit.q === 'cloudOfWitnesses' || (kit.q === 'communion' && kit.active.has('heretic.b.2b'));
  return false;
}

/** Whether the assigned E's native hit can kill enemies. */
export function eDamages(kit: Kit): boolean {
  switch (kit.classId) {
    case 'fallen': return kit.e === 'fallingStar' || kit.e === 'gatebreaker' || kit.e === 'rainOfFire';
    case 'heretic': return (kit.e === 'shroud' && !kit.active.has('heretic.c.1a')) || kit.e === 'trialByFire';
    case 'binder': return false;
    case 'betrayer': return (kit.e === 'shadowstep' || kit.e === 'wayBack') && !kit.active.has('betrayer.b.3b');
  }
}

/** Null when the trigger can happen with this kit and party; otherwise the dormancy note for its card. */
export function relicDormancy(id: RelicId, kit: Kit, ctx: SourceContext): string | null {
  const party = [kit.q, ...ctx.allies.map((a) => a.q)];
  switch (id) {
    case 'usher': return party.includes('blasphemy') ? null : 'Dormant: nobody here taunts (Blasphemy)';
    case 'thurible': return ownIncense(kit) || ctx.allies.some((a) => a.classId === 'heretic') || ctx.areas.has('censed') ? null : 'Dormant: nobody here makes incense';
    case 'link': return stateAvailable('bound', kit, ctx) ? null : 'Dormant: nothing here binds enemies';
    case 'tile': return stateAvailable('pooled', kit, ctx) ? null : 'Dormant: nothing here pools enemies';
    case 'wheel': return stateAvailable('slowed', kit, ctx) ? null : 'Dormant: nothing here slows enemies';
    case 'qseal': return qDamages(kit) ? null : 'Dormant: assigned Q cannot kill';
    case 'eseal': return eDamages(kit) ? null : 'Dormant: assigned E cannot kill';
    default: return null;
  }
}
