import { floorHash, fmix32, generateFloor } from '../src/gen';
import { PINNED } from '../src/gen/pinned';
import { PEARLY_POOL_R1 } from '../src/data/rooms/1';
import { expect, state, test } from './fixtures';

test('two browser clients reproduce the pinned Node floor and dev entry positions', async ({ page: a, browser }) => {
  const generated = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL_R1);
  const nodeHash = floorHash(generated.def);
  expect(nodeHash).toBe(PINNED.floorHash);
  const expectedSimSeed = fmix32((PINNED.seed ^ 0x53494d) >>> 0);
  const own = await browser.browserType().launch(test.info().project.use.launchOptions ?? {});
  const context = await own.newContext({ viewport: { width: 640, height: 360 } });
  const b = await context.newPage();
  const errors: string[] = [];
  b.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  b.on('pageerror', (e) => errors.push(e.message));
  try {
    await a.goto(`/?dev=1&map=rogue&seed=${PINNED.seed}&class=fallen&room=0`);
    await a.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0, null, { timeout: 30_000 });
    await a.setViewportSize({ width: 320, height: 180 });
    await b.goto(`/?dev=1&map=rogue&seed=${PINNED.seed}&class=binder&room=999`);
    await b.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0, null, { timeout: 30_000 });
    for (const [page, room] of [[a, 0], [b, generated.floor.boss]] as const) {
      const s = await state(page);
      expect(s.floorHash).toBe(nodeHash);
      expect(s.seed).toBe(PINNED.seed);
      expect(s.simSeed).toBe(expectedSimSeed);
      expect(s.attempts).toBe(PINNED.attempts);
      expect(s.fallbackUsed).toBe(false);
      expect(s.activeRoom).toBe(255);
      expect(s.activePhase).toBe('idle');
      expect(s.clearedMask).toBe((1 << generated.floor.n) - 1);
      expect(s.enemies).toBe(0);
      const [c, r] = generated.def.rooms[room].entry[0].cells[0];
      await expect.poll(async () => {
        const { self } = await state(page);
        return [self.x, self.y, self.z];
      }).toEqual([c + 0.5, r + 0.5, generated.map.floor[r * generated.map.w + c]]);
    }
    expect((await state(a)).runId).not.toBe((await state(b)).runId);
    await a.keyboard.press('F3');
    await expect(a.locator('.debug-overlay')).toContainText(`Seed ${PINNED.seed}`);
    expect(errors).toEqual([]);
  } finally {
    await own.close();
  }
});
