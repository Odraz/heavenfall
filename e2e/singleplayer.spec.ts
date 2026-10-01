import { expect, state, test } from './fixtures';

// Milestone 2: the Fallen only; all 4 classes from milestone 3.
const CLASSES = ['fallen'];

for (const classId of CLASSES) {
  test(`singleplayer smoke: ${classId}`, async ({ page }) => {
    await page.goto(`/?dev=1&map=sandbox&class=${classId}&bot=1&god=1&seed=1`);
    await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame', null, { timeout: 30_000 });
    const enemySamples: number[] = [];
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(1000);
      enemySamples.push((await state(page)).enemies);
    }
    const end = await state(page);
    expect(end.fps).toBeGreaterThan(0);
    expect(Math.max(...enemySamples)).toBeGreaterThan(0);
  });
}
