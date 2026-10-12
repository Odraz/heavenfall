import { expect, state, test } from './fixtures';

// From milestone 4: a solo run through the Pearly Gates with the bot, killing everything with K (§13.2).
test('full solo run', async ({ page }) => {
  test.setTimeout(600_000);
  await page.goto('/?dev=1&map=pearly-gates&class=fallen&bot=1&god=1&seed=1');
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame', null, { timeout: 30_000 });

  const cleared = new Set<number>();
  let combatSeen = -1;
  // When the next room should have entered combat by: 60 s after the start, then after each clear.
  let deadline = Date.now() + 60_000;
  for (;;) {
    const s = await state(page);
    if (s.gameResult !== null) break;
    if (s.activePhase === 'combat') {
      if (s.activeRoom > combatSeen) {
        expect(Date.now(), `room ${s.activeRoom} reaches combat within 60 s`).toBeLessThanOrEqual(deadline);
        combatSeen = s.activeRoom;
      }
      await page.keyboard.press('KeyK');
    } else {
      for (let i = 0; i < 32; i++) {
        if (((s.clearedMask >>> i) & 1) === 1 && !cleared.has(i)) {
          cleared.add(i);
          deadline = Date.now() + 60_000;
        }
      }
      expect(Date.now(), `room ${combatSeen + 1} reaches combat within 60 s`).toBeLessThanOrEqual(deadline);
    }
    await page.waitForTimeout(1000);
  }

  expect([...cleared].sort()).toEqual([0, 1, 2]);
  expect(combatSeen).toBe(3);
  await page.waitForFunction(() => window.__heavenfall.gameResult === 'victory', null, { timeout: 10_000 });
  await page.waitForFunction(() => window.__heavenfall.screen === 'results', null, { timeout: 10_000 });
});
