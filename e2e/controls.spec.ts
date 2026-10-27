import { expect, state, test } from './fixtures';

// M9 §11.2: the right button fires the secondary; holding the left too switches to the primary.
test('controls: right mouse fires the secondary, left pressed after it the primary', async ({ page }) => {
  await page.goto('/?dev=1&class=fallen&seed=1');
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame', null, { timeout: 30_000 });
  const canvas = page.locator('canvas.game-canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  // The first click only captures the pointer (§4).
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => document.pointerLockElement !== null);

  const before = (await state(page)).players[0];
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(1000);
  const mid = (await state(page)).players[0];
  expect(mid.secondaryShots).toBeGreaterThan(before.secondaryShots);
  expect(mid.primaryShots).toBe(before.primaryShots);

  await page.mouse.down({ button: 'left' });
  await expect.poll(async () => (await state(page)).players[0].primaryShots, { timeout: 3000 }).toBeGreaterThan(mid.primaryShots);
  await page.mouse.up({ button: 'left' });
  await page.mouse.up({ button: 'right' });
});

test('native backward movement is thirty percent slower than forward movement', async ({ page }) => {
  await page.goto('/?dev=1&map=dominion&class=fallen&god=1&seed=7');
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0);
  await page.locator('.game-canvas').click({ position: { x: 300, y: 160 } });
  await page.waitForFunction(() => document.pointerLockElement !== null);
  const speed = async (key: string) => {
    // The pose must show the teleport at once, or the walk below would be measured from the old place.
    expect(await page.evaluate(() => { window.__heavenfallTeleport!(14.5, 2.5); return window.__heavenfall.self; })).toMatchObject({ x: 14.5, y: 2.5 });
    await page.keyboard.down(key);
    await page.waitForFunction(() => Math.abs(window.__heavenfall.self.x - 14.5) > 0.3);
    // Speed per game time: the game moves at most a 50 ms step per frame (MAX_FRAME_DT), and headless
    // Chromium drops to 10-15 fps now and then, so each frame counts as the step the game took, by the
    // same frame clock.
    const measured = await page.evaluate(() => new Promise<number>((resolve) => {
      let at = -1, from = { ...window.__heavenfall.self }, dist = 0, time = 0;
      const sample = (now: number) => {
        const to = { ...window.__heavenfall.self };
        if (at >= 0) { dist += Math.hypot(to.x - from.x, to.y - from.y); time += Math.min(now - at, 50); }
        at = now; from = to;
        if (time < 400) { requestAnimationFrame(sample); return; }
        resolve(dist / (time / 1000));
      }; requestAnimationFrame(sample);
    }));
    await page.keyboard.up(key);
    return measured;
  };
  const forward = await speed('KeyW'), backward = await speed('KeyS');
  expect(forward).toBeGreaterThan(5.7); expect(forward).toBeLessThan(6.3);
  expect(backward / forward).toBeGreaterThan(0.66); expect(backward / forward).toBeLessThan(0.74);
});
