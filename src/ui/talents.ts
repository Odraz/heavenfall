/**
 * The Talents view (rogue game.md §9.4–§9.6) and the Rite offer (§9.10). One draft editor serves the
 * Lobby, the Advocate in the Confessional and development runs; the host (or the profile check in the
 * Lobby) validates the whole result. The panels keep a fixed size and a reserved message line, so
 * nothing moves when a node is clicked (UI stability).
 */
import { button, el } from './menus';
import { attachTooltip } from './tooltip';
import type { ClassId } from '../data/classes';
import { TALENT_NODES, TREES, talentNode, type TreeId, type TalentNode } from '../data/talents';
import { abilityDef, pointsFor, removeLearned, resolveKit, runBuildError, slotChoices, type LearnedBuild, type RunBuild } from '../sim/build';
import { spriteUrl } from '../render/atlas';
import type { RiteCard, RiteOffer } from '../net/messages';

const TREE_IDS: readonly TreeId[] = ['a', 'b', 'c'];
const INPUT_NAMES: Record<string, string> = { LMB: 'Revolver', RMB: 'Silver Bullet', Q: 'Q ability', E: 'E ability', passive: 'Passive', movement: 'Movement' };

/** What a node changes, for its tooltip: the input and channel, a kill trigger, a state it reads. */
export function nodeDetail(n: TalentNode): string {
  const parts = [n.rule];
  if (n.kind === 'augment') parts.push(`${INPUT_NAMES[n.input]} · ${n.channel === 'delivery' ? 'Delivery (shape)' : 'Payload (effect)'}: one of each per input.`);
  if (n.kind === 'ability') parts.push(`An alternative for ${n.teaches!.slot}; assign it below.`);
  if (n.kind === 'capstone') parts.push('Capstone: one per character.');
  if (n.discharge) parts.push('Kill-triggered: at most two in a build.');
  if (n.reads) parts.push(`Needs ${n.reads} enemies to do anything.`);
  return parts.join(' ');
}

export interface TalentPanelOptions {
  classId: ClassId;
  build: LearnedBuild;
  /** Rites held this run: shown, never editable (§9.5). */
  rites: readonly string[];
  /** The character's level, or null for a development run's free points. */
  level: number | null;
  title: string;
  /** Look only (T in a run, §9.4): nodes and abilities keep their tooltips, nothing can change. */
  readOnly?: boolean;
  onApply: (build: LearnedBuild) => void;
  onClose: () => void;
}

export interface TalentPanel {
  el: HTMLElement;
  setMessage(text: string): void;
  /** The accepted build after the host answered; the draft follows it. */
  setBuild(build: LearnedBuild, rites: readonly string[]): void;
}

