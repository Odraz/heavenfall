/** Fixed slot maps, sharing geometry and glyphs with the generated floor (rogue game.md §5). */
import type { ClassId } from '../data/classes';
import type { Floor } from '../gen/generate';
import { BAND, SLOT } from '../gen/transform';
import { PHASE_CLEARED, PHASE_COMBAT, PHASE_COUNTDOWN } from '../net/protocol';
import { drawMapIcon, ICON_PATHS, roomIcon, type MapIcon } from './mapIcons';
import type { ClientRooms } from './rooms';
import { rewardLabel } from '../gen/rewards';
import { drawRewardIcon, loadRewardArt } from './rewardIcon';

export interface MapPlayer { id: number; name: string; classId: ClassId; x: number; y: number; yaw: number }
const CLASS_COLORS: Record<ClassId, string> = { fallen: '#e05a42', heretic: '#f0c76a', binder: '#85b6e6', betrayer: '#b38bd4' };
// The :root tokens in style.css (soot, parchment, gold), which canvas drawing can't read.
const INK = {
  plate: 'rgba(27, 21, 19, 0.88)',
  line: '#e8dcc0',
  door: '#e8dcc080',
  visited: '#6e6253',
  combat: '#b03a2e',
  own: '#f3c64b',
  outline: '#1b1513',
  note: '#b9ac97',
};
const DISPLAY_FONT = "'Cinzel', Georgia, serif";
const BODY_FONT = "'Segoe UI', system-ui, sans-serif";
export const MAP_STATES = ['Undiscovered', 'Discovered', 'Visited'] as const;
export function mapState(knowledge: number, phase: number): string {
  return phase === PHASE_COMBAT ? 'Combat' : phase === PHASE_COUNTDOWN ? 'Countdown' :
    phase === PHASE_CLEARED ? 'Cleared' : MAP_STATES[knowledge];
}

export class MapView {
  readonly mini = document.createElement('canvas');
  readonly full = document.createElement('div');
  private readonly plate = document.createElement('canvas');
  private readonly legend = document.createElement('canvas');
  private readonly names = document.createElement('div');
  private readonly roomsList = document.createElement('ul');
  private cursor = { x: 294, y: 294 };
  private lastSummary = '';
  private lastDraw = -Infinity;

  constructor(private readonly parent: HTMLElement, private readonly model: ClientRooms, private readonly floor: Floor | null, private readonly localId: number) {
    this.mini.width = this.mini.height = 200;
    this.mini.className = 'minimap'; this.mini.setAttribute('aria-label', 'Floor minimap');
    this.mini.hidden = !floor;
    this.plate.width = this.plate.height = 588; this.plate.setAttribute('aria-label', 'Full floor map');
    this.full.className = 'full-map'; this.full.hidden = true;
    const layout = document.createElement('div'); layout.className = 'map-layout';
    const side = document.createElement('div'); side.className = 'map-legend';
    this.legend.width = 190; this.legend.height = 380;
    this.names.className = 'map-player-names';
    side.append(this.legend, this.names); layout.append(this.plate, side); this.full.append(layout);
    this.roomsList.className = 'map-room-list'; this.roomsList.setAttribute('aria-label', 'Known rooms');
    parent.append(this.mini, this.full, this.roomsList);
    this.drawLegend();
    // Reward art and Cinzel arrive asynchronously; the map redraws itself, the legend once each.
    void loadRewardArt().then(() => this.drawLegend());
    void document.fonts?.load(`700 16px ${DISPLAY_FONT}`).then(() => this.drawLegend());
    document.addEventListener('mousemove', this.mousemove);
  }

  set open(value: boolean) { this.full.hidden = !value; this.parent.classList.toggle('map-open', value); }
  get open(): boolean { return !this.full.hidden; }
  moveCursor(dx: number, dy: number): void {
    this.cursor.x = Math.max(0, Math.min(588, this.cursor.x + dx));
    this.cursor.y = Math.max(0, Math.min(588, this.cursor.y + dy));
  }
  private readonly mousemove = (e: MouseEvent): void => {
    if (!this.open || document.pointerLockElement) return;
    const r = this.plate.getBoundingClientRect();
    this.cursor.x = (e.clientX - r.left) * 588 / r.width;
    this.cursor.y = (e.clientY - r.top) * 588 / r.height;
  };

