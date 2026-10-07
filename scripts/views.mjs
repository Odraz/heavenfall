// M10 screenshots (M10 §11): opens each named view of scripts/views.json in Chromium on the GPU and
// saves screenshots/m10/<prefix>-<name>.png. Each view is a map, a fixed camera (`cam` parameter) and
// optional extra URL parameters (`bench=1` for a swarm) and a wait in ms before the shot. A view with a
// `group` (the Heavenly Gate's: `gate`) is shot only with `--group <group>`, and the others only without.
// Usage: node scripts/views.mjs <prefix> [--group <group>] [name ...]   (serves the build in dist/ on port 4174)
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.VIEWS_PORT ?? 4174);
const ROOT = process.env.VIEWS_ROOT ?? fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const gi = args.indexOf('--group');
const group = gi >= 0 ? args.splice(gi, 2)[1] : undefined;
const [prefix, ...only] = args;
if (!prefix) {
  console.error('Usage: node scripts/views.mjs <prefix> [name ...]');
  process.exit(1);
}
const views = JSON.parse(readFileSync(new URL('./views.json', import.meta.url), 'utf8'));
const outDir = fileURLToPath(new URL('../screenshots/m10/', import.meta.url));
mkdirSync(outDir, { recursive: true });

const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const server = spawn(process.execPath, [vite, 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
for (let i = 0; ; i++) {
  try {
    if ((await fetch(`http://localhost:${PORT}/`)).ok) break;
  } catch {
    // not up yet
  }
  if (i > 120) throw new Error('preview server did not start');
  await new Promise((r) => setTimeout(r, 250));
}

const browser = await chromium.launch({ headless: false, args: ['--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--window-position=0,0', '--disable-features=CalculateNativeWinOcclusion', '--disable-renderer-backgrounding'] });
try {
  for (const v of views) {
    if (v.group !== group || (only.length && !only.includes(v.name))) continue;
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') console.log(`[${v.name}] [console.${m.type()}] ${m.text()}`);
    });
    page.on('pageerror', (e) => console.log(`[${v.name}] [pageerror] ${e.message}`));
    const q = new URLSearchParams({ ...(v.params ?? { dev: '1' }), map: v.map, ...(v.cam ? { cam: v.cam } : {}) });
    await page.goto(`http://localhost:${PORT}/?${q}`);
    await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame', null, { timeout: 60000 });
    await page.waitForTimeout(v.wait ?? 1500);
    const path = `${outDir}${prefix}-${v.name}.png`;
    await page.screenshot({ path });
    console.log(`saved ${path}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
