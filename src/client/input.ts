/** Keyboard and mouse input for the local player (§4). */

export const MOUSE_SENSITIVITY = 0.0022;

export class Input {
  private readonly keys = new Set<string>();
  fireHeld = false;
  /** Accumulated mouse movement since the last read, in pixels. */
  private mouseDx = 0;
  private mouseDy = 0;
  /** Running press counters (wrap at 256). */
  qPresses = 0;
  ePresses = 0;
  jumpQueued = false;
  enabled = true;
  /** Called for one-shot keys: F3 and the dev keys. */
  onKey: (code: string) => void = () => {};

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.keydown);
    window.addEventListener('keyup', this.keyup);
    window.addEventListener('blur', this.release);
    canvas.addEventListener('mousedown', this.mousedown);
    window.addEventListener('mouseup', this.mouseup);
    document.addEventListener('mousemove', this.mousemove);
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

  /** Releases held input (movement keys, fire). */
  readonly release = (): void => {
    this.keys.clear();
    this.fireHeld = false;
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
  }

  private readonly keydown = (e: KeyboardEvent): void => {
    if (e.code === 'F3') {
      e.preventDefault();
      if (!e.repeat) this.onKey(e.code);
      return;
    }
    if (!this.enabled) return;
    if (e.repeat) return;
    this.keys.add(e.code);
    if (e.code === 'Space') {
      this.jumpQueued = true;
      e.preventDefault();
    } else if (e.code === 'KeyQ') this.qPresses = (this.qPresses + 1) & 0xff;
    else if (e.code === 'KeyE') this.ePresses = (this.ePresses + 1) & 0xff;
    this.onKey(e.code);
  };

  private readonly keyup = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private readonly mousedown = (e: MouseEvent): void => {
    if (!this.enabled) return;
    if (!this.pointerLocked) {
      this.requestPointerLock();
      return;
    }
    if (e.button === 0) this.fireHeld = true;
  };

  private readonly mouseup = (e: MouseEvent): void => {
    if (e.button === 0) this.fireHeld = false;
  };

  private readonly mousemove = (e: MouseEvent): void => {
    if (!this.pointerLocked || !this.enabled) return;
    this.mouseDx += e.movementX;
    this.mouseDy += e.movementY;
  };
}
