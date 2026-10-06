/** Keyboard and mouse input for the local player (§4). */
import { FIRE_LEFT, FIRE_RIGHT, FIRE_RIGHT_LAST } from '../data/weapons';

export const MOUSE_SENSITIVITY = 0.0022;

export class Input {
  private readonly keys = new Set<string>();
  /** The mouse buttons held: left for the primary, right for the secondary (M9 §2.1). */
  leftHeld = false;
  rightHeld = false;
  /** The right button was pressed after the left. */
  private rightLast = false;
  /** Accumulated mouse movement since the last read, in pixels. */
  private mouseDx = 0;
  private mouseDy = 0;
  jumpQueued = false;
  enabled = true;
  /** The bot and the benchmark never request pointer lock. */
  pointerLockAllowed = true;
  /**
   * The chat line is open (M8 §7): keys type into it, so none count as game keys except Esc, which
   * still opens Pause; fire is ignored. Mouse look goes on.
   */
  typing = false;
  /** Called on every key press (not repeats): F3, Q, E and the dev keys. */
  onKey: (code: string) => void = () => {};

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.keydown);
    window.addEventListener('keyup', this.keyup);
    window.addEventListener('blur', this.release);
    canvas.addEventListener('mousedown', this.mousedown);
    window.addEventListener('mouseup', this.mouseup);
    document.addEventListener('mousemove', this.mousemove);
    canvas.addEventListener('contextmenu', this.contextmenu);
  }

  /** The held buttons as the input's `fire` bits (M9 §10). */
  fireBits(): number {
    return (this.leftHeld ? FIRE_LEFT : 0) | (this.rightHeld ? FIRE_RIGHT : 0) | (this.rightLast ? FIRE_RIGHT_LAST : 0);
  }

  get pointerLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  /** Requests pointer lock; a refusal is ignored. */
  requestPointerLock(): void {
    try {
      const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      // The game continues without pointer lock.
    }
  }

  /** Releases held input (movement keys, both mouse buttons). */
  readonly release = (): void => {
    this.keys.clear();
    this.leftHeld = false;
    this.rightHeld = false;
    this.rightLast = false;
    this.jumpQueued = false;
  };

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** Movement axes relative to the view: forward (+1 = W) and right (+1 = D). */
  moveAxes(): { forward: number; right: number } {
    return {
      forward: (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0),
      right: (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0),
    };
  }

  takeMouse(): { dx: number; dy: number } {
    const r = { dx: this.mouseDx, dy: this.mouseDy };
    this.mouseDx = 0;
    this.mouseDy = 0;
    return r;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.keydown);
    window.removeEventListener('keyup', this.keyup);
    window.removeEventListener('blur', this.release);
    this.canvas.removeEventListener('mousedown', this.mousedown);
    window.removeEventListener('mouseup', this.mouseup);
    document.removeEventListener('mousemove', this.mousemove);
    this.canvas.removeEventListener('contextmenu', this.contextmenu);
  }

  private readonly keydown = (e: KeyboardEvent): void => {
    if (e.code === 'F3') {
      e.preventDefault();
      if (!e.repeat) this.onKey(e.code);
      return;
    }
    if (this.typing) {
      if (e.code === 'Escape' && this.enabled) this.onKey(e.code);
      return;
    }
    if (!this.enabled) return;
    if (e.repeat) return;
    this.keys.add(e.code);
    if (e.code === 'Space') {
      this.jumpQueued = true;
      e.preventDefault();
    }
    this.onKey(e.code);
  };

  private readonly keyup = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private readonly mousedown = (e: MouseEvent): void => {
    if (this.typing) {
      // Keeps the focus in the chat line.
      e.preventDefault();
      return;
    }
    if (!this.enabled || !this.pointerLockAllowed) return;
    if (!this.pointerLocked) {
      this.requestPointerLock();
      return;
    }
    if (e.button === 0) {
      this.leftHeld = true;
      this.rightLast = false;
    } else if (e.button === 2) {
      this.rightHeld = true;
      this.rightLast = true;
    }
  };

  private readonly mouseup = (e: MouseEvent): void => {
    if (e.button === 0) this.leftHeld = false;
    else if (e.button === 2) this.rightHeld = false;
  };

  /** The right button fires the secondary, so the canvas never opens the browser's menu (M9 §2.1). */
  private readonly contextmenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private readonly mousemove = (e: MouseEvent): void => {
    if (!this.pointerLocked || !this.enabled) return;
    this.mouseDx += e.movementX;
    this.mouseDy += e.movementY;
  };
}
