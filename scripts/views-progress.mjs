// M10 screenshots that need a later arena (M10 §11): a bot plays the Pearly Gates with god mode, the
// dev key K clears each arena, and when the given arena is in combat the fixed camera (`cam`) is shown
// and saved. Usage: node scripts/views-progress.mjs <prefix>   (serves dist/ on port 4174)
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PORT = 4174;
const prefix = process.argv[2] ?? 'after';
const outDir = fileURLToPath(new URL('../screenshots/m10/', import.meta.url));
mkdirSync(outDir, { recursive: true });

// Each shot: the arena it waits for (in combat), how long into the combat, and the camera.
const SHOTS = [
  // Arena 2: Cherubs over the walkways, seen against the open sky over the walls.
  { name: 'a2-cherubs', arena: 1, after: 9000, cam: '96,30,4.2,-20,16' },
  { name: 'a2-cherubs-2', arena: 1, after: 13000, cam: '118,12,2.1,160,14' },
  // The boss arena: Blessed about 60 m away across it.
  { name: 'boss-blessed-60m', arena: 3, after: 6000, cam: '8,52,6.1,31,-2' },
];

const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const server = spawn(process.execPath, [vite, 'preview', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
for (let i = 0; ; i++) {
  try {
    if ((await fetch(`http://localhost:${PORT}/`)).ok) break;
  } catch {
    // not up yet
  }
  if (i > 120) throw new Error('preview server did not start');
  await new Promise((r) => setTimeout(r, 250));
}

const browser = await chromium.launch({ headless: false, args: ['--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--disable-features=CalculateNativeWinOcclusion', '--disable-renderer-backgrounding'] });
try {
  for (const shot of SHOTS) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
    await page.goto(`http://localhost:${PORT}/?dev=1&map=pearly-gates&class=fallen&bot=1&god=1&seed=7&cam=${shot.cam}`);
    await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame', null, { timeout: 60000 });
    const t0 = Date.now();
    // Clear every arena before the wanted one with K, as soon as it's in combat.
    for (;;) {
      const s = await page.evaluate(() => ({ i: window.__heavenfall.arenaIndex, p: window.__heavenfall.arenaPhase }));
      if (s.i === shot.arena && s.p === 'combat') break;
      if (s.p === 'combat' && s.i < shot.arena) await page.keyboard.press('KeyK');
      if (Date.now() - t0 > 600000) throw new Error(`arena ${shot.arena} not reached`);
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(shot.after);
    const path = `${outDir}${prefix}-${shot.name}.png`;
    await page.screenshot({ path });
    console.log(`saved ${path}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
