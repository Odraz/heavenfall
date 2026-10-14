import { generateFloor } from '../src/gen';
import { PEARLY_POOL } from '../src/data/rooms/1';
import { PINNED } from '../src/gen/pinned';
import { expect, state, test } from './fixtures';
import { PROP_RECHARGE_TICKS, propDefs } from '../src/data/props';
import { lineOfSight } from '../src/sim/los';
import { shootProp } from './prop-fixtures';

test('shooting a small candle inside its blast radius hurts the player without God mode', async ({ page }) => {
  const g = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL);
  const q = propDefs(g.floor).find((p) => p.family === 'blast')!;
  const z = g.map.floor[Math.floor(q.y) * g.map.w + Math.floor(q.x)];
  const at = Array.from({ length: 32 }, (_, i) => [q.x + 3 * Math.cos(i * Math.PI / 16), q.y + 3 * Math.sin(i * Math.PI / 16)])
    .find(([x, y]) => {
      const c = Math.floor(x), r = Math.floor(y), cell = r * g.map.w + c;
      return c > 0 && r > 0 && c < g.map.w - 1 && r < g.map.h - 1 && !g.map.solid[cell] && !g.map.hazard[cell] &&
        g.map.roomOf[cell] === q.room && g.map.floor[cell] === z &&
        lineOfSight(g.map, x, y, z + 1.6, q.x, q.y, z + 0.55) && lineOfSight(g.map, q.x, q.y, z + 0.55, x, y, z + 0.9);
    });
  expect(at).toBeDefined();
  await page.goto(`/?dev=1&map=rogue&seed=${PINNED.seed}&class=betrayer&god=0`);
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0);
  await page.evaluate(([x, y]) => window.__heavenfallTeleport!(x, y), at!);
  await expect.poll(async () => Math.hypot((await state(page)).self.x - at![0], (await state(page)).self.y - at![1])).toBeLessThan(0.2);
  const hp = (await state(page)).players[0].hp;
  await shootProp(page, q.id);
  await expect.poll(async () => (await state(page)).players[0].hp, { timeout: 3000 }).toBe(hp - 40);
  await page.screenshot({ path: test.info().outputPath('small-candle-player-damage.png') });
});

for (const family of ['blessing', 'blast'] as const) test(`${family} stays visible while depleted and can be shot again after the host recharge`, async ({ page }) => {
  const g = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL);
  const q = propDefs(g.floor).find((p) => p.family === family)!;
  const z = g.map.floor[Math.floor(q.y) * g.map.w + Math.floor(q.x)];
  const points = [3, 5, 7].flatMap((distance) => Array.from({ length: 32 }, (_, i) => [q.x + distance * Math.cos(i * Math.PI / 16), q.y + distance * Math.sin(i * Math.PI / 16)]));
  const [x, y] = points.find(([x, y]) => {
    const c = Math.floor(x), r = Math.floor(y), index = r * g.map.w + c;
    return c > 0 && r > 0 && c < g.map.w - 1 && r < g.map.h - 1 && !g.map.solid[index] &&
      g.map.roomOf[index] === q.room && g.map.floor[index] === z && lineOfSight(g.map, x, y, z + 1.6, q.x, q.y, z + 0.6);
  })!;
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto(`/?dev=1&map=rogue&seed=${PINNED.seed}&room=${q.room}&class=betrayer&god=1`);
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0);
  await page.evaluate(([x, y]) => window.__heavenfallTeleport!(x, y), [x, y]);
  await expect.poll(async () => Math.hypot((await state(page)).self.x - x, (await state(page)).self.y - y)).toBeLessThan(0.2);
  await shootProp(page, q.id, test.info().outputPath(`${family}-active.png`));
  const ready = (await state(page)).propRecharges.find((p) => p.id === q.id)!.readyTick;
  expect(ready - (await state(page)).lastSnapshotTick).toBeGreaterThan(PROP_RECHARGE_TICKS - 60);
  await page.waitForFunction((ready) => window.__heavenfall.lastSnapshotTick >= ready - 225, ready);
  expect((await state(page)).brokenProps).toContain(q.id);
  await page.screenshot({ path: test.info().outputPath(`${family}-refilling.png`) });
  await expect.poll(async () => (await state(page)).brokenProps.includes(q.id), { timeout: 20_000 }).toBe(false);
  // The room remains live throughout recharge. Close the firing lane before the
  // second shot so an approaching enemy cannot absorb the prop's test input.
  const distance = Math.hypot(x - q.x, y - q.y);
  const close = [q.x + (x - q.x) / distance * 0.8, q.y + (y - q.y) / distance * 0.8];
  await page.evaluate(([x, y]) => window.__heavenfallTeleport!(x, y), close);
  await expect.poll(async () => Math.hypot((await state(page)).self.x - close[0], (await state(page)).self.y - close[1])).toBeLessThan(0.2);
  await shootProp(page, q.id);
  expect((await state(page)).propRecharges.find((p) => p.id === q.id)!.readyTick).toBeGreaterThan(ready);
});

test('generated combat drops are visible in complete snapshots and collected into the absolute wallet', async ({ page }) => {
  test.setTimeout(150_000);
  const { def } = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL);
  const room = def.rooms.findIndex((r) => r.kind === 'combat' && r.shape === '1x1');
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto(`/?dev=1&map=rogue&seed=${PINNED.seed}&room=${room}&class=betrayer&bot=1&god=1`);
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame');
  await expect(page.locator('.halo-wallet')).toHaveText('0');
  await page.waitForFunction(() => window.__heavenfall.pickups.some((p) => p.kind <= 1) || window.__heavenfall.wallet > 0, null, { timeout: 90_000 });
  const coin = (await state(page)).pickups.find((p) => p.kind <= 1);
  if (coin) await page.evaluate(([x, y]) => window.__heavenfallTeleport!(x, y), [coin.x, coin.y]);
  await page.waitForFunction(() => window.__heavenfall.wallet > 0, null, { timeout: 10_000 });
  const s = await state(page);
  expect(s.wallet).toBeGreaterThan(0);
  await expect(page.locator('.halo-wallet')).toHaveText(`${s.wallet}`);
  await page.screenshot({ path: test.info().outputPath('r2.1-pickups-wallet.png') });
});

test('shooting the marked amphora destroys its body once and drops a collectible transparent Chart', async ({ page }) => {
  const g = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL);
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
  // R03 replaced the marked amphora's R02 gold with a non-expiring Chart.
  await page.waitForFunction(() => window.__heavenfall.pickups.some((p) => p.kind === 13));
  const drop = (await state(page)).pickups.find((p) => p.kind === 13)!;
  await page.screenshot({ path: test.info().outputPath('r03-world-chart.png') });
  const wallet = (await state(page)).wallet;
  await page.evaluate(([x, y]) => window.__heavenfallTeleport!(x, y), [drop.x, drop.y]);
  await page.waitForFunction(id => !window.__heavenfall.pickups.some(p => p.id === id), drop.id);
  expect((await state(page)).wallet).toBe(wallet);
  expect((await state(page)).brokenProps.filter((id) => id === q.id)).toHaveLength(1);
  await page.screenshot({ path: test.info().outputPath('r2.2-marked-amphora.png') });
});
