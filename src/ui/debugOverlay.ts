/** The F3 debug overlay (§2.5). */
import { debugState } from '../debug';

export class DebugOverlay {
  private readonly el: HTMLDivElement;
  private visible = false;
  private lastUpdate = 0;

  /** `dev`: the director's line is shown (M12 §2.3). */
  constructor(
    parent: HTMLElement,
    private readonly dev = false,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'debug-overlay';
    this.el.hidden = true;
    parent.appendChild(this.el);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.hidden = !this.visible;
    this.lastUpdate = 0;
  }

  /** The local player's feet position and yaw, shown as an extra line. */
  position = { x: 0, y: 0, z: 0, yaw: 0 };

  update(now: number): void {
    if (!this.visible || now - this.lastUpdate < 100) return;
    this.lastUpdate = now;
    const d = debugState;
    const dir = d.director;
    this.el.textContent = [
      `FPS ${d.fps.toFixed(1)}`,
      `sim ${d.simMs.toFixed(2)} ms/tick`,
      `enemies ${d.enemies}`,
      `projectiles ${d.projectiles}`,
      `net in ${d.netInKBps.toFixed(1)} KB/s  out ${d.netOutKBps.toFixed(1)} KB/s`,
      `pos ${this.position.x.toFixed(2)} ${this.position.y.toFixed(2)} ${this.position.z.toFixed(2)} yaw ${this.position.yaw.toFixed(3)}`,
      ...(this.dev ? [`Wading: ${d.wade.count} · ×${d.wade.factor.toFixed(2)}`] : []),
      ...(this.dev && dir ? [`Director: ${dir.phase} ${dir.phaseTime.toFixed(1)} s · ${Math.round(dir.intensity)} · ${dir.alive}/${dir.waveTotal}`] : []),
    ].join('\n');
  }

  dispose(): void {
    this.el.remove();
  }
}
