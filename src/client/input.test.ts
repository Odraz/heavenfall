import { afterEach, expect, it, vi } from 'vitest';
import { Input } from './input';
afterEach(() => vi.unstubAllGlobals());

it('M keeps movement, releases both attacks, and suppresses new mouse presses; chat, Pause and focus loss hide it', () => {
  const win = new EventTarget(), canvas = new EventTarget(), doc = new EventTarget();
  vi.stubGlobal('window', win); vi.stubGlobal('document', Object.assign(doc, { pointerLockElement: canvas }));
  const input = new Input(canvas as HTMLCanvasElement);
  const key = (type: string, code: string) => win.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { code, repeat: false }));
  const mouse = (button: number) => canvas.dispatchEvent(Object.assign(new Event('mousedown', { cancelable: true }), { button }));
  try {
    key('keydown', 'KeyW'); mouse(0); expect(input.fireBits()).toBe(1);
    key('keydown', 'KeyM'); expect(input.mapHeld).toBe(true); expect(input.fireBits()).toBe(0);
    mouse(0); mouse(2); expect(input.fireBits()).toBe(0); expect(input.moveAxes().forward).toBe(1);
    doc.dispatchEvent(Object.assign(new Event('mousemove'), { movementX: 8, movementY: 5 }));
    expect(input.takeMouse()).toEqual({ dx: 8, dy: 5 });
    input.typing = true; expect(input.mapHeld).toBe(false); input.typing = false;
    input.enabled = false; expect(input.mapHeld).toBe(false); input.enabled = true;
    key('keyup', 'KeyM'); expect(input.mapHeld).toBe(false); expect(input.fireBits()).toBe(0);
    key('keydown', 'KeyM'); win.dispatchEvent(new Event('blur')); expect(input.mapHeld).toBe(false);
  } finally { input.dispose(); }
});
