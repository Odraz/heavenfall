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
}

interface Frame {
  root: HTMLDivElement;
  hp: HTMLDivElement;
  shield: HTMLDivElement;
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
      const total = Math.max(maxHp, m.hp + m.shield);
      f.hp.style.width = `${(Math.max(0, m.hp) / total) * 100}%`;
      f.shield.style.left = f.hp.style.width;
      f.shield.style.width = `${(m.shield / total) * 100}%`;
      f.root.classList.toggle('dead', m.dead);
      f.status.textContent = m.dead ? 'Dead' : m.shield > 0 ? `${Math.ceil(m.hp)} + ${Math.ceil(m.shield)}` : `${Math.ceil(m.hp)}`;
    }
    for (const [id, f] of this.frames) {
      if (seen.has(id)) continue;
      f.root.remove();
      this.frames.delete(id);
    }
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
    return { root, hp, shield, status };
  }

  dispose(): void {
    this.root.remove();
  }
}
