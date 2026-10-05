// Dev helper: opens a URL in headless Chromium, runs simple input steps and saves a PNG.
// Usage: node scripts/screenshot.mjs <url> <out.png> [step ...]
// Steps: wait:<ms>  hold:<KeyCode>:<ms>  press:<KeyCode>  lock  look:<dx>:<dy>  shot:<out.png>
//        goto:<x>:<y>  face:<yaw>   (need the F3 overlay open: press:F3 first)  fire:<ms> (hold the mouse button)
//        burst:<prefix>:<n>  (hold the mouse button and save n PNGs <prefix>-<i>.png in quick succession)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [url, out, ...steps] = process.argv.slice(2);
if (!url || !out) {
  console.error('Usage: node scripts/screenshot.mjs <url> <out.png> [step ...]');
  process.exit(1);
}

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => {
  if (m.type() === 'error' || m.text().startsWith('BENCH')) console.log(`[console.${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(url);
await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame', null, { timeout: 30000 });

async function save(path) {
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path });
  console.log(`saved ${path}`);
}

const cursor = { x: 640, y: 360 };
const SENS = 0.0022;

async function readPos() {
  let m = null;
  for (let i = 0; i < 30 && !m; i++) {
    const text = await page.evaluate(() => document.querySelector('.debug-overlay')?.textContent ?? '');
    m = /pos (\S+) (\S+) (\S+) yaw (\S+)/.exec(text);
    if (!m) await page.waitForTimeout(100);
  }
  if (!m) throw new Error('Open the F3 overlay first');
  return { x: +m[1], y: +m[2], z: +m[3], yaw: +m[4] };
}

async function turnTo(yaw) {
  const p = await readPos();
  let d = yaw - p.yaw;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  cursor.x += Math.round(d / SENS);
  await page.mouse.move(cursor.x, cursor.y, { steps: 4 });
  await page.waitForTimeout(150);
}

async function goTo(x, y) {
  for (let i = 0; i < 200; i++) {
    const p = await readPos();
    const dist = Math.hypot(x - p.x, y - p.y);
    if (dist < 0.3) return;
    await turnTo(Math.atan2(y - p.y, x - p.x));
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(Math.min(400, dist * 80));
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(120);
  }
  console.log('goto did not arrive', JSON.stringify(await readPos()));
}
for (const step of steps) {
  const [kind, a, b] = step.split(':');
  if (kind === 'wait') await page.waitForTimeout(Number(a));
  else if (kind === 'hold') {
    await page.keyboard.down(a);
    await page.waitForTimeout(Number(b));
    await page.keyboard.up(a);
  } else if (kind === 'press') await page.keyboard.press(a);
  else if (kind === 'lock') {
    await page.mouse.click(640, 360);
    await page.waitForTimeout(200);
  } else if (kind === 'look') {
    cursor.x += Number(a);
    cursor.y += Number(b);
    await page.mouse.move(cursor.x, cursor.y, { steps: 10 });
  } else if (kind === 'fire') {
    await page.mouse.down();
    await page.waitForTimeout(Number(a));
    await page.mouse.up();
  } else if (kind === 'burst') {
    await page.mouse.down();
    for (let i = 0; i < Number(b); i++) await save(`${a}-${i}.png`);
    await page.mouse.up();
  } else if (kind === 'goto') await goTo(Number(a), Number(b));
  else if (kind === 'face') await turnTo(Number(a));
  else if (kind === 'shot') await save(a);
  else throw new Error(`Unknown step ${step}`);
}
await save(out);
console.log(JSON.stringify(await page.evaluate(() => ({ ...window.__heavenfall, enemyCountsByTick: Object.keys(window.__heavenfall.enemyCountsByTick).length }))));
await browser.close();
