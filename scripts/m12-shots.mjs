// M12 stage 1 screenshots: the director's F3 readout in each phase, and a wave arriving from several
// sides with its spawn points glowing. Needs a running server (npm run dev or npm run preview).
// Usage: node scripts/m12-shots.mjs [readout|glow|glow-ground|wade] [base URL, default http://localhost:5173]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const [what = 'readout', base = 'http://localhost:5173'] = process.argv.slice(2);
const OUT = 'screenshots/m12';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[console.${m.type()}] ${m.text().slice(0, 400)}`);
});

const director = () => page.evaluate(() => window.__heavenfall.director);
const fmt = (d) => (d ? `${d.phase} ${d.phaseTime.toFixed(1)} s · ${Math.round(d.intensity)} · w${d.wave} ${d.alive}/${d.waveTotal}` : 'null');

async function open(query) {
  await page.goto(`${base}/?${query}`);
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame', null, { timeout: 60_000 });
  await page.keyboard.press('F3');
}

if (what === 'readout') {
  // The bot plays the Fallen in god mode: its kills close by still raise its intensity, so the
  // director peaks, and the run doesn't end in a defeat.
  await open('dev=1&map=pearly-gates&class=fallen&bot=1&god=1&seed=1&cam=26,21.5,24,0,-38');
  const shot = new Set();
  const t0 = Date.now();
  let last = '';
  while (shot.size < 3 && Date.now() - t0 < 420_000) {
    const d = await director();
    const line = fmt(d);
    if (d && d.phase !== last.split(' ')[0]) console.log(`${((Date.now() - t0) / 1000).toFixed(0)} s: ${line}`);
    last = d ? line : '';
    // Each phase once it has run a moment, so its time shows.
    if (d && !shot.has(d.phase) && d.phase !== 'done' && d.phaseTime >= 1.5 && (d.phase !== 'build' || d.wave >= 1)) {
      await page.screenshot({ path: `${OUT}/director-${d.phase}.png` });
      console.log(`saved director-${d.phase}.png (${line})`);
      shot.add(d.phase);
    }
    if ((await page.evaluate(() => window.__heavenfall.gameResult)) !== null) break;
    await page.waitForTimeout(250);
  }
  console.log(`phases shot: ${[...shot].join(', ')}`);
} else if (what === 'wade') {
  // Stage 2: the Binder bot (6 m/s) in god mode, caught by three or more Blessed (M12 §3.1).
  await open('dev=1&map=pearly-gates&class=binder&bot=1&god=1&seed=1');
  const t0 = Date.now();
  let max = 0;
  let shot = false;
  while (!shot && Date.now() - t0 < 300_000) {
    const w = await page.evaluate(() => window.__heavenfall.wade);
    max = Math.max(max, w.count);
    if (w.count >= 3 && w.factor < 0.6) {
      await page.screenshot({ path: `${OUT}/wading-caught.png` });
      console.log(`saved wading-caught.png (${w.count} pressing, ×${w.factor.toFixed(2)})`);
      shot = true;
    }
    await page.waitForTimeout(100);
  }
  if (!shot) console.log(`never caught by 3; most pressing at once: ${max}`);
} else {
  // A fixed camera high over the Courtyard's west entry, looking east over the arena, or at eye height
  // on the terrace's west stairs (glow-ground); the bot fights below.
  const ground = what === 'glow-ground';
  const cam = ground ? '30,21.5,,0,4' : '26,21.5,24,0,-38';
  await open(`dev=1&map=pearly-gates&class=fallen&bot=1&god=1&seed=1&cam=${cam}`);
  const t0 = Date.now();
  let n = 0;
  while (n < 4 && Date.now() - t0 < 300_000) {
    const d = await director();
    // Wave 2 and later, a few seconds into its arrival.
    if (d && d.phase === 'build' && d.wave >= 1 && d.phaseTime >= 2 + n * 1.5 && d.alive < d.waveTotal) {
      const name = `wave-arriving${ground ? '-ground' : ''}-${n}.png`;
      await page.screenshot({ path: `${OUT}/${name}` });
      console.log(`saved ${name} (${fmt(d)})`);
      n++;
    }
    await page.waitForTimeout(100);
  }
}
await browser.close();
