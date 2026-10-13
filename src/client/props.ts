/** Reliable prop state and the painted sprite atlas used by world decorations. */
import * as THREE from 'three';
import type { FloorSync, GameEvent } from '../net/messages';
import { PROP_HEIGHT, PROP_RECHARGE_TICKS, PROP_SPRITES, type PropDef } from '../data/props';
import type { GameMap } from '../sim/map';
import type { Atlas } from '../render/atlas';
import { Billboards, MAX_BILLBOARDS } from '../render/billboards';

type PropEvent = Extract<GameEvent, { type: 'propBroken' | 'propBlast' | 'propReady' }>;
export class PropProjection {
  readonly broken = new Set<number>();
  readonly blasts = new Map<number, number>();
  readonly recharges = new Map<number, number>();
  private readonly defs: Map<number, PropDef>;
  private revision = -1;
  constructor(readonly runId: string, props: readonly PropDef[]) { this.defs = new Map(props.map((p) => [p.id, p])); }
  sync(s: FloorSync): boolean {
    const broken = s.brokenProps ?? [], blasts = s.propBlasts ?? [], recharges = s.propRecharges ?? [];
    if (s.runId !== this.runId || !Number.isInteger(s.revision) || s.revision < 0 || s.revision > 0xffffffff || s.revision < this.revision ||
      !Number.isInteger(s.tick) || s.tick < 0 || !Array.isArray(broken) || !Array.isArray(blasts) || !Array.isArray(recharges) ||
      broken.length > this.defs.size || blasts.length > this.defs.size || recharges.length > this.defs.size || blasts.some((b) => !b) || recharges.some((b) => !b) ||
      new Set(broken).size !== broken.length || new Set(blasts.map((b) => b.id)).size !== blasts.length || new Set(recharges.map((b) => b.id)).size !== recharges.length ||
      broken.some((id) => !this.defs.has(id)) || blasts.some((b) => this.defs.get(b.id)?.family !== 'blast' || !broken.includes(b.id) || !Number.isInteger(b.impactTick) || b.impactTick < 0) ||
      recharges.some((b) => !this.defs.has(b.id) || this.defs.get(b.id)!.family === 'loot' || !broken.includes(b.id) || !Number.isInteger(b.readyTick) || b.readyTick <= s.tick || b.readyTick > s.tick + PROP_RECHARGE_TICKS)) return false;
    this.revision = s.revision; this.broken.clear(); this.blasts.clear(); this.recharges.clear();
    for (const id of broken) this.broken.add(id);
    for (const b of blasts) this.blasts.set(b.id, b.impactTick);
    for (const b of recharges) this.recharges.set(b.id, b.readyTick);
    return true;
  }
  event(e: PropEvent, revision: number): boolean {
    const p = this.defs.get(e.id);
    if (!p || !Number.isInteger(revision) || revision > 0xffffffff || revision <= this.revision ||
      ![e.x, e.y, e.z].every(Number.isFinite) || e.x !== p.x || e.y !== p.y) return false;
    if (e.type === 'propBroken') {
      if (p.family !== e.family || p.marked !== e.marked || this.broken.has(e.id) ||
        !Number.isInteger(e.impactTick) || (e.family === 'blast' ? e.impactTick < 0 : e.impactTick !== -1) ||
        !Number.isInteger(e.readyTick) || (e.family === 'loot' ? e.readyTick !== -1 : e.readyTick < PROP_RECHARGE_TICKS) ||
        e.family === 'blast' && e.readyTick !== e.impactTick - 6 + PROP_RECHARGE_TICKS ||
        !Array.isArray(e.targets) || e.targets.length > 4 || new Set(e.targets).size !== e.targets.length ||
        e.targets.some((id) => !Number.isInteger(id) || id < 0 || id >= 4)) return false;
      this.broken.add(e.id);
      if (e.family === 'blast') this.blasts.set(e.id, e.impactTick);
      if (e.readyTick >= 0) this.recharges.set(e.id, e.readyTick);
    } else if (e.type === 'propBlast') {
      if (p.family !== 'blast' || !this.blasts.has(e.id)) return false;
      this.blasts.delete(e.id);
    } else {
      if (p.family === 'loot' || !this.broken.has(e.id) || !this.recharges.has(e.id) || this.blasts.has(e.id)) return false;
      this.broken.delete(e.id); this.recharges.delete(e.id);
    }
    this.revision = revision;
    return true;
  }
  /** Interpolation cannot reactivate a prop; only a host event/checkpoint can. */
  charge(id: number, tick: number): number {
    if (!this.broken.has(id)) return 1;
    const ready = this.recharges.get(id);
    return ready === undefined ? 0 : Math.max(0, Math.min(0.99, 1 - (ready - tick) / PROP_RECHARGE_TICKS));
  }
}

