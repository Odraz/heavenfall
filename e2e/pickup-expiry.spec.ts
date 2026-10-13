import { generateFloor } from '../src/gen';
import { PEARLY_POOL } from '../src/data/rooms/1';
import { PINNED } from '../src/gen/pinned';
import { propDefs } from '../src/data/props';
import { lineOfSight } from '../src/sim/los';
import { expect, state, test } from './fixtures';
import { shootProp } from './prop-fixtures';

test('uncollected gold retains its original host deadline through the quiet expiry cue', async ({ page }) => {
  const g = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL);
  const q = propDefs(g.floor).find((p) => p.marked)!;
  const z = g.map.floor[Math.floor(q.y) * g.map.w + Math.floor(q.x)];
  const points = [5, 6, 8].flatMap((radius) => Array.from({ length: 32 }, (_, i) =>
    [q.x + radius * Math.cos(i * Math.PI / 16), q.y + radius * Math.sin(i * Math.PI / 16)]));
  const at = points.find(([x, y]) => {
    const c = Math.floor(x), r = Math.floor(y), cell = r * g.map.w + c;
    return c > 0 && r > 0 && c < g.map.w - 1 && r < g.map.h - 1 && !g.map.solid[cell] &&
      g.map.roomOf[cell] === q.room && g.map.floor[cell] === z && lineOfSight(g.map, x, y, z + 1.6, q.x, q.y, z + 0.5);
  });
  expect(at).toBeDefined();
  await page.goto(`/?dev=1&map=rogue&seed=${PINNED.seed}&room=${q.room}&class=betrayer&god=1`);
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0);
  await page.evaluate(([x, y]) => window.__heavenfallTeleport!(x, y), at!);
  await expect.poll(async () => Math.hypot((await state(page)).self.x - at![0], (await state(page)).self.y - at![1])).toBeLessThan(0.2);
  await shootProp(page, q.id);
  await page.waitForFunction(() => window.__heavenfall.pickups.some((p) => p.kind === 1));
  const gold = (await state(page)).pickups.find((p) => p.kind === 1)!;
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
