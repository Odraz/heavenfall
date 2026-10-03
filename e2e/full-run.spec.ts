import { expect, state, test } from './fixtures';

// From milestone 4: a solo run through the Pearly Gates with the bot, killing everything with K (§13.2).
test('full solo run', async ({ page }) => {
  test.setTimeout(600_000);
  await page.goto('/?dev=1&map=pearly-gates&class=fallen&bot=1&god=1&seed=1');
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame', null, { timeout: 30_000 });

  const cleared = new Set<number>();
  let combatSeen = -1;
  // When the next arena should have entered combat by: 60 s after the start, then after each clear.
  let deadline = Date.now() + 60_000;
  for (;;) {
    const s = await state(page);
    if (s.gameResult !== null) break;
    if (s.arenaPhase === 'combat') {
      if (s.arenaIndex > combatSeen) {
        expect(Date.now(), `arena ${s.arenaIndex} reaches combat within 60 s`).toBeLessThanOrEqual(deadline);
        combatSeen = s.arenaIndex;
      }
      await page.keyboard.press('KeyK');
    } else {
      if (s.arenaPhase === 'cleared' && !cleared.has(s.arenaIndex)) {
        cleared.add(s.arenaIndex);
        deadline = Date.now() + 60_000;
      }
      expect(Date.now(), `arena ${combatSeen + 1} reaches combat within 60 s`).toBeLessThanOrEqual(deadline);
    }
    await page.waitForTimeout(1000);
  }

  expect([...cleared].sort()).toEqual([0, 1, 2]);
  expect(combatSeen).toBe(3);
  await page.waitForFunction(() => window.__heavenfall.gameResult === 'victory', null, { timeout: 10_000 });
  await page.waitForFunction(() => window.__heavenfall.screen === 'results', null, { timeout: 10_000 });
});
