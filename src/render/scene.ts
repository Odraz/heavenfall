/** The three.js scene: camera, fog, sky and terrain (§4, §11.1). */
import * as THREE from 'three';
import { PLAYER_EYE } from '../sim/constants';
import type { GameMap } from '../sim/map';
import { buildTerrain, type Terrain } from './terrain';
import { Atmosphere } from './atmosphere';
import { FOG_FAR, FOG_NEAR, installFogCurve } from './fog';
import { FOG_COLOR, makeSky, setSkyLod } from './sky';
import type { TerrainTextures } from './textures';
import type { RenderStats } from '../client/bench';

export { FOG_COLOR };

/** The far plane (M10 §4.2): far enough that no cloud card is cut off. */
const FAR = 400;

export class GameScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(75, 1, 0.05, FAR);
  readonly terrain: Terrain;
  private readonly sky: THREE.Mesh;
  /** Light shafts, clouds and spires (M10 §7). */
  private readonly atmosphere: Atmosphere;
  private readonly lookTarget = new THREE.Vector3();

  constructor(
    readonly canvas: HTMLCanvasElement,
    map: GameMap,
    textures: TerrainTextures,
    glow: THREE.Texture,
  ) {
    installFogCurve();
    this.sky = makeSky(textures.sky, false);
    // alpha: the contact shadows keep their darkest value in the framebuffer's alpha (M10 §5.4); the
    // background clears it to 1 and every opaque surface writes 1.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.scene.background = new THREE.Color(FOG_COLOR);
    this.scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);
    this.scene.add(this.sky);
    this.terrain = buildTerrain(map, textures);
    this.scene.add(this.terrain.mesh);
    this.scene.add(this.terrain.painted, this.terrain.paintedAlpha);
    if (this.terrain.gate) this.scene.add(this.terrain.gate.mesh);
    this.atmosphere = new Atmosphere(map, this.terrain.arches, textures.shaft, textures.atmosphere, textures.sky, glow);
    this.scene.add(this.atmosphere.cards, this.atmosphere.shafts);
    if (this.atmosphere.radiance) this.scene.add(this.atmosphere.radiance);
    for (const d of this.terrain.doors) for (const m of [d.entry, d.exit]) if (m) this.scene.add(m);
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  readonly resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    setSkyLod(this.sky, this.renderer.getDrawingBufferSize(new THREE.Vector2()).y, this.camera.fov);
  };

  /** Shows or hides an arena's closed entry and exit door columns. */
  setDoorsClosed(arenaIndex: number, entry: boolean, exit: boolean): void {
    const d = this.terrain.doors[arenaIndex];
    if (d.entry) d.entry.visible = entry;
    if (d.exit) d.exit.visible = exit;
  }

  /** Places the camera at a player's eye (simulation coordinates of the feet) with yaw and pitch. */
  setView(x: number, y: number, feetZ: number, yaw: number, pitch: number, eyeHeight = PLAYER_EYE): void {
    const ez = feetZ + eyeHeight;
    // three.x = x, three.y = z, three.z = y
    this.camera.position.set(x, ez, y);
    const cp = Math.cos(pitch);
    this.lookTarget.set(x + cp * Math.cos(yaw), ez + Math.sin(pitch), y + cp * Math.sin(yaw));
    this.camera.lookAt(this.lookTarget);
    this.camera.updateMatrixWorld();
    this.sky.position.copy(this.camera.position);
  }

  render(): void {
    this.atmosphere.update(performance.now());
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Compiles every material's shaders (in parallel where the browser can) and uploads every texture
   * in the scene, one per task, so the first frames of the game don't block the page for seconds.
   */
  async warmUp(): Promise<void> {
    await this.renderer.compileAsync(this.scene, this.camera);
    for (const t of this.sceneTextures()) {
      this.renderer.initTexture(t);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  /** Renderer statistics of the last frame and the estimated GPU memory of the scene's textures (M10 §2.1). */
  renderStats(): RenderStats {
    const info = this.renderer.info;
    let bytes = 0;
    for (const t of this.sceneTextures()) {
      const img = t.image as { width?: number; height?: number; depth?: number } | undefined;
      const w = img?.width ?? 0;
      const h = img?.height ?? 0;
      const layers = (t as THREE.DataArrayTexture).isDataArrayTexture ? (img?.depth ?? 1) : 1;
      // RGBA8, plus a third for the mipmaps.
      bytes += w * h * layers * 4 * (t.generateMipmaps || t.mipmaps.length > 1 ? 4 / 3 : 1);
    }
    return {
      calls: info.render.calls,
      triangles: info.render.triangles,
      textures: info.memory.textures,
      textureMB: Math.round(bytes / 1e5) / 10,
    };
  }

  /** Every texture used by a material in the scene. */
  private sceneTextures(): Set<THREE.Texture> {
    const textures = new Set<THREE.Texture>();
    const collect = (v: unknown): void => {
      if (v instanceof THREE.Texture) textures.add(v);
    };
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
        for (const v of Object.values(mat)) collect(v);
        const uniforms = (mat as THREE.ShaderMaterial).uniforms;
        if (uniforms) for (const u of Object.values(uniforms)) collect(u.value);
      }
    });
    return textures;
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
    // Release the WebGL context now: a page that plays several games would otherwise pile them up.
    this.renderer.forceContextLoss();
  }
}
