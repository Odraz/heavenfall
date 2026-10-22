import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ARCS_MAX, ARC_MS, RANGED_ARC_MS, addHurt, arcAngle, hurtShake, pruneArcs, type Arc } from './hitArcs';
import { HURT_MELEE, HURT_RANGED, HURT_WORLD } from '../net/protocol';

describe('felt hits (R06 follow-up §9)', () => {
  it('points the arc at the source as the camera sees it: ahead up, right right, behind down', () => {
    // A camera at the origin looking along −z, as three.js cameras do by default.
    const cam = new THREE.PerspectiveCamera(); cam.updateMatrixWorld();
    const at = (x: number, z: number) => { const v = new THREE.Vector3(x, 0, z).applyMatrix4(cam.matrixWorldInverse); return arcAngle(v.x, v.z); };
    expect(at(0, -10)).toBeCloseTo(0);
    expect(at(10, 0)).toBeCloseTo(Math.PI / 2);
    expect(at(-10, 0)).toBeCloseTo(-Math.PI / 2);
    expect(Math.abs(at(0, 10))).toBeCloseTo(Math.PI);
    // Turning the camera to face the source brings its arc to the top.
    cam.rotation.y = -Math.PI / 2; cam.updateMatrixWorld();
    expect(at(10, 0)).toBeCloseTo(0);
  });

  it('keeps ranged arcs longer, skips world damage, caps the arcs and flinches by share of HP', () => {
    const arcs: Arc[] = [];
    expect(addHurt(arcs, [1, 2, 5, HURT_MELEE, 3, 4, 12, HURT_RANGED, 0, 0, 40, HURT_WORLD], 1000, 400)).toBe(40);
    expect(arcs.map((a) => a.ms)).toEqual([ARC_MS, RANGED_ARC_MS]);
    pruneArcs(arcs, 1000 + ARC_MS);
    expect(arcs.map((a) => [a.x, a.y])).toEqual([[3, 4]]);
    for (let i = 0; i < ARCS_MAX + 2; i++) addHurt(arcs, [i, 0, 5, HURT_MELEE], 2000 + i, 400);
    expect(arcs).toHaveLength(ARCS_MAX);
    expect(hurtShake(5, 400).amp).toBeLessThan(hurtShake(60, 400).amp);
    expect(hurtShake(400, 400).amp).toBeCloseTo(1.2);
  });
});
