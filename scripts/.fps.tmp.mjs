import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(process.argv[2]);
await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame');
const out = [];
for (let i = 0; i < 6; i++) { await page.waitForTimeout(1000); out.push((await page.evaluate(() => window.__heavenfall.fps)).toFixed(1)); }
console.log(out.join(' '));
await browser.close();
