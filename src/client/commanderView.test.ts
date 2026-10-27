import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CommanderView, chevronPoints } from './commanderView';
import { CARRIER_GRAB_RADIUS, CARRIER_TELL, type CommanderCast } from '../data/commanders';
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
  // The warning stays a thin ray: no glow or flares before the accepted damage phase.
  expect(view.group.getObjectByName('cantor-beam-glow')!.visible).toBe(false);
  expect(view.group.getObjectByName('cantor-beam-origin')!.visible).toBe(false);
  // The shield arc is centred on the same facing as the damaging beam.
  const centre = new THREE.Vector3(Math.sin(Math.PI / 3), 0, Math.cos(Math.PI / 3)).applyEuler(ward.rotation);
  expect(centre.x).toBeCloseTo(Math.cos(c.yaw)); expect(centre.z).toBeCloseTo(Math.sin(c.yaw));
  view.update([c], map, 137.5, camera); expect(width()).toBeCloseTo(0.1);
  view.update([c], map, 180, camera); expect(width()).toBeCloseTo(0.16); expect(core.visible).toBe(false);
  c.phase = 'active'; c.phaseTick = 175; c.endTick = 265;
  const glow = view.group.getObjectByName('cantor-beam-glow')!, origin = view.group.getObjectByName('cantor-beam-origin')!;
  const impact = view.group.getObjectByName('cantor-beam-impact')!, knot = view.group.getObjectByName('cantor-beam-knot')!;
  view.update([c], map, 175, camera);
  expect([glow, origin, impact, knot].every((o) => o.visible)).toBe(true);
  // The knot starts each pulse at the book and runs toward the beam's end.
  const start = knot.position.x;
  view.update([c], map, 180, camera); expect(width()).toBeCloseTo(1); expect(core.visible).toBe(true);
  expect(knot.position.x).toBeGreaterThan(start); expect(impact.position.x).toBeGreaterThan(origin.position.x);
  expect(ray.material.map).toBe(texture); expect(ray.material.color.getHex()).toBe(0xffc547);
  c.phase = 'recover'; view.update([c], map, 181, camera);
  expect(view.group.children.every((o) => !o.visible)).toBe(true); expect(view.group.children).toEqual(objects);
  view.dispose(); expect(disposeTexture).not.toHaveBeenCalled();
});

it('marks a Carrier tell with gold chevrons the width of its grab, marching to and past the target, then flashes the lock (R06 follow-up §6)', () => {
  const view = new CommanderView(new THREE.Texture()), map = loadMap(dungeonOf(room(48, 32))), camera = new THREE.Vector3(10, 5, 15);
  const c: CommanderCast = { kind: 'carry', slot: 0, incarnation: 1, castId: 1, room: 0, phase: 'tell', targetId: 0,
    startTick: 100, phaseTick: 100, endTick: 100 + CARRIER_TELL, x: 5, y: 10, z: 6, yaw: 0, pitch: 0, targetX: 15, targetY: 10, targetZ: 0, dropX: 5, dropY: 10 };
  const marks = () => view.group.children.filter((o) => o.name === 'carrier-chevron' && o.visible) as Array<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>;
  view.update([c], map, 100, camera);
  const shown = marks();
  expect(shown.length).toBeGreaterThan(8);
  // Along the facing, on the floor, reaching the target and the fly-through beyond it.
  expect(shown.every((m) => Math.abs(m.position.z - 10) < 1e-6 && m.position.y > 0)).toBe(true);
  expect(Math.max(...shown.map((m) => m.position.x))).toBeGreaterThan(c.targetX + 8);
  const box = new THREE.Box3().setFromBufferAttribute(shown[0].geometry.getAttribute('position') as THREE.BufferAttribute);
  expect(box.max.z - box.min.z).toBeCloseTo(2 * CARRIER_GRAB_RADIUS);
  const early = shown[0].material.opacity;
  view.update([c], map, 115, camera); expect(marks()[0].material.opacity).toBeGreaterThan(early);
  c.phase = 'active'; c.phaseTick = 100 + CARRIER_TELL; c.endTick = c.phaseTick + 30;
  view.update([c], map, c.phaseTick + 1, camera); expect(marks()[0].material.color.getHex()).toBe(0xfff4d0);
  view.update([c], map, c.phaseTick + 12, camera); expect(marks()[0].material.color.getHex()).toBe(0xffc547);
  c.phase = 'recover'; view.update([c], map, c.phaseTick + 40, camera); expect(marks()).toHaveLength(0);
  expect(chevronPoints({ x: 0, y: 0, yaw: Math.PI / 2, targetX: 0, targetY: 10 }, 0)[0]).toEqual([expect.closeTo(0, 9), 1]);
});
