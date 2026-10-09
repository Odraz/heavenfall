// `npm run bench` (§12): serves the build, runs ?bench=1 in headed Chromium at 1920 × 1080 with GPU
// rasterization, waits for the BENCH console line (at most 90 s) and prints it with the WebGL renderer.
//
// Options (M10 §2.3):
//   --uncapped     start Chromium without the frame-rate limit and vsync, so the frame time shows
//                  slowdowns the 60 FPS cap would hide
//   --map <id>     the map to run on (default: sandbox)
//   --view arcade  a fixed camera looking north-east instead of the turning one
//   --view gate    the boss arena instead of the first, the camera fixed on the gate (M10 gate §4)
//   --runs <n>     run n times and print the median and the spread (slowest − fastest)
//   --cooldown <s> wait s seconds before each run after the first, so a laptop that heats up under
//                  back-to-back runs (and throttles) starts each one cool
//   --class <id>   the class the benchmark plays (default: the Betrayer) (M11 §5)
//   --hud-fire     the HUD fires the class's primary attack every interval for the whole run: only the
//                  first-person weapon's cosmetic shot, no simulation, tracers or sound (M11 §5)
//   --burst        every 0.5 s the host deals 40 to the 20 Blessed nearest a point 8 m ahead of the
//                  player, so they die in light bursts (M12 §10)
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PORT = 4173;

function option(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const uncapped = process.argv.includes('--uncapped');
const mapId = option('--map');
const view = option('--view');
const runs = Math.max(1, Number(option('--runs') ?? 1) || 1);
const cooldown = Math.max(0, Number(option('--cooldown') ?? 0) || 0);
const classId = option('--class');
const hudFire = process.argv.includes('--hud-fire');
const burst = process.argv.includes('--burst');
const query = new URLSearchParams({ bench: '1' });
if (mapId) query.set('map', mapId);
if (view) query.set('view', view);
if (classId) query.set('class', classId);
if (hudFire) query.set('hudfire', '1');
if (burst) query.set('burst', '1');
const BENCH_URL = `http://localhost:${PORT}/?${query}`;

let serverExited = false;

function startPreview() {
  const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
  const child = spawn(process.execPath, [vite, 'preview', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
  child.stderr.on('data', (d) => process.stderr.write(d));
  child.on('exit', () => {
    serverExited = true;
  });
  return child;
}

async function waitForServer(timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (serverExited) throw new Error('Preview server exited (is port ' + PORT + ' already in use?)');
    try {
      const r = await fetch(`http://localhost:${PORT}/`);
      if (r.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Preview server did not start');
}

function stopPreview(child) {
  child.kill();
}

async function launch() {
  const launchOptions = {
    headless: false,
    args: [
      '--enable-gpu-rasterization',
      '--ignore-gpu-blocklist',
      '--window-size=1920,1080',
      '--window-position=0,0',
      // Keep rendering at full rate if another window covers this one.
      '--disable-features=CalculateNativeWinOcclusion',
      '--disable-renderer-backgrounding',
      // Audio runs without a user gesture, as in play (M8 §12.2).
      '--autoplay-policy=no-user-gesture-required',
      ...(uncapped ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : []),
    ],
  };
  // Playwright's Chromium first; if its headed build can't start on this machine, the installed
  // Chrome, then Edge (both Chromium).
  for (const channel of [undefined, 'chrome', 'msedge']) {
    try {
      const browser = await chromium.launch({ ...launchOptions, channel });
      return { browser, name: `${channel ?? "Playwright's Chromium"} ${browser.version()}` };
    } catch (e) {
      console.log(`Couldn't launch ${channel ?? "Playwright's Chromium"}: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`);
    }
  }
  throw new Error('No Chromium browser could be launched');
}

/** One benchmark run in a fresh browser; returns the parsed BENCH result and the renderer. */
async function runOnce() {
  const { browser, name } = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const benchLine = new Promise((resolve) => {
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
        if (m.text().startsWith('BENCH ')) resolve(m.text());
      });
    });
    await page.goto(BENCH_URL);
    await page.bringToFront();
    const renderer = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return 'no WebGL2';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    });
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('No BENCH line within 90 s')), 90000));
    const line = await Promise.race([benchLine, timeout]);
    return { line, result: JSON.parse(line.slice('BENCH '.length)), renderer, browser: name, errors };
  } finally {
    await browser.close();
  }
}

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const server = startPreview();
let exitCode = 0;
try {
  await waitForServer(30000);
  console.log(`Benchmark: ${BENCH_URL}${uncapped ? ' (uncapped)' : ''}, ${runs} run${runs > 1 ? 's' : ''}`);
  const results = [];
  for (let i = 0; i < runs; i++) {
    if (i > 0 && cooldown > 0) await new Promise((r) => setTimeout(r, cooldown * 1000));
    const r = await runOnce();
    if (i === 0) {
      console.log(`Browser: ${r.browser}`);
      console.log(`WebGL renderer: ${r.renderer}`);
      if (/swiftshader/i.test(r.renderer)) console.log('Note: software rendering (SwiftShader); the FPS result is not a pass/fail criterion (§12).');
    }
    console.log(r.line);
    if (r.errors.length) {
      console.log(`Page errors:\n${r.errors.join('\n')}`);
      exitCode = 1;
    }
    if (r.result.fps < 5) console.log('Warning: under 5 FPS, the window was likely throttled (locked or covered desktop); repeat this run.');
    results.push(r.result);
  }
  if (runs > 1) {
    const keys = ['fps', 'fpsLow', 'frameMs', 'simMs', 'simMsMax'];
    const med = Object.fromEntries(keys.map((k) => [k, Math.round(median(results.map((r) => r[k])) * 100) / 100]));
    const ft = results.map((r) => r.frameMs);
    const spread = Math.max(...ft) - Math.min(...ft);
    med.frameSpreadPct = Math.round((spread / med.frameMs) * 1000) / 10;
    med.stats = results[results.length - 1].stats;
    console.log(`MEDIAN ${JSON.stringify(med)}`);
    if (med.frameSpreadPct > 4) console.log('Note: the frame times spread by more than 4%; M10 §2.3 asks for 5 runs.');
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  exitCode = 1;
} finally {
  stopPreview(server);
}
process.exit(exitCode);
