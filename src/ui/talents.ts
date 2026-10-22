/**
 * The Talents view (rogue game.md §9.4–§9.6) and the Rite offer (§9.10). One draft editor serves the
 * Lobby, the Advocate in the Confessional and development runs; the host (or the profile check in the
 * Lobby) validates the whole result. The panels keep a fixed size and a reserved message line, so
 * nothing moves when a node is clicked (UI stability). Nodes are icon tiles built once and updated in
 * place; names and rules live in their tooltips (R06 follow-up §1).
 */
import { button, el } from './menus';
import { attachTooltip } from './tooltip';
import type { ClassId } from '../data/classes';
import { ALT_ABILITIES, TALENT_NODES, TREES, talentNode, type TreeId, type TalentNode } from '../data/talents';
import { SECONDARIES, WEAPONS } from '../data/weapons';
import { TIER_GATE, abilityDef, augmentsConflict, pointsFor, removeLearned, resolveKit, runBuildError, slotChoices, type LearnedBuild } from '../sim/build';
import { hasSprite, spriteUrl } from '../render/atlas';
import type { RiteCard, RiteOffer } from '../net/messages';

const TREE_IDS: readonly TreeId[] = ['a', 'b', 'c'];

/** What a node changes, named for its class: the weapon, or the Q/E ability it shapes. */
function inputName(n: TalentNode): string {
  if (n.input === 'LMB') return WEAPONS[n.classId].name;
  if (n.input === 'RMB') return SECONDARIES[n.classId].name;
  if ((n.input === 'Q' || n.input === 'E') && n.targets?.length) return abilityDef(n.classId, n.input, n.targets[0]).name;
  return 'same thing';
}

/**
 * Why a node can't be learned now, in plain words (R06 follow-up §1): the tier gate, a conflicting
 * talent from another tree (named), or the build check's own reason. Null when it can be learned.
 */
export function lockReason(n: TalentNode, learned: readonly string[], error: string | null): string | null {
  if (!error) return null;
  const lower = learned.filter((id) => { const o = talentNode(id); return o && o.tree === n.tree && o.tier < n.tier; }).length;
  const missing = TIER_GATE[n.tier] - lower;
  if (missing > 0) return `Learn ${missing} more talent${missing === 1 ? '' : 's'} lower in this tree first.`;
  for (const id of learned) {
    const o = talentNode(id);
    if (o && augmentsConflict(n, o)) return `Can't combine with ${o.name}: both change the ${inputName(n)}.`;
  }
  if (error === 'Only one capstone') return 'You already hold a capstone.';
  if (error === 'At most two kill-triggered talents') return 'You already hold two talents that trigger on kills.';
  if (error === 'Not enough talent points') return 'No talent points left.';
  return `${error}.`;
}

/**
 * A node's icon sprite: an ability node shows its ability's icon (B9), the others their talent icon
 * (B11, `talent-<class>-<tree>-<node>`) once it exists; null shows the name alone.
 */
export function talentIcon(n: TalentNode): string | null {
  if (n.teaches) return ALT_ABILITIES[n.teaches.ability]?.icon ?? null;
  const name = `talent-${n.id.replace(/\./g, '-')}`;
  return hasSprite(name) ? name : null;
}

function iconImage(n: TalentNode, parent: HTMLElement): void {
  const icon = talentIcon(n);
  if (!icon) return;
  const img = el('img', 'talent-icon', parent);
  img.src = spriteUrl(icon); img.alt = '';
}

/** A short press flash on a clicked tile, so a click answers at once (R06 follow-up §1). */
function flash(b: HTMLElement): void {
  b.classList.remove('pressed');
  void b.offsetWidth;
  b.classList.add('pressed');
}

export interface TalentPanelOptions {
  classId: ClassId;
  build: LearnedBuild;
  /** Rites held this run: shown, never editable (§9.5). */
  rites: readonly string[];
  /** The character's level, or null for a development run's free points. */
  level: number | null;
  title: string;
  /** Look only (T in a run during combat or dead, §9.4): nodes and abilities keep their tooltips, nothing can change. */
  readOnly?: boolean;
  /** T in a run out of combat: the talents are read only, Q and E can be reassigned and applied anywhere. */
  slotsOnly?: boolean;
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

