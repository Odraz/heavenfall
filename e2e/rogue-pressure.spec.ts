import { generateFloor } from '../src/gen';
import { PEARLY_POOL_R1 } from '../src/data/rooms/1';
import { PINNED } from '../src/gen/pinned';
import { expect, state, test } from './fixtures';
import { propDefs } from '../src/data/props';
import { lineOfSight } from '../src/sim/los';
import { shootProp } from './prop-fixtures';

test('generated combat drops are visible in complete snapshots and collected into the absolute wallet', async ({ page }) => {
  test.setTimeout(150_000);
  const { def } = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL_R1);
  const room = def.rooms.findIndex((r) => r.kind === 'combat' && r.shape === '1x1');
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto(`/?dev=1&map=rogue&seed=${PINNED.seed}&room=${room}&class=betrayer&bot=1&god=1`);
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame');
  await expect(page.getByLabel('Halo wallet')).toHaveText('Halos 0');
  await page.waitForFunction(() => window.__heavenfall.pickups.some((p) => p.kind <= 1) || window.__heavenfall.wallet > 0, null, { timeout: 90_000 });
  const coin = (await state(page)).pickups.find((p) => p.kind <= 1);
  if (coin) await page.evaluate(([x, y]) => window.__heavenfallTeleport!(x, y), [coin.x, coin.y]);
  await page.waitForFunction(() => window.__heavenfall.wallet > 0, null, { timeout: 10_000 });
  const s = await state(page);
  expect(s.wallet % 3).toBe(0);
  await expect(page.getByLabel('Halo wallet')).toHaveText(`Halos ${s.wallet}`);
  await page.screenshot({ path: test.info().outputPath('r2.1-pickups-wallet.png') });
});

test('shooting the marked amphora destroys its seed-selected body once and drops a collectible gold halo', async ({ page }) => {
  const g = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL_R1);
  const q = propDefs(g.floor).find((p) => p.marked)!;
  // Independent geometry chooses a legal nearby same-floor firing point, avoiding obstacles and leaves.
  const z = g.map.floor[Math.floor(q.y) * g.map.w + Math.floor(q.x)];
  const points = Array.from({ length: 16 }, (_, i) => [q.x + 3 * Math.cos(i * Math.PI / 8), q.y + 3 * Math.sin(i * Math.PI / 8)]);
  const [x, y] = points.find(([x, y]) => {
    const c = Math.floor(x), r = Math.floor(y), index = r * g.map.w + c;
    return c > 0 && r > 0 && c < g.map.w - 1 && r < g.map.h - 1 && !g.map.solid[index] &&
      g.map.roomOf[index] === q.room && g.map.floor[index] === z && lineOfSight(g.map, x, y, z + 1.6, q.x, q.y, z + 0.5);
  })!;
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto(`/?dev=1&map=rogue&seed=${PINNED.seed}&room=${q.room}&class=betrayer&god=1`);
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0);
  await page.evaluate(([x, y]) => window.__heavenfallTeleport!(x, y), [x, y]);
  await expect.poll(async () => Math.hypot((await state(page)).self.x - x, (await state(page)).self.y - y)).toBeLessThan(0.2);
  expect((await state(page)).brokenProps).not.toContain(q.id);
  await shootProp(page, q.id, test.info().outputPath('r2.2-props-before.png'));
  await page.waitForFunction(() => window.__heavenfall.pickups.some((p) => p.kind === 1) || window.__heavenfall.wallet === 6);
  const drop = (await state(page)).pickups.find((p) => p.kind === 1);
  if (drop) await page.evaluate(([x, y]) => window.__heavenfallTeleport!(x, y), [drop.x, drop.y]);
  await page.waitForFunction(() => window.__heavenfall.wallet === 6);
  await expect(page.getByLabel('Halo wallet')).toHaveText('Halos 6');
  expect((await state(page)).brokenProps.filter((id) => id === q.id)).toHaveLength(1);
  await page.screenshot({ path: test.info().outputPath('r2.2-marked-amphora.png') });
});
