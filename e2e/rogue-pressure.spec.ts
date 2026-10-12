import { generateFloor } from '../src/gen';
import { PEARLY_POOL_R1 } from '../src/data/rooms/1';
import { PINNED } from '../src/gen/pinned';
import { expect, state, test } from './fixtures';

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
