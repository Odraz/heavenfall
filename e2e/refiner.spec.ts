import { expect, state, test } from './fixtures';

test('accepted fire cells activate at seal, damage grounded feet and stop hurting off the channel', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto('/?dev=1&map=refiner&class=betrayer&seed=7&cam=16,23,10,-90,-35');
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0);
  expect((await state(page)).hazards.activeCells).toBe(0);
  await page.evaluate(() => window.__heavenfallTeleport!(14.5, 9.5));
  await page.waitForFunction(() => window.__heavenfall.hazards.activeCells === 112, null, { timeout: 15_000 });
  const initial = (await state(page)).players[0].hp;
  // On the east half of the north channel, away from the first accepted spawn points.
  await page.evaluate(() => window.__heavenfallTeleport!(17.5, 15.5));
  await page.waitForFunction((hp) => window.__heavenfall.players[0].hp < hp, initial, { timeout: 3000 });
  const before = await state(page);
  await page.waitForFunction((tick) => window.__heavenfall.lastSnapshotTick >= tick + 45, before.lastSnapshotTick);
  const after = await state(page), expected = 7 * (after.lastSnapshotTick - before.lastSnapshotTick) / 30;
  expect(Math.abs(before.players[0].hp - after.players[0].hp - expected)).toBeLessThanOrEqual(1.5);
  expect(after.self.z).toBeCloseTo(1.5); expect(after.hazards.activeRoom).toBe(0);
  await page.screenshot({ path: test.info().outputPath('refiner-active.png') });
  await page.evaluate(() => window.__heavenfallTeleport!(14.5, 19.5));
  await page.waitForFunction(() => window.__heavenfall.self.z > 1.9);
  const dry = await state(page);
  await page.waitForFunction((tick) => window.__heavenfall.lastSnapshotTick >= tick + 30, dry.lastSnapshotTick);
  expect((await state(page)).players[0].hp).toBe(dry.players[0].hp);
});

test('native autopilot clears the scoped fire encounter and accepted clear dims its channels', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto('/?dev=1&map=refiner&class=betrayer&bot=1&god=1&seed=7&cam=16,23,10,-90,-35');
  await page.waitForFunction(() => window.__heavenfall?.hazards.activeCells === 112, null, { timeout: 30_000 });
  await page.waitForFunction(() => (window.__heavenfall.clearedMask & 1) !== 0, null, { timeout: 90_000 });
  expect((await state(page)).hazards).toEqual({ activeRoom: -1, activeCells: 0 });
  await page.screenshot({ path: test.info().outputPath('refiner-cleared.png') });
});
