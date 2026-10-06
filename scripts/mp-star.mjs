// Dev helper (M9): screenshots a Falling Star landing in a swarm, from the rescued ally's view. A hosts
// The Pearly Gates as the Heretic Saint (god=1) and B joins as the Fallen; both walk into Arena 1. A
// faces the incoming swarm, B leaps to A, and A saves screenshots through the landing. Needs the public
// PeerJS server. Software rendering takes most of a second per screenshot, longer than the 0.4 s arc,
// so the first one waits `first` ms after the press.
// Usage: node scripts/mp-star.mjs [base URL] [out prefix] [first ms] [swarm wait ms] [A pitch rad]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173';
const prefix = process.argv[3] ?? 'screenshots/m9/star';
const FIRST_SHOT_MS = Number(process.argv[4] ?? 300);
const SWARM_WAIT_MS = Number(process.argv[5] ?? 9000);
mkdirSync(prefix.replace(/[^/]+$/, ''), { recursive: true });
const SENS = 0.0022;
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });

async function newPage(label, w, h) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  page.on('pageerror', (e) => console.log(`[${label} pageerror] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && console.log(`[${label} console.error] ${m.text()}`));
  page.size = { w, h };
  page.cursor = { x: w / 2, y: h / 2 };
  return page;
}

async function pos(page) {
  for (let i = 0; i < 50; i++) {
    const t = await page.evaluate(() => document.querySelector('.debug-overlay')?.textContent ?? '');
    const m = /pos (\S+) (\S+) (\S+) yaw (\S+)/.exec(t);
    if (m) return { x: +m[1], y: +m[2], z: +m[3], yaw: +m[4] };
    await page.waitForTimeout(100);
  }
  throw new Error('no position');
}

async function turnTo(page, yaw, pitch = 0) {
  const p = await pos(page);
  let d = yaw - p.yaw;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  page.cursor.x += Math.round(d / SENS);
  page.cursor.y = page.size.h / 2 + Math.round(-pitch / SENS);
  await page.mouse.move(page.cursor.x, page.cursor.y, { steps: 6 });
  await page.waitForTimeout(150);
}

async function goTo(page, x, y) {
  for (let i = 0; i < 200; i++) {
    const p = await pos(page);
    const dist = Math.hypot(x - p.x, y - p.y);
    if (dist < 0.4) return;
    await turnTo(page, Math.atan2(y - p.y, x - p.x));
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(Math.min(400, dist * 90));
    await page.keyboard.up('KeyW');
  }
}

const a = await newPage('A', 640, 360);
const b = await newPage('B', 320, 180);
await a.goto(base + '/?god=1');
await a.waitForFunction(() => window.__heavenfall?.screen === 'title');
await a.getByLabel('Player name').fill('Her');
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
for (const p of [a, b]) await p.waitForFunction(() => window.__heavenfall.screen === 'inGame', null, { timeout: 40000 });
for (const p of [a, b]) {
  await p.keyboard.press('F3');
  await p.mouse.click(p.size.w / 2, p.size.h / 2);
  await p.waitForTimeout(300);
}
// Into Arena 1: A stands 8 m in, on the floor before the terrace stairs; B just inside the door.
await Promise.all([
  (async () => {
    for (const [x, y] of [[15.5, 21.5], [24.5, 21.5], [32.5, 21.5]]) await goTo(a, x, y);
  })(),
  (async () => {
    for (const [x, y] of [[15.5, 21.5], [24.5, 21.5], [26.5, 21.5]]) await goTo(b, x, y);
  })(),
]);
await a.waitForFunction(() => window.__heavenfall.arenaPhase === 'combat', null, { timeout: 60000 });
await turnTo(a, 0, Number(process.argv[6] ?? 0));
// The swarm closes in on A.
await a.waitForTimeout(SWARM_WAIT_MS);
const pa = await pos(a);
const pb = await pos(b);
const dist = Math.hypot(pa.x - pb.x, pa.y - pb.y);
await turnTo(b, Math.atan2(pa.y - pb.y, pa.x - pb.x), Math.atan2(0.9 - 1.6, dist));
await b.waitForTimeout(300);
await b.keyboard.press('KeyE');
const t0 = Date.now();
await a.waitForTimeout(FIRST_SHOT_MS);
for (let i = 0; i < 3; i++) {
  await a.screenshot({ path: `${prefix}-${i}.png` });
  console.log(i, Date.now() - t0, 'ms');
}
await browser.close();