  const fixedTalents = o.readOnly || o.slotsOnly;
  // A step of the draft may leave a Rite without its gate (a reset) and learn it back; Apply needs the whole check.
  const check = (b: LearnedBuild): string | null => runBuildError(o.classId, { ...b, rites }, o.level);
  const stepCheck = (b: LearnedBuild): string | null => runBuildError(o.classId, { ...b, rites }, o.level, true);
  const toggle = (n: TalentNode): void => {
    if (fixedTalents) return;
    if (rites.includes(n.id)) { message.textContent = `${n.name} is a Rite this run`; return; }
    if (draft.talents.includes(n.id)) {
      const next = removeLearned(o.classId, { ...draft, rites }, n.id);
      draft = { talents: [...next.talents], q: next.q, e: next.e };
      message.textContent = '';
    } else {
      const next = { ...draft, talents: [...draft.talents, n.id] };
      const error = stepCheck(next);
      if (error) { message.textContent = lockReason(n, draft.talents, error) ?? error; return; }
      draft = next; message.textContent = '';
    }
    draw();
  };

  /** A node's tooltip in the current draft: its rule, then only the notes that apply now. */
  const nodeText = (n: TalentNode): string => {
    const kit = resolveKit(o.classId, { ...draft, rites });
    const learned = draft.talents.includes(n.id), rite = rites.includes(n.id);
    const lines = [n.rule];
    if (rite) lines.push('Held as a Rite this run.');
    if (kit.dormant.includes(n.id)) lines.push('Dormant: its ability is not assigned.');
    if (kit.suppressed.has(n.id)) lines.push(`Suppressed this run by the Rite ${talentNode(kit.suppressed.get(n.id)!)?.name}.`);
    if (!learned && !rite) {
      const reason = lockReason(n, draft.talents, stepCheck({ ...draft, talents: [...draft.talents, n.id] }));
      if (reason) lines.push(reason);
    }
    return lines.join('\n');
  };

  // Built once: a click updates the tiles in place, so the hovered tile stays the same element.
  const tiles = new Map<string, HTMLButtonElement>();
  for (const t of TREE_IDS) {
    const info = TREES[o.classId]?.[t];
    const col = el('div', 'talent-tree', trees);
    const name = el('div', 'talent-tree-name', col, info?.name ?? t.toUpperCase());
    if (info) attachTooltip(name, info.name, info.domain);
    for (const tier of [1, 2, 3, 4] as const) {
      const row = el('div', 'talent-tier', col);
      for (const n of nodes.filter((x) => x.tree === t && x.tier === tier)) {
        const b = button('', row, () => { if (!fixedTalents) flash(b); toggle(n); }, `talent-node${fixedTalents ? ' view' : ''}`);
        iconImage(n, b);
        if (!talentIcon(n)) el('span', 'talent-node-name', b, n.name);
        b.dataset.node = n.id;
        b.setAttribute('aria-label', n.name);
        attachTooltip(b, n.name, () => nodeText(n));
        tiles.set(n.id, b);
      }
    }
  }

  // Q and E rows are rebuilt only when the choices change (learning an ability node); a pick updates in place.
  let slotKeys = '';
  const slotButtons: Array<{ slot: 'Q' | 'E'; id: string; b: HTMLButtonElement }> = [];
  const drawSlots = (): void => {
    const choices = (['Q', 'E'] as const).map((slot) => slotChoices(o.classId, slot, [...draft.talents, ...rites]));
    const keys = JSON.stringify(choices);
    if (keys !== slotKeys) {
      slotKeys = keys;
      slots.replaceChildren();
      slotButtons.length = 0;
      (['Q', 'E'] as const).forEach((slot, i) => {
        const row = el('div', 'talent-slot-row', slots);
        el('div', 'talent-slot-key', row, slot);
        for (const id of choices[i]) {
          const def = abilityDef(o.classId, slot, id);
          const b = button('', row, () => {
            if (o.readOnly) return;
            flash(b);
            draft = slot === 'Q' ? { ...draft, q: id } : { ...draft, e: id };
            message.textContent = hint; draw();
          }, `talent-ability${o.readOnly ? ' view' : ''}`);
          const icon = el('img', '', b); icon.src = spriteUrl(def.icon); icon.alt = '';
          el('span', '', b, def.name);
          attachTooltip(b, def.name, def.description);
          slotButtons.push({ slot, id, b });
        }
      });
    }
    for (const { slot, id, b } of slotButtons) b.setAttribute('aria-pressed', String((slot === 'Q' ? draft.q : draft.e) === id));
  };

