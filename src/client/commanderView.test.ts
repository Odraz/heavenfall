import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CommanderView } from './commanderView';
import type { CommanderCast } from '../data/commanders';
import { loadMap } from '../sim/map';
import { dungeonOf } from '../sim/testutil/maps';
import { room } from '../sim/testutil/sims';

it('grows a thin warning, snaps wide only on the accepted damage phase, and hides on cancellation', () => {
  const texture = new THREE.Texture(), disposeTexture = vi.spyOn(texture, 'dispose');
  const view = new CommanderView(texture), map = loadMap(dungeonOf(room(48, 32))), camera = new THREE.Vector3(10, 5, 15);
  const c: CommanderCast = { kind: 'beam', slot: 0, incarnation: 1, castId: 1, room: 0, phase: 'tell', targetId: 0,
    startTick: 100, phaseTick: 100, endTick: 175, x: 5, y: 10, z: 0, yaw: 0, pitch: 0, targetX: 20, targetY: 10, targetZ: 0, dropX: 5, dropY: 10 };
  const ray = view.group.getObjectByName('cantor-beam') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  const ward = view.group.getObjectByName('cantor-frontal-ward') as THREE.Mesh;
  const core = view.group.getObjectByName('cantor-beam-core') as THREE.Mesh;
  const width = () => {
    const p = ray.geometry.getAttribute('position');
    return new THREE.Vector3().fromBufferAttribute(p, 0).distanceTo(new THREE.Vector3().fromBufferAttribute(p, 3));
  };
  const objects = [...view.group.children];
  view.update([c], map, 100, camera); expect(width()).toBeCloseTo(0.04); expect(core.visible).toBe(false); expect(ward.visible).toBe(true);
  // The shield arc is centred on the same facing as the damaging beam.
  const centre = new THREE.Vector3(Math.sin(Math.PI / 3), 0, Math.cos(Math.PI / 3)).applyEuler(ward.rotation);
  expect(centre.x).toBeCloseTo(Math.cos(c.yaw)); expect(centre.z).toBeCloseTo(Math.sin(c.yaw));
  view.update([c], map, 137.5, camera); expect(width()).toBeCloseTo(0.1);
  view.update([c], map, 180, camera); expect(width()).toBeCloseTo(0.16); expect(core.visible).toBe(false);
  c.phase = 'active'; c.phaseTick = 175; c.endTick = 265;
  view.update([c], map, 180, camera); expect(width()).toBeCloseTo(1); expect(core.visible).toBe(true);
  expect(ray.material.map).toBe(texture); expect(ray.material.color.getHex()).toBe(0xffc547);
  c.phase = 'recover'; view.update([c], map, 181, camera);
  expect(view.group.children.every((o) => !o.visible)).toBe(true); expect(view.group.children).toEqual(objects);
  view.dispose(); expect(disposeTexture).not.toHaveBeenCalled();
});
