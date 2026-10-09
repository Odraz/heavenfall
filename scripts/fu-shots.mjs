// M12 follow-up screenshots (docs/m12-followup.md §6), in the sandbox: Choristers and Cherubs beside the
// Blessed at their new sizes (`sizes`), globes in flight and shattering (`globe`), and globes shot down
// by the Binder's Chain Gun aimed at a Chorister (`shotdown`). Saved as screenshots/m12/fu-*.png.
// Needs a running server (npm run dev or npm run preview).
// Usage: node scripts/fu-shots.mjs [sizes|globe|shotdown] [base URL, default http://localhost:5173]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const [what = 'sizes', base = 'http://localhost:5173'] = process.argv.slice(2);
const OUT = 'screenshots/m12';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));

const cls = what === 'shotdown' ? 'binder' : 'fallen';
// `sizes` looks from a fixed camera behind and above the player, east across the arena, so the crowd
// shows as it comes (a crowd at the player's feet hides everyone's size).
const cam = what === 'sizes' ? '&cam=19,7.5,3.2,0,-4' : '';
await page.goto(`${base}/?dev=1&map=sandbox&class=${cls}&god=1&seed=1${cam}`);
await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame', null, { timeout: 60_000 });
const canvas = (await page.locator('canvas').first().boundingBox()) ?? { x: 0, y: 0, width: 1280, height: 720 };
const cx = canvas.x + canvas.width / 2;
const cy = canvas.y + canvas.height / 2;
for (let i = 0; i < 5; i++) {
  await page.mouse.click(cx, cy);
  if (await page.evaluate(() => document.pointerLockElement !== null)) break;
  await page.waitForTimeout(500);
}
let mouseX = cx;
let mouseY = cy;
// Into the sandbox's arena, facing east across it, which seals it.
await page.evaluate(() => window.__heavenfallTeleport?.(22.5, 7.5));
await page.waitForFunction(() => window.__heavenfall.arenaPhase === 'combat', null, { timeout: 90_000 });

/** Turns the view to an absolute yaw and pitch (degrees, simulation angles), by mouse movement (0.0022 rad per px). */
async function lookAt(yawDeg, pitchDeg) {
  for (let i = 0; i < 3; i++) {
    const v = await page.evaluate(() => window.__heavenfall.self);
    const dyaw = ((yawDeg - (v.yaw * 180) / Math.PI + 540) % 360) - 180;
    const dpitch = pitchDeg - (v.pitch * 180) / Math.PI;
    if (Math.abs(dyaw) < 0.3 && Math.abs(dpitch) < 0.3) return;
    mouseX += ((dyaw * Math.PI) / 180) / 0.0022;
    mouseY -= ((dpitch * Math.PI) / 180) / 0.0022;
    await page.mouse.move(mouseX, mouseY, { steps: 4 });
    await page.waitForTimeout(80);
  }
}

/** Holds the game loop while the screenshot is taken. */
async function frozenShot(path) {
  await page.evaluate(() => {
    window.__origRaf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => {
      window.__pendingFrame = cb;
      return 0;
    };
  });
  await page.waitForTimeout(60);
  await page.screenshot({ path });
  await page.evaluate(() => {
    window.requestAnimationFrame = window.__origRaf;
    const cb = window.__pendingFrame;
    window.__pendingFrame = undefined;
    if (cb) window.requestAnimationFrame(cb);
  });
}

/** Dev key J: removes the Blessed, leaving the casters. */
const clearBlessed = () => page.keyboard.press('KeyJ');

if (what === 'sizes') {
  // The crowd comes across the arena; the Blessed are cleared now and then, so the Choristers and
  // Cherubs placed among them aren't buried. Candidate frames.
  for (let n = 0; n < 16; n++) {
    if (n % 4 === 0) await clearBlessed();
    await page.waitForTimeout(700);
    await frozenShot(`${OUT}/fu-sizes-cand-${n}.png`);
  }
  console.log('saved fu-sizes-cand-0..15.png');
} else {
  // The whole wave is placed in 10 s; then the Blessed are cleared every second, so only the casters remain.
  await page.waitForTimeout(10_500);
  // Globes: turned toward the nearest Chorister. For `shotdown`, the Chain Gun fires at it, so the
  // globes it sends are shot down on their way out; for `globe`, the Fallen only watches them come.
  const key = what === 'shotdown' ? 'shotDown' : 'shattered';
  if (what === 'shotdown') await page.mouse.down();
  let saved = 0;
  let flight = 0;
  const t0 = Date.now();
  let last = await page.evaluate((k) => window.__heavenfall.globes[k], key);
  let cleared = 0;
  while (saved < 6 && Date.now() - t0 < 180_000) {
    if (Date.now() - cleared > 1000) {
      await clearBlessed();
      cleared = Date.now();
    }
    const aim = await page.evaluate(() => window.__heavenfall.casterAim);
    if (aim) await lookAt((aim.yaw * 180) / Math.PI, (aim.pitch * 180) / Math.PI);
    const n = await page.evaluate((k) => window.__heavenfall.globes[k], key);
    if (n > last) {
      await frozenShot(`${OUT}/fu-${what}-cand-${saved}.png`);
      saved++;
      last = n;
    } else if (what === 'globe' && flight < 6 && (await page.evaluate(() => window.__heavenfall.projectiles)) > 0) {
      await frozenShot(`${OUT}/fu-globe-flight-cand-${flight}.png`);
      flight++;
    }
    await page.waitForTimeout(40);
  }
  if (what === 'shotdown') await page.mouse.up();
  const g = await page.evaluate(() => window.__heavenfall.globes);
  console.log(`saved ${saved} shatter frames, ${flight} flight frames; globes ${JSON.stringify(g)}`);
}
await browser.close();