  const draw = (): void => {
    const used = draft.talents.length, cap = o.level === null ? null : pointsFor(o.level);
    points.textContent = cap === null ? `${used} points · free (development)` : `${used} / ${cap} points`;
    const kit = resolveKit(o.classId, { ...draft, rites });
    for (const n of nodes) {
      const b = tiles.get(n.id)!;
      const learned = draft.talents.includes(n.id), rite = rites.includes(n.id);
      const open = !learned && !rite && stepCheck({ ...draft, talents: [...draft.talents, n.id] }) === null;
      b.classList.remove('rite', 'learned', 'open', 'locked');
      b.classList.add(rite ? 'rite' : learned ? 'learned' : open ? 'open' : 'locked');
      b.classList.toggle('dormant', kit.dormant.includes(n.id));
      b.classList.toggle('suppressed', kit.suppressed.has(n.id));
      b.setAttribute('aria-pressed', String(learned || rite));
    }
    drawSlots();
    if (!apply) return;
    const dirty = JSON.stringify(draft) !== JSON.stringify(accepted), error = check(draft);
    apply.disabled = !dirty || error !== null;
    // Why Apply waits (a Rite's gate), unless a refusal is already showing.
    if (dirty && error && !message.textContent) message.textContent = error;
  };

  let apply: HTMLButtonElement | null = null;
  const hint = o.readOnly ? 'Learn and assign in the Lobby or with the Advocate in the Confessional.'
    : o.slotsOnly ? 'Assign Q and E here outside combat. Learn talents in the Lobby or with the Advocate.' : '';
  message.textContent = hint;
  if (!fixedTalents) button('Reset all', footer, () => {
    draft = { talents: [], q: slotChoices(o.classId, 'Q', rites).includes(draft.q) ? draft.q : slotChoices(o.classId, 'Q', [])[0], e: slotChoices(o.classId, 'E', rites).includes(draft.e) ? draft.e : slotChoices(o.classId, 'E', [])[0] };
    message.textContent = stepCheck(draft) ?? ''; draw();
  }, 'small secondary');
  button(fixedTalents ? 'Close (T)' : 'Close', footer, o.onClose, 'small secondary');
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
  const title = panel.querySelector('.talent-title')!;
  const pass = button('Pass', footer, () => o.onPass(offerId), 'small secondary');
  button('Close (Esc)', footer, o.onClose, 'small secondary');
  return {
    el: root,
    setMessage: (text) => { message.textContent = text; },
    show: (offer, pending) => {
      offerId = offer.offerId;
      const more = pending > 1 ? ` ${pending} offers wait.` : '';
      title.textContent = offer.source === 'bargain' ? 'The Advocate’s bargain' : offer.source === 'sundial' ? 'The Sundial’s Rite' : offer.source === 'bell' ? 'A Rite of the Bell' : 'A Rite';
      sub.textContent = offer.source === 'bargain'
        ? `Every chest relic is yours, so the Advocate sells a Rite: it costs ${offer.price ?? 0} max HP until the run ends. Decline to keep your health.`
        : offer.source === 'sundial'
          ? offer.fallback ? 'No talent can be offered: seal the Gatekeeper before the Sundial goes dark for 6 halos instead.'
            : 'Select one now. It becomes a Rite only if the Gatekeeper’s doors seal before 14:00; nothing is spent until then.'
          : `One of your talents until this run ends.${more} Pass keeps your kit as it is.`;
      pass.textContent = offer.source === 'bargain' ? 'Decline' : offer.source === 'sundial' ? 'Unselect' : 'Pass';
      pass.hidden = offer.source === 'sundial' && !offer.selected;
      message.textContent = '';
      cards.replaceChildren();
      for (const card of offer.cards) {
        const n = talentNode(card.id)!;
        const c = el('div', `rite-card${card.ok ? '' : ' disabled'}`, cards);
        const head = el('div', 'rite-head', c);
        iconImage(n, head);
        const title = el('div', '', head);
        el('div', 'rite-tree', title, `${TREES[o.classId]?.[n.tree].name ?? n.tree} · tier ${n.tier}`);
        el('div', 'rite-name', title, n.name);
        el('div', 'rite-rule', c, n.rule);
        const notes = el('div', 'rite-notes', c);
        for (const line of cardNotes(o.classId, card)) el('div', '', notes, line);
        const selected = offer.source === 'sundial' && offer.selected === card.id;
        const label = offer.source === 'bargain' ? `Accept · −${offer.price ?? 0} max HP` : offer.source === 'sundial' ? (selected ? 'Selected' : 'Select') : 'Take';
        const take = button(label, c, () => o.onTake(offerId, card.id), 'small');
        take.disabled = !card.ok || selected;
        if (selected) c.classList.add('selected');
      }
    },
  };
}
