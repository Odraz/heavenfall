import { SFX } from '../src/audio/sfx';
import { renderSound } from '../src/audio/synth';
import { shootProp } from './prop-fixtures';
import { test, expect, state } from './fixtures';

interface Probe {
  decoded: number; failed: number;
  plays: Array<{ recorded: boolean; length: number; rate: number }>;
}
declare global { interface Window { __audioProbe: Probe; } }

for (const corruptProps of [false, true]) test(`production recorded audio ${corruptProps ? 'keeps the prop synth after decode failures' : 'loads all 51 takes and obeys the synth toggle'}`, async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  // Observe native decoding/playback; no game/audio methods or buffers are replaced.
  await page.addInitScript(() => {
    const probe: Probe = window.__audioProbe = { decoded: 0, failed: 0, plays: [] };
    const recorded = new WeakSet<AudioBuffer>();
    const decode = AudioContext.prototype.decodeAudioData;
    AudioContext.prototype.decodeAudioData = function (data: ArrayBuffer) {
      const signature = new Uint8Array(data).slice(0, 4);
      const wav = signature[0] === 82 && signature[1] === 73 && signature[2] === 70 && signature[3] === 70;
      const bad = signature[0] === 66 && signature[1] === 82;
      return decode.call(this, data).then((buffer) => {
        if (wav) { probe.decoded++; recorded.add(buffer); }
        return buffer;
      }, (error: unknown) => { if (bad) probe.failed++; throw error; });
    };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof start>) {
      if (this.buffer) probe.plays.push({ recorded: recorded.has(this.buffer), length: this.buffer.length, rate: this.buffer.sampleRate });
      return Reflect.apply(start, this, args);
    };
  });
  if (corruptProps) await page.route(/\/porcelainBreak-0[123]-[^/]+\.wav$/, (route) => route.fulfill({ status: 200, contentType: 'audio/wav', body: 'BROKEN-RECORDING' }));
  await page.goto('/?dev=1&map=rogue&seed=317434499&room=0&class=betrayer&god=1');
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0);
  await expect.poll(() => page.evaluate(() => window.__audioProbe.decoded)).toBe(corruptProps ? 48 : 51);
  expect(await page.evaluate(() => window.__audioProbe.failed)).toBe(corruptProps ? 3 : 0);
  const s = await state(page);
  const prop = s.props.filter((p) => p.room === 0 && p.family === 'loot').sort((a, b) => Math.hypot(a.x - s.self.x, a.y - s.self.y) - Math.hypot(b.x - s.self.x, b.y - s.self.y))[0];
  const before = await page.evaluate(() => window.__audioProbe.plays.length);
  await shootProp(page, prop.id);
  const plays = (await page.evaluate(() => window.__audioProbe.plays)).slice(before);
  expect(plays.some((p) => p.recorded)).toBe(true); // The real primary uses a decoded Revolver take.
  if (corruptProps) expect(plays.some((p) => !p.recorded && p.length === renderSound(SFX.porcelainBreak, p.rate).length)).toBe(true);
  else {
    await page.keyboard.press('F8');
    const disabledAt = await page.evaluate(() => window.__audioProbe.plays.length);
    await page.mouse.down();
    try {
      await expect.poll(async () => (await page.evaluate(() => window.__audioProbe.plays)).slice(disabledAt).some((p) => !p.recorded && p.length === renderSound(SFX.revolver, p.rate).length)).toBe(true);
    } finally { await page.mouse.up(); }
    expect(await page.evaluate(() => localStorage.getItem('heavenfall.recordedSfx'))).toBe('0');
    await page.keyboard.press('F8');
    expect(await page.evaluate(() => localStorage.getItem('heavenfall.recordedSfx'))).toBe('1');
  }
});
