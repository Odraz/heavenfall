// `npm run bench` (§12): serves the build, runs ?bench=1 in headed Chromium at 1920 × 1080 with GPU
// rasterization, waits for the BENCH console line (at most 90 s) and prints it with the WebGL renderer.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PORT = 4173;
const BENCH_URL = `http://localhost:${PORT}/?bench=1`;

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

const server = startPreview();
let exitCode = 0;
try {
  await waitForServer(30000);
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
    ],
  };
  // Playwright's Chromium first; if its headed build can't start on this machine, the installed
  // Chrome, then Edge (both Chromium).
  let browser;
  for (const channel of [undefined, 'chrome', 'msedge']) {
    try {
      browser = await chromium.launch({ ...launchOptions, channel });
      console.log(`Browser: ${channel ?? "Playwright's Chromium"} ${browser.version()}`);
      break;
    } catch (e) {
      console.log(`Couldn't launch ${channel ?? "Playwright's Chromium"}: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`);
    }
  }
  if (!browser) throw new Error('No Chromium browser could be launched');
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
  console.log(line);
  console.log(`WebGL renderer: ${renderer}`);
  if (/swiftshader/i.test(renderer)) console.log('Note: software rendering (SwiftShader); the FPS result is not a pass/fail criterion (§12).');
  if (errors.length) {
    console.log(`Page errors:\n${errors.join('\n')}`);
    exitCode = 1;
  }
  await browser.close();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  exitCode = 1;
} finally {
  stopPreview(server);
}
process.exit(exitCode);
