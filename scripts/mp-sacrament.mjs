// Dev helper (M9): screenshots a Sacrament beam from the Heretic's view and from the healed
// teammate's. Two pages on the dev server join through the real menus (needs the public PeerJS
// server); A hosts as the Heretic Saint, B joins as the Fallen, and they face each other.
// Usage: node scripts/mp-sacrament.mjs [base URL] [out prefix]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173';
const prefix = process.argv[3] ?? 'screenshots/m9/sacrament';
mkdirSync(prefix.replace(/[^/]+$/, ''), { recursive: true });
const SENS = 0.0022;
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });

async function newPage(label) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  page.on('pageerror', (e) => console.log(`[${label} pageerror] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && console.log(`[${label} console.error] ${m.text()}`));
  page.cursor = { x: 480, y: 270 };
  return page;
}

const a = await newPage('A');
const b = await newPage('B');
await a.goto(base + '/');
await a.waitForFunction(() => window.__heavenfall?.screen === 'title');
await a.getByLabel('Player name').fill('Hera');
await a.getByRole('button', { name: 'Multiplayer' }).click();
await a.getByRole('button', { name: 'Host game' }).click();
await a.getByRole('button', { name: 'Create' }).click();
await a.waitForFunction(() => window.__heavenfall.screen === 'lobby', null, { timeout: 30000 });
const gameId = (await a.locator('.game-id').textContent()).trim();
await b.goto(`${base}/?join=${gameId}`);
await b.waitForFunction(() => window.__heavenfall?.screen === 'title');
await b.getByLabel('Player name').fill('Fal');
await b.getByRole('button', { name: `Join game ${gameId}` }).click();
await b.getByRole('button', { name: 'Join', exact: true }).click();
await b.waitForFunction(() => window.__heavenfall.screen === 'lobby', null, { timeout: 30000 });
await a.getByRole('button', { name: /The Heretic Saint/ }).click();
await b.getByRole('button', { name: /The Fallen/ }).click();
await a.getByRole('button', { name: 'Start' }).click();
for (const p of [a, b]) await p.waitForFunction(() => window.__heavenfall.screen === 'inGame', null, { timeout: 30000 });

async function pos(page) {
  for (let i = 0; i < 50; i++) {
    const t = await page.evaluate(() => document.querySelector('.debug-overlay')?.textContent ?? '');
    const m = /pos (\S+) (\S+) (\S+) yaw (\S+)/.exec(t);
    if (m) return { x: +m[1], y: +m[2], z: +m[3], yaw: +m[4] };
    await page.waitForTimeout(100);
  }
  throw new Error('no position');
}

/** Turns the page's player to face (x, y) and look at height z (relative to its feet). */
async function face(page, x, y, dz) {
  const p = await pos(page);
  let d = Math.atan2(y - p.y, x - p.x) - p.yaw;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const pitch = Math.atan2(dz - 1.6, Math.hypot(x - p.x, y - p.y));
  page.cursor.x += Math.round(d / SENS);
  page.cursor.y += Math.round(-pitch / SENS);
  await page.mouse.move(page.cursor.x, page.cursor.y, { steps: 6 });
  await page.waitForTimeout(200);
}

for (const p of [a, b]) {
  await p.keyboard.press('F3');
  await p.mouse.click(480, 270);
  await p.waitForTimeout(300);
}
// Step apart a little so each sees the other whole.
await b.keyboard.down('KeyS');
await b.waitForTimeout(400);
await b.keyboard.up('KeyS');
const pa = await pos(a);
const pb = await pos(b);
await face(a, pb.x, pb.y, 0.9);
await face(b, pa.x, pa.y, 1.2);
await a.mouse.down({ button: 'right' });
await a.waitForTimeout(1200);
await a.screenshot({ path: `${prefix}-heretic.png` });
await b.screenshot({ path: `${prefix}-healed.png` });
console.log(JSON.stringify((await a.evaluate(() => window.__heavenfall.players))));
await a.mouse.up({ button: 'right' });
await browser.close();
