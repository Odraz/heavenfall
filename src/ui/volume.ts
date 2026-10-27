/**
 * The Master, Music and SFX sliders on Title and the Pause overlay, in a Settings view (M8 §9.3), with
 * the Screen shake toggle (M12 §4.5), the Damage numbers toggle (R06 follow-up §8) and the Recorded SFX toggle.
 */
import { audio, sfx } from '../audio/audio';
import { loadRecordedSetting, saveRecordedSetting } from '../audio/recorded';
import { loadVolume, saveVolume, VOLUME_KEYS, VOLUME_LABELS, volumeText, type VolumeKey } from '../audio/volume';
import { loadShakeSetting, saveShakeSetting } from '../client/shake';
import { loadDamageNumbersSetting, saveDamageNumbersSetting } from '../client/damageNumbers';

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

/** An On/Off setting row, saved at once. */
function onOffToggle(parent: HTMLElement, label: string, inputName: string, load: () => boolean, save: (on: boolean) => void): HTMLLabelElement {
  const row = document.createElement('label');
  row.className = 'volume-row toggle-row';
  const name = document.createElement('span');
  name.className = 'volume-label';
  name.textContent = label;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.name = inputName;
  input.checked = load();
  const value = document.createElement('span');
  value.className = 'volume-value';
  value.textContent = input.checked ? 'On' : 'Off';
  input.addEventListener('change', () => {
    save(input.checked);
    value.textContent = input.checked ? 'On' : 'Off';
    sfx('buttonClick');
  });
  row.append(name, input, value);
  parent.appendChild(row);
  return row;
}

/** The Screen shake toggle (M12 §4.5): on by default, saved at once; each shake reads it when it starts. */
export function shakeToggle(parent: HTMLElement): HTMLLabelElement {
  return onOffToggle(parent, 'Screen shake', 'screen-shake', loadShakeSetting, saveShakeSetting);
}

/** The Damage numbers toggle (R06 follow-up §8): on by default; off, new numbers stop appearing. */
export function damageNumbersToggle(parent: HTMLElement): HTMLLabelElement {
  return onOffToggle(parent, 'Damage numbers', 'damage-numbers', loadDamageNumbersSetting, saveDamageNumbersSetting);
}

/**
 * The Recorded SFX toggle: on, the recorded takes replace the synthesized cues; off, the old
 * synthesized cues play, to compare. Saved at once; F8 flips it in a game. The returned function
 * shows the current setting again (F8 may have flipped it since).
 */
export function recordedToggle(parent: HTMLElement): () => void {
  const row = document.createElement('label');
  row.className = 'volume-row toggle-row';
  const name = document.createElement('span');
  name.className = 'volume-label';
  name.textContent = 'Recorded SFX';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.name = 'recorded-sfx';
  input.checked = audio()?.recorded ?? loadRecordedSetting();
  const value = document.createElement('span');
  value.className = 'volume-value';
  value.textContent = input.checked ? 'On' : 'Off';
  input.addEventListener('change', () => {
    setRecorded(input.checked);
    value.textContent = input.checked ? 'On' : 'Off';
    sfx('buttonClick');
  });
  row.append(name, input, value);
  parent.appendChild(row);
  return () => {
    input.checked = audio()?.recorded ?? loadRecordedSetting();
    value.textContent = input.checked ? 'On' : 'Off';
  };
}

function setRecorded(on: boolean): void {
  const a = audio();
  if (a) a.setRecorded(on);
  else saveRecordedSetting(on);
}

/**
 * A `Settings` button in `buttons` that turns `panel` into the Settings view: its title, the sliders
 * and `Back`, at the panel's size (M8 §9.3): the panel never grows or moves when Settings opens. The
 * returned function goes back to the panel's own contents.
 */
export function settingsButton(panel: HTMLElement, buttons: HTMLElement, onProfile?: () => void): () => void {
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
  const sliders = volumeSliders(view);
  shakeToggle(sliders);
  damageNumbersToggle(sliders);
  const syncRecorded = recordedToggle(sliders);
  // One bottom row, so adding Profile doesn't make the view taller than the panel it replaces.
  const actions = document.createElement('div');
  actions.className = 'buttons settings-buttons';
  view.appendChild(actions);
  if (onProfile) {
    const profile = document.createElement('button');
    profile.type = 'button';
    profile.className = 'button';
    profile.textContent = 'Profile';
    profile.addEventListener('click', onProfile);
    actions.appendChild(profile);
  }
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'button secondary';
  back.textContent = 'Back';
  actions.appendChild(back);
  panel.appendChild(view);

  // The panel's own contents that were showing when Settings opened.
  let hidden: HTMLElement[] = [];
  const close = (): void => {
    if (view.hidden) return;
    view.hidden = true;
    for (const e of hidden) e.hidden = false;
    hidden = [];
    panel.style.minHeight = '';
    panel.classList.remove('settings-open');
  };
  open.addEventListener('click', () => {
    panel.style.minHeight = `${panel.offsetHeight}px`;
    panel.classList.add('settings-open');
    hidden = [...panel.children].filter((e): e is HTMLElement => e instanceof HTMLElement && e !== view && !e.hidden);
    for (const e of hidden) e.hidden = true;
    syncRecorded();
    view.hidden = false;
  });
  back.addEventListener('click', close);
  return close;
}
