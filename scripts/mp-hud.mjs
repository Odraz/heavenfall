// Dev helper (M9): screenshots the multiplayer HUD. A hosts The Pearly Gates as the Betrayer and three
// bots auto-join (Fallen, Heretic, Binder); A walks into Arena 1, tosses a Field of Blood once the
// fight starts and saves a screenshot: the own frame, three party frames, the enemies remaining band
// and a cooling ability. Needs the public PeerJS server.
// Usage: node scripts/mp-hud.mjs [base URL] [out.png]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? 'screenshots/m9/hud-multiplayer.png';
mkdirSync(out.replace(/[^/]+$/, ''), { recursive: true });
const SENS = 0.0022;
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });

async function newPage(label, w, h) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  page.on('pageerror', (e) => console.log(`[${label} pageerror] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && console.log(`[${label} console.error] ${m.text()}`));
  return page;
}

const a = await newPage('A', 1280, 720);
a.cursor = { x: 640, y: 360 };
await a.goto(base + '/?god=1');
await a.waitForFunction(() => window.__heavenfall?.screen === 'title');
await a.getByLabel('Player name').fill('Judas');
await a.getByRole('button', { name: 'Multiplayer' }).click();
await a.getByRole('button', { name: 'Host game' }).click();
await a.getByRole('button', { name: 'Create' }).click();
await a.waitForFunction(() => window.__heavenfall.screen === 'lobby', null, { timeout: 30000 });
const gameId = (await a.locator('.game-id').textContent()).trim();
await a.getByRole('button', { name: /The Betrayer/ }).click();
const bots = [];
for (const [cls, name] of [['fallen', 'Lucifel'], ['heretic', 'Simona'], ['binder', 'Azazel']]) {
  const p = await newPage(name, 320, 180);
  await p.goto(`${base}/?bot=1&autojoin=1&join=${gameId}&class=${cls}&name=${name}`);
  await a.getByText(name).first().waitFor({ timeout: 30000 });
  bots.push(p);
}
await a.waitForTimeout(1500);
await a.getByRole('button', { name: 'Start' }).click();
await a.waitForFunction(() => window.__heavenfall.screen === 'inGame', null, { timeout: 60000 });

async function pos() {
  for (let i = 0; i < 50; i++) {
    const t = await a.evaluate(() => document.querySelector('.debug-overlay')?.textContent ?? '');
    const m = /pos (\S+) (\S+) (\S+) yaw (\S+)/.exec(t);
    if (m) return { x: +m[1], y: +m[2], yaw: +m[4] };
    await a.waitForTimeout(100);
  }
  throw new Error('no position');
}

async function turnTo(yaw) {
  const p = await pos();
  let d = yaw - p.yaw;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  a.cursor.x += Math.round(d / SENS);
  await a.mouse.move(a.cursor.x, a.cursor.y, { steps: 6 });
  await a.waitForTimeout(150);
}

async function goTo(x, y) {
  for (let i = 0; i < 200; i++) {
    const p = await pos();
    const dist = Math.hypot(x - p.x, y - p.y);
    if (dist < 0.4) return;
    await turnTo(Math.atan2(y - p.y, x - p.x));
    await a.keyboard.down('KeyW');
    await a.waitForTimeout(Math.min(400, dist * 90));
    await a.keyboard.up('KeyW');
  }
}

await a.keyboard.press('F3');
await a.mouse.click(640, 360);
await a.waitForTimeout(300);
for (const [x, y] of [[15.5, 21.5], [24.5, 21.5], [30.5, 21.5]]) await goTo(x, y);
await a.waitForFunction(() => window.__heavenfall.arenaPhase === 'combat', null, { timeout: 60000 });
await turnTo(Math.PI);
await a.keyboard.press('F3');
await a.waitForTimeout(800);
await a.keyboard.press('KeyQ');
await a.waitForTimeout(2500);
await a.screenshot({ path: out });
console.log('saved', out);
await browser.close();
