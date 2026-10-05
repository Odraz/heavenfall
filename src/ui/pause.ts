/** The Pause overlay (§3): `Resume` and `Leave game`, and the volume sliders (M8 §9.3). */
import { volumeSliders } from './volume';

export class PauseOverlay {
  readonly root: HTMLDivElement;

  constructor(parent: HTMLElement, onResume: () => void, onLeave: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'pause-overlay';
    this.root.hidden = true;
    const panel = document.createElement('div');
    panel.className = 'panel';
    const h = document.createElement('h2');
    h.textContent = 'Paused';
    const buttons = document.createElement('div');
    buttons.className = 'buttons buttons-column';
    for (const [label, fn] of [
      ['Resume', onResume],
      ['Leave game', onLeave],
    ] as const) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'button';
      b.textContent = label;
      b.addEventListener('click', fn);
      buttons.appendChild(b);
    }
    panel.append(h);
    volumeSliders(panel);
    panel.append(buttons);
    this.root.appendChild(panel);
    parent.appendChild(this.root);
  }

  set open(v: boolean) {
    this.root.hidden = !v;
  }

  dispose(): void {
    this.root.remove();
  }
}
