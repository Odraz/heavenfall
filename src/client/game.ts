/** The in-game client: input, local movement, camera and rendering. */
import { CLASSES } from '../data/classes';
import { debugState } from '../debug';
import type { Params } from '../params';
import type { GameMap } from '../sim/map';
import { GameScene } from '../render/scene';
import { DebugOverlay } from '../ui/debugOverlay';
import { FpsCounter } from './fps';
import { Input, MOUSE_SENSITIVITY } from './input';
import { LocalPlayer, wasdDirection } from './localPlayer';

export class Game {
  private readonly scene: GameScene;
  private readonly input: Input;
  private readonly player: LocalPlayer;
  private readonly overlay: DebugOverlay;
  private readonly fps = new FpsCounter();
  private lastFrame = 0;
  private raf = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly map: GameMap,
    params: Params,
  ) {
    const canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    root.appendChild(canvas);
    this.scene = new GameScene(canvas, map);
    this.input = new Input(canvas);
    const crosshair = document.createElement('div');
    crosshair.className = 'crosshair';
    root.appendChild(crosshair);
    this.overlay = new DebugOverlay(root);
    this.input.onKey = (code) => {
      if (code === 'F3') this.overlay.toggle();
    };
    const cls = CLASSES[params.classId];
    const [sc, sr] = map.spawns[0];
    this.player = new LocalPlayer(sc + 0.5, sr + 0.5, map.floor[sr * map.w + sc], cls.speed);
    debugState.players = [{ id: 0, classId: cls.id, hp: cls.hp, dead: false, kills: 0 }];
  }

  start(): void {
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.max(0, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    const { dx, dy } = this.input.takeMouse();
    this.player.look(dx * MOUSE_SENSITIVITY, -dy * MOUSE_SENSITIVITY);
    const axes = this.input.moveAxes();
    const [mx, my] = wasdDirection(this.player.yaw, axes.forward, axes.right);
    const wantJump = this.input.jumpQueued || this.input.isDown('Space');
    this.input.jumpQueued = false;
    this.player.update(this.map, dt, mx, my, wantJump);

    const b = this.player.body;
    this.scene.setView(b.x, b.y, b.z, this.player.yaw, this.player.pitch);
    this.scene.render();

    this.overlay.position.x = b.x;
    this.overlay.position.y = b.y;
    this.overlay.position.z = b.z;
    this.overlay.position.yaw = this.player.yaw;
    debugState.fps = this.fps.frame(now);
    this.overlay.update(now);
  };

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.input.dispose();
    this.overlay.dispose();
    this.scene.dispose();
    this.root.replaceChildren();
  }
}
