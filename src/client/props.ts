/** Reliable prop projection and the explicitly labeled B1 art fallback. */
import * as THREE from 'three';
import type { FloorSync, GameEvent } from '../net/messages';
import { PROP_HEIGHT, type PropDef } from '../data/props';
import type { GameMap } from '../sim/map';
import type { SpriteFrame } from '../render/atlas';
import { Billboards } from '../render/billboards';

export class PropProjection {
  readonly broken = new Set<number>();
  readonly blasts = new Map<number, number>();
  private readonly defs: Map<number, PropDef>;
  private revision = -1;
  constructor(readonly runId: string, props: readonly PropDef[]) { this.defs = new Map(props.map((p) => [p.id, p])); }
  sync(s: FloorSync): boolean {
    const broken = s.brokenProps ?? [], blasts = s.propBlasts ?? [];
    if (s.runId !== this.runId || !Number.isInteger(s.revision) || s.revision < 0 || s.revision > 0xffffffff || s.revision < this.revision ||
      !Number.isInteger(s.tick) || s.tick < 0 || !Array.isArray(broken) || !Array.isArray(blasts) ||
      broken.length > this.defs.size || blasts.length > this.defs.size || blasts.some((b) => !b) ||
      new Set(broken).size !== broken.length || new Set(blasts.map((b) => b.id)).size !== blasts.length ||
      broken.some((id) => !this.defs.has(id)) || blasts.some((b) => this.defs.get(b.id)?.family !== 'blast' || !broken.includes(b.id) || !Number.isInteger(b.impactTick) || b.impactTick < 0)) return false;
    this.revision = s.revision; this.broken.clear(); this.blasts.clear();
    for (const id of broken) this.broken.add(id);
    for (const b of blasts) this.blasts.set(b.id, b.impactTick);
    return true;
  }
  event(e: Extract<GameEvent, { type: 'propBroken' | 'propBlast' }>, revision: number): boolean {
    const p = this.defs.get(e.id);
    if (!p || !Number.isInteger(revision) || revision > 0xffffffff || revision <= this.revision ||
      ![e.x, e.y, e.z].every(Number.isFinite) || e.x !== p.x || e.y !== p.y) return false;
    if (e.type === 'propBroken' && (p.family !== e.family || p.marked !== e.marked ||
      !Number.isInteger(e.impactTick) || (e.family === 'blast' ? e.impactTick < 0 : e.impactTick !== -1) ||
      !Array.isArray(e.targets) || e.targets.length > 4 || new Set(e.targets).size !== e.targets.length ||
      e.targets.some((id) => !Number.isInteger(id) || id < 0 || id >= 4))) return false;
    this.revision = revision;
    if (e.type === 'propBlast') {
      if (p.family !== 'blast' || !this.blasts.has(e.id)) return false;
      this.blasts.delete(e.id); return true;
    }
    if (this.broken.has(e.id)) return false;
    this.broken.add(e.id);
    if (e.family === 'blast') this.blasts.set(e.id, e.impactTick);
    return true;
  }
}

