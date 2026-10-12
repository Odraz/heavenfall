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
    await b.goto(`/?dev=1&map=rogue&seed=${PINNED.seed}&class=binder&room=999&god=1`);
    await b.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0, null, { timeout: 30_000 });
    await b.waitForFunction(() => window.__heavenfall.activePhase === 'combat', null, { timeout: 10_000 });
    for (const [page, room] of [[a, 0], [b, generated.floor.boss]] as const) {
      const s = await state(page);
      expect(s.floorHash).toBe(nodeHash);
      expect(s.seed).toBe(PINNED.seed);
      expect(s.simSeed).toBe(expectedSimSeed);
      expect(s.attempts).toBe(PINNED.attempts);
      expect(s.fallbackUsed).toBe(false);
      expect(s.activeRoom).toBe(room === 0 ? 255 : generated.floor.boss);
      expect(s.activePhase).toBe(room === 0 ? 'idle' : 'combat');
      expect(s.clearedMask).toBe(((1 << generated.floor.n) - 1) & (room === 0 ? ~0 : ~(1 << generated.floor.boss)));
      if (room === 0) expect(s.enemies).toBe(0);
      else expect(s.enemies).toBeGreaterThan(0);
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

test('solo autopilot clears the pinned generated floor and reaches the inherited boss', async ({ page }) => {
  test.setTimeout(900_000);
  const { floor, def } = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL_R1);
  await page.setViewportSize({ width: 320, height: 180 });
  await page.goto(`/?dev=1&map=rogue&seed=${PINNED.seed}&class=fallen&bot=1&god=1`);
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame', null, { timeout: 30_000 });
  const seen = new Set<number>();
  let latestMask = 0, lastProgress = Date.now(), lastWave = -1, lastRoom = 255;
  for (;;) {
    const s = await state(page);
    if (s.gameResult !== null) break;
    const wave = s.director?.wave ?? -1;
    if (s.clearedMask !== latestMask || s.activeRoom !== lastRoom || wave !== lastWave) {
      latestMask = s.clearedMask; lastRoom = s.activeRoom; lastWave = wave; lastProgress = Date.now();
    }
    expect(Date.now() - lastProgress, `autopilot progresses: room ${s.activeRoom}, ${s.activePhase}, wave ${wave}, at ${s.self.x},${s.self.y}`).toBeLessThan(90_000);
    if (s.activePhase === 'combat') { seen.add(s.activeRoom); await page.keyboard.press('KeyK'); }
    await page.waitForTimeout(500);
  }
  expect(seen.has(floor.boss)).toBe(true);
  for (let i = 0; i < def.rooms.length; i++) {
    if (def.rooms[i].kind === 'combat') expect((latestMask >>> i) & 1, `combat room ${i} cleared`).toBe(1);
  }
  await page.waitForFunction(() => window.__heavenfall.screen === 'results', null, { timeout: 10_000 });
  expect((await state(page)).gameResult).toBe('victory');
});