  update(now: number, players: MapPlayer[], ownRoom: number): void {
    // Maps need a pulse and moving markers, not a full redraw at the game's render rate.
    if (now - this.lastDraw < 50) return;
    this.lastDraw = now;
    this.draw(this.mini, 28, 2, now, players, ownRoom, false);
    if (this.open) this.draw(this.plate, 84, 0, now, players, ownRoom, true);
    const summary = this.model.states.flatMap((r, i) => r.knowledge ? [`${i}: ${this.model.map.rooms[i].name} — ${mapState(r.knowledge, r.phase)}${this.floor && this.model.map.rooms[i].kind === 'combat' ? ` · ${rewardLabel(this.floor.rewards[i])}` : ''}`] : []);
    const text = summary.join('\n');
    if (text !== this.lastSummary) {
      this.lastSummary = text;
      this.roomsList.replaceChildren(...summary.map((s) => { const li = document.createElement('li'); li.textContent = s; return li; }));
      this.mini.setAttribute('aria-description', text);
    }
    if (this.open) this.names.textContent = players.map((p) => p.name).join('\n');
  }

  private draw(canvas: HTMLCanvasElement, slot: number, pad: number, now: number, players: MapPlayer[], ownRoom: number, full: boolean): void {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // The full map lies on the panel's own fill; the minimap needs a plate over the world.
    if (!full) { ctx.fillStyle = INK.plate; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    if (!this.floor) {
      ctx.fillStyle = INK.line; ctx.font = `14px ${BODY_FONT}`; ctx.textAlign = 'center';
      ctx.fillText('No map in the fixture', canvas.width / 2, canvas.height / 2); return;
    }
    const floor = this.floor;
    const project = (x: number, y: number): [number, number] => [pad + ((x - BAND) / SLOT + floor.slotOrigin[0]) * slot, pad + ((y - BAND) / SLOT + floor.slotOrigin[1]) * slot];
    // One vestibule connector per pair; never draw toward an unknown room.
    ctx.strokeStyle = INK.door; ctx.lineWidth = 2;
    floor.rooms.forEach((r, i) => {
      if (!this.model.states[i].knowledge) return;
      for (const door of r.doors) {
        if (door.to <= i || !this.model.states[door.to].knowledge) continue;
        const leaf = this.model.map.rooms[i].leaves.find((l) => l.to === door.to)!;
        const far = this.model.map.rooms[door.to].leaves.find((l) => l.to === i)!;
        const center = (cells: typeof leaf.cells) => project(cells.reduce((n, c) => n + c[0] + 0.5, 0) / 4, cells.reduce((n, c) => n + c[1] + 0.5, 0) / 4);
        const a = center(leaf.cells), b = center(far.cells);
        // Expand the authored band to the map's six-pixel room gap.
        const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        ctx.beginPath(); ctx.moveTo(mx - dx / len * 4, my - dy / len * 4); ctx.lineTo(mx + dx / len * 4, my + dy / len * 4); ctx.stroke();
      }
    });
    floor.rooms.forEach((r, i) => {
      const st = this.model.states[i]; if (!st.knowledge) return;
      const sx = Math.min(...r.slots.map((s) => s[0])), sy = Math.min(...r.slots.map((s) => s[1]));
      const w = (Math.max(...r.slots.map((s) => s[0])) - sx + 1) * slot - 6;
      const h = (Math.max(...r.slots.map((s) => s[1])) - sy + 1) * slot - 6;
      const x = pad + sx * slot + 3, y = pad + sy * slot + 3;
      ctx.globalAlpha = 1;
      if (st.phase === PHASE_COMBAT || st.phase === PHASE_COUNTDOWN) {
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(now / 1000 * Math.PI * 2);
        ctx.fillStyle = INK.combat; ctx.fillRect(x, y, w, h);
      } else if (st.phase === PHASE_CLEARED || st.knowledge === 2) {
        ctx.globalAlpha = st.phase === PHASE_CLEARED ? 0.8 : 1;
        ctx.fillStyle = st.phase === PHASE_CLEARED ? INK.line : INK.visited; ctx.fillRect(x, y, w, h);
      }
      ctx.globalAlpha = st.knowledge === 1 ? 0.5 : 1;
      ctx.lineWidth = ownRoom === i ? 3 : 2; ctx.strokeStyle = ownRoom === i ? INK.own : INK.line; ctx.strokeRect(x, y, w, h);
      ctx.globalAlpha = st.knowledge === 1 ? 0.6 : 1;
      const room = this.model.map.rooms[i], size = full ? 40 : 16;
      drawMapIcon(ctx, roomIcon(room, i === floor.reliquary), x + w / 2, y + h / 2, size, st.phase === PHASE_CLEARED);
      if (room.secondary && i !== floor.reliquary) drawMapIcon(ctx, room.secondary, x + w - size / 4, y + h - size / 4, size / 2, st.phase === PHASE_CLEARED);
      if (room.kind === 'combat') drawRewardIcon(ctx, floor.rewards[i], x + size * 0.35, y + h - size * 0.35, size * 0.6);
    });
    ctx.globalAlpha = 1;
    for (const p of players) {
      const room = this.model.roomAt(p.x, p.y);
      if (room !== 255 && !this.model.states[room].knowledge) continue;
      const [x, y] = project(p.x, p.y); ctx.fillStyle = CLASS_COLORS[p.classId];
      ctx.strokeStyle = INK.outline; ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (p.id === this.localId) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(p.yaw);
        ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-2, 0); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      } else { ctx.arc(x, y, full ? 5 : 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      if (full) { ctx.font = `600 12px ${BODY_FONT}`; ctx.textAlign = 'center'; ctx.strokeText(p.name, x, y - 10); ctx.fillText(p.name, x, y - 10); }
    }
    if (full) {
      ctx.strokeStyle = INK.own; ctx.lineWidth = 2; const { x, y } = this.cursor;
      ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6); ctx.stroke();
    }
  }