export function talentPanel(o: TalentPanelOptions): TalentPanel {
  const root = el('div', 'talent-overlay');
  const panel = el('div', 'panel talent-panel', root);
  const head = el('div', 'talent-head', panel);
  el('h2', 'talent-title', head, o.title);
  const points = el('div', 'talent-points', head);
  const trees = el('div', 'talent-trees', panel);
  const slots = el('div', 'talent-slots', panel);
  const message = el('div', 'message talent-message', panel);
  const footer = el('div', 'buttons talent-footer', panel);
  let accepted: LearnedBuild = { talents: [...o.build.talents], q: o.build.q, e: o.build.e };
  let rites = [...o.rites];
  let draft: LearnedBuild = { ...accepted, talents: [...accepted.talents] };
  const nodes = TALENT_NODES[o.classId];

  const check = (b: LearnedBuild): string | null => runBuildError(o.classId, { ...b, rites }, o.level);
  const toggle = (n: TalentNode): void => {
    if (o.readOnly) return;
    if (rites.includes(n.id)) { message.textContent = `${n.name} is a Rite this run`; return; }
    if (draft.talents.includes(n.id)) {
      const next = removeLearned(o.classId, { ...draft, rites }, n.id);
      draft = { talents: [...next.talents], q: next.q, e: next.e };
      message.textContent = '';
    } else {
      const next = { ...draft, talents: [...draft.talents, n.id] };
      const error = check(next);
      if (error) { message.textContent = error; return; }
      draft = next; message.textContent = '';
    }
    draw();
  };

  const draw = (): void => {
    const used = draft.talents.length, cap = o.level === null ? null : pointsFor(o.level);
    points.textContent = cap === null ? `${used} points · free (development)` : `${used} / ${cap} points`;
    const kit = resolveKit(o.classId, { ...draft, rites });
    trees.replaceChildren();
    for (const t of TREE_IDS) {
      const info = TREES[o.classId]?.[t];
      const col = el('div', 'talent-tree', trees);
      el('div', 'talent-tree-name', col, info?.name ?? t.toUpperCase());
      el('div', 'talent-tree-domain', col, info?.domain ?? '');
      for (const tier of [1, 2, 3, 4] as const) {
        const row = el('div', 'talent-tier', col);
        for (const n of nodes.filter((x) => x.tree === t && x.tier === tier)) {
          const learned = draft.talents.includes(n.id), rite = rites.includes(n.id);
          const open = !learned && !rite && check({ ...draft, talents: [...draft.talents, n.id] }) === null;
          const state = rite ? 'rite' : learned ? 'learned' : open ? 'open' : 'locked';
          const b = button(n.name, row, () => toggle(n), `talent-node ${o.readOnly ? 'view ' : ''}${state}${kit.dormant.includes(n.id) ? ' dormant' : ''}${kit.suppressed.has(n.id) ? ' suppressed' : ''}`);
          b.dataset.node = n.id;
          b.setAttribute('aria-pressed', String(learned || rite));
          const notes = [rite ? 'Held as a Rite this run.' : '', kit.dormant.includes(n.id) ? 'Dormant: its ability is not assigned.' : '',
            kit.suppressed.has(n.id) ? `Suppressed this run by the Rite ${talentNode(kit.suppressed.get(n.id)!)?.name}.` : ''].filter(Boolean).join(' ');
          attachTooltip(b, n.name, `${nodeDetail(n)}${notes ? ` ${notes}` : ''}`);
        }
      }
      const reset = button(`Reset ${info?.name ?? t}`, col, () => {
        let b: RunBuild = { ...draft, rites };
        for (const id of draft.talents) if (talentNode(id)?.tree === t && b.talents.includes(id)) b = removeLearned(o.classId, b, id);
        draft = { talents: [...b.talents], q: b.q, e: b.e }; message.textContent = ''; draw();
      }, 'small secondary talent-reset');
      // Hidden, not removed, so the trees keep the editor's size.
      if (o.readOnly) { reset.disabled = true; reset.classList.add('talent-unused'); }
    }
    slots.replaceChildren();
    for (const slot of ['Q', 'E'] as const) {
      const row = el('div', 'talent-slot-row', slots);
      el('div', 'talent-slot-key', row, slot);
      for (const id of slotChoices(o.classId, slot, [...draft.talents, ...rites])) {
        const def = abilityDef(o.classId, slot, id), current = (slot === 'Q' ? draft.q : draft.e) === id;
        const b = button('', row, () => { if (o.readOnly) return; draft = slot === 'Q' ? { ...draft, q: id } : { ...draft, e: id }; message.textContent = ''; draw(); }, 'talent-ability');
        b.setAttribute('aria-pressed', String(current));
        if (o.readOnly) b.classList.add('view');
        const icon = el('img', '', b); icon.src = spriteUrl(def.icon); icon.alt = '';
        el('span', '', b, def.name);
        attachTooltip(b, def.name, def.description);
      }
    }
    if (!apply) return;
    apply.disabled = JSON.stringify(draft) === JSON.stringify(accepted) || check(draft) !== null;
  };

  let apply: HTMLButtonElement | null = null;
  if (o.readOnly) message.textContent = 'Learn and assign in the Lobby or with the Advocate in the Confessional.';
  else button('Reset all', footer, () => {
    draft = { talents: [], q: slotChoices(o.classId, 'Q', rites).includes(draft.q) ? draft.q : slotChoices(o.classId, 'Q', [])[0], e: slotChoices(o.classId, 'E', rites).includes(draft.e) ? draft.e : slotChoices(o.classId, 'E', [])[0] };
    const error = check(draft);
    message.textContent = error ?? ''; draw();
  }, 'small secondary');
  button(o.readOnly ? 'Close (T)' : 'Close', footer, o.onClose, 'small secondary');
  if (!o.readOnly) apply = button('Apply', footer, () => {
    const error = check(draft);
    if (error) { message.textContent = error; return; }
    message.textContent = 'Sending…';
    o.onApply({ talents: [...draft.talents], q: draft.q, e: draft.e });
  }, 'small');
  draw();
  return {
    el: root,
    setMessage: (text) => { if (!o.readOnly) message.textContent = text; },
    setBuild: (build, held) => { accepted = { talents: [...build.talents], q: build.q, e: build.e }; rites = [...held]; draft = { ...accepted, talents: [...accepted.talents] }; draw(); },
  };
}

