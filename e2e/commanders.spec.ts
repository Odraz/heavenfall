import type { Page } from '@playwright/test';
import { expect, state, test } from './fixtures';

async function encounter(page: Page, family: string) {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto(`/?dev=1&map=${family}&class=fallen&god=${family === 'carrier' ? 0 : 1}&seed=7&cam=16,23,10,-90,-35`);
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0);
  if (family === 'carrier') await page.keyboard.press('KeyG');
  await page.evaluate(() => window.__heavenfallTeleport!(14.5, 9.5));
  await page.waitForFunction(() => window.__heavenfall.commanders.length > 0, null, { timeout: 45000 });
}

test('Cantor loads its atlas, opens the hymnal for a host beam and Blasphemy cancels it', async ({ page }) => {
  await encounter(page, 'cantor');
  await page.waitForFunction(() => window.__heavenfall.commanders.some((c) => c.kind === 'beam' && c.phase === 'tell'), null, { timeout: 20000 });
  const warning = (await state(page)).commanders.find((c) => c.kind === 'beam')!;
  expect(warning.endTick - warning.phaseTick).toBe(75);
  await page.screenshot({ path: test.info().outputPath('cantor-warning.png') });
  await page.waitForFunction(() => window.__heavenfall.commanders.some((c) => c.kind === 'beam' && c.phase === 'active'), null, { timeout: 20000 });
  const c = (await state(page)).commanders[0]; expect(c.endTick - c.phaseTick).toBe(90);
  await page.screenshot({ path: test.info().outputPath('cantor-singing.png') });
  await page.evaluate(({ x, y }) => window.__heavenfallTeleport!(x, y), { x: c.x + 2, y: c.y });
  await page.keyboard.press('KeyQ');
  await page.waitForFunction((id) => window.__heavenfall.commanders.some((c) => c.castId === id && c.phase === 'recover'), c.castId, { timeout: 3000 });
  expect((await state(page)).players[0].dead).toBe(false);
});

for (const family of ['cantor', 'carrier']) test(`${family}: a real PeerJS late join restores the current cast identity and deadline`, async ({ page: host, browser }) => {
  const own = await browser.browserType().launch(test.info().project.use.launchOptions ?? {});
  const errors: string[] = [];
  try {
    const guest = await own.newPage({ viewport: { width: 320, height: 180 }, baseURL: 'http://localhost:4173' });
    guest.on('pageerror', (e) => errors.push(e.message));
    guest.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await host.setViewportSize({ width: 320, height: 180 });
    const menu = async (page: Page, url: string, name: string) => {
      await page.goto(url); await page.waitForFunction(() => window.__heavenfall?.screen === 'title');
      await page.getByLabel('Player name').fill(name);
      await page.getByRole('button', { name: 'Multiplayer', exact: true }).click();
    };
    await menu(host, `/?dev=1&menu=1&map=${family}&god=1&seed=7`, 'Host');
    await host.getByRole('button', { name: 'Host game', exact: true }).click();
    await host.getByRole('button', { name: 'Create', exact: true }).click();
    await host.waitForFunction(() => window.__heavenfall.screen === 'lobby', null, { timeout: 30000 });
    const id = (await host.locator('.game-id').textContent())!.trim();
    await host.getByRole('button', { name: /The Fallen/ }).click();
    await host.getByRole('button', { name: 'Start', exact: true }).click();
    await host.waitForFunction(() => window.__heavenfall.screen === 'inGame');
    await host.evaluate(() => window.__heavenfallTeleport!(14.5, 9.5));
    await host.waitForFunction(() => window.__heavenfall.commanders.length > 0);
    await menu(guest, '/?dev=1&menu=1&readyHold=1', 'Guest');
    await guest.getByRole('button', { name: 'Join game', exact: true }).click();
    await guest.getByLabel('Game ID').fill(id);
    await guest.getByRole('button', { name: 'Join', exact: true }).click();
    await guest.waitForFunction(() => window.__heavenfall.screen === 'lobby', null, { timeout: 30000 });
    await guest.getByRole('button', { name: /The Betrayer/ }).click();
    await guest.getByRole('button', { name: 'Enter game', exact: true }).click();
    await guest.waitForFunction(() => typeof window.__heavenfallReady === 'function', null, { timeout: 20000 }).catch(async (error) => {
      console.log(`${family} guest preparation`, await guest.locator('body').innerText(), errors);
      throw error;
    });
    const cast = await (await host.waitForFunction(() => window.__heavenfall.commanders.find((c) => c.phase === 'tell' && c.endTick - window.__heavenfall.lastSnapshotTick >= 24), null, { polling: 20, timeout: 15000 })).jsonValue();
    await guest.evaluate(() => window.__heavenfallReady!());
    const restored = await (await guest.waitForFunction((id) => window.__heavenfall.commanders.find((c) => c.castId === id), cast!.castId, { polling: 20, timeout: 3000 })).jsonValue();
    expect([restored!.incarnation, restored!.startTick, restored!.endTick, restored!.kind]).toEqual([cast!.incarnation, cast!.startTick, cast!.endTick, cast!.kind]);
    expect((await state(guest)).floorSyncTick).toBeGreaterThanOrEqual(cast!.startTick);
    const tick = (await state(guest)).lastSnapshotTick;
    await guest.waitForFunction((tick) => window.__heavenfall.lastSnapshotTick > tick + 30, tick);
    expect(errors).toEqual([]);
  } finally { await own.close(); }
});

test('Carrier marks a native crowd, carries under host authority, and Falling Star frees the victim', async ({ page }) => {
  await encounter(page, 'carrier');
  await page.waitForFunction(() => window.__heavenfall.commanders.some((c) => c.kind === 'carry' && c.phase === 'tell'), null, { timeout: 30000 });
  await page.waitForFunction(() => window.__heavenfall.commanders.some((c) => c.phase === 'active'), null, { polling: 20, timeout: 45000 });
  await page.keyboard.press('KeyG'); // Native developer toggle: make the real grab eligible.
  const grab = await (await page.waitForFunction(() => window.__heavenfall.commanders.find((c) => c.phase === 'carry'), null, { polling: 20, timeout: 3000 })).jsonValue();
  await page.keyboard.down('KeyW');
  const carried = await (await page.waitForFunction((z) => {
    const s = window.__heavenfall, c = s.commanders.find((c) => c.phase === 'carry');
    return c && s.self.z > z + 3 ? { self: { ...s.self }, c } : null;
  }, grab!.targetZ, { polling: 20, timeout: 2000 })).jsonValue();
  await page.keyboard.up('KeyW');
  expect(Math.hypot(carried!.self.x - carried!.c.x, carried!.self.y - carried!.c.y)).toBeLessThan(1);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__heavenfall.commanders.every((c) => c.phase !== 'carry'), null, { timeout: 3000 });
  await page.keyboard.press('KeyG');
  await page.screenshot({ path: test.info().outputPath('carrier-release.png') });
  expect((await state(page)).players[0].dead).toBe(false);
});
