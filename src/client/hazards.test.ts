import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HazardView } from './hazards';
import { refinerLab } from '../data/dungeons/refiner';
import { loadMap } from '../sim/map';
import { PHASE_COMBAT, PHASE_IDLE, type Snapshot } from '../net/protocol';
const state = (active = true) => ({ activeRoom: active ? 0 : 255, activePhase: active ? PHASE_COMBAT : PHASE_IDLE, clearedMask: active ? 0 : 1 } as Snapshot);
describe('accepted fire presentation', () => {
  it('pools fixed cells, uses accepted phase/ticks and dims at clear without replaying a late seal', () => {
    const view = new HazardView(loadMap(refinerLab)), camera = new THREE.PerspectiveCamera();
    expect(view.group.children).toHaveLength(3);
    const mesh = view.group.children[0] as THREE.InstancedMesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
    expect(mesh.count).toBe(112); expect(view.update(null, camera, 0, false)).toBe(0);
    view.seal(0, 20); expect(view.update(state(), camera, 25, false)).toBe(112);
    expect(mesh.material.uniforms.sealTick.value).toBe(20); expect(mesh.material.uniforms.tick.value).toBe(25);
    expect(view.update(state(false), camera, 26, false)).toBe(0); expect(mesh.material.uniforms.activeRoom.value).toBe(-1);
    const late = new HazardView(loadMap(refinerLab)); late.update(state(), camera, 100, false);
    const lateMesh = late.group.children[0] as THREE.InstancedMesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
    expect(lateMesh.material.uniforms.sealTick.value).toBe(-10_000);
    expect(late.update(state(), camera, 101, true)).toBe(0); view.dispose(); late.dispose();
  });
  it('selects a room-local nearest source at bounded cadence and clears it on room change', () => {
    const view = new HazardView(loadMap(refinerLab));
    expect(view.nearest(0, 1.5, 14.5, 100)).toEqual({ x: 1.5, y: 14.5 });
    expect(view.nearest(0, 30.5, 14.5, 200)).toEqual({ x: 1.5, y: 14.5 });
    expect(view.nearest(0, 30.5, 14.5, 400)).toEqual({ x: 30.5, y: 14.5 });
    expect(view.nearest(1, 1.5, 14.5, 401)).toBeNull(); view.dispose();
  });
});
