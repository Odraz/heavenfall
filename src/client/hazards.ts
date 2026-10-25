/** Painted channel floor with pooled animated fire, driven by accepted room state. */
import * as THREE from 'three';
import type { Snapshot } from '../net/protocol';
import { PHASE_COMBAT } from '../net/protocol';
import type { GameMap } from '../sim/map';

const vertex = `
 attribute float iRoom; attribute float iSeed;
 uniform vec3 cameraRight; uniform float upright;
 varying vec2 vUv; varying float vRoom; varying float vSeed; varying vec2 vWorld;
 void main() {
   vUv = uv; vRoom = iRoom; vSeed = iSeed;
   vec3 p = upright > 0.5 ? cameraRight * position.x + vec3(0.0, (position.y + 0.5) * 0.8, 0.0) : vec3(position.x, 0.0, position.y);
   vWorld = (instanceMatrix * vec4(p, 1.0)).xz;
   gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
 }`;
const fragment = `
 uniform float tick; uniform float activeRoom; uniform float sealTick; uniform float upright;
 uniform sampler2D channel; uniform sampler2D flames;
 varying vec2 vUv; varying float vRoom; varying float vSeed; varying vec2 vWorld;
 void main() {
   float isHot = abs(vRoom - activeRoom) < 0.1 ? 1.0 : 0.0;
   float elapsed = tick - sealTick;
   float flare = isHot * (elapsed >= 0.0 && elapsed < 30.0 ? 1.0 - elapsed / 30.0 : 0.0);
   float wave = sin(vUv.x * 22.0 + vSeed + tick * 0.19) * sin(vUv.y * 13.0 - tick * 0.25 + vSeed);
   float alpha; vec3 color;
   if (upright > 0.5) {
     if (isHot < 0.5) discard;
     float tongue = (1.0 - vUv.y) * (0.42 + 0.1 * wave);
     alpha = (1.0 - smoothstep(tongue, tongue + 0.06, abs(vUv.x - 0.5))) * (1.0 - vUv.y) * 0.65;
     // The painted flames (B10), a different stretch per cell drifting sideways, break up each tongue.
     float lick = texture2D(flames, vec2(fract(vUv.x * 0.35 + vSeed * 0.137 + tick * 0.004), vUv.y)).a;
     alpha *= 0.45 + 0.9 * lick;
     color = mix(vec3(1.0, 0.16, 0.015), vec3(1.0, 0.88, 0.24), vUv.y + flare * 0.4);
   } else {
     float edge = max(abs(vUv.x - 0.5), abs(vUv.y - 0.5));
     vec3 painted = texture2D(channel, vWorld / 4.0).rgb;
     color = painted * mix(0.38, 0.95 + wave * 0.08 + flare * 0.35, isHot);
     alpha = 1.0;
   }
   gl_FragColor = vec4(color, alpha);
   #include <colorspace_fragment>
 }`;

