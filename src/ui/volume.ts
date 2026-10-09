/**
 * The Master, Music and SFX sliders on Title and the Pause overlay, in a Settings view (M8 §9.3), with
 * the Screen shake toggle (M12 §4.5).
 */
import { audio, sfx } from '../audio/audio';
import { loadVolume, saveVolume, VOLUME_KEYS, VOLUME_LABELS, volumeText, type VolumeKey } from '../audio/volume';
import { loadShakeSetting, saveShakeSetting } from '../client/shake';

function setVolume(k: VolumeKey, v: number): void {
  const a = audio();
  if (a) a.setVolume(k, v);
  else saveVolume(k, v);
}

/** Three sliders, 0–100%: each takes effect while dragging; releasing SFX plays a click at the new level. */
export function volumeSliders(parent: HTMLElement): HTMLDivElement {
  const box = document.createElement('div');
  box.className = 'volume-sliders';
  for (const k of VOLUME_KEYS) {
    const row = document.createElement('label');
    row.className = 'volume-row';
    const name = document.createElement('span');
    name.className = 'volume-label';
    name.textContent = VOLUME_LABELS[k];
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.step = '1';
    input.name = `volume-${k}`;
    input.setAttribute('aria-label', VOLUME_LABELS[k]);
    const value = document.createElement('span');
    value.className = 'volume-value';
    const v0 = audio()?.volume(k) ?? loadVolume(k);
    input.value = String(Math.round(v0 * 100));
    value.textContent = volumeText(v0);
    input.addEventListener('input', () => {
      const v = Number(input.value) / 100;
      value.textContent = volumeText(v);
      setVolume(k, v);
    });
    if (k === 'sfx') input.addEventListener('change', () => sfx('buttonClick'));
    row.append(name, input, value);
    box.appendChild(row);
  }
  parent.appendChild(box);
  return box;
}

/** The Screen shake toggle (M12 §4.5): on by default, saved at once; each shake reads it when it starts. */
export function shakeToggle(parent: HTMLElement): HTMLLabelElement {
  const row = document.createElement('label');
  row.className = 'volume-row toggle-row';
  const name = document.createElement('span');
  name.className = 'volume-label';
  name.textContent = 'Screen shake';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.name = 'screen-shake';
  input.checked = loadShakeSetting();
  const value = document.createElement('span');
  value.className = 'volume-value';
  value.textContent = input.checked ? 'On' : 'Off';
  input.addEventListener('change', () => {
    saveShakeSetting(input.checked);
    value.textContent = input.checked ? 'On' : 'Off';
    sfx('buttonClick');
  });
  row.append(name, input, value);
  parent.appendChild(row);
  return row;
}

/**
 * A `Settings` button in `buttons` that turns `panel` into the Settings view: its title, the sliders
 * and `Back`. The panel keeps its size meanwhile, so the window doesn't move. The returned function
 * goes back to the panel's own contents.
 */
export function settingsButton(panel: HTMLElement, buttons: HTMLElement): () => void {
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'button';
  open.textContent = 'Settings';
  buttons.appendChild(open);

  const view = document.createElement('div');
  view.className = 'settings-view';
  view.hidden = true;
  const title = document.createElement('h2');
  title.className = 'settings-title';
  title.textContent = 'Settings';
  view.appendChild(title);
  shakeToggle(volumeSliders(view));
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'button secondary';
  back.textContent = 'Back';
  view.appendChild(back);
  panel.appendChild(view);

  // The panel's own contents that were showing when Settings opened.
  let hidden: HTMLElement[] = [];
  const close = (): void => {
    if (view.hidden) return;
    view.hidden = true;
    for (const e of hidden) e.hidden = false;
    hidden = [];
    panel.style.height = '';
  };
  open.addEventListener('click', () => {
    panel.style.height = `${panel.offsetHeight}px`;
    hidden = [...panel.children].filter((e): e is HTMLElement => e instanceof HTMLElement && e !== view && !e.hidden);
    for (const e of hidden) e.hidden = true;
    view.hidden = false;
  });
  back.addEventListener('click', close);
  return close;
}