export class PropView {
  readonly model: PropProjection;
  readonly billboards: Billboards;
  private readonly charge = new THREE.InstancedBufferAttribute(new Float32Array(MAX_BILLBOARDS * 2), 2);
  private readonly glow = { r: 1, g: 0.9, b: 0.6, a: 0 };
  constructor(readonly map: GameMap, runId: string, readonly defs: readonly PropDef[], lightmap: THREE.Texture, private readonly atlas: Atlas) {
    this.model = new PropProjection(runId, defs);
    this.billboards = new Billboards(atlas.texture);
    this.billboards.setLight(lightmap, map.w, map.h, (x, y) => map.floor[Math.floor(y) * map.w + Math.floor(x)]);
    this.charge.setUsage(THREE.DynamicDrawUsage);
    this.billboards.mesh.geometry.setAttribute('propCharge', this.charge);
    // One material/draw for every prop; no per-frame texture uploads.
    const material = this.billboards.mesh.material as THREE.ShaderMaterial;
    material.vertexShader = 'attribute vec2 propCharge; varying vec2 vCharge; varying vec2 vLocal;\n' + material.vertexShader.replace('vUv = mix', 'vCharge = propCharge; vLocal = uv; vUv = mix');
    material.fragmentShader = 'varying vec2 vCharge; varying vec2 vLocal;\n' + material.fragmentShader.replace('if (c.a < 0.5)', `
      if (vCharge.x > 1.5) {
        float fill = vCharge.y;
        vec2 liquid = (vLocal - vec2(0.5, 0.90 + 0.055 * fill)) / vec2(0.43, 0.037);
        float water = (1.0 - smoothstep(0.88, 1.0, length(liquid))) * step(0.01, fill);
        float spill = step(0.995, fill) * step(0.80, vLocal.y) * step(vLocal.y, 0.96)
          * (1.0 - smoothstep(0.012, 0.025, min(abs(vLocal.x - 0.18), abs(vLocal.x - 0.82))));
        c.rgb = mix(c.rgb, vec3(0.10, 0.90, 0.32), max(water, spill));
      } else if (vCharge.x > 0.5 && vCharge.y < 1.0) {
        if (vLocal.y > 0.34 && vLocal.y < 0.68 && vLocal.x > 0.33 && vLocal.x < 0.67)
          c.rgb = mix(c.rgb, vec3(0.16, 0.025, 0.025), 0.94);
      }
      if (c.a < 0.5)`);
  }
  update(camera: THREE.Camera, tick: number): void {
    const b = this.billboards; b.begin(); let index = 0;
    for (const p of this.defs) {
      const depleted = this.model.broken.has(p.id), impact = this.model.blasts.get(p.id);
      if (depleted && p.family === 'loot') continue;
      const name = p.family === 'loot' ? PROP_SPRITES[p.marked ? 3 : p.variant] : p.family === 'blast' ? 'sanctuary-lamp' : 'blessing-chalice';
      const z = this.map.floor[Math.floor(p.y) * this.map.w + Math.floor(p.x)];
      const charge = this.model.charge(p.id, tick), active = !depleted;
      this.charge.setXY(index++, p.family === 'blessing' ? 2 : p.family === 'blast' ? 1 : 0, charge);
      this.glow.r = p.family === 'blessing' ? 0.25 : 1; this.glow.g = p.family === 'blast' ? 0.4 : 0.95; this.glow.b = p.family === 'blessing' ? 0.4 : 0.25;
      this.glow.a = impact !== undefined && tick < impact ? 0.75 : active && (p.family !== 'loot' || p.marked) ? 0.12 + 0.08 * Math.sin(tick / 9 + p.id) : 0;
      const shade = depleted ? 0.60 + charge * 0.25 : 1;
      b.add(this.atlas.frames[name], p.x, p.y, z, PROP_HEIGHT[p.family], false, shade, shade, shade, this.glow);
    }
    this.charge.needsUpdate = true; b.end(camera);
  }
  dispose(): void { this.billboards.mesh.geometry.dispose(); (this.billboards.mesh.material as THREE.Material).dispose(); }
}
