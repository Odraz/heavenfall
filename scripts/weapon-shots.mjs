// M11 screenshots of the painted first-person weapons: for each class, in Arena 1 of the Pearly Gates
// from a fixed camera, saves screenshots/weapons/<prefix><class>-<shot>.png. Firing is real (pointer lock
// and mouse buttons); a shot is captured by freezing the game loop the given time after the press.
// Usage: node scripts/weapon-shots.mjs [--prefix <p>] [--size 1920x1080] [--eye] [class ...] [-- shot ...]
//   shots: idle, fire (40 ms after a shot; fire-<ms> at another time), shade (in the arcade's shadow), cooldown (Q and E pressed),
//          down, up (looking at the floor and the sky), beam (the Heretic: Sacrament, needs an ally:
//          shot by scripts/mp-sacrament.mjs instead), swing-<ms> (the Binder's Scourge)
// Serves the build in dist/ on port 4176.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PORT = 4176;
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : def;
};
const prefix = opt('--prefix', '');
const eye = args.includes('--eye') && args.splice(args.indexOf('--eye'), 1).length > 0;
const [W, H] = opt('--size', '1920x1080').split('x').map(Number);
const dash = args.indexOf('--');
const classes = (dash >= 0 ? args.slice(0, dash) : args).filter(Boolean);
const shots = dash >= 0 ? args.slice(dash + 1) : ['idle', 'fire', 'shade', 'cooldown'];
const CLASSES = classes.length ? classes : ['fallen', 'heretic', 'binder', 'betrayer'];

// Fixed cameras (x, y, z, yaw, pitch in degrees): full sun on the open floor looking north-east along
// the north arcade; the arcade's shadow; the floor; the sky.
const CAMS = {
  idle: '30,14,,-45,0',
  fire: '30,14,,-45,0',
  cooldown: '30,14,,-45,0',
  shade: '40,7.5,,-20,0',
  down: '30,14,,-45,-45',
  up: '30,14,,-45,40',
};

const outDir = fileURLToPath(new URL('../screenshots/weapons/', import.meta.url));
mkdirSync(outDir, { recursive: true });
const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const server = spawn(process.execPath, [vite, 'preview', '--port', String(PORT), '--strictPort'], { cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: 'ignore' });
for (let i = 0; ; i++) {
  try {
    if ((await fetch(`http://localhost:${PORT}/`)).ok) break;
  } catch {
    // not up yet
  }
  if (i > 120) throw new Error('preview server did not start');
  await new Promise((r) => setTimeout(r, 250));
}

const browser = await chromium.launch({ headless: false, args: ['--ignore-gpu-blocklist', '--window-position=0,0', '--disable-features=CalculateNativeWinOcclusion', '--disable-renderer-backgrounding', '--autoplay-policy=no-user-gesture-required'] });
let problems = 0;
try {
  for (const cls of CLASSES) {
    for (const shot of shots) {
      const cam = CAMS[shot] ?? CAMS.idle;
      const page = await browser.newPage({ viewport: { width: W, height: H } });
      page.on('console', (m) => {
        if (m.type() === 'error' || (m.type() === 'warning' && !m.text().includes('AudioContext'))) {
          problems++;
          console.log(`[${cls} ${shot}] [console.${m.type()}] ${m.text()}`);
        }
      });
      page.on('pageerror', (e) => {
        problems++;
        console.log(`[${cls} ${shot}] [pageerror] ${e.message}`);
      });
      // `--eye` shoots from the player's own eyes (so tracers and projectiles start in view), not a fixed camera.
      await page.goto(`http://localhost:${PORT}/?dev=1&god=1&map=pearly-gates&class=${cls}${eye ? '' : `&cam=${cam}`}`);
      await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame', null, { timeout: 60000 });
      await page.waitForTimeout(2500);
      const box = (await page.locator('canvas').first().boundingBox()) ?? { x: 0, y: 0, width: W, height: H };
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      // The first click captures the pointer; retried, as a click can land before the page has focus.
      const lock = async () => {
        await page.bringToFront();
        for (let i = 0; ; i++) {
          await page.mouse.move(cx, cy);
          await page.mouse.click(cx, cy);
          try {
            await page.waitForFunction(() => document.pointerLockElement !== null, null, { timeout: 2000 });
            return;
          } catch (e) {
            if (i >= 3) throw e;
          }
        }
      };
      const freeze = () => page.evaluate(() => {
        window.requestAnimationFrame = () => 0;
      });
      if (shot === 'fire' || shot.startsWith('fire-')) {
        await lock();
        await page.waitForTimeout(300);
        await page.mouse.down({ button: 'left' });
        await page.waitForTimeout(shot === 'fire' ? 40 : Number(shot.slice(5)));
        await freeze();
        await page.mouse.up({ button: 'left' });
      } else if (shot.startsWith('swing-')) {
        await lock();
        await page.waitForTimeout(300);
        await page.mouse.down({ button: 'right' });
        await page.waitForTimeout(Number(shot.slice(6)));
        await freeze();
        await page.mouse.up({ button: 'right' });
      } else if (shot === 'cooldown') {
        await lock();
        await page.keyboard.press('KeyQ');
        await page.keyboard.press('KeyE');
        await page.waitForTimeout(1500);
      }
      await page.waitForTimeout(100);
      const name = `${prefix}${cls}-${shot}${W === 1920 ? '' : `-${H}`}.png`;
      await page.screenshot({ path: outDir + name });
      console.log(`saved screenshots/weapons/${name}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.kill();
}
if (problems) process.exitCode = 1;
