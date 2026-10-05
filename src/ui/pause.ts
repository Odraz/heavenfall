/** The Pause overlay (§3): `Resume`, `Settings` (the volume sliders, M8 §9.3) and `Leave game`. */
import { settingsButton } from './volume';

export class PauseOverlay {
  readonly root: HTMLDivElement;
  private readonly closeSettings: () => void;

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
    const add = (label: string, fn: () => void): void => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'button';
      b.textContent = label;
      b.addEventListener('click', fn);
      buttons.appendChild(b);
    };
    add('Resume', onResume);
    panel.append(h, buttons);
    this.closeSettings = settingsButton(panel, buttons);
    add('Leave game', onLeave);
    this.root.appendChild(panel);
    parent.appendChild(this.root);
  }

  set open(v: boolean) {
    this.root.hidden = !v;
    if (v) this.closeSettings();
  }

  dispose(): void {
    this.root.remove();
  }
}
