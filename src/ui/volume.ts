/** The Master, Music and SFX sliders on Title and the Pause overlay (M8 §9.3). */
import { audio, sfx } from '../audio/audio';
import { loadVolume, saveVolume, VOLUME_KEYS, VOLUME_LABELS, volumeText, type VolumeKey } from '../audio/volume';

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
