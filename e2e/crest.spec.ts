import { expect, state, test } from './fixtures';
import { PINNED } from '../src/gen/pinned';

test('native arrivals warn, cancel on player proximity, then use the warned reachable floor without unsafe spawning', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto('/?dev=1&map=arrival&class=binder&god=1&seed=7');
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame');
  await page.evaluate(() => window.__heavenfallTeleport!(8.5, 5.5));
  const warning = await (await page.waitForFunction(() => window.__heavenfall.spawnWarnings[0] ?? null, null, { polling: 20 })).jsonValue();
  expect(warning!.readyTick - warning!.startTick).toBe(30); expect((await state(page)).enemies).toBe(0);
  // Cancel immediately: taking a software-renderer screenshot can consume this one-second deadline.
  await page.evaluate(([x, y]) => window.__heavenfallTeleport!(x, y), [warning!.x, warning!.y]);
  await page.waitForFunction((id) => !window.__heavenfall.spawnWarnings.some((w) => w.id === id), warning!.id, { polling: 20, timeout: 3000 });
  expect((await state(page)).enemies).toBe(0);
  const fallback = await (await page.waitForFunction((prior) => window.__heavenfall.spawnWarnings.find((w) => w.startTick >= prior.startTick + 60) ?? null, warning!, { polling: 20, timeout: 6000 })).jsonValue();
  expect(fallback!.startTick).toBeGreaterThanOrEqual(warning!.startTick + 60);
  expect(fallback!.readyTick - fallback!.startTick).toBe(30);
  expect(Math.hypot(fallback!.x - warning!.x, fallback!.y - warning!.y)).toBeGreaterThan(3);
  await page.screenshot({ path: test.info().outputPath('warned-floor-fallback.png') });
  await page.waitForFunction(() => window.__heavenfall.enemies > 0, null, { timeout: 5000 });
});

test('the real generated horde announces its pure Blessed crest and finishes with the inherited base kit autopilot', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto(`/?dev=1&map=rogue&seed=${PINNED.seed}&room=3&class=betrayer&bot=1&god=1`);
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame');
  await page.waitForFunction(() => window.__heavenfall.activePhase === 'combat');
  // Clear the preliminary waves; the crest itself receives only native bot attacks/abilities.
  for (;;) {
    const s = await state(page); if (s.crests > 0) break;
    await page.keyboard.press('KeyK'); await page.waitForTimeout(250);
  }
  await page.waitForFunction(() => window.__heavenfall.crests === 1 && window.__heavenfall.enemies > 100, null, { timeout: 15_000 });
  await page.screenshot({ path: test.info().outputPath('native-solo-crest.png') });
  await page.waitForFunction(() => ((window.__heavenfall.clearedMask >>> 3) & 1) === 1, null, { timeout: 150_000 });
  expect((await state(page)).crests).toBe(1);
});