/** One atlas/one billboard draw, with three ivory shapes, a red-black lamp and a gold chalice. */
function fallbackAtlas(): { texture: THREE.CanvasTexture; frames: SpriteFrame[] } {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  for (let i = 0; i < 8; i++) {
    ctx.save(); ctx.translate(i * 128, 0); ctx.lineWidth = 4; ctx.strokeStyle = '#60462f';
    if (i < 6) {
      const squat = i % 3 === 1;
      ctx.fillStyle = '#f7efd9';
      ctx.beginPath(); ctx.moveTo(46, 17); ctx.lineTo(82, 17); ctx.lineTo(79, 58);
      ctx.bezierCurveTo(squat ? 125 : 118, squat ? 100 : 75, 115, 178, 82, 211); ctx.lineTo(46, 211);
      ctx.bezierCurveTo(13, 178, squat ? 3 : 10, squat ? 100 : 75, 49, 58); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#dfb448'; ctx.strokeRect(44, 15, 40, 9);
      ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(28, 87, 13, 25, 0, 0, Math.PI * 2); ctx.ellipse(100, 87, 13, 25, 0, 0, Math.PI * 2); ctx.stroke();
      if (i % 3 === 2) { ctx.strokeStyle = '#b2a574'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(64, 181); ctx.lineTo(64, 112); ctx.moveTo(64, 145); ctx.lineTo(44, 128); ctx.moveTo(64, 138); ctx.lineTo(84, 119); ctx.stroke(); }
      if (i >= 3) { ctx.strokeStyle = '#e8b620'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(64, 105); ctx.lineTo(64, 175); ctx.moveTo(43, 130); ctx.lineTo(85, 130); ctx.stroke(); }
      ctx.fillStyle = '#f1d69d'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(squat ? 'AMPHORA · SQUAT' : i % 3 === 2 ? 'AMPHORA · LILY' : 'AMPHORA · TALL', 64, 247);
    } else if (i === 6) {
      ctx.strokeStyle = '#c8982e'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(64, 136); ctx.lineTo(64, 213); ctx.moveTo(64, 157); ctx.lineTo(31, 213); ctx.moveTo(64, 157); ctx.lineTo(97, 213); ctx.stroke();
      ctx.fillStyle = '#b32326'; ctx.fillRect(28, 55, 72, 90); ctx.strokeStyle = '#1c191d'; ctx.lineWidth = 12; ctx.strokeRect(27, 54, 74, 91); ctx.fillStyle = '#111'; ctx.fillRect(23, 93, 82, 17);
      ctx.fillStyle = '#ffe58a'; ctx.beginPath(); ctx.moveTo(64, 22); ctx.quadraticCurveTo(94, 53, 64, 71); ctx.quadraticCurveTo(43, 56, 64, 22); ctx.fill();
      ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SANCTUARY LAMP', 64, 247);
    } else {
      ctx.fillStyle = '#eee7d7'; ctx.fillRect(35, 189, 58, 22); ctx.fillRect(47, 159, 34, 30);
      ctx.fillStyle = '#e4b944'; ctx.beginPath(); ctx.moveTo(22, 35); ctx.lineTo(106, 35); ctx.quadraticCurveTo(109, 99, 69, 110); ctx.lineTo(69, 150); ctx.lineTo(93, 160); ctx.lineTo(35, 160); ctx.lineTo(59, 150); ctx.lineTo(59, 110); ctx.quadraticCurveTo(19, 99, 22, 35); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff7b2'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('HEALING CHALICE', 64, 247);
    }
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, frames: Array.from({ length: 16 }, (_, i) => ({ u0: (i % 8) / 8, u1: (i % 8 + 1) / 8,
    v0: i < 8 ? 44 / 256 : 0, v1: i < 8 ? 240 / 256 : 32 / 256, aspect: i < 8 ? 0.8 : 4 })) };
}

export class PropView {
  readonly model: PropProjection;
  readonly billboards: Billboards;
  private readonly atlas = fallbackAtlas();
  private readonly glow = { r: 1, g: 0.9, b: 0.6, a: 0 };
  constructor(readonly map: GameMap, runId: string, readonly defs: readonly PropDef[], lightmap: THREE.Texture) {
    this.model = new PropProjection(runId, defs);
    this.billboards = new Billboards(this.atlas.texture);
    this.billboards.setLight(lightmap, map.w, map.h, (x, y) => map.floor[Math.floor(y) * map.w + Math.floor(x)]);
  }
  update(camera: THREE.Camera, tick: number): void {
    const b = this.billboards; b.begin();
    for (const p of this.defs) {
      const impact = this.model.blasts.get(p.id);
      if (this.model.broken.has(p.id) && (impact === undefined || tick >= impact)) continue;
      const frame = p.family === 'loot' ? p.variant + (p.marked ? 3 : 0) : p.family === 'blast' ? 6 : 7;
      const z = this.map.floor[Math.floor(p.y) * this.map.w + Math.floor(p.x)];
      this.glow.a = impact !== undefined ? 0.85 : p.marked ? Math.max(0, 1 - Math.abs((tick % 90) - 8) / 8) * 0.45 : p.family === 'blast' ? 0.06 + 0.04 * Math.sin(tick / 3 + p.id) : 0;
      b.add(this.atlas.frames[frame], p.x, p.y, z, PROP_HEIGHT[p.family], false, 1, 1, 1, this.glow);
      b.add(this.atlas.frames[frame + 8], p.x, p.y, z + PROP_HEIGHT[p.family] + 0.05, 0.18, false);
    }
    b.end(camera);
  }
  dispose(): void { this.billboards.mesh.geometry.dispose(); (this.billboards.mesh.material as THREE.Material).dispose(); this.atlas.texture.dispose(); }
}