  private drawLegend(): void {
    const ctx = this.legend.getContext('2d')!; ctx.clearRect(0, 0, this.legend.width, this.legend.height);
    ctx.font = `700 16px ${DISPLAY_FONT}`; ctx.fillStyle = INK.own;
    ctx.fillText('Floor map', 4, 18);
    const after = 4 + ctx.measureText('Floor map').width + 10;
    ctx.font = `13px ${BODY_FONT}`; ctx.fillStyle = INK.note;
    ctx.fillText('Hold M', after, 18);
    ctx.font = `14px ${BODY_FONT}`; ctx.fillStyle = INK.line;
    (Object.keys(ICON_PATHS) as MapIcon[]).forEach((icon, i) => {
      drawMapIcon(ctx, icon, 16, 42 + i * 20, 16);
      ctx.fillText(icon[0].toUpperCase() + icon.slice(1), 34, 47 + i * 20);
    });
    const rewards = [{ kind: 'gold' }, { kind: 'item', item: 'balm' }, { kind: 'rite' }] as const;
    rewards.forEach((reward, i) => {
      drawRewardIcon(ctx, reward, 16, 294 + i * 24, 20);
      ctx.fillStyle = INK.line; ctx.fillText(['Halos', 'Consumable', 'Rite page'][i], 34, 299 + i * 24);
    });
    ctx.fillStyle = INK.note; ctx.fillText('No mark: no clear reward', 4, 299 + 3 * 24);
  }
  dispose(): void {
    this.parent.classList.remove('map-open');
    document.removeEventListener('mousemove', this.mousemove);
    this.mini.remove(); this.full.remove(); this.roomsList.remove();
  }
}
