/**
 * Party frames (§10), multiplayer only: one per other player, with name, class icon, HP and shield
 * bar and dead state; the ally target for E is tinted gold.
 */
import { CLASSES, type ClassId } from '../data/classes';
import { spriteUrl } from '../render/atlas';

export interface PartyMember {
  id: number;
  name: string;
  classId: ClassId;
  hp: number;
  shield: number;
  dead: boolean;
  /** Revive progress 0–1 while dead (M8 §3.1). */
  revive: number;
}

/** Party frame flashes (M8 §3.1): healed, shielded and (from stage 4) revived. */
const FLASH_COLORS = { green: 'rgba(80, 230, 100, 0.85)', blue: 'rgba(90, 170, 255, 0.85)', ember: 'rgba(255, 122, 58, 0.9)' } as const;
const FLASH_MS = 400;
const DAMAGE_PULSE_MS = 200;

interface Frame {
  root: HTMLDivElement;
  bar: HTMLDivElement;
  /** HP + shield in the previous update, for the damage pulse. */
  total: number;
  hp: HTMLDivElement;
  shield: HTMLDivElement;
  revive: HTMLDivElement;
  status: HTMLDivElement;
}

function div(className: string, parent: HTMLElement): HTMLDivElement {
  const e = document.createElement('div');
  e.className = className;
  parent.appendChild(e);
  return e;
}

export class PartyFrames {
  private readonly root: HTMLDivElement;
  private readonly frames = new Map<number, Frame>();

  constructor(parent: HTMLElement) {
    this.root = div('party', parent);
  }

  /** The other players still connected, in id order; a player who left loses their frame. */
  set(members: readonly PartyMember[]): void {
    const seen = new Set<number>();
    for (const m of members) {
      seen.add(m.id);
      let f = this.frames.get(m.id);
      if (!f) {
        f = this.create(m);
        this.frames.set(m.id, f);
      }
      const maxHp = CLASSES[m.classId].hp;
      // Damage taken: the bar's border pulses red.
      if (m.hp + m.shield < f.total && !m.dead) {
        f.bar.animate([{ boxShadow: '0 0 0 3px rgba(235, 40, 20, 0.95)' }, { boxShadow: '0 0 0 3px rgba(235, 40, 20, 0)' }], { duration: DAMAGE_PULSE_MS, easing: 'ease-out' });
      }
      f.total = m.hp + m.shield;
      const total = Math.max(maxHp, m.hp + m.shield);
      f.hp.style.width = `${(Math.max(0, m.hp) / total) * 100}%`;
      f.shield.style.left = f.hp.style.width;
      f.shield.style.width = `${(m.shield / total) * 100}%`;
      f.root.classList.toggle('dead', m.dead);
      // A dead player's frame shows their revive progress, without text (M8 §3.1).
      f.revive.style.width = m.dead ? `${Math.max(0, Math.min(1, m.revive)) * 100}%` : '0';
      f.status.textContent = m.dead ? '' : m.shield > 0 ? `${Math.ceil(m.hp)} + ${Math.ceil(m.shield)}` : `${Math.ceil(m.hp)}`;
    }
    for (const [id, f] of this.frames) {
      if (seen.has(id)) continue;
      f.root.remove();
      this.frames.delete(id);
    }
  }

  /** Flashes a player's frame, fading over 400 ms (M8 §3.1). */
  flash(id: number, color: keyof typeof FLASH_COLORS): void {
    const f = this.frames.get(id);
    f?.root.animate([{ backgroundColor: FLASH_COLORS[color], boxShadow: `0 0 16px ${FLASH_COLORS[color]}` }, {}], { duration: FLASH_MS, easing: 'ease-out' });
  }

  /** Tints the ally target's frame gold (255 = none). */
  setAllyTarget(id: number): void {
    for (const [fid, f] of this.frames) f.root.classList.toggle('ally', fid === id);
  }

  private create(m: PartyMember): Frame {
    const root = document.createElement('div');
    root.className = 'party-frame';
    root.dataset.playerId = String(m.id);
    // Keep the frames in id order.
    const next = [...this.frames.entries()].filter(([id]) => id > m.id).sort((a, b) => a[0] - b[0])[0];
    this.root.insertBefore(root, next ? next[1].root : null);
    const icon = document.createElement('img');
    icon.className = 'party-icon';
    icon.src = spriteUrl(`class-${m.classId}`);
    icon.alt = CLASSES[m.classId].name;
    root.appendChild(icon);
    const info = div('party-info', root);
    const head = div('party-head', info);
    div('party-name', head).textContent = m.name;
    const status = div('party-status', head);
    const bar = div('party-bar', info);
    const hp = div('party-hp', bar);
    const shield = div('party-shield', bar);
    const revive = div('party-revive', bar);
    return { root, bar, total: m.hp + m.shield, hp, shield, revive, status };
  }

  dispose(): void {
    this.root.remove();
  }
}