// ------------------------------------------------------------------ Rite offer (§9.10)

export interface RiteOverlayOptions {
  classId: ClassId;
  onTake: (offerId: number, id: string) => void;
  onPass: (offerId: number) => void;
  onClose: () => void;
}

export interface RiteOverlay {
  el: HTMLElement;
  show(offer: RiteOffer, pending: number): void;
  setMessage(text: string): void;
}

/** The trade a card names (§9.10): the surrendered learned effect, the replaced ability and what goes dormant. */
export function cardNotes(classId: ClassId, card: RiteCard): string[] {
  const notes: string[] = [];
  if (card.surrenders) notes.push(`Gives up for this run: ${talentNode(card.surrenders)?.name}.`);
  const n = talentNode(card.id);
  if (card.replaces && n?.teaches) notes.push(`Replaces ${abilityDef(classId, n.teaches.slot, card.replaces).name} on ${n.teaches.slot}.`);
  if (card.dormant.length) notes.push(`Goes dormant: ${card.dormant.map((d) => talentNode(d)?.name).join(', ')}.`);
  if (!card.ok) notes.push(`Not now: ${card.reason}.`);
  return notes;
}

export function riteOverlay(o: RiteOverlayOptions): RiteOverlay {
  const root = el('div', 'talent-overlay');
  const panel = el('div', 'panel rite-panel', root);
  el('h2', 'talent-title', panel, 'A Rite');
  const sub = el('div', 'rite-sub', panel);
  const cards = el('div', 'rite-cards', panel);
  const message = el('div', 'message talent-message', panel);
  const footer = el('div', 'buttons talent-footer', panel);
  let offerId = 0;
  button('Pass', footer, () => o.onPass(offerId), 'small secondary');
  button('Close (Esc)', footer, o.onClose, 'small secondary');
  return {
    el: root,
    setMessage: (text) => { message.textContent = text; },
    show: (offer, pending) => {
      offerId = offer.offerId;
      sub.textContent = `One of your talents until this run ends.${pending > 1 ? ` ${pending} offers wait.` : ''} Pass keeps your kit as it is.`;
      message.textContent = '';
      cards.replaceChildren();
      for (const card of offer.cards) {
        const n = talentNode(card.id)!;
        const c = el('div', `rite-card${card.ok ? '' : ' disabled'}`, cards);
        el('div', 'rite-tree', c, `${TREES[o.classId]?.[n.tree].name ?? n.tree} · tier ${n.tier}`);
        el('div', 'rite-name', c, n.name);
        el('div', 'rite-rule', c, n.rule);
        const notes = el('div', 'rite-notes', c);
        for (const line of cardNotes(o.classId, card)) el('div', '', notes, line);
        const take = button('Take', c, () => o.onTake(offerId, card.id), 'small');
        take.disabled = !card.ok;
      }
    },
  };
}
