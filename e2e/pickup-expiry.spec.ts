import { generateFloor } from '../src/gen';
import { PEARLY_POOL } from '../src/data/rooms/1';
import { expect, state, test } from './fixtures';

test('uncollected clear-reward gold retains its original host deadline through the quiet expiry cue', async ({ page }) => {
  // Marked amphorae now contain Charts. Use a real authored gold clear reward,
  // selected from deterministic small-room seeds, without injecting a pickup.
  let seed = 1, room = -1;
  for (; seed <= 64; seed++) {
    const g = generateFloor(seed, 1, 1, PEARLY_POOL);
    room = g.def.rooms.findIndex((r, i) => r.kind === 'combat' && r.shape === '1x1' && g.floor.rewards[i].kind === 'gold');
    if (room >= 0) break;
  }
  expect(room).toBeGreaterThanOrEqual(0);
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto(`/?dev=1&map=rogue&seed=${seed}&room=${room}&class=betrayer&god=1`);
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0);
  await page.waitForFunction(() => window.__heavenfall.activePhase === 'combat');
  while ((((await state(page)).clearedMask >>> room) & 1) === 0) {
    await page.keyboard.press('KeyK'); await page.waitForTimeout(250);
  }
  await page.waitForFunction(() => window.__heavenfall.pickups.some(p => p.kind === 1));
  const gold = (await state(page)).pickups.find(p => p.kind === 1)!;
  const seen = (await state(page)).lastSnapshotTick;
  await page.screenshot({ path: test.info().outputPath('halo-steady.png') });
  await page.waitForFunction((tick) => window.__heavenfall.lastSnapshotTick >= tick + 515, seen);
  expect((await state(page)).pickups.some((p) => p.id === gold.id)).toBe(true);
  expect((await state(page)).wallet).toBe(0);
  await page.screenshot({ path: test.info().outputPath('halo-expiring.png') });
  await page.waitForFunction((id) => !window.__heavenfall.pickups.some((p) => p.id === id), gold.id, { timeout: 5000 });
  const end = await state(page);
  expect(end.lastSnapshotTick - seen).toBeGreaterThanOrEqual(570);
  expect(end.lastSnapshotTick - seen).toBeLessThan(630);
  expect(end.wallet).toBe(0);
});
