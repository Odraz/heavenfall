/** The three.js scene: camera, fog, sky and terrain (§4, §11.1). */
import * as THREE from 'three';
import { PLAYER_EYE } from '../sim/constants';
import type { GameMap } from '../sim/map';
import { buildTerrain, type Terrain } from './terrain';
import { brickTexture, stoneTexture } from './textures';

export const FOG_COLOR = 0xcfe2f3;
const FOG_NEAR = 40;
const FOG_FAR = 150;

function makeSky(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(180, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x8fc3ef) },
      horizon: { value: new THREE.Color(0xf2d58c) },
      bottom: { value: new THREE.Color(0xf6ead0) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 horizon;
      uniform vec3 bottom;
      varying vec3 vDir;
      void main() {
        float y = vDir.y;
        vec3 c = y > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.6, y), 0.7)) : mix(horizon, bottom, smoothstep(0.0, -0.3, y));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  return sky;
}

export class GameScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(75, 1, 0.05, 200);
  readonly terrain: Terrain;
  private readonly sky = makeSky();
  private readonly lookTarget = new THREE.Vector3();

  constructor(
    readonly canvas: HTMLCanvasElement,
    map: GameMap,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.scene.background = new THREE.Color(FOG_COLOR);
    this.scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);
    this.scene.add(this.sky);
    this.terrain = buildTerrain(map, stoneTexture(), brickTexture());
    this.scene.add(this.terrain.mesh);
    for (const d of this.terrain.doors) if (d) this.scene.add(d);
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  readonly resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  /** Shows or hides each arena's closed-door columns. */
  setDoorsClosed(arenaIndex: number, closed: boolean): void {
    const d = this.terrain.doors[arenaIndex];
    if (d) d.visible = closed;
  }

  /** Places the camera at a player's eye (simulation coordinates of the feet) with yaw and pitch. */
  setView(x: number, y: number, feetZ: number, yaw: number, pitch: number, eyeHeight = PLAYER_EYE): void {
    const ez = feetZ + eyeHeight;
    // three.x = x, three.y = z, three.z = y
    this.camera.position.set(x, ez, y);
    const cp = Math.cos(pitch);
    this.lookTarget.set(x + cp * Math.cos(yaw), ez + Math.sin(pitch), y + cp * Math.sin(yaw));
    this.camera.lookAt(this.lookTarget);
    this.sky.position.copy(this.camera.position);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** The WebGL renderer string, for the benchmark report. */
  rendererString(): string {
    const gl = this.renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
  }
}
