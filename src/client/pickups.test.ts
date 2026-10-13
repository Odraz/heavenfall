import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { PickupProjection, PickupView } from './pickups';
import { COIN, GOLD_HALO, HEAL_MOTE } from '../data/pickups';
import type { Atlas } from '../render/atlas';
import { Simulation } from '../sim/sim';
import { loadRunMap } from '../sim/runMap';
import { PINNED } from '../gen/pinned';
import { decodeSnapshot } from '../net/protocol';

it('keeps overlapping halos visible without additive glare or expiry blinking', () => {
  const context = { fillRect() {}, strokeRect() {}, fillText() {} };
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => context }) });
  const loading = vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation(() => new THREE.Texture());
  const { map, def } = loadRunMap({ heaven: 1, floor: 1, seed: PINNED.seed, fixture: null });
  const sim = new Simulation({ dungeon: def, map, seed: 1, players: [{ id: 0, name: 'P', classId: 'fallen' }] });
  const texture = new THREE.CanvasTexture({} as HTMLCanvasElement), glow = new THREE.Texture();
  const frame = { u0: 0, v0: 0, u1: 1, v1: 1, aspect: 1 };
  const atlas: Atlas = { texture, frames: { 'gold-halo': frame, 'heal-mote': frame }, canvas: {} as HTMLCanvasElement };
  const view = new PickupView(map, sim.runId, glow, atlas);
  try {
    const at = map.spawns[0];
    for (const kind of [COIN, GOLD_HALO, HEAL_MOTE]) sim.pickups.drop(kind, 0, at[0] + 0.5, at[1] + 0.5, 0);
    view.model.sync(sim.floorSync(sim.runId));
    const snapshot = decodeSnapshot(sim.encodeFor(0)[0])!, camera = new THREE.PerspectiveCamera();
    const [glows, coin, gold, mote] = view.group.children as THREE.InstancedMesh[];
    const matrix = new THREE.Matrix4(), previous = new THREE.Vector3();
    for (let tick = 509; tick < 600; tick++) {
      view.update(snapshot, camera, tick);
      expect([coin.count, gold.count, mote.count, glows.count]).toEqual([1, 1, 1, 1]);
      coin.getMatrixAt(0, matrix);
      const position = new THREE.Vector3().setFromMatrixPosition(matrix);
      if (tick > 509) expect(position.distanceTo(previous)).toBeLessThan(0.01);
      previous.copy(position);
      expect(new THREE.Vector3().setFromMatrixScale(matrix).x).toBeGreaterThan(0.65);
    }
    for (const mesh of [coin, gold]) {
      const material = mesh.material as THREE.MeshBasicMaterial;
      expect(material.blending).toBe(THREE.NormalBlending);
      expect(material.depthWrite).toBe(false);
    }
    coin.getMatrixAt(0, matrix); const coinAt = new THREE.Vector3().setFromMatrixPosition(matrix);
    gold.getMatrixAt(0, matrix); expect(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(coinAt)).toBeGreaterThan(0.1);
    sim.pickups.live.length = 0; sim.tick = 600;
    view.update(decodeSnapshot(sim.encodeFor(0)[0])!, camera, 600);
    expect([coin.count, gold.count, mote.count, glows.count]).toEqual([0, 0, 0, 0]);
  } finally { view.dispose(); texture.dispose(); glow.dispose(); loading.mockRestore(); vi.unstubAllGlobals(); }
});

it('restores pickup deadlines atomically and ignores pre-checkpoint metadata without removing future drops', () => {
  const { map, def } = loadRunMap({ heaven: 1, floor: 1, seed: PINNED.seed, fixture: null });
  const sim = new Simulation({ dungeon: def, map, seed: 1, players: [{ id: 0, name: 'P', classId: 'fallen' }] });
  const model = new PickupProjection(sim.runId);
  const at = map.spawns[0]; sim.pickups.drop(0, 0, at[0] + 0.5, at[1] + 0.5, 0);
  const sync = sim.floorSync(sim.runId);
  expect(model.sync(sync)).toBe(true); expect(model.records.get(1)?.pickup.expiresTick).toBe(600);
  expect(model.sync({ ...sync, pickups: [...sync.pickups!, ...sync.pickups!] })).toBe(false);
  expect(model.records.size).toBe(1);
  model.state({ ...sync.pickups![0], value: 99 }, 0, sync.revision); expect(model.records.get(1)?.pickup.value).toBe(3);
  model.state({ ...sync.pickups![0], id: 2 }, 10, sync.revision + 1);
  model.snapshot(decodeSnapshot(sim.encodeFor(0)[0])!); expect(model.records.has(2)).toBe(true);
  sim.pickups.live.length = 0; sim.tick = 11;
  model.snapshot(decodeSnapshot(sim.encodeFor(0)[0])!); expect(model.records.size).toBe(0);
  expect(model.sync({ ...sync, runId: 'f'.repeat(32) })).toBe(false);
});
