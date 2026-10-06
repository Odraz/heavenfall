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