export class HazardView {
  readonly group = new THREE.Group();
  private readonly geometry = new THREE.PlaneGeometry(1, 1);
  private readonly rimGeometry = new THREE.PlaneGeometry(1, 0.08);
  private readonly rimMaterial = new THREE.MeshBasicMaterial({ color: 0xf1c858, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide });
  private readonly materials: THREE.ShaderMaterial[];
  private readonly cells = new Map<number, Array<{ x: number; y: number }>>();
  private readonly seals: Float64Array;
  private lastNearest = -Infinity;
  private nearestRoom = -1;
  private nearestAt: { x: number; y: number } | null = null;
  private readonly right = new THREE.Vector3();
  constructor(readonly map: GameMap, channel = new THREE.Texture(), flames = new THREE.Texture()) {
    this.seals = new Float64Array(map.rooms.length).fill(-10_000);
    const indices: number[] = [];
    for (let i = 0; i < map.hazard.length; i++) if (map.hazard[i] && map.roomOf[i] !== 255) {
      indices.push(i); const room = map.roomOf[i], list = this.cells.get(room) ?? [];
      list.push({ x: i % map.w + 0.5, y: Math.floor(i / map.w) + 0.5 }); this.cells.set(room, list);
    }
    this.geometry.setAttribute('iRoom', new THREE.InstancedBufferAttribute(Float32Array.from(indices, (i) => map.roomOf[i]), 1));
    this.geometry.setAttribute('iSeed', new THREE.InstancedBufferAttribute(Float32Array.from(indices, (i) => (i * 0.618034) % 100), 1));
    this.materials = [0, 1].map((upright) => new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment,
      uniforms: { channel: { value: channel }, flames: { value: flames }, tick: { value: 0 }, activeRoom: { value: -1 }, sealTick: { value: -10_000 }, upright: { value: upright }, cameraRight: { value: new THREE.Vector3(1, 0, 0) } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    const matrix = new THREE.Matrix4();
    for (const material of this.materials) {
      const mesh = new THREE.InstancedMesh(this.geometry, material, Math.max(1, indices.length));
      mesh.count = indices.length; mesh.visible = indices.length > 0; mesh.frustumCulled = false;
      indices.forEach((i, k) => { matrix.makeTranslation(i % map.w + 0.5, map.floor[i] + 0.025, Math.floor(i / map.w) + 0.5); mesh.setMatrixAt(k, matrix); });
      mesh.instanceMatrix.needsUpdate = true; this.group.add(mesh);
    }
    // A fixed narrow gold lip follows only the outside edges of a sunk channel, not its cell seams.
    const edges: Array<{ x: number; y: number; z: number; turn: boolean }> = [];
    for (const i of indices) {
      const c = i % map.w, r = Math.floor(i / map.w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = c + dx, y = r + dy, n = y * map.w + x;
        if (x < 0 || y < 0 || x >= map.w || y >= map.h || map.wall[n] || map.hazard[n]) continue;
        edges.push({ x: c + 0.5 + dx * 0.5, y: r + 0.5 + dy * 0.5, z: Math.max(map.floor[i], map.floor[n]) + 0.028, turn: dx !== 0 });
      }
    }
    const rim = new THREE.InstancedMesh(this.rimGeometry, this.rimMaterial, Math.max(1, edges.length)); rim.count = edges.length; rim.visible = edges.length > 0; rim.frustumCulled = false;
    edges.forEach((e, k) => { matrix.makeRotationFromEuler(new THREE.Euler(-Math.PI / 2, 0, e.turn ? Math.PI / 2 : 0)); matrix.setPosition(e.x, e.z, e.y); rim.setMatrixAt(k, matrix); });
    rim.instanceMatrix.needsUpdate = true; this.group.add(rim);
  }
  seal(room: number, tick: number): void { if (room >= 0 && room < this.seals.length && Number.isFinite(tick)) this.seals[room] = Math.max(this.seals[room], tick); }
  update(s: Snapshot | null, camera: THREE.Camera, tick: number, over: boolean): number {
    const room = s && !over && s.activePhase === PHASE_COMBAT ? s.activeRoom : -1;
    camera.updateMatrixWorld(); this.right.setFromMatrixColumn(camera.matrixWorld, 0); this.right.y = 0; this.right.normalize();
    for (const material of this.materials) {
      material.uniforms.tick.value = tick; material.uniforms.activeRoom.value = room;
      material.uniforms.sealTick.value = this.seals[room] ?? -10_000;
      material.uniforms.cameraRight.value.copy(this.right);
    }
    return this.cells.get(room)?.length ?? 0;
  }
  /** One room-local ambient source; bounded rescan at four Hz, rather than one voice per cell. */
  nearest(room: number, x: number, y: number, now: number): { x: number; y: number } | null {
    if (room !== this.nearestRoom || now - this.lastNearest >= 250) {
      this.nearestRoom = room; this.lastNearest = now; this.nearestAt = null; let best = Infinity;
      for (const c of this.cells.get(room) ?? []) { const d = (c.x - x) ** 2 + (c.y - y) ** 2; if (d < best) { best = d; this.nearestAt = c; } }
    }
    return this.nearestAt;
  }
  dispose(): void { this.group.removeFromParent(); for (const child of this.group.children) (child as THREE.InstancedMesh).dispose(); this.geometry.dispose(); this.rimGeometry.dispose(); this.rimMaterial.dispose(); for (const material of this.materials) material.dispose(); }
}
